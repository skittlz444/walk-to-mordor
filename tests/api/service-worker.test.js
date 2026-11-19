/**
 * Tests for the generated service worker contract.
 *
 * The SW is generated from `scripts/templates/sw.js` by `scripts/generate-sw.js`.
 * These tests pin the parts of that contract that keep deploys deterministic and
 * offline-safe:
 * - the exact precache list (no missing mobiscroll entries, no extras)
 * - every precache URL is versioned and resolves to a real file under `public/`
 *   (client build outputs may be absent on a fresh checkout: then the version must
 *   match the committed, drift-checked asset map instead)
 * - CACHE_NAME / SWR_CACHE_VERSION are filled (no `{{...}}` placeholders)
 * - the two runtime JSON maps are network-first, carved out before cache-first
 * - superseded image cache entries are pruned against the current image map
 * - activate caches the image map it prunes against, and stays offline-safe
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SW_PATH = path.join(ROOT, 'public', 'sw.js');
const TEMPLATE_PATH = path.join(ROOT, 'scripts', 'templates', 'sw.js');
const ASSET_VERSIONS_PATH = path.join(ROOT, 'src', 'generated', 'asset-versions.ts');
const PUBLIC_DIR = path.join(ROOT, 'public');
const CLIENT_PRECACHE_DIR = '/js/client/';

const EXPECTED_PRECACHE = [
  '/css/main.css',
  '/js/main.js',
  '/js/client/islands.js',
  '/js/client/islands.css',
  '/manifest.json',
];

const EXPECTED_CLIENT_PRECACHE = EXPECTED_PRECACHE.filter((pathname) =>
  pathname.startsWith(CLIENT_PRECACHE_DIR)
);

function readGeneratedSW() {
  return fs.readFileSync(SW_PATH, 'utf8');
}

function readTemplate() {
  return fs.readFileSync(TEMPLATE_PATH, 'utf8');
}

function extractPrecacheUrls(source) {
  const match = source.match(/const urlsToCache = \[([\s\S]*?)\];/);
  if (!match) {
    throw new Error('public/sw.js has no urlsToCache array');
  }
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

function splitVersionedUrl(url) {
  const [pathname, query] = url.split('?');
  const params = new URLSearchParams(query || '');
  return { pathname, version: params.get('v') };
}

/** Same version format the generators use: 12 lowercase hex chars of SHA-256. */
function contentHash(absPath) {
  return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex').slice(0, 12);
}

/**
 * Reads the committed entry-asset map. Parsed as text rather than imported so the
 * plain-JS legacy runner (no TypeScript transform) can run this suite too.
 */
function readCommittedAssetVersions() {
  const source = fs.readFileSync(ASSET_VERSIONS_PATH, 'utf8');
  const versions = {};
  for (const match of source.matchAll(/^\s*"([^"]+)":\s*"([0-9a-f]{12})",$/gm)) {
    versions[match[1]] = match[2];
  }
  return versions;
}

/**
 * Loads the generated SW into a controlled scope with a Cache Storage mock.
 * Mirrors the harness in sw-swr.test.js so the same file is exercised.
 */
function loadServiceWorker() {
  const source = readGeneratedSW();
  const store = new Map();

  const cache = {
    match: jest.fn(async (request) => {
      const key = typeof request === 'string' ? request : request.url;
      return store.get(key);
    }),
    put: jest.fn(async (request, response) => {
      const key = typeof request === 'string' ? request : request.url;
      store.set(key, response);
    }),
    delete: jest.fn(async (request) => {
      const key = typeof request === 'string' ? request : request.url;
      return store.delete(key);
    }),
    keys: jest.fn(async () =>
      Array.from(store.keys()).map((key) => new Request(new URL(key, 'https://example.com')))
    ),
    addAll: jest.fn(async () => {}),
  };

  const caches = {
    open: jest.fn(async () => cache),
    match: jest.fn(async (request) => cache.match(request)),
    keys: jest.fn(async () => ['walk-to-mordor-test']),
    delete: jest.fn(async () => true),
  };

  const globalFetch = jest.fn();
  const listeners = {};
  const self = {
    location: { origin: 'https://example.com' },
    addEventListener: jest.fn((type, handler) => {
      listeners[type] = handler;
    }),
    clients: { matchAll: jest.fn(async () => []) },
  };

  const factory = new Function(
    'self',
    'caches',
    'fetch',
    'Response',
    'Headers',
    'URL',
    'Date',
    'Request',
    `${source}\n; return { CACHE_NAME, SWR_CACHE_VERSION, buildReferencedImageUrls, pruneSupersededImages, refreshRuntimeMap };`
  );

  const exports = factory(self, caches, globalFetch, Response, Headers, URL, Date, Request);

  return { store, cache, caches, globalFetch, listeners, ...exports };
}

describe('Generated service worker contract', () => {
  test('precache list is exactly the five shell assets', () => {
    const urls = extractPrecacheUrls(readGeneratedSW());
    expect(urls.map((url) => splitVersionedUrl(url).pathname)).toEqual(EXPECTED_PRECACHE);
  });

  test('every precache URL is versioned and resolves to a file under public/', () => {
    const urls = extractPrecacheUrls(readGeneratedSW());
    expect(urls).toHaveLength(EXPECTED_PRECACHE.length);

    const entries = urls.map(splitVersionedUrl);

    // Client chunks are gitignored build output: absent on a fresh checkout, present
    // after `npm run build:client`. No other client path may ever be precached.
    const clientPaths = entries
      .map(({ pathname }) => pathname)
      .filter((pathname) => pathname.startsWith(CLIENT_PRECACHE_DIR))
      .sort();
    expect(clientPaths).toEqual([...EXPECTED_CLIENT_PRECACHE].sort());

    const committedVersions = readCommittedAssetVersions();

    for (const { pathname, version } of entries) {
      expect(version).toMatch(/^[0-9a-f]{12}$/);

      if (pathname.startsWith(CLIENT_PRECACHE_DIR)) {
        const absPath = path.join(PUBLIC_DIR, pathname);
        if (fs.existsSync(absPath)) {
          // Built: the version must be the hash of the bytes actually shipped.
          expect(version).toBe(contentHash(absPath));
        } else {
          // Not built: fall back to the committed, drift-checked version map, which
          // `npm run check:assets:versions` re-verifies against a real build.
          expect(committedVersions[pathname]).toMatch(/^[0-9a-f]{12}$/);
          expect(version).toBe(committedVersions[pathname]);
        }
        continue;
      }

      expect(fs.existsSync(path.join(PUBLIC_DIR, pathname))).toBe(true);
    }
  });

  test('CACHE_NAME and SWR_CACHE_VERSION are filled and no placeholders remain', () => {
    const source = readGeneratedSW();

    expect(source).not.toContain('{{');
    expect(source).not.toMatch(/BUILD_TIMESTAMP/);
    expect(source).toMatch(/const CACHE_NAME = 'walk-to-mordor-[0-9a-f]{12}';/);
    expect(source).toMatch(/const SWR_CACHE_VERSION = '[0-9a-f]{12}';/);
  });

  test('both runtime JSON maps are network-first before cache-first static handling', () => {
    const source = readGeneratedSW();

    expect(source).toContain("const IMAGE_VERSIONS_PATH = '/img/image-versions.json';");
    expect(source).toContain("const TILE_METADATA_PATH = '/img/map/tiles/metadata.json';");

    // The carve-out sits inside the fetch handler and before the generic
    // cache-first `caches.match(event.request)` static path.
    const fetchHandlerStart = source.indexOf("self.addEventListener('fetch'");
    const runtimeBranch = source.indexOf('if (isRuntimeMapPath(requestUrl.pathname))');
    const cacheFirst = source.indexOf('caches.match(event.request)');

    expect(fetchHandlerStart).toBeGreaterThan(-1);
    expect(runtimeBranch).toBeGreaterThan(fetchHandlerStart);
    expect(cacheFirst).toBeGreaterThan(runtimeBranch);

    // Network is attempted before the cached fallback inside the handler.
    const handlerStart = source.indexOf('async function refreshRuntimeMap');
    const networkFetch = source.indexOf('await fetch(request)', handlerStart);
    const cachedFallback = source.indexOf('caches.match(request)', handlerStart);
    expect(handlerStart).toBeGreaterThan(-1);
    expect(networkFetch).toBeGreaterThan(handlerStart);
    expect(cachedFallback).toBeGreaterThan(networkFetch);
  });

  test('the template declares the runtime map paths for the generator', () => {
    const template = readTemplate();
    expect(template).toContain("'/img/image-versions.json'");
    expect(template).toContain("'/img/map/tiles/metadata.json'");
  });
});

describe('Superseded image pruning', () => {
  const ORIGIN = 'https://example.com';
  const IMAGE_MAP_URL = `${ORIGIN}/img/image-versions.json`;
  const TILE_URL = `${ORIGIN}/img/map/tiles/0/0/0.webp?v=tileversion`;

  test('keeps referenced versions and bare paths, deletes superseded images', async () => {
    const sw = loadServiceWorker();
    sw.store.set(`${ORIGIN}/img/highres/keep.webp?v=aaaa`, new Response('keep'));
    sw.store.set(`${ORIGIN}/img/highres/plain.webp`, new Response('plain'));
    sw.store.set(`${ORIGIN}/img/highres/drop.webp?v=old`, new Response('drop'));
    sw.store.set(TILE_URL, new Response('tile'));
    sw.store.set(IMAGE_MAP_URL, new Response('map'));
    sw.store.set('https://other.example/img/highres/drop.webp?v=old', new Response('other'));

    await sw.pruneSupersededImages({
      '/img/highres/keep.webp': 'aaaa',
      '/img/highres/plain.webp': 'bbbb',
    });

    expect(sw.store.has(`${ORIGIN}/img/highres/keep.webp?v=aaaa`)).toBe(true);
    expect(sw.store.has(`${ORIGIN}/img/highres/plain.webp`)).toBe(true);
    expect(sw.store.has(`${ORIGIN}/img/highres/drop.webp?v=old`)).toBe(false);
    expect(sw.store.has(TILE_URL)).toBe(true);
    expect(sw.store.has(IMAGE_MAP_URL)).toBe(true);
    expect(sw.store.has('https://other.example/img/highres/drop.webp?v=old')).toBe(true);
  });

  test('builds the referenced set from both the bare path and the versioned URL', () => {
    const sw = loadServiceWorker();
    expect(sw.buildReferencedImageUrls({ '/img/a.webp': 'aaaa' })).toEqual({
      '/img/a.webp': true,
      '/img/a.webp?v=aaaa': true,
    });
  });

  test('a successful map refresh caches the new map and prunes the old image', async () => {
    const sw = loadServiceWorker();
    sw.store.set(`${ORIGIN}/img/highres/drop.webp?v=old`, new Response('drop'));

    sw.globalFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ version: 'map', assets: { '/img/highres/keep.webp': 'aaaa' } }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const response = await sw.refreshRuntimeMap(new Request(IMAGE_MAP_URL));

    expect(response.status).toBe(200);
    expect(sw.cache.put).toHaveBeenCalledWith(expect.anything(), expect.anything());
    expect(sw.store.has(IMAGE_MAP_URL)).toBe(true);
    expect(sw.store.has(`${ORIGIN}/img/highres/drop.webp?v=old`)).toBe(false);
  });

  test('offline map refresh serves the cached map and skips pruning', async () => {
    const sw = loadServiceWorker();
    sw.store.set(IMAGE_MAP_URL, new Response('cached-map'));
    sw.store.set(`${ORIGIN}/img/highres/drop.webp?v=old`, new Response('drop'));
    sw.globalFetch.mockRejectedValueOnce(new Error('offline'));

    const response = await sw.refreshRuntimeMap(new Request(IMAGE_MAP_URL));

    expect(await response.text()).toBe('cached-map');
    expect(sw.store.has(`${ORIGIN}/img/highres/drop.webp?v=old`)).toBe(true);
  });

  test('activate caches the image map it prunes against', async () => {
    const sw = loadServiceWorker();
    sw.store.set(`${ORIGIN}/img/highres/drop.webp?v=old`, new Response('drop'));
    sw.globalFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ version: 'map', assets: { '/img/highres/keep.webp': 'aaaa' } }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    let pending;
    sw.listeners.activate({ waitUntil: (promise) => { pending = promise; } });
    await pending;

    expect(sw.cache.put).toHaveBeenCalledWith('/img/image-versions.json', expect.anything());
    expect(sw.store.has(`${ORIGIN}/img/highres/drop.webp?v=old`)).toBe(false);
  });

  test('offline activate neither caches the map nor throws', async () => {
    const sw = loadServiceWorker();
    sw.store.set(`${ORIGIN}/img/highres/drop.webp?v=old`, new Response('drop'));
    sw.globalFetch.mockRejectedValueOnce(new Error('offline'));

    let pending;
    sw.listeners.activate({ waitUntil: (promise) => { pending = promise; } });
    await pending;

    expect(sw.cache.put).not.toHaveBeenCalledWith('/img/image-versions.json', expect.anything());
    expect(sw.store.has(`${ORIGIN}/img/highres/drop.webp?v=old`)).toBe(true);
  });

  test('tile metadata is network-first but never triggers image pruning', async () => {
    const sw = loadServiceWorker();
    sw.store.set(`${ORIGIN}/img/highres/drop.webp?v=old`, new Response('drop'));

    sw.globalFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ levels: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const tileMetadataUrl = `${ORIGIN}/img/map/tiles/metadata.json`;
    const response = await sw.refreshRuntimeMap(new Request(tileMetadataUrl));

    expect(response.status).toBe(200);
    expect(sw.store.has(tileMetadataUrl)).toBe(true);
    expect(sw.store.has(`${ORIGIN}/img/highres/drop.webp?v=old`)).toBe(true);
  });
});
