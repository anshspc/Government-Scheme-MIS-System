import io
import re
import pandas as pd
from datetime import datetime, date
from sqlalchemy import func
from sqlalchemy.orm import Session
from app import models
from app.database import SessionLocal

COLUMN_MAPPINGS = {
    "aadhaar_number": ["aadhaar_number", "aadhaar", "aadhar number", "aadhar", "uid", "aadhaar_no", "aadhar_no"],
    "name": ["name", "beneficiary name", "beneficiary", "full name", "applicant name"],
    "gender": ["gender", "sex"],
    "age": ["age", "dob_years", "dob"],
    "state": ["state", "state_name", "province", "region"],
    "district": ["district", "dist", "district_name", "dist_name", "district_name", "distname", "districtname"],
    "block": ["block", "block_name", "sub-division", "taluka", "taluk"],
    "village": ["village", "village_name", "town", "locality"],
    "scheme_name": ["scheme", "scheme_name", "scheme_id", "welfare_scheme"],
    "amount_received": ["amount_received", "amount", "funds", "benefit", "benefit_amount", "cash_received"],
    "enrollment_date": ["enrollment_date", "date", "enrolled_on", "registration_date", "enroll_date"]
}

def auto_map_columns(df_columns):
    mapped = {}
    logs = []
    for standard_col, aliases in COLUMN_MAPPINGS.items():
        found = False
        for col in df_columns:
            cleaned_col = str(col).strip().lower().replace("_", "").replace(" ", "")
            for alias in aliases:
                cleaned_alias = alias.replace("_", "").replace(" ", "")
                if cleaned_col == cleaned_alias:
                    mapped[col] = standard_col
                    logs.append(f"Auto-mapped column '{col}' to standard field '{standard_col}'")
                    found = True
                    break
            if found:
                break
    return mapped, logs

def normalize_district_name(d_name: str) -> str:
    if not isinstance(d_name, str):
        return "Unknown"
    # standard form is "District X"
    cleaned = d_name.strip().title()
    match = re.search(r"District\s*(\d+)", cleaned, re.IGNORECASE)
    if match:
        return f"District {match.group(1)}"
    
    # Try just extracting numbers if standard format fails
    num_match = re.search(r"(\d+)", cleaned)
    if num_match:
        return f"District {num_match.group(1)}"
    
    return cleaned

def clean_scheme_name(s_name: str) -> str:
    if not isinstance(s_name, str):
        return "Unknown"
    cleaned = s_name.strip().lower()
    if "kisan" in cleaned:
        return "PM Kisan"
    if "pmay" in cleaned or "awas" in cleaned:
        return "PMAY"
    if "mgnrega" in cleaned or "nrega" in cleaned:
        return "MGNREGA"
    if "jeevan" in cleaned or "jjm" in cleaned:
        return "Jal Jeevan Mission"
    if "ayushman" in cleaned or "pmjay" in cleaned or "bharat" in cleaned:
        return "Ayushman Bharat"
    return s_name.strip()

def run_etl_pipeline(file_content: bytes, file_name: str) -> tuple:
    logs = [f"Starting ETL pipeline for file '{file_name}'"]
    
    # Read file based on type
    try:
        if file_name.endswith(".xlsx"):
            df = pd.read_excel(io.BytesIO(file_content))
        else:
            df = pd.read_csv(io.BytesIO(file_content))
    except Exception as e:
        logs.append(f"Error reading file: {str(e)}")
        return None, logs

    logs.append(f"Loaded {len(df)} raw rows.")
    
    # Column mapping
    mapping, map_logs = auto_map_columns(df.columns)
    logs.extend(map_logs)
    
    # Check for missing crucial columns
    required_fields = ["aadhaar_number", "name", "district", "scheme_name"]
    missing_required = [f for f in required_fields if f not in mapping.values()]
    if missing_required:
        logs.append(f"ETL Aborted: Missing mapped fields for required parameters: {missing_required}")
        return None, logs
        
    df = df.rename(columns=mapping)
    df = df[list(mapping.values())] # keep only mapped columns
    
    # 1. Clean Scheme Names
    if "scheme_name" in df.columns:
        df["scheme_name"] = df["scheme_name"].apply(clean_scheme_name)
        logs.append("Standardized scheme names.")
        
    # 1.5 Clean and Standardize State Names
    if "state" in df.columns:
        df["state"] = df["state"].fillna("Madhya Pradesh").astype(str).str.strip().str.title()
        logs.append("Standardized state names.")
        
    # 2. Normalize District Names
    if "district" in df.columns:
        df["district"] = df["district"].apply(normalize_district_name)
        logs.append("Normalized district names.")
        
    # 3. Clean and standardise Dates
    if "enrollment_date" in df.columns:
        # Convert date to standard string format or default to today if parser fails
        df["enrollment_date"] = pd.to_datetime(df["enrollment_date"], errors="coerce")
        df["enrollment_date"] = df["enrollment_date"].fillna(pd.Timestamp.now())
        df["enrollment_date"] = df["enrollment_date"].dt.date
        logs.append("Standardized dates to YYYY-MM-DD.")
        
    # 4. Fill missing values for optional text fields
    for text_col in ["block", "village", "gender"]:
        if text_col in df.columns:
            df[text_col] = df[text_col].fillna("Unknown").astype(str).str.strip()
            
    if "amount_received" in df.columns:
        df["amount_received"] = pd.to_numeric(df["amount_received"], errors="coerce").fillna(0.0)
        logs.append("Filled missing financial amounts with 0.0.")
        
    if "age" in df.columns:
        df["age"] = pd.to_numeric(df["age"], errors="coerce").fillna(30).astype(int)
        
    # 5. Remove duplicates within the CSV/Excel itself
    initial_len = len(df)
    df = df.drop_duplicates(subset=["aadhaar_number"])
    dups_removed = initial_len - len(df)
    if dups_removed > 0:
        logs.append(f"Removed {dups_removed} duplicate records by Aadhaar within the upload file.")
        
    return df, logs

def validate_and_save_data(df: pd.DataFrame, db: Session, user_id: int = None) -> dict:
    success_count = 0
    error_count = 0
    duplicate_count = 0
    overutilization_warnings = []
    
    # Load existing schemes
    schemes = db.query(models.Scheme).all()
    scheme_map = {s.scheme_name.lower(): s.id for s in schemes}
    
    # Load all existing Aadhaar numbers to check uniqueness fast
    existing_aadhaars = set(r[0] for r in db.query(models.Beneficiary.aadhaar_number).all())
    
    # Load user's default state/district if user_id is provided
    user_state = "Madhya Pradesh"
    user_district = None
    if user_id:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if user:
            if user.state:
                user_state = user.state
            if user.district:
                user_district = user.district
                
    # Temp cache for fund utilizations vs allocations checking
    # (scheme_id, state, district) -> (allocated, utilized)
    financials_cache = {}
    
    # Iterate and write to DB
    for index, row in df.iterrows():
        aadhaar = str(row["aadhaar_number"]).strip().replace(".0", "")
        # pad to 12 digits if short
        if len(aadhaar) < 12 and aadhaar.isdigit():
            aadhaar = aadhaar.zfill(12)
            
        name = str(row["name"]).strip()
        age = int(row["age"])
        gender = str(row.get("gender", "Unknown"))
        state = str(row.get("state", user_state)).strip() if "state" in row and pd.notna(row["state"]) else user_state
        district = str(row["district"]).strip()
        block = str(row.get("block", "Unknown")).strip()
        village = str(row.get("village", "Unknown")).strip()
        s_name = str(row["scheme_name"]).strip()
        amount = float(row.get("amount_received", 0.0))
        enroll_date = row["enrollment_date"]
        
        # Resolve Scheme ID
        s_id = scheme_map.get(s_name.lower())
        if not s_id:
            # Create scheme if missing
            new_scheme = models.Scheme(scheme_name=s_name, description=f"Scheme created during ETL import from row {index}")
            db.add(new_scheme)
            db.commit()
            db.refresh(new_scheme)
            scheme_map[s_name.lower()] = new_scheme.id
            s_id = new_scheme.id

        # 1. Validation: Aadhaar Must Be Unique
        if aadhaar in existing_aadhaars:
            duplicate_count += 1
            error_count += 1
            
            # Find beneficiary details for logging reference if possible
            existing_b = db.query(models.Beneficiary).filter(models.Beneficiary.aadhaar_number == aadhaar).first()
            b_id = existing_b.beneficiary_id if existing_b else None
            
            err = models.ValidationError(
                beneficiary_id=b_id,
                error_type="Duplicate Aadhaar",
                description=f"Record '{name}' rejected. Aadhaar {aadhaar} already exists in database.",
                timestamp=datetime.utcnow()
            )
            db.add(err)
            continue
            
        # 2. Validation: Age > 18
        if age < 18:
            error_count += 1
            err = models.ValidationError(
                beneficiary_id=None,
                error_type="Age Validation Failure",
                description=f"Record '{name}' (Aadhaar {aadhaar}) rejected. Age {age} is below 18.",
                timestamp=datetime.utcnow()
            )
            db.add(err)
            continue

        # 3. Financial Validation: Utilized amount vs Allocated Amount
        # Determine Financial Year based on enrollment date
        # If enrollment is in April 2024 to March 2025 -> "2024-25"
        fy = "2025-26"
        if enroll_date < date(2025, 4, 1):
            fy = "2024-25"
            
        cache_key = (s_id, state, district, fy)
        if cache_key not in financials_cache:
            # Query allocation
            alloc = db.query(models.FundAllocation).filter(
                models.FundAllocation.scheme_id == s_id,
                models.FundAllocation.state == state,
                models.FundAllocation.district == district,
                models.FundAllocation.financial_year == fy
            ).first()
            alloc_amt = alloc.allocated_amount if alloc else 0.0
            
            # Query total current utilization
            util_sum = db.query(func.sum(models.FundUtilization.utilized_amount)).filter(
                models.FundUtilization.scheme_id == s_id,
                models.FundUtilization.state == state,
                models.FundUtilization.district == district
            ).scalar() or 0.0
            
            financials_cache[cache_key] = {"allocated": alloc_amt, "utilized": util_sum}
            
        fin_info = financials_cache[cache_key]
        
        # Check if adding this beneficiary's amount causes overutilization
        if fin_info["allocated"] > 0 and (fin_info["utilized"] + amount) > fin_info["allocated"]:
            warning_msg = f"Overutilization warning: Adding '{name}' ({amount} INR) pushes total utilization for {s_name} in {district} ({fy}) past the allocated limit of {fin_info['allocated']} INR."
            overutilization_warnings.append(warning_msg)
            
            err = models.ValidationError(
                beneficiary_id=None,
                error_type="Fund Overutilization",
                description=warning_msg,
                timestamp=datetime.utcnow()
            )
            db.add(err)
            
        # Update cache utilization
        fin_info["utilized"] += amount
        
        # Create beneficiary
        db_b = models.Beneficiary(
            aadhaar_number=aadhaar,
            name=name,
            gender=gender,
            age=age,
            state=state,
            district=district,
            block=block,
            village=village,
            scheme_id=s_id,
            amount_received=amount,
            enrollment_date=enroll_date
        )
        db.add(db_b)
        db.flush() # Flush to get beneficiary_id for potential linkage
        
        # Add to existing Aadhaar set to prevent duplicates within this batch execution
        existing_aadhaars.add(aadhaar)
        
        # Log utilization as transactional entry
        db_util = models.FundUtilization(
            scheme_id=s_id,
            state=state,
            district=district,
            utilized_amount=amount,
            date=enroll_date
        )
        db.add(db_util)
        
        success_count += 1
        
    # Write Audit Log
    details_str = f"Imported {success_count} beneficiaries successfully. Rejected {error_count} records ({duplicate_count} duplicate Aadhaars)."
    log = models.AuditLog(
        user_id=user_id,
        action="Data Upload",
        details=details_str,
        timestamp=datetime.utcnow()
    )
    db.add(log)
    
    db.commit()
    
    return {
        "success_count": success_count,
        "error_count": error_count,
        "duplicate_count": duplicate_count,
        "warnings": overutilization_warnings
    }
