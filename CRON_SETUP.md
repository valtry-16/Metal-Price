# Cron Job Setup Guide

## ✅ Yes, cron-job.org is PERFECT for your needs!

**cron-job.org FREE plan** offers:
- ✅ **50 different cron jobs** (NOT 50 executions - each job runs unlimited times!)
- ✅ **Once-daily scheduling** (or any frequency you want)
- ✅ **HTTP/HTTPS support** (calls your API endpoint)
- ✅ **Execution history** and logs
- ✅ **Email notifications** on failures
- ✅ **No credit card required** for free tier

**Important:** The "50 jobs" means you can CREATE 50 different cron jobs. Each job can run every day, forever, without counting against any limit. So 1 job running daily at 9 AM = 1 job slot used, runs every day indefinitely!

---

## 📅 Current Configuration

Your backend now runs the price fetch **once per day** at:
- **9:00 AM daily** (configured in `backend/.env`)
- Internal cron using `node-cron`

The schedule can be changed by modifying `CRON_SCHEDULE` in `backend/.env`:

```env
# Examples:
CRON_SCHEDULE=0 9 * * *    # 9 AM daily (current setting)
CRON_SCHEDULE=0 8 * * *    # 8 AM daily
CRON_SCHEDULE=0 12 * * *   # 12 PM daily
CRON_SCHEDULE=0 0 * * *    # Midnight daily
```

---

## 🌐 Setting Up cron-job.org (External Cron)

### Why use external cron?
- Your backend doesn't need to run 24/7
- More reliable than keeping your computer/server running
- Free monitoring and error notifications

### Setup Steps:

1. **Sign up at [cron-job.org](https://cron-job.org/)**
   - Free account, no credit card needed

2. **Create a new cron job:**
   - Click "Create cronjob"
   - **Title**: "Fetch Metal Prices Daily"
   - **URL**: `https://your-domain.com/fetch-today-prices`
     - For local testing: Use a service like [ngrok](https://ngrok.com/) to expose your `localhost:4000`
     - For production: Use your deployed backend URL
   
3. **Configure schedule:**
   - **Execution schedule**: Select "Once a day"
   - **Time**: `09:00` (9:00 AM)
   - **Timezone**: Select "Asia/Kolkata" (IST)
   
   This ONE job will run every day at 9 AM to fetch today's prices. Each day it runs, it stores that day's data.

4. **Configure notifications (optional):**
   - Enable "Send me an email if execution fails"
   - Add your email address

5. **Save and enable** the cron job

### Testing Your Cron Job:

```powershell
# Test the GET endpoint manually:
Invoke-RestMethod -Uri "http://localhost:4000/fetch-today-prices" -Method Get

# Or using curl:
curl http://localhost:4000/fetch-today-prices
```

---

## 🚀 Deployment Options

For production, deploy your backend to one of these platforms:

### Option 1: **Render.com** (Recommended)
- Free tier available
- Easy Node.js deployment
- Supports background workers
- Built-in cron jobs (but only on paid plans)

### Option 2: **Railway.app**
- $5/month free credit
- Simple deployment
- Supports cron jobs

### Option 3: **Heroku**
- Free dynos (with sleep)
- Add-ons available
- Pair with cron-job.org to wake it up

### Option 4: **DigitalOcean App Platform**
- $0 for basic apps
- Scalable infrastructure

---

## 🔄 How It Works

### Internal Cron (node-cron):
```javascript
// Runs when backend is active
cron.schedule(CRON_SCHEDULE, async () => {
  await fetchAndStoreToday();
});
```

### External Cron (cron-job.org):
```
cron-job.org → GET /fetch-today-prices → Your Backend → Supabase
```

---

## 📊 Monitoring

Check if data is being fetched:

```powershell
# Get latest prices
Invoke-RestMethod -Uri "http://localhost:4000/get-latest-price"

# Check comparison
Invoke-RestMethod -Uri "http://localhost:4000/compare-yesterday"
```

---

## 🎯 Recommendation

**For Development**: Use internal `node-cron` (already configured)

**For Production**: 
1. Deploy backend to Render/Railway
2. Set up cron-job.org to hit `/fetch-today-prices` once daily
3. Disable internal cron or keep it as a backup

---

## ⚙️ Customizing Schedule Format

Cron format: `minute hour day month weekday`

```
0 6 * * *     # 6:00 AM daily
0 8 * * *     # 8:00 AM daily
0 12 * * *    # 12:00 PM daily
0 18 * * *    # 6:00 PM daily
0 0 * * *     # Midnight daily
0 8 * * 1-5   # 8 AM weekdays only
0 9 1 * *     # 9 AM on 1st of every month
```

---

## 📝 Notes

- Price data is stored in Supabase with unique constraint on (metal_name, carat, date)
- Duplicate fetches on the same day will update existing records
- Historical data is preserved for weekly/monthly charts
- Currency conversion uses live USD→INR rates from frankfurter.app
