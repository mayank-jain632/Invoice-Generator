from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from .db import Base


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    email = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    pair_sheets = relationship("PairSheet", back_populates="vendor", cascade="all, delete-orphan")


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    address = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    pair_sheets = relationship("PairSheet", back_populates="company", cascade="all, delete-orphan")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    hourly_rate = Column(Float, nullable=False, default=0.0)
    email = Column(String, nullable=True)
    start_date = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    sheet_rows = relationship("SheetRow", back_populates="employee")


class PairSheet(Base):
    __tablename__ = "pair_sheets"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="pair_sheets")
    company = relationship("Company", back_populates="pair_sheets")
    rows = relationship("SheetRow", back_populates="pair_sheet", cascade="all, delete-orphan")
    invoices = relationship("CombinedInvoice", back_populates="pair_sheet", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("vendor_id", "company_id", name="uq_pair_sheet_vendor_company"),)


class SheetRow(Base):
    __tablename__ = "sheet_rows"

    id = Column(Integer, primary_key=True, index=True)
    pair_sheet_id = Column(Integer, ForeignKey("pair_sheets.id"), nullable=False)
    month_key = Column(String, nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    role = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    hours = Column(Float, nullable=False, default=0.0)
    rate = Column(Float, nullable=False, default=0.0)
    comments = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    pair_sheet = relationship("PairSheet", back_populates="rows")
    employee = relationship("Employee", back_populates="sheet_rows")


class CombinedInvoice(Base):
    __tablename__ = "combined_invoices"

    id = Column(Integer, primary_key=True, index=True)
    pair_sheet_id = Column(Integer, ForeignKey("pair_sheets.id"), nullable=False)
    month_key = Column(String, nullable=False)
    invoice_number = Column(String, unique=True, nullable=False)
    pdf_path = Column(String, nullable=True)
    total_amount = Column(Float, nullable=False, default=0.0)
    sent = Column(Boolean, default=False)
    paid = Column(Boolean, default=False)
    manual_recipients = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    sent_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)

    pair_sheet = relationship("PairSheet", back_populates="invoices")
    lines = relationship("CombinedInvoiceLine", back_populates="invoice", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("pair_sheet_id", "month_key", name="uq_combined_invoice_pair_month"),)


class CombinedInvoiceLine(Base):
    __tablename__ = "combined_invoice_lines"

    id = Column(Integer, primary_key=True, index=True)
    combined_invoice_id = Column(Integer, ForeignKey("combined_invoices.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    employee_name = Column(String, nullable=False)
    role = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    hours = Column(Float, nullable=False, default=0.0)
    rate = Column(Float, nullable=False, default=0.0)
    amount = Column(Float, nullable=False, default=0.0)
    comments = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    invoice = relationship("CombinedInvoice", back_populates="lines")
