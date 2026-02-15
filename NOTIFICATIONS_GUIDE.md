# Notifications System - Complete Guide

## Overview

The Auric Ledger app now has **two types of notifications**:

### 1. **Daily Notifications (After Cron Job)**
- **Trigger**: Automatically after cron job fetches prices (9:00 AM daily)
- **Conditions**: 
  - ✅ Browser notifications enabled by user (they clicked "🔔 Enable Notifications")
  - ✅ Email subscription active (they entered email in app)
- **Delivery**:
  - **Browser**: Single notification showing Gold price + total metals updated
  - **Email**: Full price table with all 9 metals sent to all subscribers

### 2. **Manual Price Alerts (User-Set)**
- **Trigger**: When price meets user's alert condition (target price or % change)
- **Conditions**:
  - ✅ User created an alert (target price or percentage change)
  - ✅ Alert is enabled
  - ✅ No cooldown (60 minutes since last trigger)
- **Delivery**:
  - **Browser**: Toast + system notification (if permission granted)
  - **Email**: Alert email sent if user has subscribed email

---

## Implementation Details

### **Backend Changes**

#### 1. Email Subscription (`/subscribe-email` endpoint)
- Accepts email from user
- Stores in `price_email_subscriptions` table
- **NEW**: Immediately sends welcome email with today's prices
- Welcome email includes all 9 metals current prices

#### 2. Manual Alert Trigger (`/trigger-price-alert` endpoint)
- Frontend calls this when user alert triggers
- Checks if user email is subscribed
- Sends personalized alert email with:
  - Metal name
  - Current price
  - Alert type and target value
  - Timestamp

#### 3. Daily Price Summary (`/daily-price-summary` endpoint)
- Returns today's prices for all metals
- Used by frontend to show daily browser notifications
- Only includes 22K gold (no 18K/24K)

#### 4. Cron Job Enhancement
- After fetching prices, calls `sendDailyPriceEmails()`
- Sends emails to all subscribers
- Logs: "📧 Sending emails to X subscriber(s)..."
- Shows success rate: "📊 Email Summary: X/Y sent successfully"

---

### **Frontend Changes**

#### 1. Daily Browser Notification
- Checks once per day if notifications are enabled
- Stored in localStorage: `auric-last-daily-notification`
- Shows: "Today's Gold (22K): ₹X/g | 9 metals updated"
- Only shows if:
  - Browser notification permission granted
  - Not already shown today

#### 2. Manual Alert Enhancement
- Changed `checkAlerts()` to **async function**
- Changed `forEach` to `for...of` loop (to support await)
- When alert triggers:
  1. Show browser notification (if enabled)
  2. Call `/trigger-price-alert` API with email
  3. Backend sends email (if subscribed)
  4. Update last triggered timestamp

#### 3. Welcome Email on Subscription
- When user enters email, backend immediately:
  1. Stores email in database
  2. Fetches today's prices
  3. Sends welcome email with full price table

---

## How It Works - User Flow

### **Scenario 1: Daily Notifications Only**

**User Actions:**
1. Opens app
2. Clicks "🔔 Enable Notifications" → Grants permission
3. Subscribes email (enters email in Alerts modal)

**What Happens:**
- **9:00 AM (Cron runs):**
  - Backend fetches prices
  - Sends email to user with all 9 metal prices
  
- **When User Opens App After 9 AM:**
  - Shows browser notification: "Today's Gold (22K): ₹7,500/g | 9 metals updated"
  - Only shows once per day

---

### **Scenario 2: Manual Price Alerts**

**User Actions:**
1. Opens app
2. Clicks "🔔 Alerts"
3. Subscribes email: `user@example.com`
4. **Immediately receives welcome email** with today's prices
5. Creates alert: "Notify me when Gold reaches ₹7,500/g"
6. Enables browser notifications

**What Happens When Price Hits ₹7,500:**
- **Browser Notification:** 
  - Toast: "🎯 Gold reached ₹7,500/g! Current: ₹7,500"
  - System notification pops up
  
- **Email:**
  - Subject: "🚨 Price Alert: XAU"
  - Body: "Gold has reached your target price of ₹7,500/g!"
  - Sent to: `user@example.com`

- **60-Minute Cooldown:** Won't trigger again for 60 minutes

---

### **Scenario 3: Email Only (No Browser)**

**User Actions:**
1. Opens app
2. Subscribes email (doesn't enable browser notifications)

**What Happens:**
- **Immediately:** Welcome email with current prices
- **Daily 9:00 AM:** Daily email with all metal prices
- **Price Alerts:** Email only (no browser notifications)

---

## Technical Flow

### **Daily Notification Flow**
```
[Cron Job 9:00 AM]
  ↓
[Fetch Prices from apised.com]
  ↓
[Store in Supabase]
  ↓
[sendDailyPriceEmails()] → Sends to all subscribers
  ↓
[User Opens App]
  ↓
[checkDailyNotification()] → Fetches /daily-price-summary
  ↓
[Shows Browser Notification] (if enabled + not shown today)
```

### **Manual Alert Flow**
```
[Price Data Updates in Frontend]
  ↓
[checkAlerts(metalName, currentPrice)] (async)
  ↓
[Check if alert condition met]
  ↓
[YES] → Show Toast + Browser Notification (if enabled)
       → Call /trigger-price-alert API
       → Backend sends email (if subscribed)
       → Update lastTriggeredAt
  ↓
[60-Minute Cooldown Active]
```

### **Email Subscription Flow**
```
[User Enters Email]
  ↓
[Frontend calls /subscribe-email]
  ↓
[Backend stores in DB]
  ↓
[Immediately calls sendWelcomeEmail()]
  ↓
[Fetches today's prices → fetchAndStoreToday()]
  ↓
[Sends email with price table]
  ↓
[User receives email instantly]
```

---

## Database Schema

### **price_email_subscriptions** table
```sql
id               BIGSERIAL PRIMARY KEY
email            VARCHAR(255) NOT NULL UNIQUE
subscribed_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

**Indexes:**
- `idx_email_subscriptions_email` on `email`
- `idx_email_subscriptions_subscribed_at` on `subscribed_at`

---

## localStorage Keys

| Key | Purpose | Example Value |
|-----|---------|--------------|
| `auric-email` | Stores user's subscribed email | `user@example.com` |
| `auric-alerts` | Stores all user alerts | JSON array |
| `auric-last-daily-notification` | Prevents duplicate daily notifications | `2026-02-15` |
| `auric-dark-mode` | Theme preference | `true` / `false` |

---

## Environment Variables Required

```env
# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password  # No spaces!
EMAIL_FROM=your-email@gmail.com

# Cron Schedule
CRON_SCHEDULE=0 9 * * *  # 9:00 AM daily
```

---

## Testing

### **Test Daily Notifications**

1. **Email Test:**
   ```bash
   # Backend running
   # Open app → Subscribe email
   # Check email inbox → Should receive welcome email immediately
   ```

2. **Browser Notification Test:**
   ```bash
   # Enable browser notifications
   # Delete localStorage key: auric-last-daily-notification
   # Refresh app
   # Should show: "Today's Gold (22K): ₹X/g | 9 metals updated"
   ```

### **Test Manual Alerts**

1. **Create Alert:**
   - Open Alerts modal
   - Select Gold
   - Target Price: Enter current price + 1
   - Enable browser notifications
   - Subscribe email

2. **Manually Update Price** (in Supabase):
   ```sql
   UPDATE metal_prices
   SET price_1g = 7500
   WHERE metal_name = 'XAU' AND carat = '22' AND date = CURRENT_DATE;
   ```

3. **Refresh App:**
   - Should show browser notification
   - Check email for alert email

---

## Troubleshooting

### Issue: Welcome email not sent
- ✅ Check EMAIL_USER and EMAIL_PASSWORD in .env
- ✅ Check backend logs for "✅ Welcome email sent to..."
- ✅ Verify emailTransporter is initialized (no error on startup)

### Issue: Daily notification shows multiple times
- ✅ Check localStorage → Should have `auric-last-daily-notification` = today's date
- ✅ Clear localStorage and refresh

### Issue: Manual alert email not sent
- ✅ Verify email is in `price_email_subscriptions` table
- ✅ Check backend logs for "✅ Price alert email sent to..."
- ✅ Check alert cooldown (60 minutes)

---

## Summary

✅ **Two notification systems implemented:**
1. **Daily Notifications** (cron-based, all subscribers, once per day)
2. **Manual Alerts** (user-set, individual, with cooldown)

✅ **Welcome email on subscription** (immediate, includes today's prices)

✅ **Smart delivery:**
- Browser notifications require user permission
- Email notifications require email subscription
- Both work independently

✅ **No spam:**
- Daily browser notification: once per day
- Daily email: 9:00 AM only
- Manual alerts: 60-minute cooldown

🎉 **Ready for production!**
