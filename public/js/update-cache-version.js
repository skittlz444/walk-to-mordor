#!/usr/bin/env node

/**
 * Build script to update service worker cache name with build timestamp
 * This ensures each deployment gets a fresh cache
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_SW_PATH = path.join(__dirname, '..', 'sw.js');
const BUILD_TIMESTAMP_PLACEHOLDER = '{{BUILD_TIMESTAMP}}';
const SWR_CACHE_VERSION_PLACEHOLDER = '{{SWR_CACHE_VERSION}}';

function getSwPath() {
  return process.env.SW_PATH || DEFAULT_SW_PATH;
}

function updateCacheVersion() {
  try {
    const swPath = getSwPath();
    // Generate timestamp in format: YYYYMMDD-HHMMSS
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+/, '')
      .replace('T', '-');
    
    // Read the service worker file
    let swContent = fs.readFileSync(swPath, 'utf8');
    
    // Check if placeholder exists
    if (!swContent.includes(BUILD_TIMESTAMP_PLACEHOLDER)) {
      console.log('⚠️  Build timestamp placeholder not found in service worker');
      return;
    }
    
    // Replace all occurrences of placeholder with actual timestamp
    swContent = swContent.replaceAll(BUILD_TIMESTAMP_PLACEHOLDER, timestamp);
    
    // Replace SWR_CACHE_VERSION placeholder with timestamp
    if (swContent.includes(SWR_CACHE_VERSION_PLACEHOLDER)) {
      swContent = swContent.replaceAll(SWR_CACHE_VERSION_PLACEHOLDER, timestamp);
      console.log(`✅ Updated SWR cache version to: ${timestamp}`);
    }
    
    // Write back to file
    fs.writeFileSync(swPath, swContent, 'utf8');
    
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
