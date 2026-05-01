# Government Scheme Monitoring & MIS Automation System

**Live Application Link**: [https://scheme-monitoring-system.vercel.app](https://scheme-monitoring-system.vercel.app)

This is a premium, end-to-end full-stack web application designed for central and state governments to monitor the implementation and performance of major welfare schemes:
- **PM Kisan** (Pradhan Mantri Kisan Samman Nidhi)
- **PMAY** (Pradhan Mantri Awas Yojana)
- **MGNREGA** (Mahatma Gandhi National Rural Employment Guarantee Act)
- **Jal Jeevan Mission** (JJM)
- **Ayushman Bharat** (PM-JAY)

The system automates the data ingestion (ETL), validation, fund reconciliation, forecasting, and reporting processes.

---

## Technical Stack

- **Frontend**: React.js, Tailwind CSS v3, Recharts, Material UI
- **Backend**: FastAPI (Python), Pandas, NumPy, Scikit-learn (Linear Regression & Moving Average)
- **Database**: PostgreSQL
- **Authentication**: JWT, Role-Based Access Control (RBAC)
- **Deployment**: Docker, Docker Compose

---

## Localhost Execution

You can run the application either with **Docker Compose (Recommended)** or **Natively (with local services)**.

### Method 1: One-Command Startup (Docker Compose)

To start the database, backend API, and frontend client concurrently:

```bash
docker compose up --build
```

- **Frontend**: Port 5173
- **Backend API**: Port 8000
- **FastAPI OpenAPI Documentation**: Port 8000 (`/docs`)

---

### Method 2: Native Manual Startup

#### 1. Database (Docker Compose)
Start the PostgreSQL container:
```bash
docker compose up -d db
```

#### 2. Backend (FastAPI)
Initialize virtual environment and run development server:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

#### 3. Frontend (Vite + React)
Install node modules and start Vite server:
```bash
cd frontend
npm install
npm run dev
```

- **Frontend**: Port 5173
- **Backend API**: Port 8000

---

## Pre-Seeded Security Accounts

On first-time startup, the database is automatically seeded with **50,000 synthetic beneficiary records** spanning multiple states (Madhya Pradesh, Uttar Pradesh, Rajasthan), and the following default roles:

| User Role | Email | Password | Access scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@gov.in` | `admin123` | Full access (all states, all views, reconciliation, upload, audit logs, forecasting) |
| **State Admin (MP)** | `state@gov.in` or `state_mp@gov.in` | `state123` | Locked to Madhya Pradesh dashboards, reconciliation, report downloads, logs |
| **State Admin (UP)** | `state_up@gov.in` | `state123` | Locked to Uttar Pradesh dashboards, reconciliation, report downloads |
| **State Admin (RJ)** | `state_rj@gov.in` | `state123` | Locked to Rajasthan dashboards, reconciliation, report downloads |
| **District Officer (Bhind, MP)** | `bhind@gov.in` | `bhind123` | Filtered to Bhind district dashboard, rankings, and reports |
| **District Officer (Etawah, UP)** | `etawah@gov.in` | `etawah123` | Filtered to Etawah district dashboard, rankings, and reports |
| **District Officer (Dholpur, RJ)** | `dholpur@gov.in` | `dholpur123` | Filtered to Dholpur district dashboard, rankings, and reports |
| **Block Officer (Bhind, MP)** | `block@gov.in` | `block123` | Filtered to Bhind blocks and villages dashboard oversight |
| **Data Entry Operator (MP)** | `operator@gov.in` | `operator123` | ETL Drag-and-Drop Uploader & Validation log feedback for MP |

---

## Features

### 1. Data Ingestion & ETL (Pandas)
- Drag & Drop interface for CSV/Excel uploads.
- Similarity heuristic matching maps raw file headers to standard schema fields automatically.
- De-duplicates by Aadhaar and standardizes formatting (date forms, casing).

### 2. Validation & Quality Checks
- Rejects underage applicants (Age < 18).
- Blocks duplicate Aadhaar entries.
- Flags and stores database violations in the `validation_errors` table.
- Warns if utilization in a district/scheme exceeds the allocated budget.

### 3. Power BI-style Dashboards (Recharts)
- Executive summary metrics cards.
- Month-by-month enrollment trends.
- Area-wise expenditure mappings.
- District rankings sorted by burn rate efficiency.
- Pie chart visualization of scheme share percentages.

### 4. Advanced Analytics & Forecasting (Scikit-Learn)
- Fits Ordinary Least Squares Linear Regression and Rolling 3-Month Moving Average models on historical data.
- Generates 12-month projections of beneficiary counts and fund utilization.
- Visualizes forecast paths as dashed lines in interactive Recharts components.

### 5. MIS Reports Center
- Generates styled, print-ready PDF reports (using ReportLab) complete with grids and audit summaries.
- Generates formatted Excel spreadsheets (using Openpyxl) containing summary pages, scheme metrics, and integrity violations worksheets.

### 6. Audit Logging & Notifications
- Monitors login sessions, file ingestion summaries, and report downloads.
- Real-time warning bell highlights active database integrity violations.

---

## Developer / Maintainer

Designed and developed by **Ansh Shukla**.

- **GitHub**: [github.com/anshspc](https://github.com/anshspc)
- **LinkedIn**: [Ansh Shukla on LinkedIn](https://www.linkedin.com/in/ansh-shukla-656a211b4/)
