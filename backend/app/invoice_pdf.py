from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from pathlib import Path
from datetime import datetime
from .settings import settings

def generate_invoice_pdf(
    out_dir: Path,
    invoice_number: str,
    employee_name: str,
    month_key: str,
    hours: float,
    rate: float,
    amount: float,
) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = out_dir / f"{invoice_number}.pdf"

    c = canvas.Canvas(str(pdf_path), pagesize=LETTER)
    w, h = LETTER

    y = h - 60
    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, y, "INVOICE")

    y -= 30
    c.setFont("Helvetica", 10)
    c.drawString(50, y, f"Invoice #: {invoice_number}")
    c.drawString(300, y, f"Date: {datetime.utcnow().date().isoformat()}")

    y -= 25
    c.setFont("Helvetica-Bold", 11)
    c.drawString(50, y, settings.COMPANY_NAME)
    y -= 14
    c.setFont("Helvetica", 10)
    c.drawString(50, y, settings.COMPANY_ADDRESS)
    y -= 14
    c.drawString(50, y, settings.COMPANY_EMAIL)

    y -= 30
    c.setFont("Helvetica-Bold", 11)
    c.drawString(50, y, "Bill To:")
    y -= 14
    c.setFont("Helvetica", 10)
    c.drawString(50, y, employee_name)

    y -= 30
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, y, "Description")
    c.drawString(300, y, "Hours")
    c.drawString(360, y, "Rate")
    c.drawString(440, y, "Amount")

    y -= 12
    c.line(50, y, 550, y)
    y -= 18

    c.setFont("Helvetica", 10)
    c.drawString(50, y, f"Work performed ({month_key})")
    c.drawRightString(340, y, f"{hours:.2f}")
    c.drawRightString(420, y, f"{rate:.2f}")
    c.drawRightString(550, y, f"{amount:.2f} {settings.DEFAULT_CURRENCY}")

    y -= 30
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(550, y, f"Total: {amount:.2f} {settings.DEFAULT_CURRENCY}")

    c.showPage()
    c.save()
    return pdf_path
