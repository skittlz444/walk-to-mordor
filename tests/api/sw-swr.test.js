/**
 * Tests for Service Worker SWR (Stale-While-Revalidate) API Caching
 *
 * Story 8.3 - Validates the SWR caching logic in public/sw.js:
 * - SWR endpoint allowlist matching
 * - Cache-with-timestamp for TTL metadata (x-swr-cached-at)
 * - Client notification via postMessage
 * - Background revalidation (revalidateAndNotify)
 * - Cold cache fetch-and-cache
 * - Fetch event routing (SWR hit/miss, non-SWR, write methods, static assets)
 * - Activate event SWR cache version busting
 *
 * Uses Node vm module to load sw.js in a mock ServiceWorker environment
 * so that actual function behaviour is tested, not just source strings.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const SW_PATH = path.join(__dirname, '..', '..', 'public', 'sw.js');
const SW_SOURCE = fs.readFileSync(SW_PATH, 'utf8');
const ORIGIN = 'https://example.com';

/**
 * Creates a mock ServiceWorker environment, loads sw.js via vm, and returns
 * references to the sandbox functions, mocks, and captured event listeners.
 */
function createSWEnvironment() {
  var eventListeners = {};
  var mockClient = { postMessage: jest.fn() };

  var selfObj = {
    addEventListener: function(type, handler) {
      if (!eventListeners[type]) eventListeners[type] = [];
      eventListeners[type].push(handler);
    },
    clients: {
      matchAll: jest.fn().mockResolvedValue([mockClient]),
    },
    location: { origin: ORIGIN },
  };

  var defaultCache = {
    match: jest.fn().mockResolvedValue(undefined),
    put: jest.fn().mockResolvedValue(undefined),
    addAll: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(true),
  };

  var mockCaches = {
    open: jest.fn().mockResolvedValue(defaultCache),
    keys: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(true),
    match: jest.fn().mockResolvedValue(undefined),
  };

  var mockFetch = jest.fn();

  var sandbox = {
    self: selfObj,
    caches: mockCaches,
    fetch: mockFetch,
    Response: globalThis.Response,
    Headers: globalThis.Headers,
    Request: globalThis.Request,
    URL: globalThis.URL,
    console: globalThis.console,
  };

  vm.createContext(sandbox);
  vm.runInContext(SW_SOURCE, sandbox);

  return {
    sandbox: sandbox,
    self: selfObj,
    mockCaches: mockCaches,
    defaultCache: defaultCache,
    mockFetch: mockFetch,
    mockClient: mockClient,
    eventListeners: eventListeners,
  };
}

function createFetchEvent(urlPath, method) {
  method = method || 'GET';
  var url = urlPath.startsWith('http') ? urlPath : ORIGIN + urlPath;
  var request = new Request(url, { method: method });
  var event = {
    request: request,
    _responsePromise: null,
    _waitUntilPromises: [],
    respondWith: function(p) { event._responsePromise = p; },
    waitUntil: function(p) { event._waitUntilPromises.push(p); },
  };
  return event;
}

function createLifecycleEvent() {
  var event = {
    _waitUntilPromises: [],
    waitUntil: function(p) { event._waitUntilPromises.push(p); },
  };
  return event;
}

describe('Service Worker SWR API Caching', function() {

  describe('SWR Constants (source verification)', function() {
    test('defines SWR_CACHE_NAME as a separate cache from static CACHE_NAME', function() {
      expect(SW_SOURCE).toContain("const SWR_CACHE_NAME = 'walk-to-mordor-api-swr'");
      expect(SW_SOURCE).not.toMatch(/SWR_CACHE_NAME.*BUILD_TIMESTAMP/);
    });

    test('defines SWR_TTL_MS as 300000 (5 minutes)', function() {
      expect(SW_SOURCE).toContain('const SWR_TTL_MS = 300000');
    });

    test('defines SWR_ENDPOINTS allowlist with all required endpoints', function() {
      ['/api/session', '/api/goals', '/api/calendar-progress',
       '/api/total-distance', '/api/user/parties', '/api/friends'].forEach(function(ep) {
        expect(SW_SOURCE).toContain("'" + ep + "'");
      });
    });

    test('does NOT include excluded endpoints in the SWR allowlist', function() {
      var match = SW_SOURCE.match(/const SWR_ENDPOINTS\s*=\s*\[([\s\S]*?)\];/);
      expect(match).toBeTruthy();
      expect(match[1]).not.toContain('/api/party');
      expect(match[1]).not.toContain('/api/friends/pending');
    });

    test('SWR_CACHE_VERSION uses a placeholder pattern', function() {
      expect(SW_SOURCE).toContain("const SWR_CACHE_VERSION = '{{SWR_CACHE_VERSION}}'");
    });

    test('SWR_VERSION_CACHE is defined for version tracking', function() {
      expect(SW_SOURCE).toContain("const SWR_VERSION_CACHE = 'walk-to-mordor-swr-version'");
    });

    test('uses x-swr-cached-at header for TTL metadata', function() {
      expect(SW_SOURCE).toContain("'x-swr-cached-at'");
    });

    test('preserves BUILD_TIMESTAMP and CACHE_NAME for static assets', function() {
      expect(SW_SOURCE).toContain("const BUILD_TIMESTAMP = '{{BUILD_TIMESTAMP}}'");
    });

    test('sw.js is a classic script (no import statements)', function() {
      expect(SW_SOURCE).not.toMatch(/^import\s/m);
    });
  });

  describe('isSWREndpoint()', function() {
    var env;
    beforeEach(function() { env = createSWEnvironment(); });

    test.each([
      '/api/session', '/api/goals', '/api/calendar-progress',
      '/api/total-distance', '/api/user/parties', '/api/friends',
    ])('returns true for allowlisted endpoint %s', function(endpoint) {
      expect(env.sandbox.isSWREndpoint(endpoint)).toBe(true);
    });

    test.each([
      '/api/party/123/activity', '/api/friends/pending',
      '/api/unknown', '/api/user', '/api/', '/api/goals/1',
      '/api/session/extra', '/', '/journey', '/css/main.css',
    ])('returns false for non-allowlisted path %s', function(endpoint) {
      expect(env.sandbox.isSWREndpoint(endpoint)).toBe(false);
    });
  });

  describe('cacheWithTimestamp()', function() {
    var env;
    beforeEach(function() { env = createSWEnvironment(); });

    test('stores response in cache with x-swr-cached-at header', async function() {
      var cache = { put: jest.fn().mockResolvedValue(undefined) };
      var request = new Request(ORIGIN + '/api/session');
      var response = new Response('{"user":"test"}', {
        status: 200, statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      });
      await env.sandbox.cacheWithTimestamp(cache, request, response);
      expect(cache.put).toHaveBeenCalledTimes(1);
      var cachedAt = cache.put.mock.calls[0][1].headers.get('x-swr-cached-at');
      expect(cachedAt).toBeTruthy();
      expect(Number(cachedAt)).toBeGreaterThan(0);
    });

    test('preserves original response status and statusText', async function() {
      var cache = { put: jest.fn().mockResolvedValue(undefined) };
      var request = new Request(ORIGIN + '/api/goals');
      var response = new Response('[]', { status: 200, statusText: 'OK' });
      await env.sandbox.cacheWithTimestamp(cache, request, response);
      var putResp = cache.put.mock.calls[0][1];
      expect(putResp.status).toBe(200);
      expect(putResp.statusText).toBe('OK');
    });

    test('preserves original response headers alongside new timestamp', async function() {
      var cache = { put: jest.fn().mockResolvedValue(undefined) };
      var request = new Request(ORIGIN + '/api/session');
      var response = new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Custom': 'value' },
      });
      await env.sandbox.cacheWithTimestamp(cache, request, response);
      var putResp = cache.put.mock.calls[0][1];
      expect(putResp.headers.get('content-type')).toBe('application/json');
      expect(putResp.headers.get('x-custom')).toBe('value');
      expect(putResp.headers.get('x-swr-cached-at')).toBeTruthy();
    });
  });

  describe('notifyClients()', function() {
    var env;
    beforeEach(function() { env = createSWEnvironment(); });

    test('sends sw-cache-updated message with URL to all clients', async function() {
      var url = ORIGIN + '/api/session';
      await env.sandbox.notifyClients(url);
      expect(env.self.clients.matchAll).toHaveBeenCalledWith({ type: 'window' });
      expect(env.mockClient.postMessage).toHaveBeenCalledWith({
        type: 'sw-cache-updated', url: url,
      });
    });

    test('sends message to every connected client', async function() {
      var client1 = { postMessage: jest.fn() };
      var client2 = { postMessage: jest.fn() };
      env.self.clients.matchAll.mockResolvedValue([client1, client2]);
      await env.sandbox.notifyClients(ORIGIN + '/api/goals');
      expect(client1.postMessage).toHaveBeenCalledTimes(1);
      expect(client2.postMessage).toHaveBeenCalledTimes(1);
    });

    test('handles zero connected clients gracefully', async function() {
      env.self.clients.matchAll.mockResolvedValue([]);
      await expect(env.sandbox.notifyClients(ORIGIN + '/api/session')).resolves.not.toThrow();
    });
  });

  describe('revalidateAndNotify()', function() {
    var env;
    beforeEach(function() { env = createSWEnvironment(); });

    test('fetches fresh response and updates cache on success', async function() {
      env.mockFetch.mockResolvedValue(new Response('{"fresh":true}', { status: 200 }));
      var swrCache = { put: jest.fn().mockResolvedValue(undefined) };
      var request = new Request(ORIGIN + '/api/session');
      await env.sandbox.revalidateAndNotify(request, swrCache);
      expect(env.mockFetch).toHaveBeenCalledWith(request);
      expect(swrCache.put).toHaveBeenCalledTimes(1);
    });

    test('notifies clients after successful cache update', async function() {
      env.mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      var swrCache = { put: jest.fn().mockResolvedValue(undefined) };
      var request = new Request(ORIGIN + '/api/goals');
      await env.sandbox.revalidateAndNotify(request, swrCache);
      expect(env.mockClient.postMessage).toHaveBeenCalledWith({
        type: 'sw-cache-updated', url: ORIGIN + '/api/goals',
      });
    });

    test('does not update cache or notify on non-ok response', async function() {
      env.mockFetch.mockResolvedValue(new Response('Not Found', { status: 404 }));
      var swrCache = { put: jest.fn() };
      var request = new Request(ORIGIN + '/api/session');
      await env.sandbox.revalidateAndNotify(request, swrCache);
      expect(swrCache.put).not.toHaveBeenCalled();
      expect(env.mockClient.postMessage).not.toHaveBeenCalled();
    });

    test('silently handles network errors without throwing', async function() {
      env.mockFetch.mockRejectedValue(new Error('Network failure'));
      var swrCache = { put: jest.fn() };
      var request = new Request(ORIGIN + '/api/session');
      await expect(env.sandbox.revalidateAndNotify(request, swrCache)).resolves.not.toThrow();
      expect(swrCache.put).not.toHaveBeenCalled();
      expect(env.mockClient.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('fetchAndCache()', function() {
    var env;
    beforeEach(function() { env = createSWEnvironment(); });

    test('returns network response on success', async function() {
      var networkResponse = new Response('{"data":"ok"}', { status: 200 });
      env.mockFetch.mockResolvedValue(networkResponse);
      var swrCache = { put: jest.fn().mockResolvedValue(undefined) };
      var request = new Request(ORIGIN + '/api/session');
      var result = await env.sandbox.fetchAndCache(request, swrCache);
      expect(result).toBe(networkResponse);
    });

    test('caches successful response with x-swr-cached-at timestamp', async function() {
      env.mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      var swrCache = { put: jest.fn().mockResolvedValue(undefined) };
      var request = new Request(ORIGIN + '/api/session');
      await env.sandbox.fetchAndCache(request, swrCache);
      expect(swrCache.put).toHaveBeenCalledTimes(1);
      expect(swrCache.put.mock.calls[0][1].headers.get('x-swr-cached-at')).toBeTruthy();
    });

    test('does not cache non-ok responses', async function() {
      env.mockFetch.mockResolvedValue(new Response('Error', { status: 500 }));
      var swrCache = { put: jest.fn() };
      var request = new Request(ORIGIN + '/api/session');
      var result = await env.sandbox.fetchAndCache(request, swrCache);
      expect(result.status).toBe(500);
      expect(swrCache.put).not.toHaveBeenCalled();
    });

    test('returns 503 Service Unavailable on network error', async function() {
      env.mockFetch.mockRejectedValue(new Error('Network failure'));
      var swrCache = { put: jest.fn() };
      var request = new Request(ORIGIN + '/api/session');
      var result = await env.sandbox.fetchAndCache(request, swrCache);
      expect(result.status).toBe(503);
      expect(result.statusText).toBe('Service Unavailable');
    });
  });

  describe('Fetch event handler', function() {
    var env;
    beforeEach(function() { env = createSWEnvironment(); });

    function getFetchHandler() {
      var handlers = env.eventListeners.fetch;
      expect(handlers).toBeDefined();
      return handlers[0];
    }

    test('skips non-GET requests - POST/PUT/DELETE bypass cache', function() {
      var handler = getFetchHandler();
      ['POST', 'PUT', 'DELETE', 'PATCH'].forEach(function(method) {
        var event = createFetchEvent('/api/session', method);
        handler(event);
        expect(event._responsePromise).toBeNull();
      });
    });

    test('skips cross-origin requests', function() {
      var handler = getFetchHandler();
      var event = createFetchEvent('https://other-domain.com/api/session');
      handler(event);
      expect(event._responsePromise).toBeNull();
    });

    describe('SWR API endpoints (allowlisted)', function() {
      test('returns cached response immediately on SWR cache hit', async function() {
        var cachedResponse = new Response('{"cached":true}', { status: 200 });
        var swrCache = {
          match: jest.fn().mockResolvedValue(cachedResponse),
          put: jest.fn().mockResolvedValue(undefined),
        };
        env.mockCaches.open.mockResolvedValue(swrCache);
        env.mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
        var handler = getFetchHandler();
        var event = createFetchEvent('/api/session');
        handler(event);
        var response = await event._responsePromise;
        expect(response).toBe(cachedResponse);
      });

      test('triggers background revalidation on SWR cache hit', async function() {
        var swrCache = {
          match: jest.fn().mockResolvedValue(new Response('{"old":true}', { status: 200 })),
          put: jest.fn().mockResolvedValue(undefined),
        };
        env.mockCaches.open.mockResolvedValue(swrCache);
        env.mockFetch.mockResolvedValue(new Response('{"new":true}', { status: 200 }));
        var handler = getFetchHandler();
        var event = createFetchEvent('/api/session');
        handler(event);
        await event._responsePromise;
        expect(event._waitUntilPromises.length).toBeGreaterThan(0);
        await Promise.all(event._waitUntilPromises);
        expect(env.mockFetch).toHaveBeenCalled();
        expect(swrCache.put).toHaveBeenCalled();
      });

      test('background revalidation sends postMessage to clients', async function() {
        var swrCache = {
          match: jest.fn().mockResolvedValue(new Response('{"old":true}', { status: 200 })),
          put: jest.fn().mockResolvedValue(undefined),
        };
        env.mockCaches.open.mockResolvedValue(swrCache);
        env.mockFetch.mockResolvedValue(new Response('{"new":true}', { status: 200 }));
        var handler = getFetchHandler();
        var event = createFetchEvent('/api/goals');
        handler(event);
        await event._responsePromise;
        await Promise.all(event._waitUntilPromises);
        expect(env.mockClient.postMessage).toHaveBeenCalledWith({
          type: 'sw-cache-updated', url: ORIGIN + '/api/goals',
        });
      });

      test('fetches from network on cold cache (miss)', async function() {
        var networkResponse = new Response('{"network":true}', { status: 200 });
        var swrCache = {
          match: jest.fn().mockResolvedValue(undefined),
          put: jest.fn().mockResolvedValue(undefined),
        };
        env.mockCaches.open.mockResolvedValue(swrCache);
        env.mockFetch.mockResolvedValue(networkResponse);
        var handler = getFetchHandler();
        var event = createFetchEvent('/api/goals');
        handler(event);
        var response = await event._responsePromise;
        expect(response).toBe(networkResponse);
      });

      test('caches network response with timestamp on cold cache miss', async function() {
        var swrCache = {
          match: jest.fn().mockResolvedValue(undefined),
          put: jest.fn().mockResolvedValue(undefined),
        };
        env.mockCaches.open.mockResolvedValue(swrCache);
        env.mockFetch.mockResolvedValue(new Response('{"data":1}', { status: 200 }));
        var handler = getFetchHandler();
        var event = createFetchEvent('/api/total-distance');
        handler(event);
        await event._responsePromise;
        expect(swrCache.put).toHaveBeenCalledTimes(1);
        expect(swrCache.put.mock.calls[0][1].headers.get('x-swr-cached-at')).toBeTruthy();
      });

      test('each allowlisted endpoint is routed through SWR', async function() {
        var endpoints = ['/api/session', '/api/goals', '/api/calendar-progress',
          '/api/total-distance', '/api/user/parties', '/api/friends'];
        for (var i = 0; i < endpoints.length; i++) {
          var freshEnv = createSWEnvironment();
          var swrCache = {
            match: jest.fn().mockResolvedValue(undefined),
            put: jest.fn().mockResolvedValue(undefined),
          };
          freshEnv.mockCaches.open.mockResolvedValue(swrCache);
          freshEnv.mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
          var handler = freshEnv.eventListeners.fetch[0];
          var event = createFetchEvent(endpoints[i]);
          handler(event);
          expect(event._responsePromise).not.toBeNull();
          await event._responsePromise;
          expect(freshEnv.mockCaches.open).toHaveBeenCalled();
        }
      });
    });

    describe('Non-SWR API endpoints (network-only)', function() {
      test('uses network-only for /api/party/:id/activity', async function() {
        var networkResponse = new Response('[]', { status: 200 });
        env.mockFetch.mockResolvedValue(networkResponse);
        var handler = getFetchHandler();
        var event = createFetchEvent('/api/party/123/activity');
        handler(event);
        var response = await event._responsePromise;
        expect(response).toBe(networkResponse);
      });

      test('uses network-only for /api/friends/pending', async function() {
        env.mockFetch.mockResolvedValue(new Response('[]', { status: 200 }));
        var handler = getFetchHandler();
        var event = createFetchEvent('/api/friends/pending');
        handler(event);
        var response = await event._responsePromise;
        expect(response.status).toBe(200);
      });

      test('non-allowlisted API endpoints do not open the SWR cache', async function() {
        env.mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
        var handler = getFetchHandler();
        var event = createFetchEvent('/api/some-other-endpoint');
        handler(event);
        await event._responsePromise;
        expect(env.mockCaches.open).not.toHaveBeenCalled();
      });
    });

    describe('Write methods bypass cache', function() {
      test.each(['POST', 'PUT', 'DELETE'])(
        '%s to an SWR endpoint bypasses cache', function(method) {
          var handler = getFetchHandler();
          var event = createFetchEvent('/api/session', method);
          handler(event);
          expect(event._responsePromise).toBeNull();
          expect(env.mockCaches.open).not.toHaveBeenCalled();
        }
      );
    });

    describe('Static assets (unchanged behaviour)', function() {
      test('static asset requests use cache-first, not SWR', function() {
        env.mockCaches.match.mockResolvedValue(undefined);
        env.mockFetch.mockResolvedValue(
          new Response('body', { status: 200, headers: { 'Content-Type': 'text/css' } })
        );
        var handler = getFetchHandler();
        var event = createFetchEvent('/css/main.css');
        handler(event);
        expect(event._responsePromise).not.toBeNull();
      });
    });
  });

  describe('Activate event handler', function() {
    test('stores SWR version on first activation (no previous version)', async function() {
      var versionCache = {
        match: jest.fn().mockResolvedValue(undefined),
        put: jest.fn().mockResolvedValue(undefined),
      };
      var env = createSWEnvironment();
      env.mockCaches.open.mockImplementation(function(name) {
        if (name === 'walk-to-mordor-swr-version') return Promise.resolve(versionCache);
        return Promise.resolve({ addAll: jest.fn().mockResolvedValue(undefined), match: jest.fn().mockResolvedValue(undefined), put: jest.fn().mockResolvedValue(undefined) });
      });
      env.mockCaches.keys.mockResolvedValue([]);
      var handler = env.eventListeners.activate[0];
      var event = createLifecycleEvent();
      handler(event);
      await Promise.all(event._waitUntilPromises);
      expect(versionCache.put).toHaveBeenCalledWith('version', expect.any(Response));
    });

    test('preserves SWR cache when stored version matches current', async function() {
      var versionCache = {
        match: jest.fn().mockResolvedValue(new Response('{{SWR_CACHE_VERSION}}')),
        put: jest.fn().mockResolvedValue(undefined),
      };
      var env = createSWEnvironment();
      env.mockCaches.open.mockImplementation(function(name) {
        if (name === 'walk-to-mordor-swr-version') return Promise.resolve(versionCache);
        return Promise.resolve({ addAll: jest.fn().mockResolvedValue(undefined), match: jest.fn().mockResolvedValue(undefined), put: jest.fn().mockResolvedValue(undefined) });
      });
      env.mockCaches.keys.mockResolvedValue([]);
      var handler = env.eventListeners.activate[0];
      var event = createLifecycleEvent();
      handler(event);
      await Promise.all(event._waitUntilPromises);
      expect(env.mockCaches.delete).not.toHaveBeenCalledWith('walk-to-mordor-api-swr');
    });

    test('clears SWR cache when stored version differs from current', async function() {
      var versionCache = {
        match: jest.fn().mockResolvedValue(new Response('old-version-1')),
        put: jest.fn().mockResolvedValue(undefined),
      };
      var env = createSWEnvironment();
      env.mockCaches.open.mockImplementation(function(name) {
        if (name === 'walk-to-mordor-swr-version') return Promise.resolve(versionCache);
        return Promise.resolve({ addAll: jest.fn().mockResolvedValue(undefined), match: jest.fn().mockResolvedValue(undefined), put: jest.fn().mockResolvedValue(undefined) });
      });
      env.mockCaches.keys.mockResolvedValue([]);
      var handler = env.eventListeners.activate[0];
      var event = createLifecycleEvent();
      handler(event);
      await Promise.all(event._waitUntilPromises);
      expect(env.mockCaches.delete).toHaveBeenCalledWith('walk-to-mordor-api-swr');
      expect(versionCache.put).toHaveBeenCalledWith('version', expect.any(Response));
    });

    test('preserves SWR and version caches during old static cache cleanup', async function() {
      var versionCache = {
        match: jest.fn().mockResolvedValue(new Response('{{SWR_CACHE_VERSION}}')),
        put: jest.fn().mockResolvedValue(undefined),
      };
      var env = createSWEnvironment();
      env.mockCaches.open.mockImplementation(function(name) {
        if (name === 'walk-to-mordor-swr-version') return Promise.resolve(versionCache);
        return Promise.resolve({ addAll: jest.fn().mockResolvedValue(undefined), match: jest.fn().mockResolvedValue(undefined), put: jest.fn().mockResolvedValue(undefined) });
      });
      env.mockCaches.keys.mockResolvedValue([
        'walk-to-mordor-20240101-120000',
        'walk-to-mordor-{{BUILD_TIMESTAMP}}',
        'walk-to-mordor-api-swr',
        'walk-to-mordor-swr-version',
      ]);
      var handler = env.eventListeners.activate[0];
      var event = createLifecycleEvent();
      handler(event);
      await Promise.all(event._waitUntilPromises);
      expect(env.mockCaches.delete).toHaveBeenCalledWith('walk-to-mordor-20240101-120000');
      var deleteCalls = env.mockCaches.delete.mock.calls.map(function(c) { return c[0]; });
      expect(deleteCalls).not.toContain('walk-to-mordor-{{BUILD_TIMESTAMP}}');
      expect(deleteCalls).not.toContain('walk-to-mordor-swr-version');
    });
  });

  describe('Install event handler (static asset caching unchanged)', function() {
    test('pre-caches static assets on install', async function() {
      var staticCache = { addAll: jest.fn().mockResolvedValue(undefined) };
      var env = createSWEnvironment();
      env.mockCaches.open.mockResolvedValue(staticCache);
      var handler = env.eventListeners.install[0];
      var event = createLifecycleEvent();
      handler(event);
      await Promise.all(event._waitUntilPromises);
      expect(env.mockCaches.open).toHaveBeenCalled();
      expect(staticCache.addAll).toHaveBeenCalledTimes(1);
      var cachedUrls = staticCache.addAll.mock.calls[0][0];
      expect(cachedUrls).toContain('/css/main.css');
      expect(cachedUrls).toContain('/js/main.js');
      expect(cachedUrls).toContain('/manifest.json');
    });
  });
});
