# Metal Price Tracker

Production-ready full-stack app for tracking daily prices of gold, silver, and other metals with INR conversion, taxes, and historical trends.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: Supabase (PostgreSQL)

## Setup
1. Create a Supabase project and run the SQL in `backend/sql/metal_prices.sql`.
2. Copy `.env.example` to `.env` and fill in:
   - Supabase credentials
   - `METALS_API_KEY` from [apised.com](https://apised.com/apis/metals/documentation)

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
The backend pulls symbols from `https://metals.g.apised.com/v1/supported-metals` and fetches all prices in a single request from `https://metals.g.apised.com/v1/latest?symbols=XAU,XAG,XPD,XPT,XCU,NI,ZNC,ALU,LEAD&base_currency=USD` using the apised.com API. Supported metals include gold, silver, platinum, palladium, copper, nickel, zinc, aluminum, and lead.
