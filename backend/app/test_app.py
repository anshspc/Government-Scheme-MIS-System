import pytest
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app import models, auth, data_pipeline, analytics

# In-memory SQLite Database setup for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_password_hashing():
    plain_password = "password123"
    hashed = auth.get_password_hash(plain_password)
    assert hashed != plain_password
    assert auth.verify_password(plain_password, hashed) is True
    assert auth.verify_password("wrong_password", hashed) is False

def test_jwt_generation():
    email = "test@gov.in"
    token = auth.create_access_token(data={"sub": email})
    assert token is not None
    
    # decode check
    payload = auth.jwt.decode(token, auth.settings.SECRET_KEY, algorithms=[auth.settings.ALGORITHM])
    assert payload.get("sub") == email

def test_district_name_normalization():
    assert data_pipeline.normalize_district_name("district 1") == "District 1"
    assert data_pipeline.normalize_district_name("DISTRICT   12") == "District 12"
    assert data_pipeline.normalize_district_name("District 3") == "District 3"
    assert data_pipeline.normalize_district_name("Patna") == "Patna"

def test_scheme_name_normalization():
    assert data_pipeline.clean_scheme_name("pm kisan portal") == "PM Kisan"
    assert data_pipeline.clean_scheme_name("PMAY-Urban") == "PMAY"
    assert data_pipeline.clean_scheme_name("nrega rural") == "MGNREGA"
    assert data_pipeline.clean_scheme_name("jal jeevan mission") == "Jal Jeevan Mission"
    assert data_pipeline.clean_scheme_name("ayushman bharat card") == "Ayushman Bharat"

def test_etl_data_ingestion_and_validation(db_session):
    # 1. Create a scheme first
    scheme = models.Scheme(scheme_name="PM Kisan", description="Welfare")
    db_session.add(scheme)
    db_session.commit()
    
    # 2. Build mock raw CSV bytes
    csv_content = (
        "Aadhar,Full Name,Sex,Age,Dist Name,Block,Village,Scheme,Benefit,Date\n"
        "123456789012,Ramesh Kumar,Male,34,District 1,Block 1,Village 1,PM Kisan,2000,2024-05-12\n"
        "987654321098,Underage Boy,Male,12,District 2,Block 2,Village 5,PM Kisan,2000,2024-06-15\n" # Should fail age > 18
    )
    
    # Run ETL
    df, logs = data_pipeline.run_etl_pipeline(csv_content.encode('utf-8'), "mock_data.csv")
    assert df is not None
    assert len(df) == 2
    
    # Validate and Save
    stats = data_pipeline.validate_and_save_data(df, db_session)
    assert stats["success_count"] == 1
    assert stats["error_count"] == 1 # 1 underage record
    
    # Assert database states
    beneficiaries = db_session.query(models.Beneficiary).all()
    assert len(beneficiaries) == 1
    assert beneficiaries[0].name == "Ramesh Kumar"
    
    validation_errors = db_session.query(models.ValidationError).all()
    assert len(validation_errors) == 1
    assert "below 18" in validation_errors[0].description

def test_forecasting_calculation(db_session):
    # Setup simple historical data points
    scheme = models.Scheme(scheme_name="PM Kisan", description="Welfare")
    db_session.add(scheme)
    db_session.commit()
    
    # Insert 6 beneficiaries enrolled in different dates in 2024
    for i in range(6):
        b = models.Beneficiary(
            aadhaar_number=f"50000000000{i}",
            name=f"Farmer {i}",
            gender="Male",
            age=30,
            district="District 1",
            block="Block 1",
            village="Village 1",
            scheme_id=scheme.id,
            amount_received=6000.0,
            enrollment_date=date(2024, 1 + i, 15)
        )
        db_session.add(b)
        
    db_session.commit()
    
    # Run analytics predictions
    forecast = analytics.get_forecast_predictions(db_session, filter_district="District 1", filter_scheme_id=scheme.id)
    assert forecast is not None
    assert "beneficiaries" in forecast
    assert len(forecast["beneficiaries"]) > 6
    
    # Verify forecast fields
    future_point = forecast["beneficiaries"][-1]
    assert future_point["actual"] is None
    assert "forecast_linear" in future_point
    assert "forecast_ma" in future_point

def test_multi_state_filtering(db_session):
    scheme = models.Scheme(scheme_name="PM Kisan", description="Welfare")
    db_session.add(scheme)
    db_session.commit()
    
    # Add beneficiaries for different states
    b1 = models.Beneficiary(
        aadhaar_number="111111111111",
        name="MP Beneficiary",
        gender="Male",
        age=30,
        state="Madhya Pradesh",
        district="Bhind",
        block="Block 1",
        village="Village 1",
        scheme_id=scheme.id,
        amount_received=2000.0,
        enrollment_date=date(2024, 5, 12)
    )
    b2 = models.Beneficiary(
        aadhaar_number="222222222222",
        name="UP Beneficiary",
        gender="Female",
        age=28,
        state="Uttar Pradesh",
        district="Etawah",
        block="Block 1",
        village="Village 1",
        scheme_id=scheme.id,
        amount_received=2000.0,
        enrollment_date=date(2024, 6, 12)
    )
    db_session.add(b1)
    db_session.add(b2)
    db_session.commit()
    
    # Assert query count by state
    assert db_session.query(models.Beneficiary).filter(models.Beneficiary.state == "Madhya Pradesh").count() == 1
    assert db_session.query(models.Beneficiary).filter(models.Beneficiary.state == "Uttar Pradesh").count() == 1

if __name__ == "__main__":
    pytest.main(["-v"])
