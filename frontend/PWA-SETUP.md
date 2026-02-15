# Metal Price Tracker - PWA (Progressive Web App) Setup

Your Metal Price Tracker app is now configured as a Progressive Web App! This allows users to install the app on their devices and use it offline.

## ✅ PWA Features

### 1. **Installable App**
- Install on desktop (Chrome, Edge, Firefox)
- Install on mobile (Android Chrome, iOS Safari)
- App icon on home screen
- Standalone app experience (no browser UI)

### 2. **Offline Support**
- Service worker caches essential files
- View previously fetched metal prices offline
- Automatic sync when back online
- Offline fallback page

### 3. **Auto Updates**
- Service worker checks for updates every minute in the background
- Prompts users when updates are available
- Seamless update experience

### 4. **Responsive Design**
- Works on all screen sizes
- Touch-friendly interface
- Adaptive layouts

## 📦 Files Added/Modified

### New Files:
- `public/sw.js` - Service Worker (caching & offline support)
- `public/offline.html` - Offline fallback page
- `public/icons/icon.svg` - Master icon template
- `public/icons/generate-icons.js` - Icon generation script (Node.js)
- `public/icons/generate-icons.sh` - Icon generation script (Bash)
- `public/icons/README.md` - Icon generation guide

### Modified Files:
- `index.html` - Added PWA meta tags and service worker registration
- `manifest.json` - Already configured with app metadata

## 🚀 Getting Started

### Step 1: Generate App Icons

The App needs PNG icons in multiple sizes. Choose one method:

**Option A: Node.js (Recommended for Windows)**
```bash
cd frontend/public/icons
npm install sharp svg2png
node generate-icons.js
```

**Option B: ImageMagick (Linux/macOS)**
```bash
cd frontend/public/icons
bash generate-icons.sh
```

**Option C: Online Converter**
- Visit: https://convertio.co/svg-png/
- Upload `icon.svg`
- Download PNGs for sizes: 72, 96, 128, 144, 152, 192, 384, 512

### Step 2: Run the App

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Visit: http://localhost:5173

### Step 3: Install the App

**Desktop (Chrome/Edge/Firefox):**
1. Open the app in browser
2. Look for "Install" button in address bar (or menu)
3. Click to install
4. App opens in standalone window

**Mobile (Android Chrome):**
1. Open the app in Chrome
2. Tap menu (three dots)
3. Tap "Add to Home screen" or "Install app"
4. Confirm the installation

**Mobile (iOS Safari):**
1. Open the app in Safari
2. Tap Share button
3. Tap "Add to Home Screen"
4. Name the app and add

## 🔧 Service Worker Features

### Caching Strategy
- **Network First** for API calls (try network, fall back to cache)
- **Cache First** for static assets (use cache, fall back to network)
- Static assets cached on first load

### Auto Update
- Service worker checks for updates every minute
- Automatic cache cleanup of old versions
- Seamless updates without user intervention

### Offline Detection
- Offline page served when network unavailable
- Auto-reload when connection restored
- Visual indicators of connection status

## 📊 Manifest Configuration

The `manifest.json` includes:

```json
{
  "name": "Metal Price Tracker",
  "short_name": "MetalPrice",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#B8860B",
  "background_color": "#0F172A",
  "icons": [
    // Various sizes for different devices
  ],
  "shortcuts": [
    // Quick access to Gold/Silver prices
  ]
}
```

## 🎨 Icon Information

Current icon design features:
- **Color**: Gold (#B8860B) with accent (#FFD700)
- **Symbol**: Rupee (₹) in coin shape
- **Style**: Professional, scalable, recognizable

### Supported Sizes:
- 72x72 - Legacy Android
- 96x96 - Android, desktop shortcuts
- 128x128 - Chrome Web Store
- 144x144 - Android home screen
- 152x152 - iPad
- 192x192 - **Most important** - Android & PWA install
- 384x384 - Splash screen (tablet)
- 512x512 - Splash screen (mobile)

⚠️ **Generate these PNG files before deploying!**

## 🌐 Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Desktop & Android |
| Edge | ✅ Full | Desktop |
| Firefox | ✅ Full | Desktop only |
| Safari | ⚠️ Limited | iOS via "Add to Home Screen" |
| Opera | ✅ Full | Desktop & Mobile |

## 📱 Offline Behavior

When offline:

1. **Cached pages** load instantly from cache
2. **API requests** fail gracefully with offline page
3. **Auto-sync** happens when connection restored
4. **Data persists** from last online session

## 🔒 Security Headers

The Service Worker respects:
- CORS policies
- Same-origin requests only
- Secure context (HTTPS on production)

## 🚀 Production Deployment

Before deploying to production:

1. **Generate all icon PNG files**
   ```bash
   npm install sharp svg2png
   node public/icons/generate-icons.js
   ```

2. **Build the app**
   ```bash
   npm run build
   ```

3. **Enable HTTPS** (required for PWA)
   - PWA works only over HTTPS (or localhost)

4. **Verify service worker**
   - DevTools → Application → Service Workers
   - Check caching behavior

5. **Test installation**
   - Test on various devices
   - Verify offline functionality

## 📊 Monitoring

Check service worker status in Chrome DevTools:

1. Open DevTools (F12)
2. Go to **Application** tab
3. Click **Service Workers**
4. See registration status and cache

## 🐛 Troubleshooting

### Service Worker Not Registering
- Check browser console for errors
- Ensure HTTPS (or localhost)
- Clear cache and reload

### Icons Not Showing
- **Generate PNG files** first
- Verify file sizes in `manifest.json`
- Check `public/icons/` directory

### Offline Page Not Working
- Service worker must cache `/offline.html`
- Reload app while online first
- Check service worker scope

### Cache Not Updating
- Service worker checks every minute
- Manual refresh: `Ctrl+Shift+Delete` cache
- DevTools: Application → Clear site data

## 📚 Resources

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Icon Generator](https://www.favicon-generator.org/)

## ✨ Next Steps

1. **Generate app icons** (choose one method above)
2. **Test offline functionality**
3. **Test installation** on multiple devices
4. **Enable HTTPS** for production
5. **Monitor service worker** in DevTools

Your app is now a true PWA! 🎉
