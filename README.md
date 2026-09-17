# CSS Homework 1

This repository contains two full-stack data dashboards:

- **Disease Radar** - interactive exploration of U.S. notifiable disease surveillance data.
- **World Bank Data Explorer** - exploration and comparison of World Development Indicators.

## Live applications

- Disease Radar: https://disease-radar-web-production.up.railway.app
- World Bank Data Explorer: https://world-bank-web-production.up.railway.app

## Project structure

```text
CSS_homework_1/
├── cdc_data/
│   ├── backend/
│   └── frontend/
│
└── world_bank_data_catalog/
    ├── backend/
    └── frontend/
```

## Data Sources

### Disease Radar

The project uses data from the **CDC National Notifiable Diseases Surveillance System (NNDSS)**.

Dataset:

https://data.cdc.gov/NNDSS/NNDSS-Weekly-Data/x9gk-5huc/about_data

Download the dataset as a CSV file and place it in:

```text
cdc_data/backend/data/
```

The deployed version of the application uses a subset containing data from **2024–2026** in order to reduce memory usage while keeping the dataset larger than 100 MB.

The script:

```text
cdc_data/backend/data/trim_dataset.py
```

can be used to create the reduced dataset from the original NNDSS CSV file.

### World Bank Data Explorer

The project uses the **World Development Indicators (WDI)** dataset published by the World Bank.

Dataset:

https://datacatalog.worldbank.org/search/dataset/0037712/world-development-indicators

Download and extract the dataset files into:

```text
world_bank_data_catalog/backend/data/
```

## Running Locally

### 1. Disease Radar

#### Backend

Open a terminal and run:

```bash
cd cdc_data/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The backend will be available at:

```text
http://localhost:8000
```

#### Frontend

Open another terminal and run:

```bash
cd cdc_data/frontend
npm install
npm run dev
```

The frontend uses `http://localhost:5173` as the default local API URL.

---

### 2. World Bank Data Explorer

#### Backend

Open a terminal and run:

```bash
cd world_bank_data_catalog/backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The backend will be available at:

```text
http://localhost:8000
```

#### Frontend

Open another terminal and run:

```bash
cd world_bank_data_catalog/frontend
npm install
npm run dev
```

The frontend uses `http://localhost:5173` as the default local API URL.
