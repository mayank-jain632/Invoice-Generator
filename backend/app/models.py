from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from .db import Base

class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    hourly_rate = Column(Float, nullable=False)
    email = Column(String, nullable=True)

    lifetime_hours = Column(Float, default=0.0)
    # hours tracked per month are in EmployeeMonth

    created_at = Column(DateTime, default=datetime.utcnow)

    months = relationship("EmployeeMonth", back_populates="employee", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="employee", cascade="all, delete-orphan")

class EmployeeMonth(Base):
    __tablename__ = "employee_months"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    month_key = Column(String, nullable=False)  # e.g. "2025-12"

    hours = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", back_populates="months")

    __table_args__ = (UniqueConstraint("employee_id", "month_key", name="uq_employee_month"),)

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)

    month_key = Column(String, nullable=False)
    hours = Column(Float, nullable=False)
    rate = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)

    invoice_number = Column(String, unique=True, nullable=False)
    pdf_path = Column(String, nullable=True)

    approved = Column(Boolean, default=False)
    sent = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", back_populates="invoices")

    __table_args__ = (
        UniqueConstraint("employee_id", "month_key", name="uq_invoice_employee_month"),
    )
