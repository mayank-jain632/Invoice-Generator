import smtplib
from email.message import EmailMessage
from pathlib import Path
from typing import Iterable
from .settings import settings

def send_email(
    subject: str,
    body: str,
    to_emails: str | Iterable[str],
    attachments: list[Path] | None = None,
    cc_emails: Iterable[str] | None = None,
):
    if isinstance(to_emails, str):
        recipients = [to_emails]
    else:
        recipients = [e for e in to_emails if e]

    if not recipients:
        raise ValueError("No recipients provided")
    cc = [e for e in (cc_emails or []) if e]

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.FROM_EMAIL or settings.SMTP_USER
    msg["To"] = ", ".join(recipients)
    if cc:
        msg["Cc"] = ", ".join(cc)
    msg.set_content(body)

    attachments = attachments or []
    for p in attachments:
        data = p.read_bytes()
        msg.add_attachment(data, maintype="application", subtype="pdf", filename=p.name)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASS)
        server.send_message(msg)

def send_timesheet_reminder(month_key: str):
    subject = f"Timesheet Reminder — {month_key}"
    body = (
        f"Hi team,\n\n"
        f"Please submit your timesheet for {month_key}.\n\n"
        f"Thank you!"
    )
    send_email(subject, body, settings.REMINDER_TO_EMAIL)
