# App Icons Generation Guide

This directory contains icon configuration for the Metal Price Tracker PWA (Progressive Web App).

## Files

- **icon.svg** - Master SVG icon template
- **generate-icons.js** - Node.js script to generate PNG icons (recommended)
- **generate-icons.sh** - Bash script for Linux/macOS

## How to Generate Icons

### Option 1: Using Node.js (Recommended for Windows)

```bash
cd frontend/public/icons

# Install dependencies
npm install sharp svg2png

# Generate PNG icons
node generate-icons.js
```

### Option 2: Using ImageMagick (Linux/macOS)

```bash
cd frontend/public/icons

# Install ImageMagick
# macOS: brew install imagemagick
# Ubuntu/Debian: sudo apt-get install imagemagick

# Run generation script
bash generate-icons.sh
```

### Option 3: Online Converters

If you prefer not to install additional tools:

1. Visit: https://convertio.co/svg-png/ or https://www.freeconvert.com/image-converter
2. Upload `icon.svg`
3. Download PNG versions for sizes: 72, 96, 128, 144, 152, 192, 384, 512
4. Save as `icon-{size}x{size}.png`

## Generated Icon Sizes

The following PNG icons will be generated:

- **72x72** - Legacy Android devices
- **96x96** - Android devices, desktop shortcuts
- **128x128** - Chrome Web Store
- **144x144** - Android home screen (old)
- **152x152** - iPad
- **192x192** - Android home screen (modern), PWA install icon
- **384x384** - Splash screen (tablet)
- **512x512** - Splash screen (mobile), large displays

## Icon Format

The SVG icon features:
- Gold/Bronze color scheme (#B8860B primary, #FFD700 accent)
- Rupee symbol (₹) representing Indian currency
- Coin shape representing precious metals
- Scalable design that works at any size

## Notes

- Icons must be PNG format for maximum PWA compatibility
- Keep icons in this `icons/` directory
- Update `manifest.json` if you change icon filenames
- Test PWA installation on different devices to ensure icons display correctly

## Testing

After generating icons:

1. Open the app in a Chromium-based browser (Chrome, Edge, etc.)
2. Check the URL bar for an install button
3. Install the app to verify icons appear correctly
4. Test on mobile devices (iOS via Safari, Android via Chrome)

## Customization

To customize the icon:

1. Edit `icon.svg` with your SVG editor or text editor
2. Modify colors, shapes, or add/remove elements
3. Regenerate the PNG files using one of the methods above

## Resources

- SVG: https://www.w3.org/TR/SVG2/
- PWA Icons: https://web.dev/add-manifest/#icons
- Sharp (Node.js): https://sharp.pixelplumbing.com/
- ImageMagick: https://imagemagick.org/
