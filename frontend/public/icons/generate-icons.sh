#!/bin/bash
# Icon generation script for Metal Price Tracker App
# This script converts SVG icons to PNG using ImageMagick

# Install ImageMagick if not already installed:
# Ubuntu/Debian: sudo apt-get install imagemagick
# macOS: brew install imagemagick
# Windows: Download from https://imagemagick.org/

# Icon sizes to generate
sizes=(72 96 128 144 152 192 384 512)

# Colors for different size icons
PRIMARY_COLOR="#B8860B"
SECONDARY_COLOR="#FFD700"

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "ImageMagick not found. Please install it first:"
    echo "Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "macOS: brew install imagemagick"
    echo "Windows: https://imagemagick.org/"
    exit 1
fi

# Generate PNG icons from SVG
echo "Generating icons..."

for size in "${sizes[@]}"; do
    echo "Creating icon-${size}x${size}.png..."
    convert -background none \
            -density 300 \
            -resize "${size}x${size}" \
            -gravity center \
            -extent "${size}x${size}" \
            icon.svg \
            "icon-${size}x${size}.png"
done

echo "✓ Icons generated successfully!"
ls -la icon-*.png
