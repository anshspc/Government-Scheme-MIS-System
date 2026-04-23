import numpy as np
import pandas as pd
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import func
from sklearn.linear_model import LinearRegression
from app import models

def get_forecast_predictions(db: Session, filter_state: str = None, filter_district: str = None, filter_scheme_id: int = None):
    # 1. Fetch Beneficiary data grouped by month
    b_query = db.query(
        models.Beneficiary.enrollment_date,
        func.count(models.Beneficiary.beneficiary_id).label("count")
    )
    if filter_state:
        b_query = b_query.filter(models.Beneficiary.state == filter_state)
    if filter_district:
        b_query = b_query.filter(models.Beneficiary.district == filter_district)
    if filter_scheme_id:
        b_query = b_query.filter(models.Beneficiary.scheme_id == filter_scheme_id)
        
    b_data = b_query.group_by(models.Beneficiary.enrollment_date).all()
    
    # 2. Fetch Fund Utilization data grouped by month
    u_query = db.query(
        models.FundUtilization.date,
        func.sum(models.FundUtilization.utilized_amount).label("amount")
    )
    if filter_state:
        u_query = u_query.filter(models.FundUtilization.state == filter_state)
    if filter_district:
        u_query = u_query.filter(models.FundUtilization.district == filter_district)
    if filter_scheme_id:
        u_query = u_query.filter(models.FundUtilization.scheme_id == filter_scheme_id)
        
    u_data = u_query.group_by(models.FundUtilization.date).all()

    # Process Beneficiaries into a monthly DataFrame
    b_df = pd.DataFrame([{"date": r[0], "count": r[1]} for r in b_data])
    if b_df.empty:
        # Fallback if database empty
        b_df = pd.DataFrame(columns=["date", "count"])
    else:
        b_df["date"] = pd.to_datetime(b_df["date"])
        b_df = b_df.set_index("date").resample("ME").sum().reset_index()

    # Process Utilizations into a monthly DataFrame
    u_df = pd.DataFrame([{"date": r[0], "amount": r[1]} for r in u_data])
    if u_df.empty:
        u_df = pd.DataFrame(columns=["date", "amount"])
    else:
        u_df["date"] = pd.to_datetime(u_df["date"])
        u_df = u_df.set_index("date").resample("ME").sum().reset_index()

    # Align date range from April 2024 to current (say June 2026)
    # Let's populate missing months with 0 or low numbers
    all_months = pd.date_range(start="2024-04-01", end="2026-06-30", freq="ME")
    
    b_aligned = pd.DataFrame({"date": all_months})
    b_aligned = pd.merge(b_aligned, b_df, on="date", how="left").fillna(0)
    
    u_aligned = pd.DataFrame({"date": all_months})
    u_aligned = pd.merge(u_aligned, u_df, on="date", how="left").fillna(0)

    # 3. Apply Forecasting helper function
    b_forecast, b_metrics = run_forecast_models(b_aligned, "count", 12)
    u_forecast, u_metrics = run_forecast_models(u_aligned, "amount", 12)

    return {
        "beneficiaries": b_forecast,
        "utilization": u_forecast,
        "model_metrics": {
            "beneficiary_r2": b_metrics["r2"],
            "utilization_r2": u_metrics["r2"]
        }
    }

def run_forecast_models(df: pd.DataFrame, target_col: str, forecast_months: int = 12) -> tuple:
    # Check if we have enough points
    if len(df) < 3:
        # Return fallback mock list
        fallback = []
        for i in range(12):
            fallback.append({
                "label": f"Month +{i+1}",
                "actual": None,
                "forecast_linear": 100 + i * 5,
                "forecast_ma": 100
            })
        return fallback, {"r2": 0.0}

    # Prepare indices
    n_historical = len(df)
    X = np.arange(n_historical).reshape(-1, 1)
    y = df[target_col].values

    # Fit Linear Regression
    lr = LinearRegression()
    lr.fit(X, y)
    r2_score = float(lr.score(X, y))

    # Forecast with Linear Regression
    future_X = np.arange(n_historical, n_historical + forecast_months).reshape(-1, 1)
    future_y_lr = lr.predict(future_X)
    # clamp negative predictions to 0
    future_y_lr = np.clip(future_y_lr, 0, None)

    # Fit Moving Average Forecast
    # We will use W = 3 months
    window_size = 3
    historical_ma = df[target_col].rolling(window=window_size).mean().fillna(df[target_col].mean()).values

    # Generate future Moving Average iteratively
    future_y_ma = []
    temp_history = list(y)
    for _ in range(forecast_months):
        next_ma = float(np.mean(temp_history[-window_size:]))
        future_y_ma.append(next_ma)
        temp_history.append(next_ma)

    # Combine into a single Recharts friendly response
    output = []
    
    # 1. Historical data points
    for idx, row in df.iterrows():
        date_str = row["date"].strftime("%b %Y")
        output.append({
            "label": date_str,
            "actual": float(row[target_col]),
            "forecast_linear": float(lr.predict([[idx]])[0]),
            "forecast_ma": float(historical_ma[idx])
        })
        
    # 2. Future forecast points
    last_date = df["date"].iloc[-1]
    for i in range(forecast_months):
        next_date = last_date + pd.DateOffset(months=i+1)
        date_str = next_date.strftime("%b %Y")
        output.append({
            "label": date_str,
            "actual": None,
            "forecast_linear": float(future_y_lr[i]),
            "forecast_ma": float(future_y_ma[i])
        })

    return output, {"r2": r2_score}
