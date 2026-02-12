# Metal Price Tracker

Production-ready full-stack app for tracking daily prices of gold, silver, and other metals with INR conversion, taxes, and historical trends.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: Supabase (PostgreSQL)

## Setup
1. Create a Supabase project and run the SQL in `backend/sql/metal_prices.sql`.
2. Copy `.env.example` to `.env` and fill in Supabase credentials.

## Install
```bash
cd frontend
npm install

cd ../backend
npm install
```

## Run
```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

## API
- `POST /fetch-today-prices`
- `GET /get-latest-price`
- `GET /compare-yesterday`
- `GET /weekly-history`
- `GET /monthly-history`

## Metal Symbols
The backend pulls symbols from `https://api.gold-api.com/symbols` and then fetches each symbol price from `https://api.gold-api.com/price/{symbol}` so newly added symbols are picked up automatically.
