# Email Template Guide

## Overview
Auric Ledger sends professional, branded HTML emails to subscribers. There are two types of emails:

1. **Welcome Email** - Sent immediately when a user subscribes
2. **Daily Price Email** - Sent every morning at 9:00 AM IST via cron job

---

## Email Design Features

### 🎨 Branding Elements
- **Logo**: 📊 Chart emoji (48px)
- **Site Name**: "Auric Ledger" in bold 32px font
- **Color Scheme**:
  - Primary Gold: `#d4af37`
  - Secondary Gold: `#f4e5c3`
  - Dark Header: `#2c3e50` to `#34495e` gradient
  - Background: `#f5f5f5`

### 📧 Email Structure
1. **Header Section**
   - Gold gradient background
   - Logo (chart icon)
   - Site name "Auric Ledger"
   - Tagline

2. **Content Section**
   - Welcome/Update message
   - Date display
   - USD to INR exchange rate
   - Metal prices table

3. **Information Box**
   - Green box (Welcome) with subscription info
   - Yellow box (Daily) with market insights

4. **Footer Section**
   - Dark background (#2c3e50)
   - "Visit Auric Ledger" button
   - Copyright and tagline
   - Link: `https://auric-ledger.vercel.app`

---

## Welcome Email Template

### Subject Line
```
🎉 Welcome to Auric Ledger - Today's Prices Inside!
```

### Key Sections
1. **Header**: Gold gradient with logo and branding
2. **Welcome Message**: "Welcome to Our Community!" with warm greeting
3. **Date & Exchange Rate**: Current date and USD to INR rate
4. **Prices Table**: All 9 metals with per-gram prices
5. **Info Box**: Green box explaining daily updates at 9 AM IST
6. **Footer**: Link to app with copyright

### Content Highlights
- Personalized greeting: "Dear Valued Subscriber"
- Emphasizes community membership
- Explains what to expect (daily emails at 9 AM)
- Clear call-to-action button

---

## Daily Price Email Template

### Subject Line
```
💎 Daily Metals Update - DD MMM YYYY | Auric Ledger
```
Example: `💎 Daily Metals Update - 15 Feb 2026 | Auric Ledger`

### Key Sections
1. **Header**: Gold gradient with logo and "Daily Precious Metals Price Update"
2. **Market Update**: Date-specific header
3. **Date & Exchange Rate**: Current date and USD to INR rate
4. **Prices Table**: All 9 metals with per-gram prices
5. **Info Box**: Yellow box with market insights
6. **Footer**: Link to app with copyright

### Content Highlights
- Professional market update format
- Time-stamped with full date
- Encourages setting custom alerts
- Mentions 9 AM IST update schedule

---

## Metal Prices Table

### Metals Displayed (Per Gram)
1. **Gold (22K)** - XAU with 22K carat only
2. **Silver** - XAG
3. **Platinum** - XPT
4. **Palladium** - XPD
5. **Rhodium** - RH
6. **Ruthenium** - RU
7. **Iridium** - IR
8. **Osmium** - OS
9. **Rhenium** - RE

### Table Design
- **Header**: Dark gradient (#2c3e50 to #34495e)
- **Columns**: Metal name | Price per Gram
- **Price Format**: ₹XX.XX (2 decimal places)
- **Footer Note**: "* All prices are inclusive of import duty and GST, converted to INR"

### Data Logic
```javascript
// For gold, show only 22K carat
if (row.metal_name === "XAU" && row.carat !== "22K") return;

// Skip Mercury
if (row.metal_name === "HG") return;

// Use price_1g field from database
const price = row.price_1g;
```

---

## Customization Guide

### Changing Colors
Located in `backend/src/index.js` in the email content HTML:

```javascript
// Header background
style="background: linear-gradient(135deg, #d4af37 0%, #f4e5c3 100%);"

// Table header
style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);"

// Button color
style="background-color: #d4af37;"

// Footer background
style="background-color: #2c3e50;"
```

### Changing App Link
Update the footer link in both email functions:
```html
<a href="https://auric-ledger.vercel.app" ...>
```

### Modifying Metal List
Edit the `metalNames` object in both email functions:
```javascript
const metalNames = {
  'XAU': 'Gold (22K)',
  'XAG': 'Silver',
  // Add or modify metals here
};
```

### Adjusting Table Styling
Modify the table HTML in the email template:
```html
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #ddd;">
```

---

## Best Practices

### ✅ Do's
- Keep email width at 600px for mobile compatibility
- Use inline CSS (email clients strip `<style>` tags)
- Test in multiple email clients (Gmail, Outlook, Apple Mail)
- Use table-based layout for better compatibility
- Include alt text for any images (if added later)

### ❌ Don'ts
- Don't use external CSS files
- Don't use `<style>` tags in `<head>`
- Don't rely on JavaScript (won't work in emails)
- Don't use fixed heights that might cut content
- Avoid complex responsive designs for simplicity

---

## Email Client Compatibility

### Tested & Working
- ✅ Gmail (Web & Mobile)
- ✅ Outlook (Desktop & Web)
- ✅ Apple Mail (iOS & macOS)
- ✅ Yahoo Mail
- ✅ Proton Mail

### Rendering Notes
- **Gmail**: Strips some CSS, but gradients work
- **Outlook**: Use tables for layout (no flexbox/grid)
- **Apple Mail**: Best rendering, supports most CSS
- **Dark Mode**: Text colors chosen to work in both light/dark modes

---

## Testing Emails

### Test Welcome Email
1. Start backend: `cd backend && npm run dev`
2. Subscribe with your email in the frontend app
3. Check inbox for welcome email
4. Verify all prices are displayed

### Test Daily Email
**Option 1: Wait for cron job**
- Runs daily at 9:00 AM IST automatically

**Option 2: Trigger manually**
```javascript
// In backend/src/index.js, temporarily modify cron:
cron.schedule("*/1 * * * *", async () => { // Run every 1 minute
  // ... existing code
});
```

### Check Email Logs
Backend console shows:
```
📧 Sending emails to X subscriber(s)...
✅ Email sent to user@example.com
📊 Email Summary: X/X sent successfully
```

---

## Troubleshooting

### Issue: Prices not showing in email
**Fixed!** The issue was:
- ❌ Old code: `if (row.unit === "per_gram")` - field doesn't exist
- ✅ New code: Uses `row.price_1g` directly and filters by `row.carat` for gold

### Issue: Email not received
1. Check backend logs for email sending errors
2. Verify EMAIL_USER and EMAIL_PASSWORD in `.env`
3. Check spam folder
4. Ensure email service (Gmail) allows less secure apps or has app password

### Issue: Broken layout
1. Test in different email clients
2. Verify HTML structure (all tags closed)
3. Check inline CSS syntax
4. Ensure no external CSS or JavaScript

### Issue: Wrong prices
1. Verify database has today's prices: Query `metal_prices` table
2. Check cron job ran successfully: Look for "✅ Cron job completed" in logs
3. Ensure API key is valid and fetching prices

---

## Code Locations

### Email Functions
**File**: `backend/src/index.js`

**Functions**:
- `sendWelcomeEmail(email, priceData)` - Lines ~680-829
- `sendDailyPriceEmails(priceData)` - Lines ~950-1099

### Email Transporter Config
**File**: `backend/src/index.js`
**Lines**: ~39-59

```javascript
const emailTransporter = nodemailer.createTransport({
  service: EMAIL_SERVICE,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASSWORD
  }
});
```

### Environment Variables
**File**: `backend/.env`

```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM="Auric Ledger <your-email@gmail.com>"
```

---

## Future Enhancements

### Potential Improvements
1. **Logo Image**: Replace emoji with actual logo image
2. **Charts**: Add price trend charts (requires image generation)
3. **Personalization**: Include user's saved metals/alerts
4. **Unsubscribe Link**: Add one-click unsubscribe
5. **Preferences**: Allow users to choose which metals to receive
6. **Price Alerts**: Send immediate emails when user-set alerts trigger
7. **Historical Data**: Show price changes (up/down arrows)
8. **Multiple Languages**: Support Hindi, Tamil, etc.

### Technical Improvements
1. **Email Queue**: Use Bull or BullMQ for email queue management
2. **Template Engine**: Switch to EJS or Handlebars for easier maintenance
3. **A/B Testing**: Test different subject lines for open rates
4. **Analytics**: Track email opens and clicks
5. **Retry Logic**: Implement exponential backoff for failed sends

---

## Summary

Auric Ledger's email system delivers professional, branded HTML emails with:
- ✅ Fixed price display issue (now shows all 9 metals correctly)
- ✅ Professional merchant-style branding
- ✅ Gold gradient header with logo and site name
- ✅ Warm welcome messages
- ✅ Complete metal price tables with proper formatting
- ✅ Footer with app link and branding
- ✅ Mobile-responsive design (600px width)
- ✅ Compatible with all major email clients

**Ready for production!** 🚀
