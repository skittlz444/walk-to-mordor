const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const MAP_DIR = path.join(__dirname, '..', 'public', 'img', 'map');

async function processMapImages() {
  console.log(`Scanning ${MAP_DIR}...`);
  try {
    const files = await fs.readdir(MAP_DIR);
    
    for (const file of files) {
      if (file.endsWith('.webp')) continue; // Skip already converted
      
      const ext = path.extname(file).toLowerCase();
      if (!['.png', '.jpg', '.jpeg'].includes(ext)) continue;

      const inputPath = path.join(MAP_DIR, file);
      const outputPath = path.join(MAP_DIR, path.basename(file, ext) + '.webp');

      console.log(`Processing ${file}...`);
      
      // Get metadata of original
      const originalMeta = await sharp(inputPath).metadata();
      console.log(`  Original: ${originalMeta.width}x${originalMeta.height}, ${originalMeta.format}`);

      // Convert using lossless or near-lossless
      // User asked for "Full Quality" and "Retaining Resolution"
      // We'll use quality 100 or lossless. Let's try high quality first as lossless can be huge for photos.
      // Actually, for maps, if it's painted, it might be better with lossless=false, quality=90-100.
      // Let's use quality 100.
      
      await sharp(inputPath)
        .webp({ quality: 100, lossless: false }) // lossless: true might be too big for large maps
        .toFile(outputPath);

      const newMeta = await sharp(outputPath).metadata();
      const stats = await fs.stat(outputPath);
      const sizeMB = stats.size / (1024 * 1024);

      console.log(`  Converted to: ${path.basename(outputPath)}`);
      console.log(`  Dimensions: ${newMeta.width}x${newMeta.height}`);
      console.log(`  Size: ${sizeMB.toFixed(2)} MB`);
      
      // Validation Check
      if (newMeta.width > 8192 || newMeta.height > 8192) {
        console.warn(`  WARNING: Dimensions exceed 8192px (Typical mobile texture limit). May fail on older phones.`);
      } else if (newMeta.width > 4096) {
        console.log(`  NOTE: Dimensions > 4096px. High detail preserved, but check mobile performance.`);
      } else {
        console.log(`  PASS: Dimensions within standard texture limits.`);
      }
      
      if (sizeMB > 5) {
        console.warn(`  WARNING: File size is large (>5MB). Loading might be slow.`);
      }

      console.log('---');
    }
  } catch (err) {
    console.error('Error processing images:', err);
    process.exitCode = 1;
  }
}

processMapImages();
