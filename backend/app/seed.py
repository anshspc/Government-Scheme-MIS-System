import random
import time
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal, Base, engine
from app import models
from app.auth import get_password_hash

def seed_database(db: Session):
    print("Starting database seeding...")
    
    # 1. Clear existing data
    print("Clearing existing tables...")
    db.query(models.AuditLog).delete()
    db.query(models.ValidationError).delete()
    db.query(models.Beneficiary).delete()
    db.query(models.FundUtilization).delete()
    db.query(models.FundAllocation).delete()
    db.query(models.Scheme).delete()
    db.query(models.User).delete()
    db.commit()

    # 2. Create default users
    print("Creating default users...")
    users_data = [
        {"name": "Super Admin", "email": "admin@gov.in", "role": "Super Admin", "password": "admin123"},
        {"name": "State Admin MP", "email": "state@gov.in", "role": "State Admin", "state": "Madhya Pradesh", "password": "state123"},
        {"name": "State Admin MP Secondary", "email": "state_mp@gov.in", "role": "State Admin", "state": "Madhya Pradesh", "password": "state123"},
        {"name": "State Admin UP", "email": "state_up@gov.in", "role": "State Admin", "state": "Uttar Pradesh", "password": "state123"},
        {"name": "State Admin RJ", "email": "state_rj@gov.in", "role": "State Admin", "state": "Rajasthan", "password": "state123"},
        {"name": "District Officer (Bhind)", "email": "bhind@gov.in", "role": "District Officer", "state": "Madhya Pradesh", "district": "Bhind", "password": "bhind123"},
        {"name": "District Officer (Etawah)", "email": "etawah@gov.in", "role": "District Officer", "state": "Uttar Pradesh", "district": "Etawah", "password": "etawah123"},
        {"name": "District Officer (Dholpur)", "email": "dholpur@gov.in", "role": "District Officer", "state": "Rajasthan", "district": "Dholpur", "password": "dholpur123"},
        {"name": "District Officer 1", "email": "district@gov.in", "role": "District Officer", "state": "Madhya Pradesh", "district": "Bhind", "password": "district123"},
        {"name": "Block Officer 1", "email": "block@gov.in", "role": "Block Officer", "state": "Madhya Pradesh", "district": "Bhind", "password": "block123"},
        {"name": "Data Entry Operator", "email": "operator@gov.in", "role": "Data Entry Operator", "state": "Madhya Pradesh", "password": "operator123"},
    ]
    for u in users_data:
        db_user = models.User(
            name=u["name"],
            email=u["email"],
            role=u["role"],
            state=u.get("state"),
            district=u.get("district"),
            password_hash=get_password_hash(u["password"])
        )
        db.add(db_user)
    db.commit()

    # 3. Create schemes
    print("Creating schemes...")
    schemes_data = [
        {"scheme_name": "PM Kisan", "description": "Pradhan Mantri Kisan Samman Nidhi - Direct benefit transfer of Rs. 6000 per year in three equal installments to small and marginal farmers."},
        {"scheme_name": "PMAY", "description": "Pradhan Mantri Awas Yojana - Housing for All initiative providing financial assistance for building affordable homes in rural and urban areas."},
        {"scheme_name": "MGNREGA", "description": "Mahatma Gandhi National Rural Employment Guarantee Act - Guarantees 100 days of wage employment in a financial year to a rural household."},
        {"scheme_name": "Jal Jeevan Mission", "description": "Jal Jeevan Mission - Assisting, empowering and facilitating States/UTs for planning of participatory rural water supply schemes to supply tap water to every household."},
        {"scheme_name": "Ayushman Bharat", "description": "Ayushman Bharat PM-JAY - National health protection scheme providing coverage of Rs. 5 lakhs per family per year for secondary and tertiary hospitalization."}
    ]
    db_schemes = []
    for s in schemes_data:
        db_scheme = models.Scheme(scheme_name=s["scheme_name"], description=s["description"])
        db.add(db_scheme)
        db_schemes.append(db_scheme)
    db.commit()
    
    # Retrieve scheme IDs
    scheme_ids = [s.id for s in db_schemes]
    
    # 4. Generate geography mappings for multiple states
    states_geography = {
        "Madhya Pradesh": {
            "Bhind": ["Bhind Block", "Ater", "Mehgaon", "Gohad", "Lahar", "Ron", "Mihona"],
            "Bhopal": ["Bhopal Block 1", "Bhopal Block 2"],
            "Gwalior": ["Gwalior Block 1", "Gwalior Block 2"],
            "Indore": ["Indore Block 1", "Indore Block 2"],
            "Jabalpur": ["Jabalpur Block 1", "Jabalpur Block 2"]
        },
        "Uttar Pradesh": {
            "Etawah": ["Etawah Block 1", "Etawah Block 2"],
            "Jhansi": ["Jhansi Block 1", "Jhansi Block 2"],
            "Agra": ["Agra Block 1", "Agra Block 2"],
            "Lucknow": ["Lucknow Block 1", "Lucknow Block 2"]
        },
        "Rajasthan": {
            "Dholpur": ["Dholpur Block 1", "Dholpur Block 2"],
            "Jaipur": ["Jaipur Block 1", "Jaipur Block 2"],
            "Kota": ["Kota Block 1", "Kota Block 2"]
        }
    }
    
    # Build complete flat list of districts for random selections later
    all_geography_flat = []
    for state_name, dists in states_geography.items():
        for dist_name, blocks in dists.items():
            all_geography_flat.append((state_name, dist_name, blocks))

    # 5. Create Fund Allocations & Utilizations
    # We will generate allocations for years 2024-25 and 2025-26
    print("Generating fund allocations and utilizations...")
    financial_years = ["2024-25", "2025-26"]
    
    allocations_to_insert = []
    utilizations_to_insert = []
    
    # Track allocations for utilization references
    allocation_map = {} # (scheme_id, state, district, year) -> amount
    
    for s_id in scheme_ids:
        for state_name, dists in states_geography.items():
            for d in dists.keys():
                for fy in financial_years:
                    # Allocation between 15 Crore to 50 Crore (150,000,000 to 500,000,000 Rupees)
                    alloc = round(random.uniform(150_000_000, 500_000_000), 2)
                    allocations_to_insert.append({
                        "scheme_id": s_id,
                        "state": state_name,
                        "district": d,
                        "allocated_amount": alloc,
                        "financial_year": fy
                    })
                    allocation_map[(s_id, state_name, d, fy)] = alloc
                    
                    # Utilization
                    # We will create multiple utilization records (say 6 per district/scheme/FY) across the year
                    # Make some districts exceed allocations (e.g. Bhind on PM Kisan)
                    util_multiplier = 0.95 # Normal
                    if d == "Bhind" and s_id == scheme_ids[0]:
                        util_multiplier = 1.08  # Overutilized by 8% to trigger warnings
                    elif d == "Gwalior":
                        util_multiplier = 0.60  # Underutilized
                    else:
                        util_multiplier = random.uniform(0.75, 0.98)
                    
                    total_utilized = alloc * util_multiplier
                    
                    # Split total utilized into 6 transactions (dates from Jan 2024 to May 2026)
                    start_date = date(2024, 4, 1) if fy == "2024-25" else date(2025, 4, 1)
                    for t in range(6):
                        days_to_add = random.randint(0, 330)
                        tx_date = start_date + timedelta(days=days_to_add)
                        # Limit dates to current local time (June 2026)
                        if tx_date > date(2026, 6, 20):
                            tx_date = date(2026, 6, 1)
                            
                        tx_amount = round(total_utilized / 6 * random.uniform(0.85, 1.15), 2)
                        utilizations_to_insert.append({
                            "scheme_id": s_id,
                            "state": state_name,
                            "district": d,
                            "utilized_amount": tx_amount,
                            "date": tx_date
                        })

    db.bulk_insert_mappings(models.FundAllocation, allocations_to_insert)
    db.bulk_insert_mappings(models.FundUtilization, utilizations_to_insert)
    db.commit()

    # 6. Generate 50,000 Beneficiary records
    print("Generating 50,000 synthetic beneficiary records...")
    start_time = time.time()
    
    beneficiaries_to_insert = []
    # Aadhaar base: 12 digits, e.g. 500000000001
    aadhaar_base = 500000000000
    
    # Maintain list of records to insert validation errors for
    underage_indices = []
    duplicate_aadhaar_indices = []
    
    # Pre-select indices to inject issues
    # 150 records will be underage (<18)
    for _ in range(150):
        underage_indices.append(random.randint(0, 49999))
        
    # Distribute generation to make sure we hit every district, block, and village
    for i in range(50000):
        # Pick random state, district, block, village
        state_name, d, blocks_list = random.choice(all_geography_flat)
        b = random.choice(blocks_list)
        v = f"{b} Village {random.randint(1, 5)}"
        s_id = random.choice(scheme_ids)
        
        # Age distribution: mostly adult, some underage
        if i in underage_indices:
            age = random.randint(12, 17)
        else:
            age = random.randint(18, 85)
            
        gender = random.choice(["Male", "Female", "Other"])
        name_pool_m = ["Ramesh", "Suresh", "Amit", "Rajesh", "Vijay", "Anil", "Rahul", "Dinesh", "Sanjay", "Sunil"]
        name_pool_f = ["Sunita", "Anita", "Geeta", "Kiran", "Rekha", "Priya", "Pooja", "Meena", "Suman", "Radha"]
        last_names = ["Kumar", "Sharma", "Singh", "Verma", "Gupta", "Patel", "Yadav", "Joshi", "Mishra", "Choudhary"]
        
        if gender == "Male":
            name = f"{random.choice(name_pool_m)} {random.choice(last_names)}"
        elif gender == "Female":
            name = f"{random.choice(name_pool_f)} {random.choice(last_names)}"
        else:
            name = f"{random.choice(name_pool_m + name_pool_f)} {random.choice(last_names)}"
            
        # Amount received based on scheme
        if s_id == scheme_ids[0]: # PM Kisan
            amount = 6000.0
        elif s_id == scheme_ids[1]: # PMAY
            amount = 120000.0
        elif s_id == scheme_ids[2]: # MGNREGA
            amount = round(random.uniform(5000, 25000), 2)
        elif s_id == scheme_ids[3]: # JJM
            amount = round(random.uniform(1500, 8000), 2)
        else: # Ayushman Bharat (Claim amount)
            amount = round(random.uniform(10000, 150000), 2)
            
        enroll_date = date(2024, 1, 1) + timedelta(days=random.randint(0, 850))
        if enroll_date > date(2026, 6, 20):
            enroll_date = date(2026, 6, 1)
            
        # Handle Aadhaar (Keep unique to respect database schema index rules)
        aadhaar = f"{aadhaar_base + i:012d}"
            
        beneficiaries_to_insert.append({
            "aadhaar_number": aadhaar,
            "name": name,
            "gender": gender,
            "age": age,
            "state": state_name,
            "district": d,
            "block": b,
            "village": v,
            "scheme_id": s_id,
            "amount_received": amount,
            "enrollment_date": enroll_date
        })

    # Bulk insert in chunks of 10,000 for safety and speed
    chunk_size = 10000
    for chunk_start in range(0, len(beneficiaries_to_insert), chunk_size):
        chunk = beneficiaries_to_insert[chunk_start : chunk_start + chunk_size]
        db.bulk_insert_mappings(models.Beneficiary, chunk)
        db.commit()
        
    print(f"Beneficiaries inserted. Time taken: {time.time() - start_time:.2f} seconds.")

    # 7. Seed Validation Errors
    # We will query some of the inserted beneficiaries to map their ids to errors
    print("Generating validation error logs...")
    inserted_beneficiaries = db.query(models.Beneficiary).all()
    
    validation_errors = []
    
    # Log Duplicate Aadhaar errors (Simulate duplicate notifications from uploads)
    duplicate_logged_count = 0
    for idx, b in enumerate(inserted_beneficiaries):
        if idx % 1000 == 0:
            validation_errors.append({
                "beneficiary_id": b.beneficiary_id,
                "error_type": "Duplicate Aadhaar",
                "description": f"Aadhaar number {b.aadhaar_number} is shared by multiple records (e.g. {b.name} in {b.district} and a separate upload file).",
                "timestamp": datetime.utcnow() - timedelta(hours=random.randint(1, 48))
            })
            duplicate_logged_count += 1
            if duplicate_logged_count >= 50:
                break
                
    # Log Age errors
    age_logged_count = 0
    for b in inserted_beneficiaries:
        if b.age < 18:
            validation_errors.append({
                "beneficiary_id": b.beneficiary_id,
                "error_type": "Age Validation Failure",
                "description": f"Beneficiary {b.name} is aged {b.age}, which is below the scheme's minimum age threshold of 18.",
                "timestamp": datetime.utcnow() - timedelta(hours=random.randint(1, 48))
            })
            age_logged_count += 1
            if age_logged_count >= 60:
                break
                
    # Log Budget Overutilization errors (Bhind PM Kisan)
    pm_kisan_scheme = db_schemes[0]
    validation_errors.append({
        "beneficiary_id": None,
        "error_type": "Fund Overutilization",
        "description": f"Bhind has utilized 108% of its allocated funds for {pm_kisan_scheme.scheme_name} in FY 2024-25.",
        "timestamp": datetime.utcnow() - timedelta(hours=12)
    })
    
    db.bulk_insert_mappings(models.ValidationError, validation_errors)
    db.commit()

    # 8. Create some initial Audit Logs
    print("Generating audit logs...")
    audit_logs_data = [
        {"action": "Database Init", "details": "Database schema created and initial structural parameters registered.", "timestamp": datetime.utcnow() - timedelta(days=2)},
        {"action": "Seeding Complete", "details": "Generated 5 schemes, 20 districts, 100 blocks, 500 villages, and 50,000 beneficiary records.", "timestamp": datetime.utcnow() - timedelta(minutes=1)}
    ]
    db.bulk_insert_mappings(models.AuditLog, audit_logs_data)
    db.commit()

    print("Database seeding completed successfully.")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        # Create tables if not exist
        Base.metadata.create_all(bind=engine)
        seed_database(db)
    finally:
        db.close()
