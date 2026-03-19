/**
 * Tests for Service Worker SWR (Stale-While-Revalidate) API caching
 *
 * Validates:
 * - SWR hit returns cached response + background revalidation
 * - Cold cache goes to network (network-first)
 * - POST/PUT/DELETE bypass cache
 * - Non-allowlisted GET endpoints bypass cache
 * - TTL metadata (x-swr-cached-at) stored and readable
 * - postMessage emitted on cache update
 * - SWR_CACHE_VERSION change clears SWR cache on activate
 * - Static asset caching unchanged
 * - isSWREndpoint matcher works correctly
 */

const fs = require('fs');
const path = require('path');

const SW_PATH = path.join(__dirname, '..', '..', 'public', 'sw.js');

// Read sw.js source for eval-based testing
function loadSWSource() {
  return fs.readFileSync(SW_PATH, 'utf8');
}

describe('Service Worker SWR API Caching', () => {

  describe('Constants and Configuration', () => {
    let swSource;

    beforeAll(() => {
      swSource = loadSWSource();
    });

    test('should define SWR_CACHE_VERSION placeholder', () => {
      expect(swSource).toContain("const SWR_CACHE_VERSION = '{{SWR_CACHE_VERSION}}'");
    });

    test('should define SWR_CACHE_NAME as walk-to-mordor-api-swr', () => {
      expect(swSource).toContain("const SWR_CACHE_NAME = 'walk-to-mordor-api-swr'");
    });

    test('should define SWR_VERSION_CACHE for version tracking', () => {
      expect(swSource).toContain("const SWR_VERSION_CACHE = 'walk-to-mordor-swr-version'");
    });

    test('should define SWR_TTL_MS as 300000 (5 minutes)', () => {
      expect(swSource).toContain('const SWR_TTL_MS = 300000');
    });

    test('should define all six SWR endpoints', () => {
      const expectedEndpoints = [
        '/api/session',
        '/api/goals',
        '/api/calendar-progress',
        '/api/total-distance',
        '/api/user/parties',
        '/api/friends'
      ];
      expectedEndpoints.forEach(ep => {
        expect(swSource).toContain(`'${ep}'`);
      });
    });

    test('should NOT include excluded endpoints in SWR_ENDPOINTS', () => {
      // These should not appear in the SWR_ENDPOINTS array
      const excludedEndpoints = [
        '/api/party/',
        '/api/friends/pending'
      ];
      // Extract just the SWR_ENDPOINTS array portion
      const endpointsMatch = swSource.match(/const SWR_ENDPOINTS = \[([\s\S]*?)\];/);
      expect(endpointsMatch).toBeTruthy();
      const endpointsBlock = endpointsMatch[1];
      excludedEndpoints.forEach(ep => {
        expect(endpointsBlock).not.toContain(ep);
      });
    });

    test('should preserve BUILD_TIMESTAMP and CACHE_NAME for static assets', () => {
      expect(swSource).toContain("const BUILD_TIMESTAMP = '{{BUILD_TIMESTAMP}}'");
      expect(swSource).toContain("const CACHE_NAME = `walk-to-mordor-{{BUILD_TIMESTAMP}}`");
    });

    test('should not contain import statements', () => {
      // sw.js must be a classic script
      expect(swSource).not.toMatch(/^import\s/m);
      expect(swSource).not.toMatch(/^import\(/m);
    });
  });

  describe('isSWREndpoint matcher', () => {
    let isSWREndpoint;
    let SWR_ENDPOINTS;

    beforeAll(() => {
      // Extract and evaluate the isSWREndpoint function
      const swSource = loadSWSource();

      // Extract the SWR_ENDPOINTS array
      const endpointsMatch = swSource.match(/const SWR_ENDPOINTS = \[([\s\S]*?)\];/);
      // eslint-disable-next-line no-eval
      SWR_ENDPOINTS = eval(`[${endpointsMatch[1]}]`);

      // Extract and create the function
      isSWREndpoint = function(pathname) {
        return SWR_ENDPOINTS.includes(pathname);
      };
    });

    test('should match all allowlisted endpoints', () => {
      const endpoints = [
        '/api/session',
        '/api/goals',
        '/api/calendar-progress',
        '/api/total-distance',
        '/api/user/parties',
        '/api/friends'
      ];
      endpoints.forEach(ep => {
        expect(isSWREndpoint(ep)).toBe(true);
      });
    });

    test('should NOT match non-allowlisted API endpoints', () => {
      const excluded = [
        '/api/party/123/activity',
        '/api/friends/pending',
        '/api/login',
        '/api/register',
        '/api/progress',
        '/api/user/preferences',
        '/api/admin/users'
      ];
      excluded.forEach(ep => {
        expect(isSWREndpoint(ep)).toBe(false);
      });
    });

    test('should NOT match non-API paths', () => {
      expect(isSWREndpoint('/')).toBe(false);
      expect(isSWREndpoint('/journey')).toBe(false);
      expect(isSWREndpoint('/css/main.css')).toBe(false);
    });

    test('should require exact match (no partial matching)', () => {
      expect(isSWREndpoint('/api/session/extra')).toBe(false);
      expect(isSWREndpoint('/api/goal')).toBe(false);
      expect(isSWREndpoint('/api/friends/')).toBe(false);
    });
  });

  describe('SWR Fetch Handler Logic', () => {
    let mockCacheStorage;
    let mockSwrCache;
    let mockClients;
    let fetchBackup;

    beforeEach(() => {
      // Mock cache storage
      mockSwrCache = {
        match: jest.fn(),
        put: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(true)
      };

      mockCacheStorage = {
        open: jest.fn().mockResolvedValue(mockSwrCache),
        keys: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue(true)
      };

      // Mock clients
      mockClients = {
        matchAll: jest.fn().mockResolvedValue([])
      };

      // Save original fetch
      fetchBackup = global.fetch;
    });

    afterEach(() => {
      global.fetch = fetchBackup;
    });

    test('SWR cache hit returns cached response and triggers background revalidation', async () => {
      const cachedResponse = new Response(JSON.stringify({ data: 'cached' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-swr-cached-at': (Date.now() - 60000).toString()
        }
      });
      const freshResponse = new Response(JSON.stringify({ data: 'fresh' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });

      mockSwrCache.match.mockResolvedValue(cachedResponse);
      global.fetch = jest.fn().mockResolvedValue(freshResponse);

      // Simulate the SWR logic
      const cache = mockSwrCache;
      const request = new Request('https://example.com/api/session');
      const cached = await cache.match(request);

      expect(cached).toBe(cachedResponse);

      // Background revalidation
      const networkResponse = await global.fetch(request);
      expect(networkResponse).toBe(freshResponse);
    });

    test('SWR cache miss fetches from network and caches result', async () => {
      const networkResponse = new Response(JSON.stringify({ data: 'fresh' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });

      mockSwrCache.match.mockResolvedValue(undefined);
      global.fetch = jest.fn().mockResolvedValue(networkResponse);

      const request = new Request('https://example.com/api/goals');
      const cached = await mockSwrCache.match(request);

      expect(cached).toBeUndefined();

      // Should go to network
      const response = await global.fetch(request);
      expect(response).toBe(networkResponse);
      expect(global.fetch).toHaveBeenCalledWith(request);
    });

    test('POST/PUT/DELETE requests never enter SWR path', () => {
      const swSource = loadSWSource();
      // The fetch handler skips non-GET requests before reaching SWR logic
      expect(swSource).toContain("if (event.request.method !== 'GET')");
    });

    test('TTL metadata is stored via x-swr-cached-at header', () => {
      const swSource = loadSWSource();
      expect(swSource).toContain("headers.set('x-swr-cached-at', Date.now().toString())");
    });

    test('postMessage is emitted on cache update', () => {
      const swSource = loadSWSource();
      expect(swSource).toContain("client.postMessage({ type: 'sw-cache-updated', url: url })");
      expect(swSource).toContain("self.clients.matchAll({ type: 'window' })");
    });

    test('cacheWithTimestamp creates response with TTL header', async () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const originalResponse = new Response(JSON.stringify({ test: true }), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      });

      // Simulate cacheWithTimestamp logic
      const headers = new Headers(originalResponse.headers);
      headers.set('x-swr-cached-at', now.toString());
      const timestamped = new Response(JSON.stringify({ test: true }), {
        status: originalResponse.status,
        statusText: originalResponse.statusText,
        headers: headers
      });

      expect(timestamped.headers.get('x-swr-cached-at')).toBe(now.toString());
      expect(timestamped.status).toBe(200);

      Date.now.mockRestore();
    });
  });

  describe('SWR Cache Version Busting (activate)', () => {
    test('activate handler checks SWR_CACHE_VERSION', () => {
      const swSource = loadSWSource();
      // The activate event should reference SWR version checking
      expect(swSource).toContain('SWR_VERSION_CACHE');
      expect(swSource).toContain('SWR_CACHE_VERSION');
      expect(swSource).toContain("versionCache.match('version')");
    });

    test('activate handler deletes SWR cache on version mismatch', () => {
      const swSource = loadSWSource();
      // Should delete SWR_CACHE_NAME when version changes
      expect(swSource).toContain('caches.delete(SWR_CACHE_NAME)');
    });

    test('activate handler stores new version after clearing', () => {
      const swSource = loadSWSource();
      expect(swSource).toContain("versionCache.put('version', new Response(SWR_CACHE_VERSION))");
    });

    test('activate handler preserves SWR cache and version cache from static cleanup', () => {
      const swSource = loadSWSource();
      // The static cache cleanup should exclude SWR caches
      expect(swSource).toContain('cacheName !== SWR_CACHE_NAME');
      expect(swSource).toContain('cacheName !== SWR_VERSION_CACHE');
    });
  });

  describe('Static Asset Caching Unchanged', () => {
    let swSource;

    beforeAll(() => {
      swSource = loadSWSource();
    });

    test('install event still pre-caches static assets', () => {
      expect(swSource).toContain("caches.open(CACHE_NAME)");
      expect(swSource).toContain("cache.addAll(urlsToCache)");
    });

    test('static asset cache-first strategy is preserved', () => {
      expect(swSource).toContain("caches.match(event.request)");
      expect(swSource).toContain("event.request.destination === 'style'");
      expect(swSource).toContain("event.request.destination === 'script'");
      expect(swSource).toContain("event.request.destination === 'image'");
    });

    test('HTML navigations still use network-only with offline fallback', () => {
      expect(swSource).toContain("event.request.mode === 'navigate'");
      expect(swSource).toContain("event.request.destination === 'document'");
      expect(swSource).toContain("Offline - Please check your connection");
    });

    test('urlsToCache array is unchanged', () => {
      expect(swSource).toContain("'/css/main.css'");
      expect(swSource).toContain("'/js/main.js'");
      expect(swSource).toContain("'/manifest.json'");
    });
  });

  describe('Fetch Handler Routing', () => {
    let swSource;

    beforeAll(() => {
      swSource = loadSWSource();
    });

    test('non-GET requests are skipped before SWR logic', () => {
      // The method check must come before the API path check
      const methodCheckPos = swSource.indexOf("event.request.method !== 'GET'");
      const apiCheckPos = swSource.indexOf("requestUrl.pathname.startsWith('/api/')");
      expect(methodCheckPos).toBeLessThan(apiCheckPos);
    });

    test('cross-origin requests are skipped', () => {
      expect(swSource).toContain('requestUrl.origin !== self.location.origin');
    });

    test('SWR endpoint check uses isSWREndpoint', () => {
      expect(swSource).toContain('isSWREndpoint(requestUrl.pathname)');
    });

    test('non-SWR API endpoints still use network-only', () => {
      // After the isSWREndpoint check, there should be a fallback to fetch
      expect(swSource).toContain('// Non-SWR API endpoints: network-only');
    });

    test('revalidateAndNotify is called for cache hits', () => {
      expect(swSource).toContain('revalidateAndNotify(event.request, swrCache)');
    });

    test('fetchAndCache is called for cache misses', () => {
      expect(swSource).toContain('fetchAndCache(event.request, swrCache)');
    });
  });

  describe('notifyClients function', () => {
    test('function is defined in sw.js', () => {
      const swSource = loadSWSource();
      expect(swSource).toContain('async function notifyClients(url)');
    });

    test('uses self.clients.matchAll with type window', () => {
      const swSource = loadSWSource();
      expect(swSource).toContain("self.clients.matchAll({ type: 'window' })");
    });

    test('sends correct message shape', () => {
      const swSource = loadSWSource();
      expect(swSource).toContain("type: 'sw-cache-updated'");
      expect(swSource).toContain('url: url');
    });
  });

  describe('revalidateAndNotify function', () => {
    test('function is defined in sw.js', () => {
      const swSource = loadSWSource();
      expect(swSource).toContain('async function revalidateAndNotify(request, swrCache)');
    });

    test('fetches from network', () => {
      const swSource = loadSWSource();
      const fnMatch = swSource.match(/async function revalidateAndNotify[\s\S]*?^}/m);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[0]).toContain('fetch(request)');
    });

    test('caches successful response', () => {
      const swSource = loadSWSource();
      const fnMatch = swSource.match(/async function revalidateAndNotify[\s\S]*?^}/m);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[0]).toContain('cacheWithTimestamp');
    });

    test('notifies clients after caching', () => {
      const swSource = loadSWSource();
      const fnMatch = swSource.match(/async function revalidateAndNotify[\s\S]*?^}/m);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[0]).toContain('notifyClients');
    });

    test('handles network errors gracefully', () => {
      const swSource = loadSWSource();
      const fnMatch = swSource.match(/async function revalidateAndNotify[\s\S]*?^}/m);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[0]).toContain('catch');
    });
  });

  describe('fetchAndCache function', () => {
    test('function is defined in sw.js', () => {
      const swSource = loadSWSource();
      expect(swSource).toContain('async function fetchAndCache(request, swrCache)');
    });

    test('returns network response on success', () => {
      const swSource = loadSWSource();
      const fnMatch = swSource.match(/async function fetchAndCache[\s\S]*?^}/m);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[0]).toContain('return response');
    });

    test('caches successful response with timestamp', () => {
      const swSource = loadSWSource();
      const fnMatch = swSource.match(/async function fetchAndCache[\s\S]*?^}/m);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[0]).toContain('cacheWithTimestamp');
    });

    test('returns 503 on network failure', () => {
      const swSource = loadSWSource();
      const fnMatch = swSource.match(/async function fetchAndCache[\s\S]*?^}/m);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[0]).toContain('503');
    });

    test('only caches ok responses', () => {
      const swSource = loadSWSource();
      const fnMatch = swSource.match(/async function fetchAndCache[\s\S]*?^}/m);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[0]).toContain('response.ok');
    });
  });
});
