# Auric Ledger

Production-ready full-stack app for tracking real-time prices of precious metals with INR conversion, taxes, and historical trends. Built with React, Node.js, and Supabase.

## Features
- 🥇 Track 9 precious metals (Gold, Silver, Platinum, Palladium, Copper, Nickel, Zinc, Aluminium, Lead)
- 📊 Real-time price updates in INR with transparent calculations
- 📱 Progressive Web App (PWA) - installable on desktop & mobile
- 📈 Weekly and monthly historical trends
- 🌙 Dark/Light theme support
- 🔄 Automatic daily price fetching via cron job
- 📥 PDF report generation & CSV export
- 🔔 Price Alerts (target price, percentage change)
- 📧 Daily Email Notifications with all metal prices
- 🌐 Browser Notifications for instant alerts

## Stack
- Frontend: React + Vite (with PWA support)
- Backend: Node.js + Express
- Database: Supabase (PostgreSQL)
- API: apised.com Metals API

## Setup
1. Create a Supabase project and run the SQL in `backend/sql/metal_prices.sql`.
2. Copy `.env.example` to `.env` and fill in:
   - Supabase credentials
   - `METALS_API_KEY` from [apised.com](https://apised.com/apis/metals/documentation)
   - (Optional) Email credentials for daily email notifications (see ALERTS_SETUP.md)

## Email Notifications
To enable daily email notifications with all metal prices:
1. Set `EMAIL_USER` and `EMAIL_PASSWORD` in `.env` (Gmail or any SMTP service)
2. Create the email subscriptions table in Supabase (see `backend/migrations/01_create_email_subscriptions.sql`)
3. Users can subscribe via the "🔔 Alerts" modal in the app

**Full setup guide**: See [ALERTS_SETUP.md](ALERTS_SETUP.md)

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

## API Endpoints
- `POST /fetch-today-prices` - Fetch and store today's prices
- `GET /get-latest-price` - Get latest prices for all metals
- `GET /compare-yesterday` - Compare today vs yesterday prices
- `GET /weekly-history` - Get weekly price history
- `GET /monthly-history` - Get monthly price history

## Data Source
The backend fetches metal prices from **apised.com Metals API**:
- Supported Metals: `https://metals.g.apised.com/v1/supported-metals`
- Price Data: `https://metals.g.apised.com/v1/latest?symbols=XAU,XAG,XPD,XPT,XCU,NI,ZNC,ALU,LEAD&base_currency=USD`

Supported metals: Gold (XAU), Silver (XAG), Platinum (XPT), Palladium (XPD), Copper (XCU), Nickel (NI), Zinc (ZNC), Aluminium (ALU), Lead (LEAD)

## PWA Installation
Install Auric Ledger as an app on your device:
- **Desktop**: Chrome/Edge installer button in address bar
- **Android**: Tap menu → "Add to Home screen"
- **iOS**: Safari → Share → "Add to Home Screen"
