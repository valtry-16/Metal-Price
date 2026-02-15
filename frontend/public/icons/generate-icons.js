import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

/**
 * Icon Generation Script for Metal Price Tracker
 * Generates PNG icons from SVG template in multiple sizes
 * 
 * Usage: node generate-icons.js
 * 
 * Install dependencies first:
 * npm install sharp
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputFile = path.join(__dirname, 'icon.svg');
const outputDir = __dirname;

async function generateIcons() {
  try {
    // Check if SVG file exists
    if (!fs.existsSync(inputFile)) {
      console.error('❌ Error: icon.svg not found in current directory');
      console.error(`   Expected: ${inputFile}`);
      process.exit(1);
    }

    console.log('🎨 Generating app icons...\n');
    
    const generatedFiles = [];
    
    for (const size of sizes) {
      const outputFile = path.join(outputDir, `icon-${size}x${size}.png`);
      
      try {
        // Convert SVG to PNG with specified size using sharp
        await sharp(inputFile)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 184, g: 134, b: 11, alpha: 0 } // Transparent background
          })
          .png()
          .toFile(outputFile);
        
        console.log(`✓ Generated: icon-${size}x${size}.png (${size}x${size})`);
        generatedFiles.push(`icon-${size}x${size}.png`);
      } catch (err) {
        console.warn(`⚠ Failed to generate icon-${size}x${size}.png:`, err.message);
      }
    }
    
    if (generatedFiles.length === 0) {
      console.error('\n❌ No icons were generated. Please check your SVG file.');
      process.exit(1);
    }

    console.log(`\n✅ Icon generation complete!`);
    console.log(`\n📦 Generated ${generatedFiles.length} icon files:`);
    generatedFiles.forEach(f => console.log(`   • ${f}`));
    
    console.log('\n💡 Next steps:');
    console.log('   1. Update your manifest.json with the new icon paths');
    console.log('   2. Test the PWA installation in your browser');
    console.log('   3. Verify icons appear on home screen');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

// Run if this is the main module
generateIcons();
