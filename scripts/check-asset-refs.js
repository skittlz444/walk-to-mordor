#!/usr/bin/env node
'use strict';

/**
 * Reject raw public-asset URLs outside the approved resolvers.
 *
 * Scans client source and server source for `/img/`, `/js/`, `/css/`, and
 * `/icons/` string literals. Generated files, resolver helpers, tests, and
 * layout configuration arrays (`stylesheets`/`scripts` passed to renderLayout)
 * are exempt, as are literals passed directly to a resolver (`assetUrl('/...')`).
 * Current pre-migration call sites are listed explicitly below and disappear as
 * task groups 2 and 3 migrate them.
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
]);

/** Resolver helpers legitimately contain the raw prefixes. */
const RESOLVER_FILES = new Set([
  'client/src/utils/assetUrl.ts',
  'src/asset-url.ts',
]);

/**
 * Migration debt: every existing raw URL site. File-scoped so a NEW raw URL in
 * any other file fails. Delete entries as the owning task migrates the file.
 */
const MIGRATION_ALLOWLIST = new Map([
  // Client image construction -> task 3.3 (and tests in 3.5).
  ['client/src/components/Avatar.tsx', 'task 3.3'],
  ['client/src/components/AvatarPickerModal.tsx', 'task 3.3'],
  ['client/src/components/admin/ImageBrowserModal.tsx', 'task 3.3'],
  ['client/src/components/map/ClusterListPopup.tsx', 'task 3.3'],
  ['client/src/components/map/ClusterListSheet.tsx', 'task 3.3'],
  ['client/src/components/map/FellowshipMarkers.ts', 'task 3.3'],
  ['client/src/components/map/FriendMarkers.ts', 'task 3.3'],
  ['client/src/components/map/FriendMiniCard.tsx', 'task 3.3'],
  ['client/src/components/map/UserMarker.ts', 'task 3.3'],
  ['client/src/components/map/WaypointPopup.tsx', 'task 3.3'],
  ['client/src/components/map/WaypointSheet.tsx', 'task 3.3'],
  ['client/src/islands/AdminGoalEditIsland.tsx', 'task 3.3'],
  ['client/src/islands/BadgeAwardModal.tsx', 'task 3.3'],
  ['client/src/islands/BadgeDisplayIsland.tsx', 'task 3.3'],
  ['client/src/islands/EncounterPopupIsland.tsx', 'task 3.3'],
  ['client/src/islands/EventsIsland.tsx', 'task 3.3'],
  ['client/src/islands/GoalModal.tsx', 'task 3.3'],
  ['client/src/islands/MapIsland.tsx', 'task 3.3 / 3.4'],
  ['client/src/islands/WrappedIsland.tsx', 'task 3.3'],
]);

/**
 * A literal passed straight into a resolver is already versioned, so it is not
 * a raw reference. Keeps `assetUrl('/css/main.css')` legal in migrated files.
 */
const RESOLVER_CALL_RE = /\b\w*[aA]ssetUrl\s*\(\s*$/;

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

      const migrationTask = MIGRATION_ALLOWLIST.get(relativePath);
      const lines = fs.readFileSync(absPath, 'utf8').split(/\r?\n/);
      const configLines = scanDir === 'src' ? findLayoutConfigLines(lines) : new Set();

      lines.forEach((line, index) => {
        const literals = findRawAssetLiterals(line);
        if (literals.length === 0 || migrationTask || configLines.has(index)) {
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
  console.log(`✓ No raw asset references outside the approved resolvers and migration allowlist.`);
}

if (require.main === module) {
  main();
}
