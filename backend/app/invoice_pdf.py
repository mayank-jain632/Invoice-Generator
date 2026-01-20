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
    employee_preferred_vendor: str | None,
    month_key: str,
    hours: float,
    rate: float,
    amount: float,
) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    safe_name = "".join(c for c in employee_name if c.isalnum() or c in (" ", "-", "_")).strip().replace(" ", "_")
    safe_month = month_key.replace("-", "_")
    pdf_path = out_dir / f"{safe_name}_{safe_month}.pdf"

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

    month_date = datetime.strptime(f"{month_key}-01", "%Y-%m-%d")
    date_str = month_date.strftime("%d-%b-%y").lstrip("0")
    currency_label = "$" if settings.DEFAULT_CURRENCY.upper() == "USD" else settings.DEFAULT_CURRENCY
    company_addresses = {
        "swift bot technologies": "1712 PIONEER AVE STE 500 CHEYENNE, WY 82001",
        "orm": "5760 Legacy Dr Ste B3 187 Plano TX 75024",
    }
    company_name = employee_company or settings.COMPANY_NAME
    company_key = company_name.strip().lower()
    company_address = company_addresses.get(company_key, "Address on file")

    c.setFont("Helvetica-Bold", 11)
    c.drawString(left, top_bar_y + 14, company_name)
    c.setFont("Helvetica", 8)
    c.drawString(left, top_bar_y + 2, company_address)
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
    c.drawString(left, y, f"{company_name or 'N/A'}")

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
    c.drawString(left, y, f"{employee_name} — {month_key}")
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
