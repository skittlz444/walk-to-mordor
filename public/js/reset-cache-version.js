#!/usr/bin/env node

/**
 * Reset script to restore service worker cache name to development placeholder
 * This is useful for development and ensuring the build script works correctly
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_SW_PATH = path.join(__dirname, '..', 'sw.js');
const BUILD_TIMESTAMP_PLACEHOLDER = '{{BUILD_TIMESTAMP}}';
const SWR_CACHE_VERSION_PLACEHOLDER = '{{SWR_CACHE_VERSION}}';

function getSwPath() {
  return process.env.SW_PATH || DEFAULT_SW_PATH;
}

function resetCacheVersion() {
  try {
    const swPath = getSwPath();
    // Read the service worker file
    let swContent = fs.readFileSync(swPath, 'utf8');
    
    // Find the cache name line and replace with placeholder
    const cacheNameRegex = /const CACHE_NAME = `walk-to-mordor-[^`]+`;/;
    const placeholderLine = `const CACHE_NAME = \`walk-to-mordor-${BUILD_TIMESTAMP_PLACEHOLDER}\`;`;
    
    if (cacheNameRegex.test(swContent)) {
      swContent = swContent.replace(cacheNameRegex, placeholderLine);
    } else {
      console.log('⚠️  Cache name pattern not found in service worker');
      return;
    }
    
    // Also reset the BUILD_TIMESTAMP constant
    const timestampRegex = /const BUILD_TIMESTAMP = '[^']+';/;
    const placeholderConstant = `const BUILD_TIMESTAMP = '${BUILD_TIMESTAMP_PLACEHOLDER}';`;
    
    if (timestampRegex.test(swContent)) {
      swContent = swContent.replace(timestampRegex, placeholderConstant);
    }
    
    // Reset SWR_CACHE_VERSION constant
    const swrVersionRegex = /const SWR_CACHE_VERSION = '[^']+';/;
    const swrPlaceholder = `const SWR_CACHE_VERSION = '${SWR_CACHE_VERSION_PLACEHOLDER}';`;
    
    if (swrVersionRegex.test(swContent)) {
      swContent = swContent.replace(swrVersionRegex, swrPlaceholder);
      console.log('✅ Reset SWR cache version to development placeholder');
    }
    
    // Write back to file
    fs.writeFileSync(swPath, swContent, 'utf8');
    
    console.log('✅ Reset service worker cache version to development placeholder');
    
  } catch (error) {
    console.error('❌ Failed to reset cache version:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  resetCacheVersion();
}

module.exports = { resetCacheVersion };
