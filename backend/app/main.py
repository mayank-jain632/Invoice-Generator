from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
from pathlib import Path
import logging
import sys
import os

from .db import Base, engine, get_db
from . import models, schemas
from .invoice_pdf import generate_invoice_pdf
from .emailer import send_timesheet_reminder, send_email
from .settings import settings
from .auth import verify_token, create_access_token, verify_credentials
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        # Only log to file if not on Vercel (Vercel uses /tmp which is ephemeral)
    ] if not os.getenv("VERCEL") else [logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Only create tables if not on Vercel (tables created once, not on each function invoke)
if not os.getenv("VERCEL"):
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.warning(f"Could not create tables on startup: {e}")

app = FastAPI(
    title="Invoice Automation API",
    debug=settings.DEBUG,
    root_path="/api" if os.getenv("VERCEL") else ""
)

# CORS configuration - must be before other middleware
allowed_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",")]
logger.info(f"CORS enabled for origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=600,
)

# Use /tmp for serverless (Vercel), otherwise local directory
import os
if os.getenv("VERCEL"):
    INVOICE_DIR = Path("/tmp/generated_invoices")
else:
    INVOICE_DIR = Path("./generated_invoices")

def invoice_number_for(employee_id: int, month_key: str) -> str:
    # simple deterministic-ish format; swap with your own numbering rules
    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    return f"INV-{month_key.replace('-', '')}-{employee_id}-{ts}"

@app.get("/health")
def health():
    return {"ok": True, "env": os.getenv("VERCEL", "local")}

# --- Auth ---
class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/auth/login")
def login(credentials: LoginRequest):
    if verify_credentials(credentials.username, credentials.password):
        access_token = create_access_token(data={"sub": credentials.username})
        return {"access_token": access_token, "token_type": "bearer"}
    raise HTTPException(status_code=401, detail="Invalid username or password")

# --- Employees ---
@app.post("/employees", response_model=schemas.EmployeeOut)
def create_employee(payload: schemas.EmployeeCreate, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    existing = db.query(models.Employee).filter(models.Employee.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Employee name already exists")
    emp = models.Employee(
        name=payload.name,
        hourly_rate=payload.hourly_rate,
        email=payload.email,
        start_date=payload.start_date,
        company=payload.company,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    logger.info(f"Created employee: {emp.name} (ID: {emp.id})")
    return emp

@app.get("/employees", response_model=list[schemas.EmployeeOut])
def list_employees(db: Session = Depends(get_db), username: str = Depends(verify_token)):
    try:
        employees = db.query(models.Employee).order_by(models.Employee.name.asc()).all()
        logger.info(f"Retrieved {len(employees)} employees")
        return employees
    except Exception as e:
        logger.error(f"Error fetching employees: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.put("/employees/{employee_id}")
def update_employee(employee_id: int, payload: schemas.EmployeeCreate, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp.name = payload.name
    emp.hourly_rate = payload.hourly_rate
    emp.email = payload.email
    emp.start_date = payload.start_date
    emp.company = payload.company
    db.commit()
    db.refresh(emp)
    return emp

@app.delete("/employees/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    db.delete(emp)
    db.commit()
    return {"deleted": employee_id}

@app.get("/employees/{employee_id}/monthly_hours/{month_key}")
def get_monthly_hours(employee_id: int, month_key: str, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    month = (
        db.query(models.EmployeeMonth)
        .filter(models.EmployeeMonth.employee_id == employee_id, models.EmployeeMonth.month_key == month_key)
        .first()
    )
    return {"employee_id": employee_id, "month_key": month_key, "hours": month.hours if month else 0.0}

# --- Reminders ---
@app.post("/reminders/send")
def send_reminder(month_key: str):
    if not settings.REMINDER_TO_EMAIL:
        raise HTTPException(status_code=400, detail="REMINDER_TO_EMAIL not configured")
    send_timesheet_reminder(month_key)
    return {"sent": True, "month_key": month_key}

# --- Timesheet ingestion ---
@app.post("/timesheets/ingest")
def ingest_timesheet(payload: schemas.TimesheetIn, db: Session = Depends(get_db)):
    # payload.rows: [{name, hours}]
    updated = []
    for row in payload.rows:
        emp = db.query(models.Employee).filter(models.Employee.name == row.name).first()
        if not emp:
            raise HTTPException(status_code=404, detail=f"Unknown employee: {row.name}")

        # update month hours
        month = (
            db.query(models.EmployeeMonth)
            .filter(models.EmployeeMonth.employee_id == emp.id, models.EmployeeMonth.month_key == payload.month_key)
            .first()
        )
        if not month:
            month = models.EmployeeMonth(employee_id=emp.id, month_key=payload.month_key, hours=0.0)
            db.add(month)

        # add new hours
        month.hours = float(month.hours) + float(row.hours)
        month.updated_at = datetime.utcnow()

        # update lifetime
        emp.lifetime_hours = float(emp.lifetime_hours) + float(row.hours)

        updated.append({"employee": emp.name, "added_hours": row.hours, "month_total": month.hours})

    db.commit()
    return {"month_key": payload.month_key, "updated": updated}

# --- Invoice generation ---
@app.post("/invoices/generate", response_model=list[schemas.InvoiceOut])
def generate_invoices(payload: schemas.InvoiceCreateIn, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    invoices_out = []
    for emp_id in payload.employee_ids:
        emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail=f"Employee id not found: {emp_id}")

        # prevent duplicate invoices for same employee/month
        existing = (
            db.query(models.Invoice)
            .filter(models.Invoice.employee_id == emp_id, models.Invoice.month_key == payload.month_key)
            .first()
        )
        if existing:
            # If PDF missing, regenerate and update
            pdf_missing = not existing.pdf_path or not Path(existing.pdf_path).exists()
            if pdf_missing:
                pdf_path = generate_invoice_pdf(
                    out_dir=INVOICE_DIR,
                    invoice_number=existing.invoice_number,
                    employee_name=emp.name,
                    employee_company=emp.company,
                    employee_start_date=emp.start_date,
                    employee_email=emp.email,
                    month_key=payload.month_key,
                    hours=float(existing.hours),
                    rate=float(existing.rate),
                    amount=float(existing.amount),
                )
                existing.pdf_path = str(pdf_path)
                db.commit()
                db.refresh(existing)
            invoices_out.append(existing)
            continue

        month = (
            db.query(models.EmployeeMonth)
            .filter(models.EmployeeMonth.employee_id == emp_id, models.EmployeeMonth.month_key == payload.month_key)
            .first()
        )
        if not month or month.hours <= 0:
            raise HTTPException(status_code=400, detail=f"No hours for {emp.name} in {payload.month_key}")

        inv_no = invoice_number_for(emp_id, payload.month_key)
        hours = float(month.hours)
        rate = float(emp.hourly_rate)
        amount = hours * rate

        pdf_path = generate_invoice_pdf(
            out_dir=INVOICE_DIR,
            invoice_number=inv_no,
            employee_name=emp.name,
            employee_company=emp.company,
            employee_start_date=emp.start_date,
            employee_email=emp.email,
            month_key=payload.month_key,
            hours=hours,
            rate=rate,
            amount=amount,
        )

        inv = models.Invoice(
            employee_id=emp_id,
            month_key=payload.month_key,
            hours=hours,
            rate=rate,
            amount=amount,
            invoice_number=inv_no,
            pdf_path=str(pdf_path),
            approved=False,
            sent=False,
        )
        db.add(inv)
        try:
            db.commit()
            db.refresh(inv)
            invoices_out.append(inv)
        except IntegrityError:
            db.rollback()
            existing = (
                db.query(models.Invoice)
                .filter(models.Invoice.employee_id == emp_id, models.Invoice.month_key == payload.month_key)
                .first()
            )
            if existing:
                invoices_out.append(existing)
            else:
                raise HTTPException(status_code=500, detail="Could not create or fetch invoice")

    return invoices_out

@app.get("/invoices", response_model=list[schemas.InvoiceOut])
def list_invoices(db: Session = Depends(get_db), username: str = Depends(verify_token)):
    return db.query(models.Invoice).order_by(models.Invoice.created_at.desc()).all()

@app.get("/invoices/{invoice_id}/pdf")
def get_invoice_pdf(invoice_id: int, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not inv.pdf_path:
        raise HTTPException(status_code=404, detail="No PDF available for this invoice")
    pdf = Path(inv.pdf_path)
    if not pdf.exists():
        raise HTTPException(status_code=404, detail="PDF file missing")
    return FileResponse(path=pdf, media_type="application/pdf", filename=pdf.name)

@app.post("/invoices/regenerate_pdfs")
def regenerate_pdfs(db: Session = Depends(get_db), username: str = Depends(verify_token)):
    regenerated = 0
    missing = 0
    for inv in db.query(models.Invoice).all():
        target = Path(inv.pdf_path) if inv.pdf_path else None
        if not target or not target.exists():
            missing += 1
            pdf_path = generate_invoice_pdf(
                out_dir=INVOICE_DIR,
                invoice_number=inv.invoice_number,
                employee_name=inv.employee.name if inv.employee else "Employee",
                employee_company=inv.employee.company if inv.employee else None,
                employee_start_date=inv.employee.start_date if inv.employee else None,
                employee_email=inv.employee.email if inv.employee else None,
                month_key=inv.month_key,
                hours=float(inv.hours),
                rate=float(inv.rate),
                amount=float(inv.amount),
            )
            inv.pdf_path = str(pdf_path)
            regenerated += 1
    db.commit()
    return {"regenerated": regenerated, "missing_before": missing, "total": db.query(models.Invoice).count()}

@app.post("/invoices/approve")
def approve_invoices(payload: schemas.ApproveIn, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    found = 0
    for inv_id in payload.invoice_ids:
        inv = db.query(models.Invoice).filter(models.Invoice.id == inv_id).first()
        if not inv:
            continue
        inv.approved = True
        found += 1
    db.commit()
    return {"approved_count": found}

@app.post("/invoices/send")
def send_invoices(payload: schemas.SendIn, db: Session = Depends(get_db)):
    recipients = [e.strip() for e in payload.to_emails if e and e.strip()]
    if not recipients:
        raise HTTPException(status_code=400, detail="At least one recipient email is required")

    pending: list[tuple[models.Invoice, Path]] = []
    month_keys: set[str] = set()
    for inv_id in payload.invoice_ids:
        inv = db.query(models.Invoice).filter(models.Invoice.id == inv_id).first()
        if not inv:
            continue
        if not inv.approved:
            raise HTTPException(status_code=400, detail=f"Invoice {inv.invoice_number} is not approved")
        if inv.sent:
            continue

        pdf = Path(inv.pdf_path) if inv.pdf_path else None
        if not pdf or not pdf.exists():
            raise HTTPException(status_code=500, detail=f"Missing PDF for invoice {inv.invoice_number}")

        pending.append((inv, pdf))
        month_keys.add(inv.month_key)

    if not pending:
        return {"sent_count": 0}

    month_list = ", ".join(sorted(month_keys))
    subject = f"Invoices — {month_list}"
    body = f"Attached are the invoices for {month_list}."
    send_email(subject, body, recipients, attachments=[p for _, p in pending])

    for inv, _ in pending:
        inv.sent = True

    db.commit()
    return {"sent_count": len(pending)}
