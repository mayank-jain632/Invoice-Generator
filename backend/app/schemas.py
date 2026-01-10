from pydantic import BaseModel
from typing import Optional, List

class VendorCreate(BaseModel):
    name: str
    email: str

class VendorOut(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        from_attributes = True

class EmployeeCreate(BaseModel):
    name: str
    hourly_rate: float
    email: Optional[str] = None
    start_date: Optional[str] = None
    company: Optional[str] = None
    preferred_vendor_id: Optional[int] = None

class EmployeeOut(BaseModel):
    id: int
    name: str
    hourly_rate: float
    email: Optional[str]
    start_date: Optional[str]
    company: Optional[str]
    preferred_vendor_id: Optional[int]
    lifetime_hours: float

    class Config:
        from_attributes = True

class TimesheetRow(BaseModel):
    name: str
    hours: float

class TimesheetIn(BaseModel):
    month_key: str  # "YYYY-MM"
    rows: List[TimesheetRow]

class InvoiceCreateIn(BaseModel):
    month_key: str
    employee_ids: List[int]

class InvoiceOut(BaseModel):
    id: int
    employee_id: int
    month_key: str
    hours: float
    rate: float
    amount: float
    invoice_number: str
    approved: bool
    sent: bool

    class Config:
        from_attributes = True

class ApproveIn(BaseModel):
    invoice_ids: List[int]

class SendIn(BaseModel):
    invoice_ids: List[int]
    to_emails: List[str]
