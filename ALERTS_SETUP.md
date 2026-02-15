# Alerts & Notifications Setup Guide

## Features

### 1. 🔔 Browser Notifications
- Get system notifications when price alerts trigger
- Works on desktop and mobile
- Requires user permission (requested on first use)

### 2. 📧 Daily Email Notifications
- Receive daily email with all metal prices at 9:00 AM IST
- Simple subscription via email input in app
- Automatic daily delivery via cron job

### 3. ⚠️ Price Alerts
Two types of alerts:
- **Target Price**: Alert when metal reaches specific price (e.g., "Alert me when Gold reaches ₹7500/g")
- **Percentage Change**: Alert when price changes by X% (e.g., "Alert me when Gold drops 2%")

Features:
- 60-minute cooldown between alerts (prevents spam)
- Enable/disable alerts without deleting
- Persist across browser sessions via localStorage

## Email Setup

### Prerequisites
- Gmail account (or any SMTP service)
- Gmail App Password (for 2FA enabled accounts)

### Configuration

1. **Get Gmail App Password** (if using Gmail with 2FA):
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer" (or your device)
   - Copy the 16-character password

2. **Update `.env` in backend:**
   ```env
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=xxxx-xxxx-xxxx-xxxx  # Gmail app password
   EMAIL_FROM=your-email@gmail.com
   ```

3. **Create Email Subscriptions Table in Supabase:**
   - Go to Supabase Dashboard → SQL Editor
   - Run the migration from `backend/migrations/01_create_email_subscriptions.sql`
   - Or copy-paste the SQL:

   ```sql
   CREATE TABLE IF NOT EXISTS price_email_subscriptions (
     id BIGSERIAL PRIMARY KEY,
     email VARCHAR(255) NOT NULL UNIQUE,
     subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   CREATE INDEX IF NOT EXISTS idx_email_subscriptions_email ON price_email_subscriptions(email);
   CREATE INDEX IF NOT EXISTS idx_email_subscriptions_subscribed_at ON price_email_subscriptions(subscribed_at);
   ```

4. **Install nodemailer** (already in package.json):
   ```bash
   cd backend
   npm install
   ```

5. **Restart Backend:**
   ```bash
   npm run dev
   ```

### Testing Email
1. Open the app → Alerts modal
2. Enter your email in "Daily Email Notifications" section
3. Click "Subscribe to Daily Emails"
4. Manually trigger price fetch: Click "Fetch Today's Prices" button
5. Check your email inbox

### Cron Job Behavior
- Runs at 9:00 AM IST daily (configurable via `CRON_SCHEDULE`)
- Fetches prices from apised.com
- Sends emails to all subscribers
- Shows detailed logs in console

### Alternative Email Services

**SendGrid:**
```env
EMAIL_SERVICE=SendGrid
EMAIL_USER=apikey
EMAIL_PASSWORD=SG.your-api-key-here
EMAIL_FROM=noreply@yourdomain.com
```

**Outlook/Office365:**
```env
EMAIL_SERVICE=outlook
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
EMAIL_FROM=your-email@outlook.com
```

## How to Use

### Browser Notifications
1. Click "🔔 Alerts" button in header
2. Click "🔔 Enable Notifications"
3. Grant permission when prompted
4. Create alerts below
5. Get popup notifications when alerts trigger

### Email Notifications
1. Go to "🔔 Alerts" modal
2. Scroll to "📧 Daily Email Notifications"
3. Enter your email address
4. Click "📧 Subscribe to Daily Emails"
5. Receive daily emails at 9:00 AM with all metal prices

### Creating Price Alerts
1. Select metal from dropdown
2. Choose alert type (Target Price or % Change)
3. Enter value:
   - Target Price: Enter price in ₹/g (e.g., 7500)
   - % Change: Enter percentage (e.g., 2.5)
4. Click "➕ Create Alert"
5. Get notifications when conditions are met

### Managing Alerts
- Click "✓ On" / "Off" button to enable/disable alerts
- Click "Delete" to remove alerts permanently
- All saved alerts appear in your "Active Alerts" list

## Troubleshooting

### Emails not sending
1. Check backend logs for errors
2. Verify EMAIL_USER and EMAIL_PASSWORD in .env
3. Ensure price_email_subscriptions table exists in Supabase
4. Check if email is in subscribers table: 
   ```sql
   SELECT * FROM price_email_subscriptions;
   ```

### Notifications not showing
1. Check browser notification permissions: Settings → Notifications
2. Ensure you clicked "Enable Notifications" button
3. Check browser console for errors
4. Try refreshing the page

### Alerts not triggering
1. Check if alert is enabled (toggle should show "✓ On")
2. Wait 60 minutes if alert was recently triggered (cooldown)
3. Alert must match condition: 
   - Target Price: within ±1% of target
   - % Change: actual change ≥ specified percentage
4. Check comparisons pricing data is loading

## Features in Progress
- Telegram bot notifications (coming soon)
- SMS alerts (optional paid service)
- Custom alert schedules
- Alert history and statistics

## Support
For issues, check the app's About section for more details.
