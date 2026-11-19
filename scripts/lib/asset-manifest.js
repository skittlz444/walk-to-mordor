'use strict';

/**
 * Shared helpers for the deterministic asset-versioning tooling.
 *
 * Every generator and check in `scripts/` imports from here so hashing,
 * sorting, path handling, and missing-input behaviour stay identical.
 *
 * Version format: first 12 lowercase hex characters of SHA-256 over the bytes.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const HASH_LENGTH = 12;

/** Thrown when a generator cannot find an input it must not fabricate. */
class MissingInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MissingInputError';
  }
}

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** Deterministic asset version: first 12 lowercase hex chars of SHA-256. */
function contentHash(buffer) {
  return sha256Hex(buffer).slice(0, HASH_LENGTH);
}

function hashFile(absPath) {
  return contentHash(fs.readFileSync(absPath));
}

function hashString(value) {
  return contentHash(Buffer.from(value, 'utf8'));
}

/** Byte-wise comparison for URL paths and map keys. */
function byteWiseCompare(a, b) {
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

function sortObjectByteWise(input) {
  const output = {};
  const keys = Object.keys(input).sort(byteWiseCompare);
  for (const key of keys) {
    output[key] = input[key];
  }
  return output;
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function requireDirectory(absPath, label) {
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) {
    throw new MissingInputError(
      `Missing required input directory: ${label} (${absPath}). Run the build that produces it first.`
    );
  }
}

function requireFile(absPath, label) {
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
    throw new MissingInputError(
      `Missing required input file: ${label} (${absPath}). Run the build that produces it first.`
    );
  }
}

function requireJsonFile(absPath, label) {
  requireFile(absPath, label);
  try {
    return JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (error) {
    throw new MissingInputError(`Cannot parse ${label} (${absPath}): ${error.message}`);
  }
}

/** Recursively list regular files, sorted byte-wise by POSIX relative path. */
function listFilesRecursive(dirAbs) {
  const found = [];
  const visit = (current) => {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absPath);
      } else if (entry.isFile()) {
        found.push(absPath);
      }
    }
  };
  visit(dirAbs);
  return found.sort((a, b) => byteWiseCompare(toPosix(a), toPosix(b)));
}

function urlPathFor(absPath) {
  return `/${toPosix(path.relative(PUBLIC_DIR, absPath))}`;
}

function publicPathFor(relativePublicPath) {
  return path.join(PUBLIC_DIR, relativePublicPath);
}

/**
 * Files exposed to the server-rendered layout: CSS, icons, legacy JS, the
 * guided client entry (`islands.js`/`islands.css`), and the web manifest.
 *
 * Client chunks under `public/js/client/` are excluded: they have content-hash
 * filenames and are imported from inside the bundle, not from HTML.
 */
function buildEntryAssetMap() {
  const requiredFiles = [
    ['css/main.css', '/css/main.css'],
    ['js/main.js', '/js/main.js'],
    ['js/client/islands.js', '/js/client/islands.js'],
    ['js/client/islands.css', '/js/client/islands.css'],
    ['manifest.json', '/manifest.json'],
  ];

  requireDirectory(publicPathFor('css'), 'public/css');
  requireDirectory(publicPathFor('icons'), 'public/icons');
  requireDirectory(publicPathFor('js'), 'public/js');
  for (const [relativePath, label] of requiredFiles) {
    requireFile(publicPathFor(relativePath), label);
  }

  const assets = {};

  for (const directory of ['css', 'icons']) {
    for (const absPath of listFilesRecursive(publicPathFor(directory))) {
      assets[urlPathFor(absPath)] = hashFile(absPath);
    }
  }

  const bundleFiles = new Set(['islands.js', 'islands.css']);
  for (const absPath of listFilesRecursive(publicPathFor('js'))) {
    const relative = toPosix(path.relative(publicPathFor('js'), absPath));
    if (relative.startsWith('client/')) {
      if (!bundleFiles.has(relative.slice('client/'.length))) {
        continue;
      }
    }
    assets[urlPathFor(absPath)] = hashFile(absPath);
  }

  const manifestPath = publicPathFor('manifest.json');
  assets[urlPathFor(manifestPath)] = hashFile(manifestPath);

  return sortObjectByteWise(assets);
}

/**
 * Per-image runtime map. Excludes map tiles (one tile-set version instead),
 * the generated image map itself, and the generated image manifest.
 */
function buildImageAssetMap() {
  const imageDir = publicPathFor('img');
  requireDirectory(imageDir, 'public/img');

  const excludedPrefixes = ['/img/map/tiles/'];
  const excludedFiles = new Set(['/img/image-versions.json', '/img/image-manifest.json']);

  const assets = {};
  for (const absPath of listFilesRecursive(imageDir)) {
    const urlPath = urlPathFor(absPath);
    if (excludedFiles.has(urlPath)) {
      continue;
    }
    if (excludedPrefixes.some((prefix) => urlPath.startsWith(prefix))) {
      continue;
    }
    assets[urlPath] = hashFile(absPath);
  }
  return sortObjectByteWise(assets);
}

/** Stable identity for the image-map content (independent of JSON formatting). */
function computeMapVersion(assets) {
  const lines = Object.keys(assets)
    .sort(byteWiseCompare)
    .map((key) => `${key}\0${assets[key]}\n`);
  return hashString(lines.join(''));
}

function buildImageVersionsFile(assets) {
  const sortedAssets = sortObjectByteWise(assets);
  return {
    version: computeMapVersion(sortedAssets),
    assets: sortedAssets,
  };
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort(byteWiseCompare);
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * One version for the whole map-tile set: metadata (minus its own `version`
 * field) plus every tile byte. `scripts/tile-map-image.js` will write this
 * value once task 3.4 lands; until then the asset-version check only verifies it.
 */
function computeTileSetVersion(tileDir) {
  const metadataPath = path.join(tileDir, 'metadata.json');
  const metadata = requireJsonFile(metadataPath, 'public/img/map/tiles/metadata.json');
  const metadataWithoutVersion = { ...metadata };
  delete metadataWithoutVersion.version;

  const parts = ['metadata\n', stableStringify(metadataWithoutVersion), '\nfiles\n'];
  for (const absPath of listFilesRecursive(tileDir)) {
    if (absPath === metadataPath) {
      continue;
    }
    parts.push(`${toPosix(path.relative(tileDir, absPath))}\0${hashFile(absPath)}\n`);
  }
  return hashString(parts.join(''));
}

module.exports = {
  MissingInputError,
  PUBLIC_DIR,
  ROOT,
  buildEntryAssetMap,
  buildImageAssetMap,
  buildImageVersionsFile,
  byteWiseCompare,
  computeTileSetVersion,
  formatJson,
  hashString,
  listFilesRecursive,
  requireDirectory,
  requireFile,
  requireJsonFile,
  toPosix,
};
