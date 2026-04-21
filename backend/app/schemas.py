from pydantic import BaseModel, EmailStr
from datetime import datetime, date
from typing import List, Optional

# User Schemas
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    state: Optional[str] = None
    district: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str
    email: str
    state: Optional[str] = None
    district: Optional[str] = None

# Scheme Schemas
class SchemeBase(BaseModel):
    scheme_name: str
    description: Optional[str] = None

class SchemeCreate(SchemeBase):
    pass

class SchemeResponse(SchemeBase):
    id: int

    class Config:
        from_attributes = True

# Beneficiary Schemas
class BeneficiaryBase(BaseModel):
    aadhaar_number: str
    name: str
    gender: str
    age: int
    state: str
    district: str
    block: str
    village: str
    scheme_id: int
    amount_received: float = 0.0
    enrollment_date: date

class BeneficiaryCreate(BeneficiaryBase):
    pass

class BeneficiaryResponse(BeneficiaryBase):
    beneficiary_id: int

    class Config:
        from_attributes = True

# Fund Allocation Schemas
class FundAllocationBase(BaseModel):
    scheme_id: int
    state: str
    district: str
    allocated_amount: float
    financial_year: str

class FundAllocationResponse(FundAllocationBase):
    allocation_id: int

    class Config:
        from_attributes = True

# Fund Utilization Schemas
class FundUtilizationBase(BaseModel):
    scheme_id: int
    state: str
    district: str
    utilized_amount: float
    date: date

class FundUtilizationResponse(FundUtilizationBase):
    utilization_id: int

    class Config:
        from_attributes = True

# Validation Error Schemas
class ValidationErrorResponse(BaseModel):
    error_id: int
    beneficiary_id: Optional[int] = None
    error_type: str
    description: str
    timestamp: datetime

    class Config:
        from_attributes = True

# Audit Log Schemas
class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    details: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

# Reconciliation Schemas
class ReconciliationSummary(BaseModel):
    scheme_name: str
    state: str
    district: str
    allocated: float
    utilized: float
    difference: float
    utilization_percentage: float
    status: str  # Normal, Underutilized, Overutilized

class ReconciliationReport(BaseModel):
    summary: List[ReconciliationSummary]
    total_allocated: float
    total_utilized: float
    mismatches_count: int

# Forecast Schemas
class ForecastDataPoint(BaseModel):
    label: str
    actual: Optional[float] = None
    forecast_linear: Optional[float] = None
    forecast_ma: Optional[float] = None

class ForecastResponse(BaseModel):
    beneficiaries: List[ForecastDataPoint]
    utilization: List[ForecastDataPoint]
    model_metrics: dict
