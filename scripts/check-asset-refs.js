#!/usr/bin/env node
'use strict';

/**
 * Reject raw public-asset URLs outside the approved resolvers.
 *
 * Scans client source and server source for `/img/`, `/js/`, `/css/`, and
 * `/icons/` string literals. Generated files, resolver helpers, tests, and
 * layout configuration arrays (`stylesheets`/`scripts` passed to renderLayout)
 * are exempt, as are literals passed directly to a resolver (`assetUrl('/...')`)
 * and fetches of generated artifacts (the image manifest, the runtime image
 * map, and the map-tile metadata). All production call sites are migrated; a
 * new raw URL anywhere else fails with `file:line` and the expected resolver.
 *
 * Usage:
 *   node scripts/check-asset-refs.js
 */

const fs = require('fs');
const path = require('path');

const {
  ROOT,
  listFilesRecursive,
  toPosix,
} = require('./lib/asset-manifest');

const SCAN_DIRS = ['client/src', 'src'];
const FILE_EXTENSIONS = ['.ts', '.tsx'];

/**
 * Fetches of generated artifacts, not asset bytes. These paths are produced by
 * the build and are safe to reference directly (see design Decision 10).
 */
const GENERATED_ARTIFACT_LITERALS = new Set([
  '/img/image-manifest.json',
  '/img/image-versions.json',
  // Tile-set metadata is fetched by MapIsland; tile URLs alone carry `?v=`.
  '/img/map/tiles/metadata.json',
]);

/** Resolver helpers legitimately contain the raw prefixes. */
const RESOLVER_FILES = new Set([
  'client/src/utils/assetUrl.ts',
  'src/asset-url.ts',
]);

/**
 * A literal passed straight into a canonical resolver is already versioned, so
 * it is not a raw reference. Keeps `assetUrl('/css/main.css')` legal in
 * migrated files.
 *
 * Anchored to the exact helper identifiers in use (`assetUrl` in both
 * `client/src/utils/assetUrl.ts` and `src/asset-url.ts`). A looser
 * `\w*[aA]ssetUrl` prefix match would also exempt a passthrough wrapper such
 * as `legacyAssetUrl(p)`, which can emit raw URLs.
 */
const RESOLVER_CALL_RE = /\bassetUrl\s*\(\s*$/;

/**
 * Matches a quoted path beginning with an asset prefix. The trailing boundary
 * check keeps normal paths like `/image.png` from matching `/img`.
 */
const ASSET_LITERAL_RE = /(['"`])(\/(?:img|js|css|icons)(?:\/[^'"`\s]*)?)/g;

function isSkippedFile(relativePath) {
  if (relativePath.includes('/__tests__/')) {
    return true;
  }
  if (/\.test\.tsx?$/.test(relativePath)) {
    return true;
  }
  if (relativePath.startsWith('src/generated/')) {
    return true;
  }
  return false;
}

function findRawAssetLiterals(line) {
  const literals = [];
  const seen = new Set();
  ASSET_LITERAL_RE.lastIndex = 0;
  let match;
  while ((match = ASSET_LITERAL_RE.exec(line)) !== null) {
    const literal = match[2];
    const nextChar = line[ASSET_LITERAL_RE.lastIndex] ?? '';
    if (/[A-Za-z0-9_-]/.test(nextChar)) {
      continue;
    }
    if (GENERATED_ARTIFACT_LITERALS.has(literal)) {
      continue;
    }
    if (RESOLVER_CALL_RE.test(line.slice(0, match.index))) {
      continue;
    }
    if (!seen.has(literal)) {
      seen.add(literal);
      literals.push(literal);
    }
  }
  return literals;
}

/**
 * Marks lines that sit inside a `stylesheets`/`scripts` array. Those paths are
 * resolved centrally by renderLayout, so they are intentionally raw.
 */
function findLayoutConfigLines(lines) {
  const exempt = new Set();
  let depth = 0;

  lines.forEach((line, index) => {
    if (depth === 0) {
      const start = line.match(/\b(?:stylesheets|scripts)\s*:\s*\[/);
      if (!start) {
        return;
      }
      for (const char of line.slice(start.index)) {
        if (char === '[') depth += 1;
        if (char === ']') depth -= 1;
      }
      exempt.add(index);
      return;
    }

    for (const char of line) {
      if (char === '[') depth += 1;
      if (char === ']') depth -= 1;
    }
    exempt.add(index);
  });

  return exempt;
}

function collectViolations() {
  const violations = [];

  for (const scanDir of SCAN_DIRS) {
    const absDir = path.join(ROOT, scanDir);
    const files = listFilesRecursive(absDir).filter((absPath) =>
      FILE_EXTENSIONS.some((extension) => absPath.endsWith(extension))
    );

    for (const absPath of files) {
      const relativePath = toPosix(path.relative(ROOT, absPath));
      if (isSkippedFile(relativePath) || RESOLVER_FILES.has(relativePath)) {
        continue;
      }

      const lines = fs.readFileSync(absPath, 'utf8').split(/\r?\n/);
      const configLines = scanDir === 'src' ? findLayoutConfigLines(lines) : new Set();

      lines.forEach((line, index) => {
        const literals = findRawAssetLiterals(line);
        if (literals.length === 0 || configLines.has(index)) {
          return;
        }
        const resolverHint =
          scanDir === 'client/src'
            ? 'use the client asset resolver (client/src/utils/assetUrl.ts, task 3.1)'
            : 'use the server asset resolver (src/asset-url.ts, task 2.1) or pass the path through renderLayout config';
        for (const literal of literals) {
          violations.push(
            `${relativePath}:${index + 1}: raw asset URL ${JSON.stringify(literal)} - ${resolverHint}`
          );
        }
      });
    }
  }

  return violations;
}

function main() {
  const violations = collectViolations();
  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(`❌ ${violation}`);
    }
    console.error(`\n❌ ${violations.length} raw asset reference(s) found. See docs/asset-workflow.md.`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ No raw asset references outside the approved resolvers.`);
}

if (require.main === module) {
  main();
}
