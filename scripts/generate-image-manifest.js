#!/usr/bin/env node
'use strict';

/**
 * Generate the deterministic image manifest.
 *
 * Scans public/img/highres/*.webp, strips the extension, sorts byte-wise, and
 * writes public/img/image-manifest.json. No timestamp: two runs over the same
 * directory produce byte-identical output.
 *
 * Usage:
 *   node scripts/generate-image-manifest.js
 *   node scripts/generate-image-manifest.js --check
 *   npm run generate:image-manifest
 *   npm run build:manifest
 *
 * The manifest is used by the admin image inventory API to cross-reference
 * goals' image_id values against deployed image assets at runtime.
 */

const fs = require('fs');
const path = require('path');

const {
  PUBLIC_DIR,
  byteWiseCompare,
  formatJson,
  listFilesRecursive,
  requireDirectory,
} = require('./lib/asset-manifest');

const HIGHRES_DIR = path.join(PUBLIC_DIR, 'img', 'highres');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'img', 'image-manifest.json');

function buildManifest() {
  requireDirectory(HIGHRES_DIR, 'public/img/highres');

  const slugs = listFilesRecursive(HIGHRES_DIR)
    .map((absPath) => path.basename(absPath))
    .filter((name) => name.endsWith('.webp'))
    .map((name) => name.replace(/\.webp$/, ''))
    .sort(byteWiseCompare);

  return {
    images: slugs,
    count: slugs.length,
  };
}

function main() {
  const check = process.argv.slice(2).includes('--check');

  try {
    const manifest = buildManifest();
    const content = formatJson(manifest);

    if (check) {
      if (!fs.existsSync(MANIFEST_PATH)) {
        console.error('❌ missing generated artifact: public/img/image-manifest.json');
        process.exitCode = 1;
        return;
      }
      const committed = fs.readFileSync(MANIFEST_PATH, 'utf8');
      if (committed !== content) {
        console.error(
          '❌ public/img/image-manifest.json is stale; run `npm run generate:image-manifest`.'
        );
        process.exitCode = 1;
        return;
      }
      console.log(`✓ public/img/image-manifest.json is current (${manifest.count} slugs).`);
      return;
    }

    fs.writeFileSync(MANIFEST_PATH, content);
    console.log('🖼️  Image Manifest Generator');
    console.log('================================\n');
    console.log(`Source: ${HIGHRES_DIR}`);
    console.log(`Output: ${MANIFEST_PATH}`);
    console.log(`\nFound ${manifest.count} image slug(s).`);
    if (manifest.count > 0) {
      console.log(`First: ${manifest.images[0]}`);
      console.log(`Last:  ${manifest.images[manifest.count - 1]}`);
    }
    console.log('\n✅ Manifest generated successfully!');
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
