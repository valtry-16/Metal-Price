# Auric Ledger

Auric Ledger is a full-stack precious and industrial metal intelligence platform for India. It provides live and historical INR metal prices, AI-driven market assistance, portfolio simulation, alerts, daily summaries, news ingestion, and multi-channel notifications.

- Live App: https://auric--ledger.vercel.app
- Backend API: https://metal-price.onrender.com
- Developer: Sabithulla

## Table of Contents

- 1. Product Overview
- 2. Tech Stack
- 3. Features
- 4. System Architecture
- 5. Repository Structure
- 6. Frontend Routes
- 7. Backend API Reference
- 8. Backend Module and Function Map
- 9. Data Model and Database Tables
- 10. Environment Variables
- 11. Local Development Setup
- 12. Build, Run, and Scripts
- 13. Scheduler and Daily Operations
- 14. Deployment Notes
- 15. Security and Reliability
- 16. Troubleshooting
- 17. License

## 1. Product Overview

Auric Ledger is designed for users who need reliable metal pricing and market context in Indian Rupees.

It combines:

- Real-time and daily-updated pricing for 9 metals
- AI chatbot with grounded database answers
- AI-generated daily market summary
- Portfolio simulator with trade history and P/L tracking
- Email, browser push, and Telegram updates
- PWA installability and offline-aware behavior

Tracked metals:

- XAU (Gold)
- XAG (Silver)
- XPT (Platinum)
- XPD (Palladium)
- XCU (Copper)
- LEAD (Lead)
- NI (Nickel)
- ZNC (Zinc)
- ALU (Aluminium)

Gold supports carat-specific pricing:

- 24K
- 22K
- 18K

## 2. Tech Stack

### Frontend

- React 19
- Vite 8
- React Router DOM
- Chart.js + react-chartjs-2
- ApexCharts + react-apexcharts
- Supabase JS client
- jsPDF + jspdf-autotable
- dayjs

### Backend

- Node.js (ES Modules)
- Express
- Axios
- Supabase JS client
- node-cron
- express-rate-limit
- express-validator
- Helmet
- node-telegram-bot-api
- web-push

### Infrastructure and Integrations

- Database/Auth: Supabase (PostgreSQL + Supabase Auth)
- Metal data provider: apised.com
- FX source: frankfurter.app
- News source: NewsAPI
- AI services:
  - HF embedding endpoint
  - HF chat completion endpoint
  - Groq completion endpoint for daily summaries
- Email service: Brevo API
- Frontend hosting: Vercel
- Backend hosting: Render

## 3. Features

### Market Intelligence

- Latest prices for all tracked metals
- Gold carat-aware display (24K, 22K, 18K)
- Weekly and monthly historical charts
- Daily comparison vs previous day
- Combined market-data endpoint for efficient frontend loading

### AI Features

- Auric AI chatbot with:
  - Embedding-based intent detection
  - Date and metal extraction from natural language
  - Database-grounded context injection
  - Streaming response mode for web chat
- Daily AI summary pipeline with:
  - Background generation
  - SSE status broadcast
  - Storage in daily_summaries

### User and Notification Features

- Supabase login/signup (Google OAuth + email/password)
- Protected pages for user-specific tools
- Email subscription and welcome email flow
- Price alert trigger emails
- Browser push subscription and per-metal preferences
- Telegram bot:
  - Price commands
  - Summary commands
  - Chart generation
  - AI question handling
  - Subscription management

### Productivity Features

- Portfolio simulator:
  - Buy/sell metal holdings
  - Top-up/reset virtual balance
  - Historical trade records
- PDF/CSV export workflows on frontend
- PWA installability and service-worker caching
- SEO and structured metadata in frontend entry page

## 4. System Architecture

### High-level flow

1. Frontend calls backend API for market/news/portfolio/chat data.
2. Backend fetches and stores canonical metal prices in Supabase.
3. Chatbot combines intent + DB context + strict prompting to answer.
4. Daily jobs trigger notifications and AI summary generation.
5. Push/email/Telegram channels distribute updates.

### Core backend orchestrator

- Entry point: backend/src/index.js
- Responsibilities:
  - Security middleware and global controls
  - Data fetching and persistence
  - API routing
  - Daily pipeline orchestration
  - Notification dispatching
  - Portfolio and chat endpoints

## 5. Repository Structure

```text
.
├─ backend/
│  ├─ migrations/
│  │  ├─ 001_add_welcome_sent_at.sql
│  │  └─ 01_create_email_subscriptions.sql
│  ├─ scripts/
│  │  └─ cleanup-duplicates.js
│  ├─ sql/
│  │  ├─ cleanup_duplicates.sql
│  │  └─ metal_prices.sql
│  ├─ src/
│  │  ├─ index.js
│  │  ├─ chatbot.js
│  │  ├─ knowledge-base.js
│  │  └─ telegram-bot.js
│  └─ package.json
├─ frontend/
│  ├─ public/
│  │  ├─ sw.js
│  │  ├─ manifest.json
│  │  ├─ offline.html
│  │  ├─ robots.txt
│  │  └─ sitemap.xml
│  ├─ src/
│  │  ├─ App.jsx
│  │  ├─ main.jsx
│  │  ├─ register-sw.js
│  │  ├─ contexts/
│  │  ├─ components/
│  │  ├─ pages/
│  │  ├─ lib/
│  │  └─ utils/
│  ├─ index.html
│  ├─ vite.config.js
│  ├─ vercel.json
│  └─ package.json
├─ .env.example
└─ README.md
```

## 6. Frontend Routes

From frontend/src/App.jsx:

### Public routes

- /
- /market
- /compare
- /news
- /summary
- /faq
- /privacy

### Protected routes

- /portfolio
- /calculator
- /dashboard
- /settings

## 7. Backend API Reference

All routes are defined in backend/src/index.js.

### Health and uptime

- GET /health
  - Simple health check
- GET /wake-up
  - Keep-alive ping endpoint for Render cold-start prevention

### Metal price and market endpoints

- POST /fetch-today-prices
  - Manual trigger to fetch/store latest prices
- GET /fetch-today-prices
  - GET-compatible trigger for cron services
- GET /get-latest-price
  - Latest prices (all or metal-specific)
- GET /compare-yesterday
  - Compare latest metal with previous day
- GET /weekly-history
  - Last 7-day history for selected metal
- GET /monthly-history
  - Monthly history with available month list
- GET /market-data
  - Combined latest + comparison + weekly + monthly payload
- GET /daily-price-summary
  - Browser-friendly daily summary dataset

### News endpoints

- GET /news-articles
  - Read stored news from Supabase
- POST /fetch-news
  - Secret-protected NewsAPI fetch + replace
- GET /fetch-news
  - Secret-protected GET variant for cron systems

### AI summary endpoints

- GET /summary-events
  - SSE stream for summary generation status
- POST /generate-daily-summary
  - Secret-protected trigger for background summary generation
- GET /daily-summary
  - Fetch latest stored AI summary

### Email and alerts

- POST /subscribe-email
  - Add/update email subscribers
- POST /send-welcome-emails
  - Secret-protected pending welcome email job
- POST /trigger-price-alert
  - Trigger alert emails for threshold conditions

### Push notification endpoints

- POST /push/subscribe
  - Save push subscription + selected metals
- PUT /push/preferences
  - Update per-user metal preferences
- GET /push/preferences/:userId
  - Retrieve user push preferences
- POST /push/unsubscribe
  - Remove user push subscriptions
- GET /push/vapid-key
  - Public VAPID key exposure for browser registration

### Portfolio simulator endpoints

- GET /api/portfolio
- POST /api/portfolio/buy
- POST /api/portfolio/sell
- POST /api/portfolio/topup
- POST /api/portfolio/reset
- GET /api/portfolio/prices
- GET /api/prices-on-date
- GET /api/available-dates

### Chat endpoint

- POST /api/chat
  - Supports non-stream and streaming modes
  - Uses backend/src/chatbot.js

### Scheduled job trigger endpoints

- POST /run-daily
  - Secret-protected full daily pipeline trigger
- POST /preserve-yesterday
  - Secret-protected prior-day snapshot trigger

## 8. Backend Module and Function Map

### backend/src/index.js

Primary responsibilities:

- Express app bootstrap
- Security middleware and controls
- Supabase and service initialization
- Data fetch + transform + upsert pipeline
- Endpoint registration
- Email/push/Telegram dispatch integration
- Summary generation orchestration

Key function groups:

1) Security and response helpers
- maskSensitiveData
- isValidEmail
- sendErrorResponse
- sendSuccessResponse

2) Data normalization and conversion
- normalizeSymbolsResponse
- normalizePriceResponse
- isGold
- isSilver
- resolveCarat
- buildRowsForMetal

3) Core price ingestion and guardrails
- getMetalSymbols
- getUsdToInrRate
- fetchAndStoreToday
- fetchWithGuard
- summarizeFetchResult
- preserveYesterdayPrices

4) Market query helpers
- getLatestDate
- getLatestRows
- getLatestForMetal
- getComparison
- getWeeklyHistory
- getMonthlyHistory
- getAvailableMonths

5) Email workflows
- sendEmailViaBrevo
- sendWelcomeEmail
- sendDailyPriceEmails
- sendPendingWelcomeEmails

6) Daily orchestration
- runDailyPipeline

7) Push workflows
- sendDailyPushNotifications

8) Daily summary orchestration
- broadcastSummaryEvent
- generateSummaryInBackground

9) Portfolio helpers
- getOrCreateBalance

10) Server startup
- startServer

### backend/src/chatbot.js

Primary responsibilities:

- Embedding-based intent detection
- Natural-language date parsing
- Metal detection
- DB context construction
- Strict prompt assembly
- Streaming and non-streaming LLM invocation

Key function groups:

1) NLP and intent
- getEmbeddings
- cosineSimilarity
- detectIntentViaEmbedding

2) Date and entity extraction
- parseDate
- tryParseFlexible
- detectMetals

3) DB context builders
- fetchPricesForDate
- fetchLatestPrices
- fetchClosestDate
- fetchDateRange
- fetchAvailableDateRange
- fetchDailySummary

4) Formatting and summaries
- fmtPrice
- formatGoldPrices
- formatMetalPrices
- computeChanges

5) Prompt and context assembly
- buildContext
- buildUserPrompt

6) Exported public APIs
- askChatbot
- askChatbotStream
- streamChatbot

### backend/src/knowledge-base.js

Primary responsibilities:

- Intent candidate corpus used for embedding matching
- Static site knowledge snippets for non-price questions

Exports:

- INTENT_CANDIDATES
- KB
- getRelevantKB
- default KB

### backend/src/telegram-bot.js

Primary responsibilities:

- Telegram bot initialization in webhook mode
- Command handling
- Chart URL generation using QuickChart
- Subscriber management
- Daily broadcast formatting and dispatch

Command coverage:

- /start, /help
- /prices
- /yesterday
- /chart
- /summary
- /ask
- /subscribe
- /unsubscribe
- /download

Exports:

- sendDailyPricesToTelegram
- default bot instance

## 9. Data Model and Database Tables

The backend expects these operational tables:

- metal_prices
- price_email_subscriptions
- news_articles
- daily_summaries
- push_subscriptions
- telegram_subscribers
- portfolio_balances
- portfolio_holdings

Included SQL/migrations in repo:

- backend/sql/metal_prices.sql
- backend/sql/cleanup_duplicates.sql
- backend/migrations/01_create_email_subscriptions.sql
- backend/migrations/001_add_welcome_sent_at.sql
- backend/scripts/cleanup-duplicates.js

## 10. Environment Variables

### Backend env file

Template: .env.example

Variables used in code:

Core and data:

- PORT
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- METALS_API_KEY
- METALS_API_URL
- METALS_SYMBOLS_URL
- USD_INR_OVERRIDE

Scheduler and protected jobs:

- CRON_SCHEDULE
- CRON_VERBOSE
- CRON_ENABLED
- RUN_DAILY_SECRET
- RUN_WELCOME_EMAIL_SECRET
- GENERATE_SUMMARY_SECRET
- RUN_NEWS_SECRET
- PRESERVE_YESTERDAY_SECRET

News and AI:

- NEWS_API_KEY
- GROQ_API_KEY

Email:

- EMAIL_USER
- EMAIL_FROM
- BREVO_API_KEY

Telegram:

- TELEGRAM_BOT_TOKEN

Push:

- VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- VAPID_EMAIL

### Frontend env file

Template: frontend/.env.example

Variables used in frontend code:

- VITE_API_BASE_URL
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_VAPID_PUBLIC_KEY

## 11. Local Development Setup

### Prerequisites

- Node.js 18+
- npm
- Supabase project with required tables

### Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### Configure env files

Backend:

```bash
cp .env.example .env
```

Frontend:

Create frontend/.env and set at least:

```bash
VITE_API_BASE_URL=http://localhost:4000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Run services

Terminal A:

```bash
cd backend
npm run dev
```

Terminal B:

```bash
cd frontend
npm run dev
```

Expected local URLs:

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## 12. Build, Run, and Scripts

### Backend scripts

From backend/package.json:

- npm run dev
  - cross-env NODE_ENV=development node --watch src/index.js
- npm start
  - cross-env NODE_ENV=production node src/index.js
- npm run lint
  - eslint src/ --fix

### Frontend scripts

From frontend/package.json:

- npm run dev
- npm run build
- npm run preview
- npm run lint

## 13. Scheduler and Daily Operations

Daily operating model:

1. preserve-yesterday step
2. fetch latest prices and persist
3. send daily emails
4. send Telegram updates
5. send web push updates
6. generate daily AI summary

Typical cron-job.org schedule:

- GET /wake-up every 1 minute
- POST /run-daily at 9:00 AM IST with x-run-daily-secret
- POST /generate-daily-summary at 9:01 AM IST with x-generate-summary-secret
- POST /send-welcome-emails every 5 minutes with x-send-welcome-emails-secret
- POST /fetch-news daily with x-run-news-secret
- Optional POST /preserve-yesterday before /run-daily with x-preserve-yesterday-secret

Internal cron exists and is controlled by CRON_ENABLED and CRON_SCHEDULE.

## 14. Deployment Notes

### Frontend (Vercel)

- SPA rewrite configured in frontend/vercel.json
- Service worker registered from frontend/src/register-sw.js
- Static caching and push handlers in frontend/public/sw.js
- SEO metadata and structured data in frontend/index.html

### Backend (Render)

- Set all backend env variables in Render dashboard
- Keep-alive ping route available at /wake-up
- Supports webhook-based Telegram update handling via /telegram/webhook

## 15. Security and Reliability

Implemented protections include:

- Helmet security headers and CSP
- CORS origin allowlist
- Body size limits for JSON/urlencoded requests
- Per-request timeout controls
- Global + endpoint-specific rate limiting
- Input validation using express-validator
- Sensitive data masking in logs
- Production-safe error responses
- 404 handler for unknown routes

Reliability patterns:

- Price fetch guard cache to prevent excessive upstream calls
- Daily pipeline orchestration with explicit logs
- Fallback handling in chatbot and summary generation
- Push stale subscription cleanup (410/404 handling)
- Server startup with multi-port fallback strategy

## 16. Troubleshooting

### Windows error: NODE_ENV is not recognized

This project already uses cross-env in backend scripts.

Use:

```bash
cd backend
npm run dev
```

Do not run Unix-style inline env assignments directly in PowerShell unless you set env vars in PowerShell syntax.

### Chatbot responds with fallback error

Check:

- SUPABASE_URL and SUPABASE_SERVICE_KEY are valid
- HF endpoints are reachable
- Network/firewall does not block outbound HTTPS
- Backend logs for askChatbot or streamChatbot errors

### No push notifications

Check:

- VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are configured
- Browser permission is granted
- Subscription rows exist in push_subscriptions

### No Telegram updates

Check:

- TELEGRAM_BOT_TOKEN is configured
- Webhook endpoint is set to backend /telegram/webhook
- telegram_subscribers table has active users

### Frontend cannot authenticate

Check:

- VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- Supabase Auth provider setup and redirect URLs

## 17. License

MIT
