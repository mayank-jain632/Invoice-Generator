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
from .auth import verify_token, verify_token_optional, create_access_token, verify_credentials
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
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
@app.post("/vendors", response_model=schemas.VendorOut)
def create_vendor(payload: schemas.VendorCreate, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    existing = db.query(models.Vendor).filter(models.Vendor.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Vendor name already exists")
    vendor = models.Vendor(name=payload.name, email=payload.email)
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor

@app.get("/vendors", response_model=list[schemas.VendorOut])
def list_vendors(db: Session = Depends(get_db), username: str = Depends(verify_token)):
    return db.query(models.Vendor).order_by(models.Vendor.name.asc()).all()

@app.put("/vendors/{vendor_id}", response_model=schemas.VendorOut)
def update_vendor(vendor_id: int, payload: schemas.VendorCreate, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    vendor.name = payload.name
    vendor.email = payload.email
    db.commit()
    db.refresh(vendor)
    return vendor

@app.delete("/vendors/{vendor_id}")
def delete_vendor(vendor_id: int, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    db.delete(vendor)
    db.commit()
    return {"deleted": vendor_id}

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
        preferred_vendor_id=payload.preferred_vendor_id,
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
    emp.preferred_vendor_id = payload.preferred_vendor_id
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

@app.post("/reminders/monthly-vendor")
def send_monthly_vendor_reminder(token: str | None = None, db: Session = Depends(get_db)):
    if settings.CRON_SECRET:
        if not token or token != settings.CRON_SECRET:
            raise HTTPException(status_code=401, detail="Unauthorized")

    from datetime import date

    today = date.today()
    year = today.year
    month = today.month - 1
    if month == 0:
        month = 12
        year -= 1
    month_key = f"{year}-{month:02d}"

    vendors = db.query(models.Vendor).all()
    bcc_emails = [v.email for v in vendors if v.email]
    if not bcc_emails:
        raise HTTPException(status_code=400, detail="No vendor emails configured")

    to_email = settings.FROM_EMAIL or settings.SMTP_USER
    if not to_email:
        raise HTTPException(status_code=400, detail="FROM_EMAIL or SMTP_USER not configured")

    subject = f"Invoice request — {month_key}"
    body = f"Hi,\n\nPlease send the invoice for {month_key}.\n\nThank you."
    send_email(subject, body, to_email, bcc_emails=bcc_emails)
    return {"sent": True, "month_key": month_key, "bcc_count": len(bcc_emails)}

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
                    employee_preferred_vendor=emp.preferred_vendor.name if emp.preferred_vendor else None,
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
            employee_preferred_vendor=emp.preferred_vendor.name if emp.preferred_vendor else None,
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
def get_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    username: str = Depends(verify_token_optional),
):
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    pdf = Path(inv.pdf_path) if inv.pdf_path else None
    if not pdf or not pdf.exists():
        emp = db.query(models.Employee).filter(models.Employee.id == inv.employee_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found for invoice")
        pdf_path = generate_invoice_pdf(
            out_dir=INVOICE_DIR,
            invoice_number=inv.invoice_number,
            employee_name=emp.name,
            employee_company=emp.company,
            employee_start_date=emp.start_date,
            employee_email=emp.email,
            employee_preferred_vendor=emp.preferred_vendor.name if emp.preferred_vendor else None,
            month_key=inv.month_key,
            hours=float(inv.hours),
            rate=float(inv.rate),
            amount=float(inv.amount),
        )
        inv.pdf_path = str(pdf_path)
        db.commit()
        db.refresh(inv)
        pdf = Path(inv.pdf_path)
    return FileResponse(path=pdf, media_type="application/pdf", filename=pdf.name)

@app.get("/invoices/download_all")
def download_all_invoices(db: Session = Depends(get_db), username: str = Depends(verify_token)):
    invoices = db.query(models.Invoice).order_by(models.Invoice.created_at.desc()).all()
    if not invoices:
        raise HTTPException(status_code=404, detail="No invoices available")

    INVOICE_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = INVOICE_DIR / f"invoices_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.zip"

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for inv in invoices:
            pdf = Path(inv.pdf_path) if inv.pdf_path else None
            if not pdf or not pdf.exists():
                emp = db.query(models.Employee).filter(models.Employee.id == inv.employee_id).first()
                if not emp:
                    continue
                pdf_path = generate_invoice_pdf(
                    out_dir=INVOICE_DIR,
                    invoice_number=inv.invoice_number,
                    employee_name=emp.name,
                    employee_company=emp.company,
                    employee_start_date=emp.start_date,
                    employee_email=emp.email,
                    employee_preferred_vendor=emp.preferred_vendor.name if emp.preferred_vendor else None,
                    month_key=inv.month_key,
                    hours=float(inv.hours),
                    rate=float(inv.rate),
                    amount=float(inv.amount),
                )
                inv.pdf_path = str(pdf_path)
                db.commit()
                db.refresh(inv)
                pdf = Path(inv.pdf_path)
            if pdf and pdf.exists():
                zipf.write(pdf, arcname=pdf.name)

    return FileResponse(path=zip_path, media_type="application/zip", filename=zip_path.name)

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
                employee_preferred_vendor=inv.employee.preferred_vendor.name if inv.employee and inv.employee.preferred_vendor else None,
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
    pending_by_vendor: dict[int, dict[str, object]] = {}
    for inv_id in payload.invoice_ids:
        inv = db.query(models.Invoice).filter(models.Invoice.id == inv_id).first()
        if not inv:
            continue
        if inv.sent:
            pass

        pdf = Path(inv.pdf_path) if inv.pdf_path else None
        if not pdf or not pdf.exists():
            emp = db.query(models.Employee).filter(models.Employee.id == inv.employee_id).first()
            if not emp:
                raise HTTPException(status_code=404, detail=f"Employee not found for invoice {inv.invoice_number}")
            pdf_path = generate_invoice_pdf(
                out_dir=INVOICE_DIR,
                invoice_number=inv.invoice_number,
                employee_name=emp.name,
                employee_company=emp.company,
                employee_start_date=emp.start_date,
                employee_email=emp.email,
                employee_preferred_vendor=emp.preferred_vendor.name if emp.preferred_vendor else None,
                month_key=inv.month_key,
                hours=float(inv.hours),
                rate=float(inv.rate),
                amount=float(inv.amount),
            )
            inv.pdf_path = str(pdf_path)
            pdf = Path(inv.pdf_path)

        emp = db.query(models.Employee).filter(models.Employee.id == inv.employee_id).first()
        vendor = emp.preferred_vendor if emp else None
        if not vendor or not vendor.email:
            raise HTTPException(status_code=400, detail=f"No vendor emails for invoice {inv.invoice_number}")

        vendor_emails = [e.strip() for e in vendor.email.split(",") if e.strip()]
        if not vendor_emails:
            raise HTTPException(status_code=400, detail=f"No vendor emails for invoice {inv.invoice_number}")

        bucket = pending_by_vendor.setdefault(vendor.id, {"vendor": vendor, "attachments": [], "month_keys": set()})
        bucket["attachments"].append(pdf)
        bucket["month_keys"].add(inv.month_key)

        inv.sent = True

    if not pending_by_vendor:
        return {"sent_count": 0}

    for bucket in pending_by_vendor.values():
        vendor = bucket["vendor"]
        month_list = ", ".join(sorted(bucket["month_keys"]))
        subject = f"Invoices — {month_list}"
        body = f"Attached are the invoices for {month_list}."
        recipients = [e.strip() for e in vendor.email.split(",") if e.strip()]
        to_email = settings.FROM_EMAIL or settings.SMTP_USER
        if not to_email:
            raise HTTPException(status_code=400, detail="FROM_EMAIL or SMTP_USER not configured")
        send_email(subject, body, to_email, attachments=bucket["attachments"], bcc_emails=recipients)

    db.commit()
    total_sent = sum(len(bucket["attachments"]) for bucket in pending_by_vendor.values())
    return {"sent_count": total_sent}

# --- Analytics ---
@app.get("/analytics/company_totals", response_model=list[schemas.CompanyTotalsOut])
def company_totals(month_key: str | None = None, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    if not month_key:
        month_key = (
            db.query(func.max(models.Invoice.month_key))
            .filter(models.Invoice.sent.is_(True))
            .scalar()
        )
        if not month_key:
            return []
    company_expr = func.coalesce(models.Employee.company, "Unassigned")
    rows = (
        db.query(company_expr.label("company"), func.sum(models.Invoice.amount).label("total_amount"))
        .join(models.Invoice, models.Invoice.employee_id == models.Employee.id)
        .filter(models.Invoice.month_key == month_key, models.Invoice.sent.is_(True))
        .group_by(company_expr)
        .order_by(company_expr.asc())
        .all()
    )

    totals = []
    for company, total in rows:
        payment = (
            db.query(models.CompanyPayment)
            .filter(models.CompanyPayment.company == company, models.CompanyPayment.month_key == month_key)
            .first()
        )
        totals.append({
            "company": company,
            "month_key": month_key,
            "total_amount": float(total or 0),
            "paid": bool(payment.paid) if payment else False,
        })
    return totals

@app.post("/analytics/company_totals/mark_paid")
def mark_company_paid(payload: schemas.CompanyTotalsIn, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    record = (
        db.query(models.CompanyPayment)
        .filter(models.CompanyPayment.company == payload.company, models.CompanyPayment.month_key == payload.month_key)
        .first()
    )
    if not record:
        record = models.CompanyPayment(company=payload.company, month_key=payload.month_key, paid=False)
        db.add(record)
    record.paid = payload.paid
    record.paid_at = datetime.utcnow() if payload.paid else None
    db.commit()
    return {"company": payload.company, "month_key": payload.month_key, "paid": record.paid}

@app.get("/analytics/earnings", response_model=list[schemas.EarningsPoint])
def earnings(db: Session = Depends(get_db), username: str = Depends(verify_token)):
    rows = (
        db.query(models.Invoice.month_key, func.sum(models.Invoice.amount).label("total_amount"))
        .filter(models.Invoice.sent.is_(True))
        .group_by(models.Invoice.month_key)
        .order_by(models.Invoice.month_key.asc())
        .all()
    )
    return [{"month_key": month_key, "total_amount": float(total or 0)} for month_key, total in rows]
import zipfile
