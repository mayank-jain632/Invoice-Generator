from typing import List, Optional

from pydantic import BaseModel, Field


class VendorCreate(BaseModel):
    name: str
    email: str


class VendorOut(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        from_attributes = True


class CompanyCreate(BaseModel):
    name: str
    address: Optional[str] = None


class CompanyOut(BaseModel):
    id: int
    name: str
    address: Optional[str]

    class Config:
        from_attributes = True


class EmployeeCreate(BaseModel):
    name: str
    hourly_rate: float
    email: Optional[str] = None
    start_date: Optional[str] = None
    notes: Optional[str] = None


class EmployeeOut(BaseModel):
    id: int
    name: str
    hourly_rate: float
    email: Optional[str]
    start_date: Optional[str]
    notes: Optional[str]

    class Config:
        from_attributes = True


class PairSheetCreate(BaseModel):
    vendor_id: int
    company_id: int


class PairSheetOut(BaseModel):
    id: int
    vendor_id: int
    company_id: int
    vendor_name: str
    company_name: str
    month_total: float = 0.0
    row_count: int = 0
    invoice_id: Optional[int] = None
    invoice_sent: bool = False
    invoice_paid: bool = False


class SheetRowIn(BaseModel):
    id: Optional[int] = None
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    role: Optional[str] = None
    notes: Optional[str] = None
    hours: float = 0.0
    rate: float = 0.0
    comments: Optional[str] = None
    sort_order: int = 0


class SheetRowOut(BaseModel):
    id: Optional[int]
    employee_id: int
    employee_name: str
    role: Optional[str]
    notes: Optional[str]
    hours: float
    rate: float
    amount: float
    comments: Optional[str]
    sort_order: int
    invoice_status: str
    paid_status: str


class WorkbookSheetSaveIn(BaseModel):
    rows: List[SheetRowIn] = Field(default_factory=list)


class CombinedInvoiceLineOut(BaseModel):
    id: int
    employee_id: Optional[int]
    employee_name: str
    role: Optional[str]
    notes: Optional[str]
    hours: float
    rate: float
    amount: float
    comments: Optional[str]
    sort_order: int

    class Config:
        from_attributes = True


class CombinedInvoiceOut(BaseModel):
    id: int
    pair_sheet_id: int
    month_key: str
    invoice_number: str
    total_amount: float
    sent: bool
    paid: bool
    manual_recipients: Optional[str]
    created_at: str
    sent_at: Optional[str]
    paid_at: Optional[str]


class WorkbookSheetDetailOut(BaseModel):
    sheet: PairSheetOut
    month_key: str
    rows: List[SheetRowOut]
    invoice: Optional[CombinedInvoiceOut] = None


class CombinedInvoiceSendIn(BaseModel):
    recipients: List[str]


class PaidToggleIn(BaseModel):
    paid: bool


class SummaryCardOut(BaseModel):
    label: str
    value: float


class CompanyBalanceOut(BaseModel):
    company: str
    total_amount: float
    paid_amount: float
    outstanding_amount: float


class VendorBalanceOut(BaseModel):
    vendor: str
    total_amount: float
    sent_count: int


class PairBalanceOut(BaseModel):
    invoice_id: int
    pair_sheet_id: int
    vendor_name: str
    company_name: str
    month_key: str
    total_amount: float
    sent: bool
    paid: bool


class EarningsPoint(BaseModel):
    month_key: str
    total_amount: float
