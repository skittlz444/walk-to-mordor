#!/usr/bin/env node
'use strict';

/**
 * Generate `public/sw.js` from `scripts/templates/sw.js`.
 *
 * The service-worker logic lives in the template. This script only fills in:
 *   {{CACHE_NAME}}          deterministic hash of the precache list + template
 *   {{PRECACHE_URLS}}       the shell assets, each carrying ?v=<content hash>
 *   {{SWR_CACHE_VERSION}}   deterministic hash of the SWR endpoint list + template
 *
 * Usage:
 *   node scripts/generate-sw.js
 *   node scripts/generate-sw.js --check
 */

const fs = require('fs');
const path = require('path');

const {
  MissingInputError,
  PUBLIC_DIR,
  ROOT,
  buildEntryAssetMap,
  hashString,
  requireFile,
} = require('./lib/asset-manifest');

const TEMPLATE_PATH = path.join(ROOT, 'scripts', 'templates', 'sw.js');
const OUTPUT_PATH = path.join(PUBLIC_DIR, 'sw.js');

const PRECACHE_ASSETS = [
  '/css/main.css',
  '/js/main.js',
  '/js/client/islands.js',
  '/js/client/islands.css',
  '/manifest.json',
];

function extractSwrEndpoints(template) {
  const match = template.match(/const SWR_ENDPOINTS = \[([\s\S]*?)\];/);
  if (!match) {
    throw new MissingInputError('scripts/templates/sw.js has no SWR_ENDPOINTS array to hash');
  }
  const endpoints = [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
  if (endpoints.length === 0) {
    throw new MissingInputError('scripts/templates/sw.js SWR_ENDPOINTS array is empty');
  }
  return endpoints;
}

function renderServiceWorker() {
  requireFile(TEMPLATE_PATH, 'scripts/templates/sw.js');
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const entryAssets = buildEntryAssetMap();

  const precacheUrls = PRECACHE_ASSETS.map((assetPath) => {
    const version = entryAssets[assetPath];
    if (!version) {
      throw new MissingInputError(`Precache asset is not in the entry map: ${assetPath}`);
    }
    return `${assetPath}?v=${version}`;
  });

  const swrEndpoints = extractSwrEndpoints(template);
  const cacheName = hashString(`${template}\nPRECACHE\n${precacheUrls.join('\n')}`);
  const swrCacheVersion = hashString(`${template}\nSWR\n${swrEndpoints.join('\n')}`);

  const precacheBlock = `const urlsToCache = [\n${precacheUrls.map((url) => `  '${url}'`).join(',\n')}\n];`;

  const rendered = template
    .replace('{{CACHE_NAME}}', cacheName)
    .replace('const urlsToCache = [];', precacheBlock)
    .replace('{{SWR_CACHE_VERSION}}', swrCacheVersion);

  if (!rendered.includes(`'${precacheUrls[0]}'`)) {
    throw new MissingInputError(
      'scripts/templates/sw.js has no `const urlsToCache = [];` line for the precache list'
    );
  }
  if (rendered.includes('{{')) {
    throw new MissingInputError('Generated service worker still contains a {{...}} placeholder');
  }

  return { rendered, cacheName, swrCacheVersion, precacheUrls };
}

function main() {
  const check = process.argv.slice(2).includes('--check');
  try {
    const { rendered, cacheName, swrCacheVersion } = renderServiceWorker();

    if (check) {
      if (!fs.existsSync(OUTPUT_PATH)) {
        console.error('❌ missing generated artifact: public/sw.js');
        process.exitCode = 1;
        return;
      }
      const committed = fs.readFileSync(OUTPUT_PATH, 'utf8');
      if (committed !== rendered) {
        console.error(
          '❌ public/sw.js is stale; run `npm run generate:sw`. ' +
            `Expected CACHE_NAME=walk-to-mordor-${cacheName}, SWR_CACHE_VERSION=${swrCacheVersion}.`
        );
        process.exitCode = 1;
        return;
      }
      console.log(`✓ public/sw.js is current (CACHE_NAME=walk-to-mordor-${cacheName}).`);
      return;
    }

    fs.writeFileSync(OUTPUT_PATH, rendered);
    console.log(`✓ Wrote public/sw.js (CACHE_NAME=walk-to-mordor-${cacheName})`);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
