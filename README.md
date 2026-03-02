# Auric Ledger

Premium, production-ready platform for tracking real-time precious metal prices in INR, with AI insights, portfolio simulation, and professional tools.

Live site: https://auric-ledger.vercel.app
API: https://metal-price.onrender.com

Developer: Sabithulla

## Highlights
- **Multi-page routed SPA** with React Router (Home, Market, Portfolio, Calculator, Compare, News, Dashboard, Settings)
- **Supabase Authentication** (Google OAuth + Email/Password) with protected routes
- **9 metals**: Gold, Silver, Platinum, Palladium, Copper, Nickel, Zinc, Aluminium, Lead
- Real-time INR pricing with duty and GST included
- Weekly + monthly historical charts (Chart.js)
- **Portfolio Simulator** — virtual ₹10 Lakh trading with P&L tracking
- **Jewellery Calculator** — price breakdown with purity, making charges, GST
- **Metal Comparison** — side-by-side charts and stats
- **AI Market Insights** — daily AI-generated summaries + RAG chatbot
- Alerts system (target price or percentage change)
- Daily email notifications via Brevo
- Telegram bot updates and charts
- CSV and PDF exports
- Luxury fintech design with dark/light theme
- PWA installable experience (desktop and mobile)

## Tech Stack
- **Frontend**: React 19 + Vite 8 + React Router DOM + Chart.js
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (Google OAuth + Email/Password)
- **Data API**: apised.com metals API
- **Email**: Brevo API
- **Deployment**: Vercel (frontend), Render (backend)

## Project Structure
```
frontend/
├── src/
│   ├── App.jsx              # Router shell with lazy-loaded pages
│   ├── index.css             # 4000+ line luxury fintech design system
│   ├── contexts/             # ThemeContext, AuthContext
│   ├── components/           # Navbar, Footer, AuthModal, ProtectedRoute
│   ├── pages/                # Home, Market, Portfolio, Calculator, Compare, News, Dashboard, Settings
│   ├── lib/                  # supabaseClient.js
│   └── utils/                # constants.js, helpers.js
├── vercel.json               # SPA rewrite rules
└── .env                      # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
backend/
├── server.js                 # Express API server
├── .env                      # API keys, Supabase credentials
└── ...
```

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
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3) Set up Supabase Auth (optional)
1. Go to Supabase Dashboard > Authentication > Providers
2. Enable Google OAuth (add Google Client ID/Secret from Google Cloud Console)
3. Set redirect URL: `https://your-domain.com` (or `http://localhost:5173` for local dev)
4. Copy the anon key from Settings > API into `frontend/.env`

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
