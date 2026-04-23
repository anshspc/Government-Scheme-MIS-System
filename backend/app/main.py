import logging
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date

from app import models, schemas, auth, database, data_pipeline, analytics, reports
from app.config import settings
from app.database import engine, get_db
from app.seed import seed_database

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI App
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs"
)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production as needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup Event: Initialize DB and Seed if Empty
@app.on_event("startup")
def on_startup():
    logger.info("Initializing database schema...")
    models.Base.metadata.create_all(bind=engine)
    
    # Check if DB is already seeded
    db = database.SessionLocal()
    try:
        user_count = db.query(models.User).count()
        if user_count == 0:
            logger.info("No users found in database. Initiating automatic seeding...")
            seed_database(db)
        else:
            logger.info(f"Database already populated ({user_count} users). Skipping automatic seed.")
    except Exception as e:
        logger.error(f"Error checking/seeding database: {str(e)}")
    finally:
        db.close()

# --------------------------------------------------------------------------
# MODULE 1: AUTHENTICATION
# --------------------------------------------------------------------------

@app.post(f"{settings.API_V1_STR}/login", response_model=schemas.Token)
def login(form_data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.email).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    # Generate JWT Token
    access_token = auth.create_access_token(data={"sub": user.email})
    
    # Log login success
    try:
        audit = models.AuditLog(
            user_id=user.id,
            action="Login Success",
            details=f"User {user.email} authenticated.",
            timestamp=datetime.utcnow()
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to log login audit entry due to read-only database: {e}")
        db.rollback()
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.name,
        "email": user.email,
        "state": user.state,
        "district": user.district
    }

# --------------------------------------------------------------------------
# USER PROFILE & REGISTRATION
# --------------------------------------------------------------------------

@app.get(f"{settings.API_V1_STR}/users/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.post(f"{settings.API_V1_STR}/users", response_model=schemas.UserResponse)
def create_user(
    user_in: schemas.UserCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_super_admin)
):
    existing = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered."
        )
    
    db_user = models.User(
        name=user_in.name,
        email=user_in.email,
        role=user_in.role,
        state=user_in.state,
        district=user_in.district,
        password_hash=auth.get_password_hash(user_in.password)
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Log audit
    audit = models.AuditLog(
        user_id=current_user.id,
        action="Create User",
        details=f"Created new user account: {db_user.email} with role {db_user.role}",
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    
    return db_user

# --------------------------------------------------------------------------
# SCHEMES
# --------------------------------------------------------------------------

@app.get(f"{settings.API_V1_STR}/schemes", response_model=List[schemas.SchemeResponse])
def read_schemes(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Scheme).all()

# --------------------------------------------------------------------------
# BENEFICIARIES (PAGINATED & FILTERED)
# --------------------------------------------------------------------------

@app.get(f"{settings.API_V1_STR}/beneficiaries")
def read_beneficiaries(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    scheme_id: Optional[int] = Query(None),
    block: Optional[str] = Query(None),
    village: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    query = db.query(models.Beneficiary)
    
    # Role-Based Restrictions
    if current_user.role == "State Admin" and current_user.state:
        state = current_user.state
    elif current_user.role == "District Officer" and current_user.district:
        query = query.filter(models.Beneficiary.district == current_user.district)
        if current_user.state:
            state = current_user.state
    elif current_user.role == "Block Officer" and current_user.district:
        query = query.filter(models.Beneficiary.district == current_user.district)
        if current_user.state:
            state = current_user.state
        
    # Filters
    if state:
        query = query.filter(models.Beneficiary.state == state)
    if district:
        query = query.filter(models.Beneficiary.district == district)
    if scheme_id:
        query = query.filter(models.Beneficiary.scheme_id == scheme_id)
    if block:
        query = query.filter(models.Beneficiary.block == block)
    if village:
        query = query.filter(models.Beneficiary.village == village)
    if gender:
        query = query.filter(models.Beneficiary.gender == gender)
    if search:
        query = query.filter(
            (models.Beneficiary.name.ilike(f"%{search}%")) |
            (models.Beneficiary.aadhaar_number.like(f"%{search}%"))
        )
        
    total = query.count()
    offset = (page - 1) * limit
    results = query.offset(offset).limit(limit).all()
    
    # Fetch geography helpers for filter lookups
    dist_q = db.query(models.Beneficiary.district).distinct()
    if state:
        dist_q = dist_q.filter(models.Beneficiary.state == state)
    all_districts = [r[0] for r in dist_q.all()]
    
    all_blocks = []
    if district:
        all_blocks = [r[0] for r in db.query(models.Beneficiary.block).filter(models.Beneficiary.district == district).distinct().all()]
        
    # Fetch all available states for dropdown
    all_states = [r[0] for r in db.query(models.Beneficiary.state).distinct().all()]
        
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "results": results,
        "filters_data": {
            "states": sorted(all_states),
            "districts": sorted(all_districts),
            "blocks": sorted(all_blocks)
        }
    }

# --------------------------------------------------------------------------
# MODULE 2 & 3: DATA IMPORT & ETL PIPELINE
# --------------------------------------------------------------------------

@app.post(f"{settings.API_V1_STR}/upload")
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_data_entry)
):
    contents = await file.read()
    
    # Run ETL
    df, logs = data_pipeline.run_etl_pipeline(contents, file.filename)
    if df is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"logs": logs, "message": "Failed to parse and clean spreadsheet structure."}
        )
        
    # Run Validations and Insert to database
    stats = data_pipeline.validate_and_save_data(df, db, user_id=current_user.id)
    
    return {
        "message": "File processed successfully",
        "logs": logs,
        "stats": stats
    }

# --------------------------------------------------------------------------
# MODULE 5: RECONCILIATION ENGINE
# --------------------------------------------------------------------------

@app.get(f"{settings.API_V1_STR}/reconciliation")
def get_reconciliation(
    state: Optional[str] = None,
    district: Optional[str] = None,
    financial_year: str = "2024-25",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Role-Based Restrictions
    if current_user.role == "State Admin" and current_user.state:
        state = current_user.state
    elif current_user.role in ["District Officer", "Block Officer"] and current_user.state:
        state = current_user.state
        
    # Query all allocations
    alloc_query = db.query(models.FundAllocation)
    if state:
        alloc_query = alloc_query.filter(models.FundAllocation.state == state)
    if district:
        alloc_query = alloc_query.filter(models.FundAllocation.district == district)
    allocs = alloc_query.filter(models.FundAllocation.financial_year == financial_year).all()
    
    summary = []
    total_allocated = 0.0
    total_utilized = 0.0
    mismatches_count = 0
    
    # Build allocation vs utilization metrics
    for alloc in allocs:
        # Sum utilizations for this scheme + district in this FY
        start_year = int(financial_year.split("-")[0])
        start_date = date(start_year, 4, 1)
        end_date = date(start_year + 1, 3, 31)
        
        util_sum = db.query(func.sum(models.FundUtilization.utilized_amount)).filter(
            models.FundUtilization.scheme_id == alloc.scheme_id,
            models.FundUtilization.district == alloc.district,
            models.FundUtilization.state == alloc.state,
            models.FundUtilization.date >= start_date,
            models.FundUtilization.date <= end_date
        ).scalar() or 0.0
        
        diff = alloc.allocated_amount - util_sum
        pct = (util_sum / alloc.allocated_amount * 100) if alloc.allocated_amount > 0 else 0.0
        
        # Mismatch is when utilized exceeds allocated, or is significantly underutilized (<70%)
        status = "Normal"
        if util_sum > alloc.allocated_amount:
            status = "Overutilized"
            mismatches_count += 1
        elif pct < 70.0:
            status = "Underutilized"
            mismatches_count += 1
            
        summary.append({
            "scheme_name": alloc.scheme.scheme_name,
            "state": alloc.state,
            "district": alloc.district,
            "allocated": alloc.allocated_amount,
            "utilized": util_sum,
            "difference": diff,
            "utilization_percentage": pct,
            "status": status
        })
        
        total_allocated += alloc.allocated_amount
        total_utilized += util_sum
        
    return {
        "summary": summary,
        "total_allocated": total_allocated,
        "total_utilized": total_utilized,
        "mismatches_count": mismatches_count
    }

# --------------------------------------------------------------------------
# MODULE 6: EXECUTIVE & DETAILED ANALYTICS
# --------------------------------------------------------------------------

@app.get(f"{settings.API_V1_STR}/analytics")
def get_analytics(
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Enforce role-based state/district lock
    if current_user.role == "State Admin" and current_user.state:
        state = current_user.state
    elif current_user.role in ["District Officer", "Block Officer"]:
        if current_user.state:
            state = current_user.state
        if current_user.district:
            district = current_user.district

    # 1. Total Beneficiaries
    b_query = db.query(models.Beneficiary)
    if state:
        b_query = b_query.filter(models.Beneficiary.state == state)
    if district:
        b_query = b_query.filter(models.Beneficiary.district == district)
    total_beneficiaries = b_query.count()
    
    # 2. Total Allocated & Utilized
    a_query = db.query(func.sum(models.FundAllocation.allocated_amount))
    if state:
        a_query = a_query.filter(models.FundAllocation.state == state)
    if district:
        a_query = a_query.filter(models.FundAllocation.district == district)
    total_alloc = a_query.scalar() or 0.0
    
    u_query = db.query(func.sum(models.FundUtilization.utilized_amount))
    if state:
        u_query = u_query.filter(models.FundUtilization.state == state)
    if district:
        u_query = u_query.filter(models.FundUtilization.district == district)
    total_util = u_query.scalar() or 0.0
    
    util_percentage = (total_util / total_alloc * 100) if total_alloc > 0 else 0.0
    
    # 3. Validation Errors Count
    e_query = db.query(models.ValidationError)
    if state or district:
        b_sub_q = db.query(models.Beneficiary.beneficiary_id)
        if state:
            b_sub_q = b_sub_q.filter(models.Beneficiary.state == state)
        if district:
            b_sub_q = b_sub_q.filter(models.Beneficiary.district == district)
        b_ids = b_sub_q.subquery()
        
        desc_filter = []
        if state:
            desc_filter.append(models.ValidationError.description.contains(state))
        if district:
            desc_filter.append(models.ValidationError.description.contains(district))
            
        from sqlalchemy import or_
        if desc_filter:
            e_query = e_query.filter((models.ValidationError.beneficiary_id.in_(b_ids)) | or_(*desc_filter))
        else:
            e_query = e_query.filter(models.ValidationError.beneficiary_id.in_(b_ids))
    total_errors = e_query.count()
    
    # 4. District Performance Rankings
    # Calculate utilization by district
    dist_perf = []
    all_d_query = db.query(models.FundAllocation.district, models.FundAllocation.state).distinct()
    if state:
        all_d_query = all_d_query.filter(models.FundAllocation.state == state)
    all_d_query = all_d_query.all()
    
    for d_row in all_d_query:
        d_name, d_state = d_row[0], d_row[1]
        d_alloc = db.query(func.sum(models.FundAllocation.allocated_amount)).filter(
            models.FundAllocation.district == d_name,
            models.FundAllocation.state == d_state
        ).scalar() or 0.0
        d_util = db.query(func.sum(models.FundUtilization.utilized_amount)).filter(
            models.FundUtilization.district == d_name,
            models.FundUtilization.state == d_state
        ).scalar() or 0.0
        d_pct = (d_util / d_alloc * 100) if d_alloc > 0 else 0.0
        dist_perf.append({
            "district": d_name,
            "state": d_state,
            "allocated": d_alloc,
            "utilized": d_util,
            "percentage": d_pct
        })
    dist_perf = sorted(dist_perf, key=lambda x: x["percentage"], reverse=True)
    
    # 5. Scheme-wise comparisons
    scheme_perf = []
    schemes = db.query(models.Scheme).all()
    for s in schemes:
        s_alloc_q = db.query(func.sum(models.FundAllocation.allocated_amount)).filter(models.FundAllocation.scheme_id == s.id)
        s_util_q = db.query(func.sum(models.FundUtilization.utilized_amount)).filter(models.FundUtilization.scheme_id == s.id)
        if state:
            s_alloc_q = s_alloc_q.filter(models.FundAllocation.state == state)
            s_util_q = s_util_q.filter(models.FundUtilization.state == state)
        if district:
            s_alloc_q = s_alloc_q.filter(models.FundAllocation.district == district)
            s_util_q = s_util_q.filter(models.FundUtilization.district == district)
            
        s_alloc = s_alloc_q.scalar() or 0.0
        s_util = s_util_q.scalar() or 0.0
        s_pct = (s_util / s_alloc * 100) if s_alloc > 0 else 0.0
        scheme_perf.append({
            "scheme_name": s.scheme_name,
            "allocated": s_alloc,
            "utilized": s_util,
            "percentage": s_pct
        })
        
    # 6. Monthly trends (last 8 months)
    monthly_trends = []
    # Dynamic date grouping depending on dialect (SQLite vs PostgreSQL)
    if db.bind.dialect.name == "sqlite":
        months_agg = db.query(
            func.strftime('%Y-%m-01', models.FundUtilization.date).label('m'),
            func.sum(models.FundUtilization.utilized_amount).label('utilized')
        )
    else:
        months_agg = db.query(
            func.date_trunc('month', models.FundUtilization.date).label('m'),
            func.sum(models.FundUtilization.utilized_amount).label('utilized')
        )
        
    if state:
        months_agg = months_agg.filter(models.FundUtilization.state == state)
    if district:
        months_agg = months_agg.filter(models.FundUtilization.district == district)
    months_agg = months_agg.group_by('m').order_by('m')
    months_results = months_agg.all()
    
    for r in months_results:
        if r[0]:
            m_val = r[0]
            if isinstance(m_val, str):
                m_val = datetime.strptime(m_val, "%Y-%m-%d")
            monthly_trends.append({
                "month": m_val.strftime("%b %Y"),
                "utilized": float(r[1])
            })
            
    # Limit to latest 8 months
    monthly_trends = monthly_trends[-8:]
    
    # Get list of unique states
    all_states = sorted([r[0] for r in db.query(models.FundAllocation.state).distinct().all()])
    
    return {
        "kpis": {
            "total_beneficiaries": total_beneficiaries,
            "total_allocated": total_alloc,
            "total_utilized": total_util,
            "utilization_percentage": util_percentage,
            "pending_cases": total_errors
        },
        "district_rankings": dist_perf,
        "scheme_performance": scheme_perf,
        "monthly_trends": monthly_trends,
        "states": all_states
    }

# --------------------------------------------------------------------------
# MODULE 7: FORECASTING
# --------------------------------------------------------------------------

@app.get(f"{settings.API_V1_STR}/forecast", response_model=schemas.ForecastResponse)
def get_forecast(
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    scheme_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Enforce role-based state/district lock
    if current_user.role == "State Admin" and current_user.state:
        state = current_user.state
    elif current_user.role in ["District Officer", "Block Officer"]:
        if current_user.state:
            state = current_user.state
        if current_user.district:
            district = current_user.district
        
    return analytics.get_forecast_predictions(db, filter_state=state, filter_district=district, filter_scheme_id=scheme_id)

# --------------------------------------------------------------------------
# MODULE 8: AUTOMATED MIS REPORTING
# --------------------------------------------------------------------------

@app.get(f"{settings.API_V1_STR}/reports")
def download_report(
    report_type: str = Query("monthly", regex="^(daily|weekly|monthly)$"),
    format: str = Query("pdf", regex="^(pdf|xlsx)$"),
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Enforce role-based state/district lock
    if current_user.role == "State Admin" and current_user.state:
        state = current_user.state
    elif current_user.role in ["District Officer", "Block Officer"]:
        if current_user.state:
            state = current_user.state
        if current_user.district:
            district = current_user.district
            
    # Log Audit Log of download
    try:
        audit = models.AuditLog(
            user_id=current_user.id,
            action="Download Report",
            details=f"Downloaded {report_type} report in {format.upper()} format for state={state}, district={district}.",
            timestamp=datetime.utcnow()
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to log download report audit entry due to read-only database: {e}")
        db.rollback()
    
    if format == "pdf":
        pdf_buf = reports.generate_pdf_report(db, report_type, state=state, district=district)
        return StreamingResponse(
            pdf_buf,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=gov_scheme_{report_type}_report.pdf"}
        )
    else:
        excel_buf = reports.generate_excel_report(db, report_type, state=state, district=district)
        return StreamingResponse(
            excel_buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=gov_scheme_{report_type}_report.xlsx"}
        )

# --------------------------------------------------------------------------
# MODULE 9: NOTIFICATIONS SYSTEM
# --------------------------------------------------------------------------

@app.get(f"{settings.API_V1_STR}/notifications", response_model=List[schemas.ValidationErrorResponse])
def get_notifications(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    query = db.query(models.ValidationError)
    if current_user.role == "State Admin" and current_user.state:
        b_sub = db.query(models.Beneficiary.beneficiary_id).filter(models.Beneficiary.state == current_user.state).subquery()
        query = query.filter(
            (models.ValidationError.beneficiary_id.in_(b_sub)) | 
            (models.ValidationError.description.contains(current_user.state))
        )
    elif current_user.role in ["District Officer", "Block Officer"] and current_user.district:
        b_sub = db.query(models.Beneficiary.beneficiary_id).filter(models.Beneficiary.district == current_user.district).subquery()
        query = query.filter(
            (models.ValidationError.beneficiary_id.in_(b_sub)) | 
            (models.ValidationError.description.contains(current_user.district))
        )
    return query.order_by(models.ValidationError.timestamp.desc()).limit(limit).all()

# --------------------------------------------------------------------------
# MODULE 10: AUDIT LOGGING
# --------------------------------------------------------------------------

@app.get(f"{settings.API_V1_STR}/audit-logs", response_model=List[schemas.AuditLogResponse])
def get_audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin)
):
    return db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).limit(limit).all()

@app.get(f"{settings.API_V1_STR}/analytics/scheme-coverage")
def get_scheme_coverage(
    scheme_id: int,
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Enforce role-based state/district lock
    if current_user.role == "State Admin" and current_user.state:
        state = current_user.state
    elif current_user.role in ["District Officer", "Block Officer"]:
        if current_user.state:
            state = current_user.state
        if current_user.district:
            district = current_user.district
            
    # Query all allocations for this scheme
    alloc_q = db.query(models.FundAllocation).filter(models.FundAllocation.scheme_id == scheme_id)
    if state:
        alloc_q = alloc_q.filter(models.FundAllocation.state == state)
    if district:
        alloc_q = alloc_q.filter(models.FundAllocation.district == district)
    allocs = alloc_q.all()
    
    coverage = []
    for a in allocs:
        # Sum utilizations for this scheme + state + district
        util_sum = db.query(func.sum(models.FundUtilization.utilized_amount)).filter(
            models.FundUtilization.scheme_id == scheme_id,
            models.FundUtilization.state == a.state,
            models.FundUtilization.district == a.district
        ).scalar() or 0.0
        
        pct = (util_sum / a.allocated_amount * 100) if a.allocated_amount > 0 else 0.0
        coverage.append({
            "district": a.district,
            "state": a.state,
            "allocated": a.allocated_amount,
            "utilized": util_sum,
            "percentage": pct
        })
        
    # Sort by utilization %
    coverage = sorted(coverage, key=lambda x: x["percentage"], reverse=True)
    return coverage

