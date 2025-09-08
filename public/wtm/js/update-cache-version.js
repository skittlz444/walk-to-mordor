#!/usr/bin/env node

/**
 * Build script to update service worker cache name with build timestamp
 * This ensures each deployment gets a fresh cache
 */

const fs = require('fs');
const path = require('path');

const SW_PATH = path.join(__dirname, '..', 'sw.js');
const BUILD_TIMESTAMP_PLACEHOLDER = '{{BUILD_TIMESTAMP}}';

function updateCacheVersion() {
  try {
    // Generate timestamp in format: YYYYMMDD-HHMMSS
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+/, '')
      .replace('T', '-');
    
    // Read the service worker file
    let swContent = fs.readFileSync(SW_PATH, 'utf8');
    
    // Check if placeholder exists
    if (!swContent.includes(BUILD_TIMESTAMP_PLACEHOLDER)) {
      console.log('⚠️  Build timestamp placeholder not found in service worker');
      return;
    }
    
    // Replace all occurrences of placeholder with actual timestamp
    swContent = swContent.replaceAll(BUILD_TIMESTAMP_PLACEHOLDER, timestamp);
    
    // Write back to file
    fs.writeFileSync(SW_PATH, swContent, 'utf8');
    
    console.log(`✅ Updated service worker cache version to: walk-to-mordor-${timestamp}`);
    
  } catch (error) {
    console.error('❌ Failed to update cache version:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  updateCacheVersion();
}

module.exports = { updateCacheVersion };

module.exports = { updateCacheVersion };
