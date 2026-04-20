from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # Super Admin, State Admin, District Officer, Block Officer, Data Entry Operator
    state = Column(String, nullable=True)
    district = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Scheme(Base):
    __tablename__ = "schemes"
    id = Column(Integer, primary_key=True, index=True)
    scheme_name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    
    beneficiaries = relationship("Beneficiary", back_populates="scheme")
    allocations = relationship("FundAllocation", back_populates="scheme")
    utilizations = relationship("FundUtilization", back_populates="scheme")

class Beneficiary(Base):
    __tablename__ = "beneficiaries"
    beneficiary_id = Column(Integer, primary_key=True, index=True)
    aadhaar_number = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    gender = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    state = Column(String, nullable=False, default="Madhya Pradesh")
    district = Column(String, nullable=False)
    block = Column(String, nullable=False)
    village = Column(String, nullable=False)
    scheme_id = Column(Integer, ForeignKey("schemes.id"), nullable=False)
    amount_received = Column(Float, default=0.0)
    enrollment_date = Column(Date, nullable=False)

    scheme = relationship("Scheme", back_populates="beneficiaries")

class FundAllocation(Base):
    __tablename__ = "fund_allocations"
    allocation_id = Column(Integer, primary_key=True, index=True)
    scheme_id = Column(Integer, ForeignKey("schemes.id"), nullable=False)
    state = Column(String, nullable=False, default="Madhya Pradesh")
    district = Column(String, nullable=False)
    allocated_amount = Column(Float, nullable=False)
    financial_year = Column(String, nullable=False)

    scheme = relationship("Scheme", back_populates="allocations")

class FundUtilization(Base):
    __tablename__ = "fund_utilizations"
    utilization_id = Column(Integer, primary_key=True, index=True)
    scheme_id = Column(Integer, ForeignKey("schemes.id"), nullable=False)
    state = Column(String, nullable=False, default="Madhya Pradesh")
    district = Column(String, nullable=False)
    utilized_amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False)

    scheme = relationship("Scheme", back_populates="utilizations")

class ValidationError(Base):
    __tablename__ = "validation_errors"
    error_id = Column(Integer, primary_key=True, index=True)
    beneficiary_id = Column(Integer, ForeignKey("beneficiaries.beneficiary_id", ondelete="SET NULL"), nullable=True)
    error_type = Column(String, nullable=False)  # e.g., duplicate_aadhaar, invalid_age, budget_overutilization, missing_data
    description = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
