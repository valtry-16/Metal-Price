# Auric Ledger

Premium, production-ready platform for tracking real-time precious metal prices in INR, with daily updates, charts, alerts, and exports.

Live site: https://metal-price.onrender.com

Developer: Sabithulla

## Highlights
- 9 metals: Gold, Silver, Platinum, Palladium, Copper, Nickel, Zinc, Aluminium, Lead
- Real-time INR pricing with duty and GST included
- Weekly + monthly historical charts
- PWA installable experience (desktop and mobile)
- Alerts system (target price or percentage change)
- Daily email notifications with welcome email delivery
- Telegram bot updates and charts
- CSV and PDF exports

## Tech Stack
- Frontend: React + Vite + PWA
- Backend: Node.js + Express
- Database: Supabase (PostgreSQL)
- Data API: apised.com metals API
- Email: Brevo API

## Local Setup
### 1) Install dependencies
```bash
cd frontend
npm install

cd ../backend
npm install
```

### 2) Configure environment variables
Backend: create backend/.env using backend/.env.example (or your local values).

Required (backend):
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- METALS_API_KEY
- RUN_DAILY_SECRET
- RUN_WELCOME_EMAIL_SECRET
- EMAIL_USER
- BREVO_API_KEY

Frontend: set frontend/.env
```bash
VITE_API_BASE_URL=https://metal-price.onrender.com
```

### 3) Run locally
```bash
# Terminal 1
cd backend
npm run dev

# Terminal 2
cd frontend
npm run dev
```

## Production Notes
### Cron jobs (cron-job.org)
Create 3 jobs:
- GET /wake-up every 1 minute
- POST /send-welcome-emails every 5 minutes (header: x-send-welcome-emails-secret)
- POST /run-daily at 9:00 AM IST (header: x-run-daily-secret)

### Deployment
Backend: Render
- Set backend environment variables in Render dashboard

Frontend: Vercel/Netlify/Render
- Set VITE_API_BASE_URL to your backend URL

## Key API Endpoints
- POST /subscribe-email
- POST /send-welcome-emails
- POST /run-daily
- GET /get-latest-price
- GET /compare-yesterday
- GET /weekly-history
- GET /monthly-history

## Security
- CORS restricted to trusted origins
- Request size limits and timeouts
- Rate limiting for abuse protection
- Input validation and email sanitization
- Sensitive data masking in logs
- CSP and security headers

## License
MIT
