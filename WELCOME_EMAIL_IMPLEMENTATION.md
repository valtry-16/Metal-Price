# Welcome Email External Cron - Implementation Guide

## Overview

A **new endpoint** has been added (`/send-welcome-emails`) that sends welcome emails to new email subscribers immediately. This endpoint should be triggered by **cron-job.org every 5 minutes** (external, just like `/run-daily`).

This solves the timeout issue caused by trying to send emails synchronously during the subscription endpoint.

## Changes Made

### 1. ✅ Code Changes (Already Applied)

#### `backend/src/index.js`

- **New function: `sendPendingWelcomeEmails()`** (line ~1254)
  - Finds all subscriptions where `welcome_sent_at IS NULL`
  - Sends welcome email immediately
  - Updates `welcome_sent_at` timestamp when successful
  - Gracefully handles failures (endpoint will retry next call via cron-job.org)
  - Returns JSON response with status

- **Updated: `/subscribe-email` endpoint** (line ~688)
  - No longer tries to send welcome immediately
  - Returns success instantly
  - Message: "✅ Subscribed! Your welcome email is coming shortly."
  - Prevents timeout on Render free tier

- **New endpoint: `/send-welcome-emails`** (line ~1380)
  - Method: POST
  - Requires header: `x-send-welcome-emails-secret: <RUN_WELCOME_EMAIL_SECRET>`
  - Calls `sendPendingWelcomeEmails()`
  - Returns JSON with status and count
  - **Secured with secret** (like `/run-daily`)

- **New environment variable**
  - `RUN_WELCOME_EMAIL_SECRET` - Secret key for /send-welcome-emails endpoint
  - Add this to your `.env` file

- **Updated server startup message**
  - Now shows: `📧 Welcome email endpoint: POST /send-welcome-emails (use cron-job.org every 5 min)`

### 2. ⏳ Database Migration (Needs Your Action)

A **new SQL migration file** has been created:

**File:** `backend/migrations/001_add_welcome_sent_at.sql`

This adds the `welcome_sent_at` column to track welcome email status.

---

## How to Set Up Cron-job.org for Welcome Emails

## How to Set Up Cron-job.org for Welcome Emails

### Step 0: Run Database Migration First

**File:** `backend/migrations/001_add_welcome_sent_at.sql`

1. **Go to Supabase Dashboard**
   - [https://app.supabase.com](https://app.supabase.com)
   - Select your project "Metal-Price"

2. **Open SQL Editor**
   - Click **SQL Editor** → **"New Query"**

3. **Copy & Paste Migration**
   - Copy all SQL from `backend/migrations/001_add_welcome_sent_at.sql`
   - Paste into editor → Click **"Run"**

4. **Verify Success**
   - Should see: "Success. No rows returned"
   - Column `welcome_sent_at` now exists in table

### Step 1: Generate Secret for /send-welcome-emails

Generate a random secret (just like you did for `/run-daily`):

```bash
OpenSSL:
openssl rand -hex 24

Or use any random 48-char string:
A7p9Qk2sT5nX8mJ3wZ4cR6yH1uF9aB2dL7eN5gP3qS6t
```

**Store this as `RUN_WELCOME_EMAIL_SECRET`** in your `.env` file:

```env
RUN_WELCOME_EMAIL_SECRET=A7p9Qk2sT5nX8mJ3wZ4cR6yH1uF9aB2dL7eN5gP3qS6t
```

### Step 2: Update Backend Configuration & Deploy

1. **Update `.env` file**
   ```env
   RUN_WELCOME_EMAIL_SECRET=A7p9Qk2sT5nX8mJ3wZ4cR6yH1uF9aB2dL7eN5gP3qS6t
   ```

2. **Deploy to Render**
   - Push code to GitHub
   - Render will auto-deploy
   - Check logs: `📧 Welcome email endpoint: POST /send-welcome-emails`

### Step 3: Add Second Cron Task in cron-job.org

1. **Login to cron-job.org**
   - Go to [https://cron-job.org/en/](https://cron-job.org/en/)
   - Sign in with your account

2. **Create New Cron Job**
   - Click **"Create new cronjob"**
   - Configure as follows:

   ```
   ✅ Title:              "Metal Price - Send Welcome Emails"
   ✅ URL:                https://metal-price.onrender.com/send-welcome-emails
   ✅ Request method:     POST
   ✅ Execution time:     Every 5 minutes (*/5 * * * *)
   ✅ Timeout:            30 seconds
   ```

3. **Add Custom Header**
   - Click **"Advanced"** section
   - Under **"HTTP Headers"**, add:
     ```
     Header Name:  x-send-welcome-emails-secret
     Header Value: A7p9Qk2sT5nX8mJ3wZ4cR6yH1uF9aB2dL7eN5gP3qS6t
     ```
     (Use the secret you generated)

4. **Save & Enable**
   - Click **"Save"**
   - Make sure it's **enabled** (toggle ON)
   - Test: Click **"Execute now"** to verify it works

### Step 4: Verify in Render Logs

After creating the cron job, check your Render logs:

```
📧 Found 1 pending welcome email(s)
🎉 Welcome email sent to user@example.com
```

If you see this, the endpoint is working!

---

## Email Flow (New Architecture with External Cron)

### Step 1: User Subscribes
```
User clicks "Subscribe" on website
        ↓
POST /subscribe-email
        ↓
Database: INSERT new subscription (welcome_sent_at = NULL)
        ↓
Response: "✅ Subscribed! Your welcome email is coming shortly."
        ↓
Return to user INSTANTLY (no timeout)
```

### Step 2: External Cron Detects & Sends (cron-job.org)
```
Every 5 minutes (triggered by cron-job.org):
        ↓
POST /send-welcome-emails
  Header: x-send-welcome-emails-secret: <secret>
        ↓
Endpoint finds subscriptions WHERE welcome_sent_at IS NULL
        ↓
Send welcome email to each new subscriber
        ↓
Update welcome_sent_at = NOW()
        ↓
Log: "🎉 Welcome email sent to user@example.com"
```

### Step 3: Daily Cron at 9 AM (cron-job.org)
```
At 9:00 AM Asia/Kolkata (triggered by cron-job.org):
        ↓
POST /run-daily
  Header: x-run-daily-secret: <secret>
        ↓
Fetch daily prices & store in database
        ↓
Send daily email to ALL subscribers
        ↓
Send Telegram updates
Note: Daily email will NOT duplicate welcome (welcome_sent_at is already set)
```

---

## Visual Timeline

```
00:00 - User subscribes at any time
        └─ welcome_sent_at = NULL

00:01-00:04 - User waits (up to 5 minutes)

00:05 - cron-job.org calls POST /send-welcome-emails
        └─ Detects welcome_sent_at = NULL
        └─ Sends welcome email
        └─ Sets welcome_sent_at = 2025-01-15 00:05:30
        └─ Email arrives! ✓

09:00 - cron-job.org calls POST /run-daily
        └─ Checks: welcome_sent_at IS NULL? NO
        └─ Sends daily price email only (no welcome)
        └─ Email arrives! ✓

Next day 09:00 - Repeat daily cron
```

---

## Expected Behavior After Setup

### For New Subscribers
- ✅ User subscribes → instant response
- ✅ Wait 5 minutes max → welcome email arrives
- ✅ At 9 AM → daily email arrives
- ✅ NO DUPLICATES guaranteed (welcome_sent_at flag)

### For Existing Subscribers
- ✅ welcome_sent_at automatically set to subscription date
- ✅ No re-sending of welcome emails
- ✅ Receive daily email at 9 AM as normal

### Failure Handling
- If email send fails → cron-job.org will retry in 5 minutes
- Failed emails logged but won't block other operations
- No timeout on subscription endpoint

---

## Testing the Implementation

### Test Case 1: New Subscriber Welcome Email

1. **Subscribe from website**
   ```
   Input: test-new-user@example.com
   Expected: Instant success message
   ```

2. **Check inbox after 5 minutes**
   ```
   Expected: Welcome email with latest metal prices
   Database: welcome_sent_at = timestamp (not NULL)
   Render logs: "🎉 Welcome email sent to..."
   ```

3. **Check again at 9 AM next day**
   ```
   Expected: Daily price email (no duplicate welcome)
   ```

### Test Case 2: Existing Subscriber

1. **Subscriber that existed before this change**
   ```
   Database: welcome_sent_at = NULL initially
   After migration: welcome_sent_at = subscribed_at
   ```

2. **Won't receive welcome again**
   ```
   cron-job.org /send-welcome-emails: WHERE welcome_sent_at IS NULL (excludes existing)
   Result: No duplicate email
   ```

### Test Case 3: Email Failure Resilience

1. **Network issue during email send**
   ```
   cron-job.org call 1 (00:05): ❌ SMTP timeout
   cron-job.org call 2 (00:10): ✅ Email sent successfully
   Result: No data loss, automatic retry
   ```

---

## Configuration Checklist

### Environment Variables (.env)

```env
# Daily cron (already set)
CRON_SCHEDULE="0 9 * * *"
CRON_ENABLED="true"
CRON_VERBOSE="false"

# Daily cron security (already set)
RUN_DAILY_SECRET=V6s9Qk2pT7nX4mJ8wZ1cR5yH3uF0aB6dL9eN2gP7qS4t

# Welcome email cron security (NEW)
RUN_WELCOME_EMAIL_SECRET=A7p9Qk2sT5nX8mJ3wZ4cR6yH1uF9aB2dL7eN5gP3qS6t
```

### cron-job.org Tasks

| Task | Schedule | URL | Header | Purpose |
|------|----------|-----|--------|---------|
| Daily Prices | `0 9 * * *` | POST /run-daily | x-run-daily-secret | Fetch prices, send daily emails |
| Welcome Emails | `*/5 * * * *` | POST /send-welcome-emails | x-send-welcome-emails-secret | Send welcome to new subscribers |

---

## Monitoring & Logs

### Server Startup
```
✅ API listening on port 10000
📱 Telegram bot started successfully
⏰ Daily cron job scheduled: 0 9 * * * (9 AM Asia/Kolkata)
📧 Welcome email endpoint: POST /send-welcome-emails (use cron-job.org every 5 min)
```

### During Execution (cron-job.org calls /send-welcome-emails)
```
📧 Found 2 pending welcome email(s)
🎉 Welcome email sent to user1@example.com
🎉 Welcome email sent to user2@example.com
```

### If Errors Occur
```
❌ Failed to send welcome email to user@example.com: SMTP timeout
   → cron-job.org will retry automatically in 5 minutes
```

---

## Rollback (If Needed)

If you want to revert this change:

### Code Rollback
1. Remove `/send-welcome-emails` endpoint from index.js
2. Remove `sendPendingWelcomeEmails()` function
3. Remove `RUN_WELCOME_EMAIL_SECRET` from environment variables
4. Redeploy backend

### Database Rollback (Optional)
```sql
-- Drop the index
DROP INDEX IF EXISTS idx_price_email_welcome_pending;

-- Remove the column (existing data will be lost)
ALTER TABLE price_email_subscriptions
DROP COLUMN welcome_sent_at;
```

---

## Deployment Steps

1. **Apply database migration** first (run the SQL in Supabase)
2. **Update `.env`** with `RUN_WELCOME_EMAIL_SECRET`
3. **Deploy backend** to Render
4. **Create cron-job.org task** for `/send-welcome-emails` every 5 minutes
5. **Test** with a new subscription
6. **Verify** email arrives within 5 minutes

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Welcome email timing | Immediate (causes timeout) | Within 5 minutes (external cron) |
| Email delivery | Fails on Render | Works reliably |
| Subscription response | Times out | Instant (< 1 second) |
| Database column | N/A | `welcome_sent_at` (tracks send time) |
| Cron jobs | 1 internal (9 AM) | 2 external via cron-job.org |
| Welcome trigger | Internal cron | POST /send-welcome-emails |
| Security | N/A | Secret header: x-send-welcome-emails-secret |
| Duplicate risk | Low | None (tracked with flag) |



### 2. ⏳ Database Migration (Needs Your Action)

A **new SQL migration file** has been created:

**File:** `backend/migrations/001_add_welcome_sent_at.sql`

This adds the `welcome_sent_at` column to track welcome email status.

---

## How to Set Up Cron-job.org for Welcome Emails

### Step 1: User Subscribes
```
User clicks "Subscribe" on website
        ↓
POST /subscribe-email
        ↓
Database: INSERT new subscription (welcome_sent_at = NULL)
        ↓
Response: "✅ Subscribed! Your welcome email is coming shortly."
        ↓
Return to user INSTANTLY (no timeout)
```

### Step 2: Background Cron Detects & Sends
```
Every 5 minutes:
        ↓
SELECT * FROM price_email_subscriptions WHERE welcome_sent_at IS NULL
        ↓
Found new subscriber? 
        ├─ YES: Send welcome email
        │        Update welcome_sent_at = NOW()
        │        Log: "🎉 Welcome email sent to user@example.com"
        │
        └─ NO: Do nothing (silent, efficient)
```

### Step 3: Daily Cron at 9 AM
```
At 9:00 AM Asia/Kolkata:
        ↓
POST /run-daily (called by cron-job.org)
        ↓
Fetch daily prices & store in database
        ↓
Send daily email to ALL subscribers
        ↓
Send Telegram updates
Note: Daily email will NOT duplicate welcome (welcome_sent_at is already set)
```

---

## Visual Timeline

```
00:00 - User subscribes at any time
        └─ welcome_sent_at = NULL

00:01-00:04 - User waits (up to 5 minutes)

00:05 - Background cron runs (every 5 minutes)
        └─ Detects welcome_sent_at = NULL
        └─ Sends welcome email
        └─ Sets welcome_sent_at = 2025-01-15 00:05:30
        └─ Email arrives! ✓

09:00 - Daily cron runs (9 AM)
        └─ Checks: welcome_sent_at IS NULL? NO
        └─ Sends daily price email only (no welcome)
        └─ Email arrives! ✓

Next day 09:00 - Repeat daily cron
```

---

## Expected Behavior After Migration

### For New Subscribers
- ✅ User subscribes → instant response
- ✅ Wait 5 minutes max → welcome email arrives
- ✅ At 9 AM → daily email arrives
- ✅ NO DUPLICATES guaranteed (welcome_sent_at flag)

### For Existing Subscribers
- ✅ welcome_sent_at automatically set to subscription date
- ✅ No re-sending of welcome emails
- ✅ Receive daily email at 9 AM as normal

### Failure Handling
- If email send fails → background cron will retry in 5 minutes
- Failed emails logged but won't block other operations
- No timeout on subscription endpoint

---

## Testing the Implementation

### Test Case 1: New Subscriber Welcome Email

1. **Subscribe from website**
   ```
   Input: test-new-user@example.com
   Expected: Instant success message
   ```

2. **Check inbox after 5 minutes**
   ```
   Expected: Welcome email with latest metal prices
   Database: welcome_sent_at = timestamp (not NULL)
   ```

3. **Check again at 9 AM next day**
   ```
   Expected: Daily price email (no duplicate welcome)
   ```

### Test Case 2: Existing Subscriber

1. **Subscriber that existed before this change**
   ```
   Database: welcome_sent_at = NULL initially
   After migration: welcome_sent_at = subscribed_at
   ```

2. **Won't receive welcome again**
   ```
   Background cron: WHERE welcome_sent_at IS NULL (excludes existing)
   Result: No duplicate email
   ```

### Test Case 3: Email Failure Resilience

1. **Network issue during email send**
   ```
   Cron attempt 1: ❌ SMTP timeout
   Cron attempt 2 (5 min later): ✅ Email sent successfully
   Result: No data loss, automatic retry
   ```

---

## Configuration Checklist

### Environment Variables (.env)

```env
# Daily cron (already set)
CRON_SCHEDULE="0 9 * * *"
CRON_ENABLED="true"
CRON_VERBOSE="false"

# Daily cron security (already set)
RUN_DAILY_SECRET=V6s9Qk2pT7nX4mJ8wZ1cR5yH3uF0aB6dL9eN2gP7qS4t

# Welcome email cron security (NEW)
RUN_WELCOME_EMAIL_SECRET=A7p9Qk2sT5nX8mJ3wZ4cR6yH1uF9aB2dL7eN5gP3qS6t
```

### cron-job.org Tasks

| Task | Schedule | URL | Header | Purpose |
|------|----------|-----|--------|---------|
| Daily Prices | `0 9 * * *` | POST /run-daily | x-run-daily-secret | Fetch prices, send daily emails |
| Welcome Emails | `*/5 * * * *` | POST /send-welcome-emails | x-send-welcome-emails-secret | Send welcome to new subscribers |

---

## Monitoring & Logs

### Server Startup
```
✅ API listening on port 10000
📱 Telegram bot started successfully
⏰ Daily cron job scheduled: 0 9 * * * (9 AM Asia/Kolkata)
📧 Welcome email cron scheduled: Every 5 minutes
```

### During Execution
```
📧 Found 2 pending welcome email(s)
🎉 Welcome email sent to user1@example.com
🎉 Welcome email sent to user2@example.com
```

### If Errors Occur
```
❌ Failed to send welcome email to user@example.com: SMTP timeout
   → Will retry automatically in 5 minutes
```

---

## Rollback (If Needed)

If you want to revert this change:

```sql
-- Drop the index
DROP INDEX IF EXISTS idx_price_email_welcome_pending;

-- Remove the column (existing data will be lost)
ALTER TABLE price_email_subscriptions
DROP COLUMN welcome_sent_at;
```

**Note:** Code changes in `index.js` would still use the column, so make sure to revert code too.

---

## Deployment Steps

1. **Apply database migration** first (run the SQL)
2. **Deploy backend** with the new code
3. **Test with a new subscription**
4. **Verify email arrives within 5 minutes**
5. **Check 9 AM daily email** next day

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Welcome email timing | Immediate (causes timeout) | Within 5 minutes (background) |
| Email delivery | Fails on Render | Works reliably |
| Subscription response | Times out | Instant (< 1 second) |
| Database column | N/A | `welcome_sent_at` (tracks send time) |
| Cron job frequency | 1 × daily at 9 AM | 1 × daily + every 5 minutes |
| Duplicate risk | Low | None (tracked with flag) |

