#!/usr/bin/env node

/**
 * Generate Image Manifest
 * 
 * Scans public/img/highres/*.webp for all image files, extracts base slugs,
 * and writes a JSON manifest to public/img/image-manifest.json.
 * 
 * Usage:
 *   node scripts/generate-image-manifest.js
 *   npm run build:manifest
 * 
 * The manifest is used by the admin image inventory API to cross-reference
 * goals' image_id values against deployed image assets at runtime.
 */

const fs = require('fs');
const path = require('path');

const HIGHRES_DIR = path.join(__dirname, '..', 'public', 'img', 'highres');
const MANIFEST_PATH = path.join(__dirname, '..', 'public', 'img', 'image-manifest.json');

function generateManifest() {
  console.log('🖼️  Image Manifest Generator');
  console.log('================================\n');

  // Handle missing directory gracefully
  if (!fs.existsSync(HIGHRES_DIR)) {
    console.log(`⚠️  High-res directory not found: ${HIGHRES_DIR}`);
    console.log('   Writing empty manifest.\n');
    const manifest = {
      generated: new Date().toISOString(),
      images: [],
      count: 0,
    };
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`✅ Empty manifest written to: ${MANIFEST_PATH}`);
    return;
  }

  // Scan for .webp files in highres directory (filter to regular files only)
  const entries = fs.readdirSync(HIGHRES_DIR, { withFileTypes: true });
  const files = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.webp'))
    .map(entry => entry.name);

  // Extract base slugs (strip .webp extension) and sort alphabetically
  const slugs = files
    .map(file => file.replace(/\.webp$/, ''))
    .sort((a, b) => a.localeCompare(b));

  const manifest = {
    generated: new Date().toISOString(),
    images: slugs,
    count: slugs.length,
  };

  // Ensure output directory exists
  const manifestDir = path.dirname(MANIFEST_PATH);
  if (!fs.existsSync(manifestDir)) {
    fs.mkdirSync(manifestDir, { recursive: true });
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`Source: ${HIGHRES_DIR}`);
  console.log(`Output: ${MANIFEST_PATH}`);
  console.log(`\nFound ${slugs.length} image slug(s).`);
  if (slugs.length > 0) {
    console.log(`First: ${slugs[0]}`);
    console.log(`Last:  ${slugs[slugs.length - 1]}`);
  }
  console.log(`\n✅ Manifest generated successfully!`);
}

generateManifest();
