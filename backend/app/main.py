import logging
import os
import sys
from datetime import datetime
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models, schemas
from .auth import create_access_token, verify_credentials, verify_token, verify_token_optional
from .db import Base, engine, get_db
from .emailer import send_email
from .invoice_pdf import generate_combined_invoice_pdf
from .settings import settings


logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

if not os.getenv("VERCEL"):
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logger.warning("Could not create tables on startup: %s", exc)

app = FastAPI(
    title="InvoiceFlow Workbook API",
    debug=settings.DEBUG,
    root_path="/api" if os.getenv("VERCEL") else "",
)

allowed_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=600,
)

INVOICE_DIR = Path("/tmp/generated_invoices") if os.getenv("VERCEL") else Path("./generated_invoices")


def invoice_number_for(sheet_id: int, month_key: str) -> str:
    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    return f"WB-{month_key.replace('-', '')}-{sheet_id}-{ts}"


def parse_recipients(recipients: list[str]) -> list[str]:
    cleaned: list[str] = []
    for entry in recipients:
        for item in entry.split(","):
            email = item.strip()
            if email and email not in cleaned:
                cleaned.append(email)
    return cleaned


def require_name(value: str, label: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail=f"{label} name is required")
    return normalized


def find_vendor_by_name(db: Session, name: str) -> models.Vendor | None:
    return db.query(models.Vendor).filter(func.lower(models.Vendor.name) == name.strip().lower()).first()


def find_company_by_name(db: Session, name: str) -> models.Company | None:
    return db.query(models.Company).filter(func.lower(models.Company.name) == name.strip().lower()).first()


def find_employee_by_name(db: Session, name: str) -> models.Employee | None:
    return db.query(models.Employee).filter(func.lower(models.Employee.name) == name.strip().lower()).first()


def create_employee_stub(db: Session, name: str, rate: float = 0.0) -> models.Employee:
    employee = models.Employee(name=name.strip(), hourly_rate=float(rate or 0))
    db.add(employee)
    db.flush()
    return employee


def serialize_invoice(inv: models.CombinedInvoice) -> schemas.CombinedInvoiceOut:
    return schemas.CombinedInvoiceOut(
        id=inv.id,
        pair_sheet_id=inv.pair_sheet_id,
        month_key=inv.month_key,
        invoice_number=inv.invoice_number,
        total_amount=float(inv.total_amount or 0),
        sent=bool(inv.sent),
        paid=bool(inv.paid),
        manual_recipients=inv.manual_recipients,
        created_at=inv.created_at.isoformat() if inv.created_at else "",
        sent_at=inv.sent_at.isoformat() if inv.sent_at else None,
        paid_at=inv.paid_at.isoformat() if inv.paid_at else None,
    )


def get_pair_sheet_out(db: Session, pair_sheet: models.PairSheet, month_key: str | None) -> schemas.PairSheetOut:
    rows_query = db.query(models.SheetRow).filter(models.SheetRow.pair_sheet_id == pair_sheet.id)
    invoice = None
    row_count = 0
    month_total = 0.0
    if month_key:
        rows = rows_query.filter(models.SheetRow.month_key == month_key).all()
        invoice = (
            db.query(models.CombinedInvoice)
            .filter(models.CombinedInvoice.pair_sheet_id == pair_sheet.id, models.CombinedInvoice.month_key == month_key)
            .first()
        )
        row_count = len(build_visible_rows(db, pair_sheet, month_key, invoice))
        month_total = sum(float(row.hours or 0) * float(row.rate or 0) for row in rows)

    return schemas.PairSheetOut(
        id=pair_sheet.id,
        vendor_id=pair_sheet.vendor_id,
        company_id=pair_sheet.company_id,
        vendor_name=pair_sheet.vendor.name,
        company_name=pair_sheet.company.name,
        month_total=month_total,
        row_count=row_count,
        invoice_id=invoice.id if invoice else None,
        invoice_sent=bool(invoice.sent) if invoice else False,
        invoice_paid=bool(invoice.paid) if invoice else False,
    )


def serialize_row(row: models.SheetRow, invoice: models.CombinedInvoice | None) -> schemas.SheetRowOut:
    amount = float(row.hours or 0) * float(row.rate or 0)
    invoice_status = "sent" if invoice and invoice.sent else "draft"
    paid_status = "paid" if invoice and invoice.paid else "open"
    return schemas.SheetRowOut(
        id=row.id,
        employee_id=row.employee_id,
        employee_name=row.employee.name,
        role=row.role,
        notes=row.notes,
        hours=float(row.hours or 0),
        rate=float(row.rate or 0),
        amount=amount,
        comments=row.comments,
        sort_order=row.sort_order,
        invoice_status=invoice_status,
        paid_status=paid_status,
    )


def synthetic_row(
    employee: models.Employee,
    sort_order: int,
    invoice: models.CombinedInvoice | None,
    role: str | None = None,
    notes: str | None = None,
) -> schemas.SheetRowOut:
    invoice_status = "sent" if invoice and invoice.sent else "draft"
    paid_status = "paid" if invoice and invoice.paid else "open"
    return schemas.SheetRowOut(
        id=None,
        employee_id=employee.id,
        employee_name=employee.name,
        role=role,
        notes=notes,
        hours=0.0,
        rate=float(employee.hourly_rate or 0),
        amount=0.0,
        comments=None,
        sort_order=sort_order,
        invoice_status=invoice_status,
        paid_status=paid_status,
    )


def build_visible_rows(
    db: Session,
    pair_sheet: models.PairSheet,
    month_key: str,
    invoice: models.CombinedInvoice | None,
) -> list[schemas.SheetRowOut]:
    current_rows = (
        db.query(models.SheetRow)
        .filter(models.SheetRow.pair_sheet_id == pair_sheet.id, models.SheetRow.month_key == month_key)
        .order_by(models.SheetRow.sort_order.asc(), models.SheetRow.id.asc())
        .all()
    )
    visible_rows = [serialize_row(row, invoice) for row in current_rows]
    seen_employee_ids = {row.employee_id for row in current_rows}

    historical_defaults: dict[int, models.SheetRow] = {}
    historical_rows = (
        db.query(models.SheetRow)
        .filter(models.SheetRow.pair_sheet_id == pair_sheet.id)
        .order_by(models.SheetRow.updated_at.desc(), models.SheetRow.id.desc())
        .all()
    )
    for historical_row in historical_rows:
        if historical_row.employee_id in seen_employee_ids or historical_row.employee_id in historical_defaults:
            continue
        historical_defaults[historical_row.employee_id] = historical_row

    for historical_row in sorted(historical_defaults.values(), key=lambda item: item.employee.name.lower()):
        visible_rows.append(
            synthetic_row(
                employee=historical_row.employee,
                sort_order=len(visible_rows),
                invoice=invoice,
                role=historical_row.role,
                notes=historical_row.notes,
            )
        )

    return visible_rows


def resolve_employee(db: Session, row_in: schemas.SheetRowIn) -> models.Employee:
    employee = None
    if row_in.employee_id:
        employee = db.query(models.Employee).filter(models.Employee.id == row_in.employee_id).first()
    elif row_in.employee_name:
        employee = find_employee_by_name(db, row_in.employee_name)
        if not employee and row_in.employee_name.strip():
            employee = create_employee_stub(db, row_in.employee_name, row_in.rate)
    if not employee:
        raise HTTPException(status_code=400, detail=f"Unknown employee reference: {row_in.employee_name or row_in.employee_id}")
    return employee


def is_empty_row(row_in: schemas.SheetRowIn) -> bool:
    return not any(
        [
            row_in.employee_id,
            row_in.employee_name,
            row_in.role,
            row_in.notes,
            row_in.comments,
            float(row_in.hours or 0),
            float(row_in.rate or 0),
        ]
    )


def regenerate_invoice_pdf(db: Session, invoice: models.CombinedInvoice) -> Path:
    pair_sheet = db.query(models.PairSheet).filter(models.PairSheet.id == invoice.pair_sheet_id).first()
    if not pair_sheet:
        raise HTTPException(status_code=404, detail="Pair sheet not found")

    lines = [
        {
            "employee_name": line.employee_name,
            "role": line.role,
            "notes": line.notes,
            "hours": float(line.hours or 0),
            "rate": float(line.rate or 0),
            "amount": float(line.amount or 0),
            "comments": line.comments,
        }
        for line in sorted(invoice.lines, key=lambda item: item.sort_order)
    ]
    pdf_path = generate_combined_invoice_pdf(
        out_dir=INVOICE_DIR,
        invoice_number=invoice.invoice_number,
        vendor_name=pair_sheet.vendor.name,
        company_name=pair_sheet.company.name,
        company_address=pair_sheet.company.address,
        month_key=invoice.month_key,
        lines=lines,
        total_amount=float(invoice.total_amount or 0),
    )
    invoice.pdf_path = str(pdf_path)
    invoice.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(invoice)
    return pdf_path


def build_invoice_from_sheet(db: Session, pair_sheet: models.PairSheet, month_key: str) -> models.CombinedInvoice:
    rows = (
        db.query(models.SheetRow)
        .filter(models.SheetRow.pair_sheet_id == pair_sheet.id, models.SheetRow.month_key == month_key)
        .order_by(models.SheetRow.sort_order.asc(), models.SheetRow.id.asc())
        .all()
    )
    if not rows:
        raise HTTPException(status_code=400, detail="This sheet has no rows for the selected month")

    total_amount = sum(float(row.hours or 0) * float(row.rate or 0) for row in rows)
    invoice = (
        db.query(models.CombinedInvoice)
        .filter(models.CombinedInvoice.pair_sheet_id == pair_sheet.id, models.CombinedInvoice.month_key == month_key)
        .first()
    )
    if not invoice:
        invoice = models.CombinedInvoice(
            pair_sheet_id=pair_sheet.id,
            month_key=month_key,
            invoice_number=invoice_number_for(pair_sheet.id, month_key),
            total_amount=total_amount,
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
    else:
        invoice.total_amount = total_amount
        invoice.updated_at = datetime.utcnow()
        for line in list(invoice.lines):
            db.delete(line)
        db.flush()

    for idx, row in enumerate(rows):
        amount = float(row.hours or 0) * float(row.rate or 0)
        db.add(
            models.CombinedInvoiceLine(
                combined_invoice_id=invoice.id,
                employee_id=row.employee_id,
                employee_name=row.employee.name,
                role=row.role,
                notes=row.notes,
                hours=row.hours,
                rate=row.rate,
                amount=amount,
                comments=row.comments,
                sort_order=idx,
            )
        )

    db.commit()
    db.refresh(invoice)
    pdf_path = regenerate_invoice_pdf(db, invoice)
    invoice.pdf_path = str(pdf_path)
    invoice.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(invoice)
    return invoice


class LoginRequest(BaseModel):
    username: str
    password: str


@app.get("/health")
def health():
    return {"ok": True, "env": os.getenv("VERCEL", "local")}


@app.post("/auth/login")
def login(credentials: LoginRequest):
    if verify_credentials(credentials.username, credentials.password):
        access_token = create_access_token(data={"sub": credentials.username})
        return {"access_token": access_token, "token_type": "bearer"}
    raise HTTPException(status_code=401, detail="Invalid username or password")


@app.get("/vendors", response_model=list[schemas.VendorOut])
def list_vendors(db: Session = Depends(get_db), username: str = Depends(verify_token)):
    return db.query(models.Vendor).order_by(models.Vendor.name.asc()).all()


@app.post("/vendors", response_model=schemas.VendorOut)
def create_vendor(payload: schemas.VendorCreate, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    name = require_name(payload.name, "Vendor")
    existing = find_vendor_by_name(db, name)
    if existing:
        raise HTTPException(status_code=409, detail="Vendor name already exists")
    vendor = models.Vendor(name=name, email=payload.email)
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor


@app.put("/vendors/{vendor_id}", response_model=schemas.VendorOut)
def update_vendor(vendor_id: int, payload: schemas.VendorCreate, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    name = require_name(payload.name, "Vendor")
    existing = find_vendor_by_name(db, name)
    if existing and existing.id != vendor_id:
        raise HTTPException(status_code=409, detail="Vendor name already exists")
    vendor.name = name
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


@app.get("/companies", response_model=list[schemas.CompanyOut])
def list_companies(db: Session = Depends(get_db), username: str = Depends(verify_token)):
    return db.query(models.Company).order_by(models.Company.name.asc()).all()


@app.post("/companies", response_model=schemas.CompanyOut)
def create_company(payload: schemas.CompanyCreate, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    name = require_name(payload.name, "Company")
    existing = find_company_by_name(db, name)
    if existing:
        raise HTTPException(status_code=409, detail="Company name already exists")
    company = models.Company(name=name, address=payload.address)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@app.put("/companies/{company_id}", response_model=schemas.CompanyOut)
def update_company(company_id: int, payload: schemas.CompanyCreate, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    name = require_name(payload.name, "Company")
    existing = find_company_by_name(db, name)
    if existing and existing.id != company_id:
        raise HTTPException(status_code=409, detail="Company name already exists")
    company.name = name
    company.address = payload.address
    db.commit()
    db.refresh(company)
    return company


@app.delete("/companies/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    db.delete(company)
    db.commit()
    return {"deleted": company_id}


@app.get("/employees", response_model=list[schemas.EmployeeOut])
def list_employees(db: Session = Depends(get_db), username: str = Depends(verify_token)):
    return db.query(models.Employee).order_by(models.Employee.name.asc()).all()


@app.post("/employees", response_model=schemas.EmployeeOut)
def create_employee(payload: schemas.EmployeeCreate, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    name = require_name(payload.name, "Employee")
    existing = find_employee_by_name(db, name)
    if existing:
        raise HTTPException(status_code=409, detail="Employee name already exists")
    employee = models.Employee(
        name=name,
        hourly_rate=payload.hourly_rate,
        email=payload.email,
        start_date=payload.start_date,
        notes=payload.notes,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@app.put("/employees/{employee_id}", response_model=schemas.EmployeeOut)
def update_employee(employee_id: int, payload: schemas.EmployeeCreate, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    name = require_name(payload.name, "Employee")
    existing = find_employee_by_name(db, name)
    if existing and existing.id != employee_id:
        raise HTTPException(status_code=409, detail="Employee name already exists")
    employee.name = name
    employee.hourly_rate = payload.hourly_rate
    employee.email = payload.email
    employee.start_date = payload.start_date
    employee.notes = payload.notes
    db.commit()
    db.refresh(employee)
    return employee


@app.delete("/employees/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    db.delete(employee)
    db.commit()
    return {"deleted": employee_id}


@app.get("/workbook/sheets", response_model=list[schemas.PairSheetOut])
def list_pair_sheets(
    month_key: str | None = None,
    vendor_id: int | None = None,
    company_id: int | None = None,
    db: Session = Depends(get_db),
    username: str = Depends(verify_token),
):
    query = db.query(models.PairSheet)
    if vendor_id:
        query = query.filter(models.PairSheet.vendor_id == vendor_id)
    if company_id:
        query = query.filter(models.PairSheet.company_id == company_id)
    sheets = query.order_by(models.PairSheet.id.asc()).all()
    return [get_pair_sheet_out(db, sheet, month_key) for sheet in sheets]


@app.post("/workbook/sheets", response_model=schemas.PairSheetOut)
def create_pair_sheet(payload: schemas.PairSheetCreate, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    existing = (
        db.query(models.PairSheet)
        .filter(models.PairSheet.vendor_id == payload.vendor_id, models.PairSheet.company_id == payload.company_id)
        .first()
    )
    if existing:
        return get_pair_sheet_out(db, existing, None)
    sheet = models.PairSheet(vendor_id=payload.vendor_id, company_id=payload.company_id)
    db.add(sheet)
    db.commit()
    db.refresh(sheet)
    return get_pair_sheet_out(db, sheet, None)


@app.get("/workbook/sheets/{sheet_id}", response_model=schemas.WorkbookSheetDetailOut)
def get_pair_sheet(
    sheet_id: int,
    month_key: str,
    db: Session = Depends(get_db),
    username: str = Depends(verify_token),
):
    sheet = db.query(models.PairSheet).filter(models.PairSheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    invoice = (
        db.query(models.CombinedInvoice)
        .filter(models.CombinedInvoice.pair_sheet_id == sheet_id, models.CombinedInvoice.month_key == month_key)
        .first()
    )
    return schemas.WorkbookSheetDetailOut(
        sheet=get_pair_sheet_out(db, sheet, month_key),
        month_key=month_key,
        rows=build_visible_rows(db, sheet, month_key, invoice),
        invoice=serialize_invoice(invoice) if invoice else None,
    )


@app.put("/workbook/sheets/{sheet_id}", response_model=schemas.WorkbookSheetDetailOut)
def save_pair_sheet(
    sheet_id: int,
    month_key: str,
    payload: schemas.WorkbookSheetSaveIn,
    db: Session = Depends(get_db),
    username: str = Depends(verify_token),
):
    sheet = db.query(models.PairSheet).filter(models.PairSheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    existing_rows = (
        db.query(models.SheetRow)
        .filter(models.SheetRow.pair_sheet_id == sheet_id, models.SheetRow.month_key == month_key)
        .all()
    )
    existing_map = {row.id: row for row in existing_rows}
    keep_ids: set[int] = set()
    now = datetime.utcnow()

    for idx, row_in in enumerate(payload.rows):
        if is_empty_row(row_in):
            continue
        employee = resolve_employee(db, row_in)
        row = existing_map.get(row_in.id) if row_in.id else None
        if not row:
            row = models.SheetRow(pair_sheet_id=sheet_id, month_key=month_key, created_at=now)
            db.add(row)
        row.employee_id = employee.id
        row.role = row_in.role
        row.notes = row_in.notes
        row.hours = float(row_in.hours or 0)
        row.rate = float(row_in.rate or employee.hourly_rate or 0)
        row.comments = row_in.comments
        row.sort_order = idx
        row.updated_at = now
        db.flush()
        keep_ids.add(row.id)

    for row in existing_rows:
        if row.id not in keep_ids:
            db.delete(row)

    db.flush()

    invoice = (
        db.query(models.CombinedInvoice)
        .filter(models.CombinedInvoice.pair_sheet_id == sheet_id, models.CombinedInvoice.month_key == month_key)
        .first()
    )
    if invoice:
        remaining_total = sum(
            float(row.hours or 0) * float(row.rate or 0)
            for row in db.query(models.SheetRow)
            .filter(models.SheetRow.pair_sheet_id == sheet_id, models.SheetRow.month_key == month_key)
            .all()
        )
        invoice.sent = False
        invoice.paid = False
        invoice.manual_recipients = None
        invoice.sent_at = None
        invoice.paid_at = None
        invoice.total_amount = remaining_total
        invoice.pdf_path = None
        invoice.updated_at = now
        for line in list(invoice.lines):
            db.delete(line)

    db.commit()
    return get_pair_sheet(sheet_id=sheet_id, month_key=month_key, db=db, username=username)


@app.post("/workbook/sheets/{sheet_id}/invoice/generate", response_model=schemas.CombinedInvoiceOut)
def generate_sheet_invoice(
    sheet_id: int,
    month_key: str,
    db: Session = Depends(get_db),
    username: str = Depends(verify_token),
):
    sheet = db.query(models.PairSheet).filter(models.PairSheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    invoice = build_invoice_from_sheet(db, sheet, month_key)
    return serialize_invoice(invoice)


@app.post("/combined-invoices/{invoice_id}/send", response_model=schemas.CombinedInvoiceOut)
def send_combined_invoice(
    invoice_id: int,
    payload: schemas.CombinedInvoiceSendIn,
    db: Session = Depends(get_db),
    username: str = Depends(verify_token),
):
    invoice = db.query(models.CombinedInvoice).filter(models.CombinedInvoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    recipients = parse_recipients(payload.recipients)
    if not recipients:
        raise HTTPException(status_code=400, detail="At least one recipient is required")

    pdf = Path(invoice.pdf_path) if invoice.pdf_path else None
    if not pdf or not pdf.exists():
        pdf = regenerate_invoice_pdf(db, invoice)

    pair_sheet = db.query(models.PairSheet).filter(models.PairSheet.id == invoice.pair_sheet_id).first()
    if not pair_sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    subject = f"Invoices — {invoice.month_key}"
    body = (
        "Hi all,\n\n"
        f"Please find attached the invoices for {invoice.month_key}.\n\n"
        f"Thanks,\n{pair_sheet.company.name}"
    )
    send_email(subject, body, recipients, attachments=[pdf])

    invoice.sent = True
    invoice.manual_recipients = ", ".join(recipients)
    invoice.sent_at = datetime.utcnow()
    invoice.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(invoice)
    return serialize_invoice(invoice)


@app.post("/combined-invoices/{invoice_id}/paid", response_model=schemas.CombinedInvoiceOut)
def toggle_invoice_paid(
    invoice_id: int,
    payload: schemas.PaidToggleIn,
    db: Session = Depends(get_db),
    username: str = Depends(verify_token),
):
    invoice = db.query(models.CombinedInvoice).filter(models.CombinedInvoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice.paid = payload.paid
    invoice.paid_at = datetime.utcnow() if payload.paid else None
    invoice.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(invoice)
    return serialize_invoice(invoice)


@app.get("/combined-invoices/{invoice_id}/pdf")
def get_combined_invoice_pdf(
    invoice_id: int,
    token: str | None = None,
    db: Session = Depends(get_db),
    username: str = Depends(verify_token_optional),
):
    invoice = db.query(models.CombinedInvoice).filter(models.CombinedInvoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    pdf = Path(invoice.pdf_path) if invoice.pdf_path else None
    if not pdf or not pdf.exists():
        pdf = regenerate_invoice_pdf(db, invoice)
    return FileResponse(path=pdf, media_type="application/pdf", filename=pdf.name)


@app.get("/analytics/summary", response_model=list[schemas.SummaryCardOut])
def analytics_summary(month_key: str | None = None, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    query = db.query(models.CombinedInvoice)
    if month_key:
        query = query.filter(models.CombinedInvoice.month_key == month_key)
    invoices = query.all()
    total_billed = sum(float(inv.total_amount or 0) for inv in invoices)
    total_paid = sum(float(inv.total_amount or 0) for inv in invoices if inv.paid)
    total_sent = sum(float(inv.total_amount or 0) for inv in invoices if inv.sent)
    return [
        schemas.SummaryCardOut(label="Billed", value=total_billed),
        schemas.SummaryCardOut(label="Sent", value=total_sent),
        schemas.SummaryCardOut(label="Paid", value=total_paid),
        schemas.SummaryCardOut(label="Outstanding", value=total_billed - total_paid),
    ]


@app.get("/analytics/company-balances", response_model=list[schemas.CompanyBalanceOut])
def company_balances(month_key: str | None = None, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    query = db.query(models.CombinedInvoice)
    if month_key:
        query = query.filter(models.CombinedInvoice.month_key == month_key)
    invoices = query.all()
    grouped: dict[str, schemas.CompanyBalanceOut] = {}
    for invoice in invoices:
        pair_sheet = invoice.pair_sheet
        company_name = pair_sheet.company.name
        current = grouped.get(company_name)
        amount = float(invoice.total_amount or 0)
        if not current:
            current = schemas.CompanyBalanceOut(
                company=company_name,
                total_amount=0.0,
                paid_amount=0.0,
                outstanding_amount=0.0,
            )
            grouped[company_name] = current
        current.total_amount += amount
        if invoice.paid:
            current.paid_amount += amount
        current.outstanding_amount = current.total_amount - current.paid_amount
    return list(sorted(grouped.values(), key=lambda item: item.company.lower()))


@app.get("/analytics/vendor-balances", response_model=list[schemas.VendorBalanceOut])
def vendor_balances(month_key: str | None = None, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    query = db.query(models.CombinedInvoice)
    if month_key:
        query = query.filter(models.CombinedInvoice.month_key == month_key)
    invoices = query.all()
    grouped: dict[str, schemas.VendorBalanceOut] = {}
    for invoice in invoices:
        vendor_name = invoice.pair_sheet.vendor.name
        current = grouped.get(vendor_name)
        amount = float(invoice.total_amount or 0)
        if not current:
            current = schemas.VendorBalanceOut(vendor=vendor_name, total_amount=0.0, sent_count=0)
            grouped[vendor_name] = current
        current.total_amount += amount
        if invoice.sent:
            current.sent_count += 1
    return list(sorted(grouped.values(), key=lambda item: item.vendor.lower()))


@app.get("/analytics/pair-balances", response_model=list[schemas.PairBalanceOut])
def pair_balances(month_key: str | None = None, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    query = db.query(models.CombinedInvoice)
    if month_key:
        query = query.filter(models.CombinedInvoice.month_key == month_key)
    invoices = query.order_by(models.CombinedInvoice.month_key.desc(), models.CombinedInvoice.created_at.desc()).all()
    return [
        schemas.PairBalanceOut(
            invoice_id=invoice.id,
            pair_sheet_id=invoice.pair_sheet_id,
            vendor_name=invoice.pair_sheet.vendor.name,
            company_name=invoice.pair_sheet.company.name,
            month_key=invoice.month_key,
            total_amount=float(invoice.total_amount or 0),
            sent=bool(invoice.sent),
            paid=bool(invoice.paid),
        )
        for invoice in invoices
    ]


@app.get("/analytics/earnings", response_model=list[schemas.EarningsPoint])
def earnings(db: Session = Depends(get_db), username: str = Depends(verify_token)):
    invoices = db.query(models.CombinedInvoice).all()
    grouped: dict[str, float] = {}
    for invoice in invoices:
        grouped[invoice.month_key] = grouped.get(invoice.month_key, 0.0) + float(invoice.total_amount or 0)
    return [
        schemas.EarningsPoint(month_key=month_key, total_amount=grouped[month_key])
        for month_key in sorted(grouped.keys())
    ]
