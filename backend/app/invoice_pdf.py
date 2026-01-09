from reportlab.lib.pagesizes import LETTER
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from pathlib import Path
from datetime import datetime
from .settings import settings

def generate_invoice_pdf(
    out_dir: Path,
    invoice_number: str,
    employee_name: str,
    employee_company: str | None,
    employee_start_date: str | None,
    employee_email: str | None,
    month_key: str,
    hours: float,
    rate: float,
    amount: float,
) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = out_dir / f"{invoice_number}.pdf"

    c = canvas.Canvas(str(pdf_path), pagesize=LETTER)
    w, h = LETTER

    left = 50
    right = w - 50
    bar_height = 40
    top_bar_y = h - 80
    bottom_bar_y = 40

    c.setFillColor(colors.HexColor("#F2F2F2"))
    c.rect(left - 10, top_bar_y, w - 2 * (left - 10), bar_height, stroke=0, fill=1)
    c.rect(left - 10, bottom_bar_y, w - 2 * (left - 10), bar_height, stroke=0, fill=1)
    c.setFillColor(colors.black)

    date_str = datetime.utcnow().strftime("%d-%b-%y").lstrip("0")
    currency_label = "$" if settings.DEFAULT_CURRENCY.upper() == "USD" else settings.DEFAULT_CURRENCY

    c.setFont("Helvetica-Bold", 11)
    c.drawString(left, top_bar_y + 14, settings.COMPANY_NAME)
    c.setFont("Helvetica", 9)
    c.drawString(right - 200, top_bar_y + 20, "Invoice Number")
    c.drawString(right - 200, top_bar_y + 8, "Invoice Date")
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(right, top_bar_y + 20, invoice_number)
    c.drawRightString(right, top_bar_y + 8, date_str)

    y = top_bar_y - 40
    c.setFont("Helvetica-Bold", 10)
    c.drawString(left, y, "Employee")
    y -= 14
    c.setFont("Helvetica", 9)
    c.drawString(left, y, f"Name: {employee_name}")
    y -= 12
    c.drawString(left, y, f"Company: {employee_company or 'N/A'}")
    y -= 12
    c.drawString(left, y, f"Start Date: {employee_start_date or 'N/A'}")
    y -= 12
    c.drawString(left, y, f"Email: {employee_email or 'N/A'}")
    y -= 12
    c.drawString(left, y, f"Month: {month_key}")

    y -= 26
    c.setFont("Helvetica-Bold", 9)
    c.drawString(left, y, "Description")
    c.drawRightString(right - 160, y, "Hours")
    c.drawRightString(right - 80, y, "Rate")
    c.drawRightString(right, y, "Amount")

    y -= 10
    c.line(left, y, right, y)
    y -= 16

    c.setFont("Helvetica", 9)
    c.drawString(left, y, "Work performed")
    c.drawRightString(right - 160, y, f"{hours:.2f}")
    c.drawRightString(right - 80, y, f"{currency_label}{rate:,.2f}")
    c.drawRightString(right, y, f"{currency_label}{amount:,.2f}")

    c.setFont("Helvetica-Bold", 10)
    c.drawString(left, bottom_bar_y + 14, "Thanks for your business")
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(right - 60, bottom_bar_y + 14, "Total")
    c.drawRightString(right, bottom_bar_y + 14, f"{currency_label}{amount:,.2f}")

    c.showPage()
    c.save()
    return pdf_path
