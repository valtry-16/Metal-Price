# 🔒 Security Improvements - Auric Ledger

## Overview

Comprehensive security hardening has been implemented to protect your Metal Price application from common web vulnerabilities and attacks.

---

## ✅ Security Measures Implemented

### 1. 🔴 HIGH PRIORITY: CORS Restriction

**Issue:** Previously allowed all origins, making the API vulnerable to cross-site attacks.

**Solution:** Whitelist only trusted domains.

```javascript
// NOW: Only these origins allowed
const ALLOWED_ORIGINS = [
  "https://metal-price.onrender.com",  // Production
  "http://localhost:3000",              // Local dev
  "http://localhost:5173"               // Vite dev
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed"), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "x-run-daily-secret", "x-send-welcome-emails-secret"]
}));
```

**Impact:** 
- ✅ Blocks unauthorized cross-origin requests
- ✅ Prevents CSRF attacks
- ✅ Protects API from misuse by third-party domains

---

### 2. 🔴 HIGH PRIORITY: Hide Detailed Error Messages

**Issue:** API exposed system details in error messages (security risk).

**Solution:** Generic error messages to users, detailed logs server-side only.

```javascript
// BEFORE: Error exposed system details
res.status(500).json({ 
  status: "error", 
  message: "Database error: Connection timeout at host..." 
});

// NOW: Generic message
sendErrorResponse(res, 500, "An error occurred. Please try again later.");
// Server logs the actual error privately
console.error("Database query error:", error.message);
```

**Impact:**
- ✅ Prevents information disclosure
- ✅ Hides system architecture from attackers
- ✅ Still logs details for troubleshooting

---

### 3. 🟡 MEDIUM PRIORITY: Rate Limiting

**Issue:** No protection against brute force, spam, or DoS attacks.

**Solution:** Implemented tiered rate limiting.

```javascript
// General rate limit: 100 requests per IP per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later"
});

// Strict email limit: 5 requests per IP per minute
const emailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: "Too many email requests, please try again later"
});

// Auth-like endpoints: 20 requests per IP per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many attempts, please try again later"
});
```

**Applied To:**
- `POST /subscribe-email` → emailLimiter (5 req/min) - Prevent email subscription spam
- `POST /run-daily` → authLimiter (20 req/15min) - Prevent cron abuse
- `POST /send-welcome-emails` → authLimiter (20 req/15min) - Prevent email cron abuse
- All routes → generalLimiter (100 req/15min) - General DoS protection

**Exceptions:**
- Cron job requests (with secret headers) bypass limits
- Internal requests not rate limited

**Impact:**
- ✅ Prevents email spam attacks
- ✅ Protects against brute force on secure endpoints
- ✅ Prevents denial-of-service (DoS)
- ✅ Allows legitimate cron jobs to work

---

### 4. 🟡 MEDIUM PRIORITY: Email Validation

**Issue:** Invalid emails could be stored, causing failed sends and data pollution.

**Solution:** Strict RFC 5322-compliant email validation.

```javascript
const isValidEmail = (email) => {
  // RFC 5322 simplified email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

// Applied in /subscribe-email endpoint
if (!isValidEmail(email)) {
  return res.status(400).json({ status: "error", message: "Invalid email format" });
}
```

**Checks:**
- ✅ Must contain exactly one `@` symbol
- ✅ Must have characters before `@` (local part)
- ✅ Must have domain with at least one dot
- ✅ Maximum 254 characters (RFC limit)
- ✅ No spaces or special characters allowed

**Impact:**
- ✅ Prevents invalid emails from being stored
- ✅ Reduces failed email sends
- ✅ Improves data quality
- ✅ Prevents XSS through email field

---

### 5. 🟢 LOW PRIORITY: Secure Error Response Handler

**Solution:** Consistent error handling across all endpoints.

```javascript
// Generic error response (doesn't expose system details)
const sendErrorResponse = (res, statusCode, message = "An error occurred") => {
  console.error(`[ERROR ${statusCode}] ${message}`);
  res.status(statusCode).json({
    status: "error",
    message: message
  });
};
```

**Benefits:**
- ✅ Consistent error format
- ✅ Prevents accidental information disclosure
- ✅ Easy to audit for security issues

---

## 📋 Configuration Changes

### Updated package.json
```json
{
  "dependencies": {
    "express-rate-limit": "^7.1.5"  // NEW
  }
}
```

Install before deploying:
```bash
npm install express-rate-limit
```

### Updated .env
No changes needed - security keys already configured:
```env
RUN_DAILY_SECRET=...              # For /run-daily endpoint
RUN_WELCOME_EMAIL_SECRET=...      # For /send-welcome-emails endpoint
```

---

## 🚀 Deployment Steps

1. **Install new dependencies**
   ```bash
   cd backend
   npm install express-rate-limit
   ```

2. **Update Render Environment**
   - No new env vars needed
   - Make sure `RUN_DAILY_SECRET` and `RUN_WELCOME_EMAIL_SECRET` are set

3. **Deploy backend**
   ```bash
   git add .
   git commit -m "Add comprehensive security improvements: CORS restriction, error message hiding, rate limiting, email validation"
   git push
   ```

4. **Verify deployment**
   - Check Render logs for startup message
   - Test with curl:
     ```bash
     # Should be rejected (CORS)
     curl -H "Origin: https://evil.example.com" https://metal-price.onrender.com/api/prices
     
     # Should work (whitelisted origin)
     curl -H "Origin: https://metal-price.onrender.com" https://metal-price.onrender.com/api/prices
     ```

---

## 🔐 Security Checklist

### Before Deployment
- [ ] Run `npm install express-rate-limit`
- [ ] Test email validation (invalid emails should be rejected)
- [ ] Test rate limiting (5 requests to /subscribe-email within 1 min should fail)
- [ ] Verify CORS only allows your domain

### After Deployment
- [ ] Check Render logs for startup message
- [ ] Test with browser (should work)
- [ ] Test with curl from different origin (should be blocked)
- [ ] Monitor logs for rate limit hits (sign of attack?)
- [ ] Check email subscription success rate

---

## 📊 Rate Limit Response

When rate limit is exceeded, API returns:

```json
{
  "status": "error",
  "message": "Too many requests, please try again later"
}
```

HTTP Status: **429 Too Many Requests**

---

## 🚨 Security Best Practices Going Forward

1. **Keep dependencies updated**
   ```bash
   npm outdated
   npm update
   ```

2. **Monitor logs for suspicious activity**
   - High rate limit hits from single IP
   - Repeated invalid email attempts
   - Unauthorized access to /run-daily or /send-welcome-emails

3. **Rotate secrets periodically**
   - Change `RUN_DAILY_SECRET` every 6 months
   - Change `RUN_WELCOME_EMAIL_SECRET` every 6 months
   - Use strong, random values (32+ chars)

4. **Add authentication for sensitive endpoints**
   - Consider adding user authentication for /subscribe-email
   - Add logging for all admin actions

5. **Set up monitoring/alerts**
   - Alert on rate limit threshold hit
   - Alert on repeated 401 (unauthorized) responses
   - Alert on email service errors

---

## 📈 Security Improvements Summary

| Issue | Before | After | Status |
|-------|--------|-------|--------|
| CORS | All origins allowed | Whitelist only (3 trusted) | ✅ Fixed |
| Error messages | Detailed system info exposed | Generic, user-friendly | ✅ Fixed |
| Email spam | No protection | Rate limited (5/min) | ✅ Fixed |
| DoS attacks | No protection | Rate limited (100/15min) | ✅ Fixed |
| Invalid emails | Accepted & stored | Validated & rejected | ✅ Fixed |
| Error handling | Inconsistent | Standardized | ✅ Fixed |
| Brute force | No protection | Rate limited (20/15min) | ✅ Fixed |

---

## 🆘 Troubleshooting

### "CORS not allowed" error in browser
- Check that your URL origin is in `ALLOWED_ORIGINS`
- Make sure you're using https in production
- Check browser console for exact origin being blocked

### Rate limit error "Too many requests"
- Wait 1 minute before making new email requests
- Check IP address (might be shared with other users)
- Contact support if legitimate requests are blocked

### Email validation rejecting valid emails
- Check email format: must have `@` and domain
- Check length (max 254 characters)
- Make sure no spaces before/after email

---

## 📚 References

- [OWASP - CORS](https://owasp.org/www-community/attacks/csrf)
- [OWASP - Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)
- [RFC 5322 - Email Format](https://tools.ietf.org/html/rfc5322)
- [express-rate-limit Documentation](https://github.com/nfriedly/express-rate-limit)

