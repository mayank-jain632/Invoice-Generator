from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

from .settings import settings


def resolve_company_address(company_name: str, company_address: str | None) -> str:
    print(f"Resolving address for company: '{company_name}' with provided address: '{company_address}'")
    normalized = company_name.strip().lower()
    preset_addresses = {
        "swift bot technologies": "1712 Pioneer Ave Ste 500 Cheyenne, WY 82001",
        "swiftbot technologies": "1712 Pioneer Ave Ste 500 Cheyenne, WY 82001",
        "Open Robo Minds Inc": "5760 Legacy Dr Ste B3 187 Plano TX 75024",
        "ORM": "5760 Legacy Dr Ste B3 187 Plano TX 75024",
    }
    for key, value in preset_addresses.items():
        if key in normalized:
            return value
    return company_address or "Address on file"


def generate_combined_invoice_pdf(
    out_dir: Path,
    invoice_number: str,
    vendor_name: str,
    company_name: str,
    company_address: str | None,
    month_key: str,
    lines: list[dict],
    total_amount: float,
) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    safe_vendor = "".join(c for c in vendor_name if c.isalnum() or c in (" ", "-", "_")).strip().replace(" ", "_")
    safe_company = "".join(c for c in company_name if c.isalnum() or c in (" ", "-", "_")).strip().replace(" ", "_")
    safe_month = month_key.replace("-", "_")
    pdf_path = out_dir / f"{safe_vendor}_{safe_company}_{safe_month}.pdf"

    c = canvas.Canvas(str(pdf_path), pagesize=LETTER)
    width, height = LETTER

    margin = 42
    left = margin + 12
    right = width - margin - 12
    top = height - margin
    bottom = margin

    c.setStrokeColor(colors.HexColor("#3F4754"))
    c.setLineWidth(1)
    c.rect(margin, margin, width - margin * 2, height - margin * 2, stroke=1, fill=0)

    c.setFont("Helvetica-Bold", 20)
    c.drawString(left, top, "INVOICE")

    month_date = datetime.strptime(f"{month_key}-01", "%Y-%m-%d")
    date_str = month_date.strftime("%d-%b-%Y").lstrip("0")
    resolved_address = resolve_company_address(company_name, company_address)

    c.setFont("Helvetica-Bold", 11)
    c.drawString(left, top - 34, company_name)
    c.setFont("Helvetica", 8)
    for idx, line in enumerate(resolved_address.splitlines()[:3]):
        c.drawString(left, top - 48 - (idx * 10), line)

    c.setFont("Helvetica", 8.5)
    c.drawRightString(right, top - 20, f"Invoice Number  {invoice_number}")
    c.drawRightString(right, top - 36, f"Invoice Date  {date_str}")
    c.drawRightString(right, top - 52, f"Vendor  {vendor_name}")
    c.drawRightString(right, top - 68, f"Period  {month_key}")

    table_top = top - 110
    header_y = table_top
    employee_x = left + 65
    hours_x = right - 170
    rate_x = right - 92
    amount_x = right - 18
    header_bar_bottom = header_y - 18
    header_bar_height = 24
    header_text_y = header_bar_bottom + 7
    c.setFillColor(colors.HexColor("#E5E7EB"))
    c.rect(left - 10, header_bar_bottom, right - left + 20, header_bar_height, stroke=0, fill=1)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(employee_x, header_text_y, "Employee")
    c.drawCentredString(hours_x, header_text_y, "Hours")
    c.drawCentredString(rate_x, header_text_y, "Rate")
    c.drawCentredString(amount_x, header_text_y, "Amount")

    y = header_y - 34
    c.setFont("Helvetica", 8.5)
    line_height = 18
    currency = "$" if settings.DEFAULT_CURRENCY.upper() == "USD" else f"{settings.DEFAULT_CURRENCY} "

    def start_new_page() -> float:
        c.showPage()
        c.setStrokeColor(colors.HexColor("#3F4754"))
        c.setLineWidth(1)
        c.rect(margin, margin, width - margin * 2, height - margin * 2, stroke=1, fill=0)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(left, top, f"INVOICE CONT. - {invoice_number}")
        continued_header_y = top - 26
        continued_header_bottom = top - 42
        continued_header_height = 24
        continued_header_text_y = continued_header_bottom + 7
        c.setFillColor(colors.HexColor("#E5E7EB"))
        c.rect(left - 10, continued_header_bottom, right - left + 20, continued_header_height, stroke=0, fill=1)
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 9)
        c.drawCentredString(employee_x, continued_header_text_y, "Employee")
        c.drawCentredString(hours_x, continued_header_text_y, "Hours")
        c.drawCentredString(rate_x, continued_header_text_y, "Rate")
        c.drawCentredString(amount_x, continued_header_text_y, "Amount")
        c.setFont("Helvetica", 8.5)
        return top - 58

    for row in lines:
        if y < bottom + 90:
            y = start_new_page()

        employee_label = row["employee_name"]
        c.drawCentredString(employee_x, y, employee_label[:30])
        c.drawCentredString(hours_x, y, f"{float(row['hours']):.2f}")
        c.drawCentredString(rate_x, y, f"{currency}{float(row['rate']):,.2f}")
        c.drawCentredString(amount_x, y, f"{currency}{float(row['amount']):,.2f}")
        y -= line_height

    footer_y = max(y - 12, bottom + 26)
    c.setFillColor(colors.HexColor("#E5E7EB"))
    c.rect(left - 10, footer_y - 10, right - left + 20, 26, stroke=0, fill=1)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(left + 95, footer_y + 2, "Thanks for your business")
    c.drawCentredString(right - 95, footer_y + 2, "Total")
    c.drawCentredString(amount_x, footer_y + 2, f"{currency}{total_amount:,.2f}")

    c.save()
    return pdf_path
