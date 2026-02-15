# Backend Auto-Detection Guide

## How It Works

The frontend now **automatically detects** which backend to use:

### Development Mode (Backend Running Locally)
When you run `npm run dev` in backend:
1. Frontend checks if `localhost:4000` is available
2. ✅ **If available**: Uses `http://localhost:4000`
3. Console shows: `✅ Using local dev server: http://localhost:4000`

### Development Mode (Backend NOT Running)
If you only run frontend without backend:
1. Frontend checks `localhost:4000` (times out after 2 seconds)
2. ⚠️ **Fallback**: Uses production backend URL
3. Console shows: `⚠️ Local dev server not available, using production: https://your-backend.onrender.com`

### Production Mode
When deployed to Vercel/Netlify:
1. Frontend tries `localhost:4000` (always fails in production)
2. Automatically falls back to `VITE_API_BASE_URL` environment variable
3. Uses your deployed Render backend

---

## Usage Scenarios

### Scenario 1: Full Local Development ✅
```bash
# Terminal 1: Backend
cd backend
npm run dev
# → Server runs on http://localhost:4000

# Terminal 2: Frontend
cd frontend
npm run dev
# → Frontend auto-detects localhost:4000
# → Console: "✅ Using local dev server: http://localhost:4000"
```

### Scenario 2: Frontend Only (Testing UI) ⚠️
```bash
# Don't start backend

# Terminal: Frontend only
cd frontend
npm run dev
# → Frontend can't reach localhost:4000
# → Console: "⚠️ Local dev server not available, using production: https://your-backend.onrender.com"
# → Uses production Render backend (if deployed)
```

### Scenario 3: Production Deployment 🚀
```bash
# Deploy backend to Render
# Get URL: https://auric-ledger-api.onrender.com

# Deploy frontend to Vercel
# Set env var: VITE_API_BASE_URL=https://auric-ledger-api.onrender.com

# Frontend tries localhost:4000 → fails (production environment)
# Falls back to VITE_API_BASE_URL → uses Render backend
```

---

## Configuration

### Frontend Environment Variables

**For Production (Vercel/Netlify):**
```env
VITE_API_BASE_URL=https://your-backend.onrender.com
```

**For Development:**
No configuration needed! Frontend auto-detects `localhost:4000`

### Backend Port
Backend must run on port `4000` (default in `.env`):
```env
PORT=4000
```

---

## How Detection Works

The frontend uses this logic:

```javascript
1. Try to fetch from http://localhost:4000/get-latest-price
2. Wait up to 2 seconds for response
3. If successful → Use localhost:4000
4. If failed (timeout/network error) → Use VITE_API_BASE_URL or fallback
```

**Why this works:**
- Local dev: Backend responds immediately from localhost:4000
- Production: localhost not available, falls back to environment variable
- No manual switching needed!

---

## Troubleshooting

### Issue: Frontend not detecting local backend
**Symptoms:**
- Backend is running on port 4000
- Frontend shows: "⚠️ Local dev server not available"

**Solutions:**
1. Check backend is actually running: `curl http://localhost:4000/get-latest-price`
2. Verify backend port is 4000 in `.env`
3. Check firewall isn't blocking localhost connections
4. Restart both frontend and backend

### Issue: Frontend using wrong backend
**Check console logs:**
- Open browser DevTools → Console
- Look for message: `✅ Using local dev server:` or `⚠️ Local dev server not available`
- This tells you which backend is being used

### Issue: Production frontend not working
**Check:**
1. Did you set `VITE_API_BASE_URL` in Vercel/Netlify?
2. Is the Render backend URL correct and deployed?
3. Check browser console for CORS errors

---

## Console Messages

| Message | Meaning | Action |
|---------|---------|--------|
| `✅ Using local dev server: http://localhost:4000` | Backend detected locally | ✅ Perfect for development |
| `⚠️ Local dev server not available, using production: https://...` | Using production backend | ⚠️ Check if you meant to run backend locally |

---

## Best Practices

### Development Workflow
1. **Always run backend first**: `cd backend && npm run dev`
2. **Then run frontend**: `cd frontend && npm run dev`
3. **Check console**: Verify frontend detected local backend

### Production Deployment
1. Deploy backend to Render first
2. Get the deployed URL
3. Set `VITE_API_BASE_URL` in frontend deployment
4. Deploy frontend

### Testing
- **Test locally**: Run both backend + frontend
- **Test production fallback**: Run frontend only (should use production URL)
- **Test production**: Deploy and verify environment variables

---

## Summary

✅ **No more manual configuration for development**
✅ **Seamless local development experience**  
✅ **Automatic production fallback**
✅ **Clear console messages showing which backend is active**

Just run your backend on port 4000, and frontend will find it automatically! 🎉
