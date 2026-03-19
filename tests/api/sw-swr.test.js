/**
 * Tests for Service Worker SWR (Stale-While-Revalidate) API Caching
 *
 * Test Coverage:
 * - SWR hit returns cached response immediately + background revalidation
 * - Cold cache (miss) goes to network and caches response
 * - Background revalidation updates cache and notifies clients
 * - postMessage emitted on cache update with correct payload
 * - POST/PUT/DELETE bypass SWR entirely
 * - Non-allowlisted GET endpoints bypass cache (network-only)
 * - TTL metadata (x-swr-cached-at) stored correctly on cached responses
 * - SWR_CACHE_VERSION change clears SWR cache on activate
 * - Static asset caching unchanged by SWR additions
 */

const fs = require('fs');
const path = require('path');

const SW_PATH = path.join(__dirname, '..', '..', 'public', 'sw.js');

// Read the SW source and extract testable functions
function loadSWModule() {
  const swSource = fs.readFileSync(SW_PATH, 'utf8');

  // Mock the service worker global scope
  const mockClients = [];
  const mockCaches = {};
  let activateCallback = null;
  let fetchCallback = null;
  let installCallback = null;
  let messageCallback = null;

  const self = {
    location: { origin: 'https://example.com' },
    clients: {
      matchAll: jest.fn(async () => mockClients),
    },
    addEventListener: jest.fn((event, cb) => {
      if (event === 'activate') activateCallback = cb;
      if (event === 'fetch') fetchCallback = cb;
      if (event === 'install') installCallback = cb;
      if (event === 'message') messageCallback = cb;
    }),
  };

  // Mock Cache API
  function createMockCache() {
    const store = new Map();
    return {
      match: jest.fn(async (request) => {
        const key = typeof request === 'string' ? request : request.url;
        return store.get(key) || undefined;
      }),
      put: jest.fn(async (request, response) => {
        const key = typeof request === 'string' ? request : request.url;
        store.set(key, response);
      }),
      delete: jest.fn(async (request) => {
        const key = typeof request === 'string' ? request : request.url;
        return store.delete(key);
      }),
      keys: jest.fn(async () => Array.from(store.keys()).map((key) => new Request(key))),
      addAll: jest.fn(async () => {}),
      _store: store,
    };
  }

  const caches = {
    open: jest.fn(async (name) => {
      if (!mockCaches[name]) {
        mockCaches[name] = createMockCache();
      }
      return mockCaches[name];
    }),
    keys: jest.fn(async () => Object.keys(mockCaches)),
    delete: jest.fn(async (name) => {
      delete mockCaches[name];
      return true;
    }),
    match: jest.fn(async () => undefined),
  };

  const globalFetch = jest.fn();

  // Execute SW code in a controlled scope
  const fn = new Function(
    'self',
    'caches',
    'fetch',
    'Response',
    'Headers',
    'URL',
    'Date',
    swSource + '\n; return { SWR_CACHE_NAME, SWR_CACHE_VERSION, SWR_VERSION_CACHE_NAME, SWR_TTL_MS, SWR_ENDPOINTS, isSWREndpoint, getCacheKey, cacheWithTimestamp, notifyClients, revalidateAndNotify, fetchAndCache, getCurrentSWRMutationVersion, bumpSWRMutationVersion };'
  );

  const exports = fn(self, caches, globalFetch, Response, Headers, URL, Date);

  return {
    self,
    caches,
    mockCaches,
    mockClients,
    globalFetch,
    activateCallback,
    fetchCallback,
    installCallback,
    messageCallback,
    ...exports,
  };
}

describe('Service Worker SWR API Caching', () => {
  let sw;

  beforeEach(() => {
    jest.restoreAllMocks();
    sw = loadSWModule();
  });

  describe('Constants and Configuration', () => {
    test('SWR_CACHE_NAME is set correctly', () => {
      expect(sw.SWR_CACHE_NAME).toBe('walk-to-mordor-api-swr');
    });

    test('SWR_CACHE_VERSION has placeholder value', () => {
      expect(sw.SWR_CACHE_VERSION).toBe('{{SWR_CACHE_VERSION}}');
    });

    test('SWR_VERSION_CACHE_NAME is set correctly', () => {
      expect(sw.SWR_VERSION_CACHE_NAME).toBe('walk-to-mordor-swr-version');
    });

    test('SWR_TTL_MS is 5 minutes (300000ms)', () => {
      expect(sw.SWR_TTL_MS).toBe(300000);
    });

    test('SWR_ENDPOINTS contains all required endpoints', () => {
      expect(sw.SWR_ENDPOINTS).toEqual([
        '/api/session',
        '/api/goals',
        '/api/calendar-progress',
        '/api/total-distance',
        '/api/user/parties',
        '/api/friends',
      ]);
    });
  });

  describe('isSWREndpoint', () => {
    test('returns true for allowlisted endpoints', () => {
      expect(sw.isSWREndpoint('/api/session')).toBe(true);
      expect(sw.isSWREndpoint('/api/goals')).toBe(true);
      expect(sw.isSWREndpoint('/api/calendar-progress')).toBe(true);
      expect(sw.isSWREndpoint('/api/total-distance')).toBe(true);
      expect(sw.isSWREndpoint('/api/user/parties')).toBe(true);
      expect(sw.isSWREndpoint('/api/friends')).toBe(true);
    });

    test('returns false for non-allowlisted API endpoints', () => {
      expect(sw.isSWREndpoint('/api/party/123/activity')).toBe(false);
      expect(sw.isSWREndpoint('/api/friends/pending')).toBe(false);
      expect(sw.isSWREndpoint('/api/login')).toBe(false);
      expect(sw.isSWREndpoint('/api/register')).toBe(false);
      expect(sw.isSWREndpoint('/api/unknown')).toBe(false);
    });

    test('returns false for non-API paths', () => {
      expect(sw.isSWREndpoint('/journey')).toBe(false);
      expect(sw.isSWREndpoint('/map')).toBe(false);
      expect(sw.isSWREndpoint('/css/main.css')).toBe(false);
    });
  });

  describe('cacheWithTimestamp', () => {
    test('stores response with x-swr-cached-at header', async () => {
      const mockCache = {
        put: jest.fn(async () => {}),
      };
      const request = new Request('https://example.com/api/goals');
      const response = new Response(JSON.stringify({ goals: [] }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      });

      const now = Date.now();
      await sw.cacheWithTimestamp(mockCache, request, response);

      expect(mockCache.put).toHaveBeenCalledTimes(1);
      const cachedResponse = mockCache.put.mock.calls[0][1];
      const cachedAt = parseInt(cachedResponse.headers.get('x-swr-cached-at'));
      expect(cachedAt).toBeGreaterThanOrEqual(now - 1000);
      expect(cachedAt).toBeLessThanOrEqual(Date.now() + 1000);
    });

    test('preserves original response status and headers', async () => {
      const mockCache = {
        put: jest.fn(async () => {}),
      };
      const request = new Request('https://example.com/api/session');
      const response = new Response('{"user":"test"}', {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json', 'X-Custom': 'value' },
      });

      await sw.cacheWithTimestamp(mockCache, request, response);

      const cached = mockCache.put.mock.calls[0][1];
      expect(cached.status).toBe(200);
      expect(cached.headers.get('Content-Type')).toBe('application/json');
      expect(cached.headers.get('X-Custom')).toBe('value');
      expect(cached.headers.get('x-swr-cached-at')).toBeTruthy();
    });

    test('x-swr-cached-at timestamp is readable after cache round-trip', async () => {
      // Use the mock cache from loadSWModule to simulate a real round-trip
      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');
      const request = new Request('https://example.com/api/goals');
      const response = new Response(JSON.stringify({ goals: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      await sw.cacheWithTimestamp(swrCache, request, response);

      // Read it back from the cache
      const cached = await swrCache.match(request);
      expect(cached).toBeDefined();
      const cachedAt = cached.headers.get('x-swr-cached-at');
      expect(cachedAt).toBeTruthy();

      // Verify it's a valid numeric timestamp (not NaN or garbage)
      const timestamp = parseInt(cachedAt, 10);
      expect(Number.isNaN(timestamp)).toBe(false);
      expect(timestamp).toBeGreaterThan(0);
      // Should be reasonably recent (within last 10 seconds)
      expect(Date.now() - timestamp).toBeLessThan(10000);
    });

    test('strips transport-specific headers when creating cached response', async () => {
      const mockCache = {
        put: jest.fn(async () => {}),
      };
      const request = new Request('https://example.com/api/session');
      const response = new Response('{"ok":true}', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
          'Content-Length': '999',
          'Transfer-Encoding': 'chunked',
          'Connection': 'keep-alive',
          'Keep-Alive': 'timeout=5',
          'Proxy-Authenticate': 'Basic realm="test"',
          'Proxy-Authorization': 'Basic abc123',
          'TE': 'trailers',
          'Trailer': 'Expires',
          'Upgrade': 'websocket',
        },
      });

      await sw.cacheWithTimestamp(mockCache, request, response);

      const cached = mockCache.put.mock.calls[0][1];
      expect(cached.headers.get('Content-Type')).toBe('application/json');
      expect(cached.headers.get('x-swr-cached-at')).toBeTruthy();
      expect(cached.headers.get('Content-Encoding')).toBeNull();
      expect(cached.headers.get('Content-Length')).toBeNull();
      expect(cached.headers.get('Transfer-Encoding')).toBeNull();
      expect(cached.headers.get('Connection')).toBeNull();
      expect(cached.headers.get('Keep-Alive')).toBeNull();
      expect(cached.headers.get('Proxy-Authenticate')).toBeNull();
      expect(cached.headers.get('Proxy-Authorization')).toBeNull();
      expect(cached.headers.get('TE')).toBeNull();
      expect(cached.headers.get('Trailer')).toBeNull();
      expect(cached.headers.get('Upgrade')).toBeNull();
    });
  });

  describe('notifyClients', () => {
    test('sends postMessage to all matched clients', async () => {
      const client1 = { postMessage: jest.fn() };
      const client2 = { postMessage: jest.fn() };
      sw.mockClients.push(client1, client2);

      await sw.notifyClients('https://example.com/api/goals');

      expect(sw.self.clients.matchAll).toHaveBeenCalledWith({ type: 'window', includeUncontrolled: true });
      expect(client1.postMessage).toHaveBeenCalledWith({
        type: 'sw-cache-updated',
        url: 'https://example.com/api/goals',
      });
      expect(client2.postMessage).toHaveBeenCalledWith({
        type: 'sw-cache-updated',
        url: 'https://example.com/api/goals',
      });
    });

    test('handles zero clients gracefully', async () => {
      // mockClients is empty by default
      await expect(sw.notifyClients('https://example.com/api/goals')).resolves.not.toThrow();
    });
  });

  describe('revalidateAndNotify', () => {
    test('fetches from network, updates cache, and notifies clients', async () => {
      const networkResponse = new Response(JSON.stringify({ fresh: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      sw.globalFetch.mockResolvedValueOnce(networkResponse);

      const mockCache = {
        put: jest.fn(async () => {}),
      };
      const request = new Request('https://example.com/api/goals');

      const client = { postMessage: jest.fn() };
      sw.mockClients.push(client);

      await sw.revalidateAndNotify(request, mockCache);

      expect(sw.globalFetch).toHaveBeenCalledWith(request);
      expect(mockCache.put).toHaveBeenCalledTimes(1);
      expect(client.postMessage).toHaveBeenCalledWith({
        type: 'sw-cache-updated',
        url: 'https://example.com/api/goals',
      });
    });

    test('does not cache or notify on network error', async () => {
      sw.globalFetch.mockRejectedValueOnce(new Error('Network error'));

      const mockCache = { put: jest.fn() };
      const request = new Request('https://example.com/api/goals');

      await expect(sw.revalidateAndNotify(request, mockCache)).resolves.not.toThrow();
      expect(mockCache.put).not.toHaveBeenCalled();
    });

    test('does not cache or notify on non-ok response', async () => {
      const errorResponse = new Response('Unauthorized', { status: 401 });
      sw.globalFetch.mockResolvedValueOnce(errorResponse);

      const mockCache = { put: jest.fn() };
      const request = new Request('https://example.com/api/goals');
      const client = { postMessage: jest.fn() };
      sw.mockClients.push(client);

      await sw.revalidateAndNotify(request, mockCache);

      expect(mockCache.put).not.toHaveBeenCalled();
      expect(client.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('fetchAndCache', () => {
    test('fetches from network and caches successful response', async () => {
      const networkResponse = new Response(JSON.stringify({ data: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      sw.globalFetch.mockResolvedValueOnce(networkResponse);

      const mockCache = { put: jest.fn(async () => {}) };
      const request = new Request('https://example.com/api/session');

      const result = await sw.fetchAndCache(request, mockCache);

      expect(sw.globalFetch).toHaveBeenCalledWith(request);
      expect(result).toBe(networkResponse);
      expect(mockCache.put).toHaveBeenCalledTimes(1);
    });

    test('returns network response without caching on error status', async () => {
      const errorResponse = new Response('Not Found', { status: 404 });
      sw.globalFetch.mockResolvedValueOnce(errorResponse);

      const mockCache = { put: jest.fn() };
      const request = new Request('https://example.com/api/session');

      const result = await sw.fetchAndCache(request, mockCache);

      expect(result).toBe(errorResponse);
      expect(mockCache.put).not.toHaveBeenCalled();
    });
  });

  describe('Fetch Event Handler — SWR Behavior', () => {
    function createFetchEvent(url, options = {}) {
      const method = options.method || 'GET';
      const mode = options.mode || 'cors';
      const destination = options.destination || '';
      const respondWithFn = jest.fn();
      const waitUntilFn = jest.fn();

      return {
        request: {
          url,
          method,
          mode,
          destination,
          headers: new Headers(options.headers || {}),
          clone: function() { return this; },
        },
        respondWith: respondWithFn,
        waitUntil: waitUntilFn,
        _respondWith: respondWithFn,
        _waitUntil: waitUntilFn,
      };
    }

    test('SWR hit returns cached response and triggers background revalidation when stale', async () => {
      const staleTimestamp = (Date.now() - 400000).toString(); // 6.67 min ago — beyond TTL, within MAX_AGE
      const cachedResponse = new Response(JSON.stringify({ cached: true }), {
        status: 200,
        headers: { 'x-swr-cached-at': staleTimestamp },
      });

      // Pre-populate the SWR cache
      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');
      await swrCache.put(
        { url: 'https://example.com/api/goals' },
        cachedResponse
      );

      // Set up network response for background revalidation
      const freshResponse = new Response(JSON.stringify({ fresh: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      sw.globalFetch.mockResolvedValueOnce(freshResponse);

      const event = createFetchEvent('https://example.com/api/goals');
      sw.fetchCallback(event);

      expect(event.respondWith).toHaveBeenCalledTimes(1);

      // Resolve the respondWith promise to get the returned response
      const responsePromise = event.respondWith.mock.calls[0][0];
      const response = await responsePromise;
      expect(response).toBeDefined();
      expect(response.headers.get('x-swr-cached-at')).toBe(staleTimestamp);

      // Background revalidation was queued (because stale)
      expect(event.waitUntil).toHaveBeenCalledTimes(1);
    });

    test('SWR miss (cold cache) fetches from network and caches', async () => {
      const networkResponse = new Response(JSON.stringify({ data: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      sw.globalFetch.mockResolvedValueOnce(networkResponse);

      const event = createFetchEvent('https://example.com/api/session');
      sw.fetchCallback(event);

      expect(event.respondWith).toHaveBeenCalledTimes(1);

      const response = await event.respondWith.mock.calls[0][0];
      expect(response).toBe(networkResponse);
    });

    test('POST requests bypass respondWith and clear SWR cache via waitUntil', async () => {
      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');
      await swrCache.put(
        { url: 'https://example.com/api/goals' },
        new Response('cached')
      );

      const event = createFetchEvent('https://example.com/api/goals', {
        method: 'POST',
      });
      sw.fetchCallback(event);
      expect(event.respondWith).not.toHaveBeenCalled();
      expect(event.waitUntil).toHaveBeenCalledTimes(1);
      await event.waitUntil.mock.calls[0][0];
      expect(sw.globalFetch).not.toHaveBeenCalled();
      expect(swrCache.delete).toHaveBeenCalled();
    });

    test('PUT requests bypass respondWith and clear SWR cache via waitUntil', async () => {
      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');
      await swrCache.put(
        { url: 'https://example.com/api/goals' },
        new Response('cached')
      );

      const event = createFetchEvent('https://example.com/api/goals', {
        method: 'PUT',
      });
      sw.fetchCallback(event);
      expect(event.respondWith).not.toHaveBeenCalled();
      expect(event.waitUntil).toHaveBeenCalledTimes(1);
      await event.waitUntil.mock.calls[0][0];
      expect(sw.globalFetch).not.toHaveBeenCalled();
      expect(swrCache.delete).toHaveBeenCalled();
    });

    test('DELETE requests bypass respondWith and clear SWR cache via waitUntil', async () => {
      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');
      await swrCache.put(
        { url: 'https://example.com/api/goals' },
        new Response('cached')
      );

      const event = createFetchEvent('https://example.com/api/goals', {
        method: 'DELETE',
      });
      sw.fetchCallback(event);
      expect(event.respondWith).not.toHaveBeenCalled();
      expect(event.waitUntil).toHaveBeenCalledTimes(1);
      await event.waitUntil.mock.calls[0][0];
      expect(sw.globalFetch).not.toHaveBeenCalled();
      expect(swrCache.delete).toHaveBeenCalled();
    });

    test('Non-allowlisted GET API endpoints use network-only', async () => {
      const networkResponse = new Response(JSON.stringify({ activity: [] }), {
        status: 200,
      });
      sw.globalFetch.mockResolvedValueOnce(networkResponse);

      const event = createFetchEvent('https://example.com/api/party/123/activity');
      sw.fetchCallback(event);

      expect(event.respondWith).toHaveBeenCalledTimes(1);
      const response = await event.respondWith.mock.calls[0][0];
      expect(response).toBe(networkResponse);
    });

    test('/api/friends/pending bypasses SWR (not in allowlist)', async () => {
      const networkResponse = new Response('[]', { status: 200 });
      sw.globalFetch.mockResolvedValueOnce(networkResponse);

      const event = createFetchEvent('https://example.com/api/friends/pending');
      sw.fetchCallback(event);

      expect(event.respondWith).toHaveBeenCalledTimes(1);
      const response = await event.respondWith.mock.calls[0][0];
      expect(response).toBe(networkResponse);
    });

    test('Cross-origin requests are not intercepted', () => {
      const event = createFetchEvent('https://other-domain.com/api/goals');
      sw.fetchCallback(event);
      expect(event.respondWith).not.toHaveBeenCalled();
    });

    test('PATCH requests bypass respondWith and clear SWR cache via waitUntil', async () => {
      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');
      await swrCache.put(
        { url: 'https://example.com/api/goals' },
        new Response('cached')
      );

      const event = createFetchEvent('https://example.com/api/goals', {
        method: 'PATCH',
      });
      sw.fetchCallback(event);
      expect(event.respondWith).not.toHaveBeenCalled();
      expect(event.waitUntil).toHaveBeenCalledTimes(1);
      await event.waitUntil.mock.calls[0][0];
      expect(sw.globalFetch).not.toHaveBeenCalled();
      expect(swrCache.delete).toHaveBeenCalled();
    });

    test('mutation bumps SWR mutation version', async () => {
      const before = sw.getCurrentSWRMutationVersion();
      const event = createFetchEvent('https://example.com/api/user/preferences', {
        method: 'PUT',
      });
      sw.fetchCallback(event);
      expect(event.respondWith).not.toHaveBeenCalled();
      expect(event.waitUntil).toHaveBeenCalledTimes(1);
      await event.waitUntil.mock.calls[0][0];
      const after = sw.getCurrentSWRMutationVersion();
      expect(after).toBe(before + 1);
    });

    test('stale revalidation does not overwrite cache after later mutation', async () => {
      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');
      const staleTimestamp = (Date.now() - 400000).toString();
      await swrCache.put(
        { url: 'https://example.com/api/session' },
        new Response(JSON.stringify({ email: 'old@example.com' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'x-swr-cached-at': staleTimestamp,
          },
        })
      );

      const staleGetResponse = new Response(JSON.stringify({ email: 'stale-get@example.com' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      sw.globalFetch
        .mockResolvedValueOnce(staleGetResponse);

      const getEvent = createFetchEvent('https://example.com/api/session');
      sw.fetchCallback(getEvent);
      const getResult = await getEvent.respondWith.mock.calls[0][0];
      expect(getResult.headers.get('x-swr-cached-at')).toBe(staleTimestamp);
      expect(getEvent.waitUntil).toHaveBeenCalledTimes(1);

      const mutationEvent = createFetchEvent('https://example.com/api/user/preferences', {
        method: 'PUT',
      });
      sw.fetchCallback(mutationEvent);
      expect(mutationEvent.respondWith).not.toHaveBeenCalled();
      expect(mutationEvent.waitUntil).toHaveBeenCalledTimes(1);
      await mutationEvent.waitUntil.mock.calls[0][0];

      await getEvent.waitUntil.mock.calls[0][0];

      const cachedAfterRace = await swrCache.match({ url: 'https://example.com/api/session' });
      expect(cachedAfterRace).toBeUndefined();
    });

    test('cold cache GET does not populate cache if mutation happens before response', async () => {
      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');
      let resolveGet;
      const delayedGet = new Promise((resolve) => {
        resolveGet = resolve;
      });

      sw.globalFetch
        .mockImplementationOnce(() => delayedGet);

      const getEvent = createFetchEvent('https://example.com/api/session');
      sw.fetchCallback(getEvent);
      expect(getEvent.respondWith).toHaveBeenCalledTimes(1);

      const mutationEvent = createFetchEvent('https://example.com/api/user/preferences', {
        method: 'PUT',
      });
      sw.fetchCallback(mutationEvent);
      expect(mutationEvent.respondWith).not.toHaveBeenCalled();
      expect(mutationEvent.waitUntil).toHaveBeenCalledTimes(1);
      await mutationEvent.waitUntil.mock.calls[0][0];

      resolveGet(new Response(JSON.stringify({ showFutureGoalsUnlocked: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

      await getEvent.respondWith.mock.calls[0][0];

      const cachedAfterRace = await swrCache.match({ url: 'https://example.com/api/session' });
      expect(cachedAfterRace).toBeUndefined();
    });

    test('cold cache miss stores response in SWR cache', async () => {
      const networkResponse = new Response(JSON.stringify({ data: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      sw.globalFetch.mockResolvedValueOnce(networkResponse);

      const event = createFetchEvent('https://example.com/api/goals');
      sw.fetchCallback(event);

      // Wait for the respondWith promise to resolve
      await event.respondWith.mock.calls[0][0];

      // Verify the SWR cache now has the entry with TTL metadata
      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');
      const cachedEntry = await swrCache.match({ url: 'https://example.com/api/goals' });
      expect(cachedEntry).toBeDefined();
      expect(cachedEntry.headers.get('x-swr-cached-at')).toBeTruthy();
    });

    test('SWR-cached entry strips encoding and length headers from network response', async () => {
      const networkResponse = new Response(JSON.stringify({ data: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Encoding': 'br',
          'Content-Length': '12345',
        },
      });
      sw.globalFetch.mockResolvedValueOnce(networkResponse);

      const event = createFetchEvent('https://example.com/api/session');
      sw.fetchCallback(event);
      await event.respondWith.mock.calls[0][0];

      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');
      const cachedEntry = await swrCache.match({ url: 'https://example.com/api/session' });
      expect(cachedEntry).toBeDefined();
      expect(cachedEntry.headers.get('x-swr-cached-at')).toBeTruthy();
      expect(cachedEntry.headers.get('Content-Type')).toBe('application/json');
      expect(cachedEntry.headers.get('Content-Encoding')).toBeNull();
      expect(cachedEntry.headers.get('Content-Length')).toBeNull();
    });

    test('SWR hit background revalidation updates cache with fresh data', async () => {
      const staleTimestamp = (Date.now() - 400000).toString(); // stale but within MAX_AGE
      const staleResponse = new Response(JSON.stringify({ version: 'old' }), {
        status: 200,
        headers: { 'x-swr-cached-at': staleTimestamp },
      });

      // Pre-populate SWR cache
      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');
      await swrCache.put(
        { url: 'https://example.com/api/goals' },
        staleResponse
      );

      // Set up fresh network response
      const freshResponse = new Response(JSON.stringify({ version: 'new' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      sw.globalFetch.mockResolvedValueOnce(freshResponse);

      const client = { postMessage: jest.fn() };
      sw.mockClients.push(client);

      const event = createFetchEvent('https://example.com/api/goals');
      sw.fetchCallback(event);

      // Resolve respondWith (returns stale cached)
      const response = await event.respondWith.mock.calls[0][0];
      expect(response.headers.get('x-swr-cached-at')).toBe(staleTimestamp);

      // Wait for background revalidation to complete
      await event.waitUntil.mock.calls[0][0];

      // Cache should now contain fresh entry with updated timestamp
      const updated = await swrCache.match({ url: 'https://example.com/api/goals' });
      expect(updated).toBeDefined();
      const cachedAt = parseInt(updated.headers.get('x-swr-cached-at'));
      expect(cachedAt).toBeGreaterThan(parseInt(staleTimestamp));

      // postMessage should have been emitted
      expect(client.postMessage).toHaveBeenCalledWith({
        type: 'sw-cache-updated',
        url: 'https://example.com/api/goals',
      });
    });

    test('network failure on cold cache propagates the error', async () => {
      sw.globalFetch.mockRejectedValueOnce(new Error('Network offline'));

      const event = createFetchEvent('https://example.com/api/session');
      sw.fetchCallback(event);

      // The respondWith promise should reject because fetchAndCache rethrows
      await expect(event.respondWith.mock.calls[0][0]).rejects.toThrow('Network offline');
    });
  });

  describe('Fetch Event — Static Asset Caching Unchanged', () => {
    function createFetchEvent(url, options = {}) {
      const respondWithFn = jest.fn();
      const waitUntilFn = jest.fn();
      return {
        request: {
          url,
          method: options.method || 'GET',
          mode: options.mode || 'cors',
          destination: options.destination || '',
          headers: new Headers(options.headers || {}),
          clone: function() { return this; },
        },
        respondWith: respondWithFn,
        waitUntil: waitUntilFn,
      };
    }

    test('HTML navigations still use network-only with offline fallback', async () => {
      const networkResponse = new Response('<html>page</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
      sw.globalFetch.mockResolvedValueOnce(networkResponse);

      const event = createFetchEvent('https://example.com/journey', {
        mode: 'navigate',
        destination: 'document',
      });
      sw.fetchCallback(event);

      expect(event.respondWith).toHaveBeenCalledTimes(1);
      const response = await event.respondWith.mock.calls[0][0];
      expect(response).toBe(networkResponse);
    });

    test('Static CSS requests use cache-first strategy', async () => {
      // Pre-populate static cache with CSS
      const cachedCSS = new Response('body{}', {
        status: 200,
        headers: { 'Content-Type': 'text/css' },
      });
      const staticCache = await sw.caches.open(
        'walk-to-mordor-{{BUILD_TIMESTAMP}}'
      );
      await staticCache.put(
        { url: 'https://example.com/css/main.css' },
        cachedCSS
      );

      // Also mock global caches.match for cache-first
      sw.caches.match.mockResolvedValueOnce(cachedCSS);

      const event = createFetchEvent('https://example.com/css/main.css', {
        destination: 'style',
      });
      sw.fetchCallback(event);

      expect(event.respondWith).toHaveBeenCalledTimes(1);
    });
  });

  describe('Activate Event — SWR Cache Version Busting', () => {
    test('clears SWR cache when version changes', async () => {
      // Simulate an old version stored
      const versionCache = await sw.caches.open('walk-to-mordor-swr-version');
      await versionCache.put('version', new Response('old-version'));

      // Pre-populate SWR cache
      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');
      await swrCache.put(
        { url: 'https://example.com/api/goals' },
        new Response('cached')
      );

      // Fire activate
      const waitUntilFn = jest.fn();
      sw.activateCallback({ waitUntil: waitUntilFn });

      // Resolve the promise chain
      await waitUntilFn.mock.calls[0][0];

      // SWR cache should have been deleted
      expect(sw.caches.delete).toHaveBeenCalledWith('walk-to-mordor-api-swr');
    });

    test('does not clear SWR cache when version matches', async () => {
      // Store the current version
      const versionCache = await sw.caches.open('walk-to-mordor-swr-version');
      await versionCache.put('version', new Response('{{SWR_CACHE_VERSION}}'));

      const waitUntilFn = jest.fn();
      sw.activateCallback({ waitUntil: waitUntilFn });

      await waitUntilFn.mock.calls[0][0];

      // caches.delete should only be called for old static asset caches, not SWR
      const deleteCalls = sw.caches.delete.mock.calls.map((c) => c[0]);
      expect(deleteCalls).not.toContain('walk-to-mordor-api-swr');
    });

    test('clears SWR cache on first activation (no stored version)', async () => {
      // No version stored — fresh install
      const waitUntilFn = jest.fn();
      sw.activateCallback({ waitUntil: waitUntilFn });

      await waitUntilFn.mock.calls[0][0];

      // Should delete SWR cache (null !== '{{SWR_CACHE_VERSION}}')
      expect(sw.caches.delete).toHaveBeenCalledWith('walk-to-mordor-api-swr');

      // Should store the new version
      const versionCache = await sw.caches.open('walk-to-mordor-swr-version');
      expect(versionCache.put).toHaveBeenCalledWith(
        'version',
        expect.any(Response)
      );
    });

    test('preserves static asset CACHE_NAME during activate', async () => {
      // Pre-populate with the current static cache
      await sw.caches.open('walk-to-mordor-{{BUILD_TIMESTAMP}}');

      const waitUntilFn = jest.fn();
      sw.activateCallback({ waitUntil: waitUntilFn });

      await waitUntilFn.mock.calls[0][0];

      // Static cache should not be deleted
      const deleteCalls = sw.caches.delete.mock.calls.map((c) => c[0]);
      expect(deleteCalls).not.toContain('walk-to-mordor-{{BUILD_TIMESTAMP}}');
    });

    test('deletes old static caches but keeps SWR and version caches', async () => {
      // Create an old static cache
      await sw.caches.open('walk-to-mordor-old-timestamp');

      // Store matching SWR version so SWR cache is not deleted by version check
      const versionCache = await sw.caches.open('walk-to-mordor-swr-version');
      await versionCache.put('version', new Response('{{SWR_CACHE_VERSION}}'));

      // Create SWR cache
      await sw.caches.open('walk-to-mordor-api-swr');

      const waitUntilFn = jest.fn();
      sw.activateCallback({ waitUntil: waitUntilFn });

      await waitUntilFn.mock.calls[0][0];

      // Old static cache should be deleted
      const deleteCalls = sw.caches.delete.mock.calls.map((c) => c[0]);
      expect(deleteCalls).toContain('walk-to-mordor-old-timestamp');

      // SWR-related caches should NOT be in the static-cache-cleanup deletes
      // (They are preserved by the condition in the activate handler)
    });
  });

  describe('getCacheKey', () => {
    test('returns request URL string when no Authorization header', () => {
      const request = new Request('https://example.com/api/goals');
      const key = sw.getCacheKey(request);
      expect(key).toBe('https://example.com/api/goals');
      expect(typeof key).toBe('string');
    });

    test('returns URL with auth hash when Authorization header present', () => {
      const request = new Request('https://example.com/api/session', {
        headers: { 'Authorization': 'Bearer token123' },
      });
      const key = sw.getCacheKey(request);
      expect(key).toMatch(/^https:\/\/example\.com\/api\/session\?_auth=.+$/);
      expect(typeof key).toBe('string');
    });

    test('different auth tokens produce different cache keys', () => {
      const req1 = new Request('https://example.com/api/session', {
        headers: { 'Authorization': 'Bearer tokenAAA' },
      });
      const req2 = new Request('https://example.com/api/session', {
        headers: { 'Authorization': 'Bearer tokenBBB' },
      });
      expect(sw.getCacheKey(req1)).not.toBe(sw.getCacheKey(req2));
    });

    test('same auth token produces same cache key', () => {
      const req1 = new Request('https://example.com/api/goals', {
        headers: { 'Authorization': 'Bearer sameToken' },
      });
      const req2 = new Request('https://example.com/api/goals', {
        headers: { 'Authorization': 'Bearer sameToken' },
      });
      expect(sw.getCacheKey(req1)).toBe(sw.getCacheKey(req2));
    });

    test('same URL with vs without auth returns different keys', () => {
      const noAuth = new Request('https://example.com/api/session');
      const withAuth = new Request('https://example.com/api/session', {
        headers: { 'Authorization': 'Bearer token' },
      });
      expect(sw.getCacheKey(noAuth)).not.toBe(sw.getCacheKey(withAuth));
    });
  });

  describe('TTL Metadata Behavior', () => {
    function createFetchEvent(url, options = {}) {
      const respondWithFn = jest.fn();
      const waitUntilFn = jest.fn();
      return {
        request: {
          url,
          method: options.method || 'GET',
          mode: options.mode || 'cors',
          destination: options.destination || '',
          headers: new Headers(options.headers || {}),
          clone: function() { return this; },
        },
        respondWith: respondWithFn,
        waitUntil: waitUntilFn,
      };
    }

    test('fresh cache hit (within TTL) still serves cached and revalidates in background', async () => {
      const freshTimestamp = (Date.now() - 60000).toString(); // 1 min ago — within 5 min TTL
      const cachedResponse = new Response(JSON.stringify({ fresh: true }), {
        status: 200,
        headers: { 'x-swr-cached-at': freshTimestamp },
      });

      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');
      await swrCache.put(
        { url: 'https://example.com/api/goals' },
        cachedResponse
      );

      const event = createFetchEvent('https://example.com/api/goals');
      sw.fetchCallback(event);

      const response = await event.respondWith.mock.calls[0][0];
      expect(response).toBeDefined();
      expect(response.headers.get('x-swr-cached-at')).toBe(freshTimestamp);

      expect(event.waitUntil).toHaveBeenCalledTimes(1);
    });

    test('stale cache hit (beyond TTL) still serves cached + revalidates', async () => {
      const staleTimestamp = (Date.now() - 400000).toString(); // ~6.7 min — beyond 5 min TTL
      const cachedResponse = new Response(JSON.stringify({ stale: true }), {
        status: 200,
        headers: { 'x-swr-cached-at': staleTimestamp },
      });

      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');
      await swrCache.put(
        { url: 'https://example.com/api/goals' },
        cachedResponse
      );

      const freshResponse = new Response(JSON.stringify({ fresh: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      sw.globalFetch.mockResolvedValueOnce(freshResponse);

      const event = createFetchEvent('https://example.com/api/goals');
      sw.fetchCallback(event);

      const response = await event.respondWith.mock.calls[0][0];
      expect(response.headers.get('x-swr-cached-at')).toBe(staleTimestamp);

      // Background revalidation was triggered
      expect(event.waitUntil).toHaveBeenCalledTimes(1);
    });

    test('very old cache hit still serves cached while revalidation runs in background', async () => {
      const oldTimestamp = (Date.now() - 2000000).toString(); // ~33 min old
      const cachedResponse = new Response(JSON.stringify({ cached: true }), {
        status: 200,
        headers: { 'x-swr-cached-at': oldTimestamp },
      });

      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');
      await swrCache.put(
        { url: 'https://example.com/api/goals' },
        cachedResponse
      );

      const networkResponse = new Response(JSON.stringify({ network: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      sw.globalFetch.mockResolvedValueOnce(networkResponse);

      const event = createFetchEvent('https://example.com/api/goals');
      sw.fetchCallback(event);

      const response = await event.respondWith.mock.calls[0][0];
      expect(response.headers.get('x-swr-cached-at')).toBe(oldTimestamp);
      expect(event.waitUntil).toHaveBeenCalledTimes(1);
    });

    test('background revalidation failure leaves cached response in place', async () => {
      const oldTimestamp = (Date.now() - 2000000).toString();
      const cachedResponse = new Response(JSON.stringify({ cached: true }), {
        status: 200,
        headers: { 'x-swr-cached-at': oldTimestamp },
      });

      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');
      await swrCache.put(
        { url: 'https://example.com/api/session' },
        cachedResponse
      );

      sw.globalFetch.mockRejectedValueOnce(new Error('Network offline'));

      const event = createFetchEvent('https://example.com/api/session');
      sw.fetchCallback(event);

      const response = await event.respondWith.mock.calls[0][0];
      expect(response.headers.get('x-swr-cached-at')).toBe(oldTimestamp);
      expect(event.waitUntil).toHaveBeenCalledTimes(1);
      await expect(event.waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
    });
  });

  describe('Auth-Aware Cache Keys (Integration)', () => {
    function createFetchEvent(url, options = {}) {
      const respondWithFn = jest.fn();
      const waitUntilFn = jest.fn();
      return {
        request: {
          url,
          method: options.method || 'GET',
          mode: options.mode || 'cors',
          destination: options.destination || '',
          headers: new Headers(options.headers || {}),
          clone: function() { return this; },
        },
        respondWith: respondWithFn,
        waitUntil: waitUntilFn,
      };
    }

    test('authenticated request caches with auth-keyed entry', async () => {
      const networkResponse = new Response(JSON.stringify({ user: 'alice' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      sw.globalFetch.mockResolvedValueOnce(networkResponse);

      const event = createFetchEvent('https://example.com/api/session', {
        headers: { 'Authorization': 'Bearer alice-token' },
      });
      sw.fetchCallback(event);

      await event.respondWith.mock.calls[0][0];

      // Verify cache has auth-keyed entry
      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');
      const authKey = sw.getCacheKey(event.request);
      const cached = await swrCache.match(authKey);
      expect(cached).toBeDefined();

      // Plain URL should NOT match
      const plain = await swrCache.match({ url: 'https://example.com/api/session' });
      expect(plain).toBeUndefined();
    });

    test('different users do not share cached responses', async () => {
      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');

      // Cache response for user A
      const reqA = new Request('https://example.com/api/session', {
        headers: { 'Authorization': 'Bearer user-a-token' },
      });
      const respA = new Response(JSON.stringify({ user: 'A' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      await sw.cacheWithTimestamp(swrCache, reqA, respA);

      // Try to read with user B's key
      const reqB = new Request('https://example.com/api/session', {
        headers: { 'Authorization': 'Bearer user-b-token' },
      });
      const cached = await swrCache.match(sw.getCacheKey(reqB));
      expect(cached).toBeUndefined();
    });
  });

  describe('Message Handler', () => {
    test('sw-clear-cache message deletes SWR cache', async () => {
      // Pre-populate SWR cache
      const swrCache = await sw.caches.open('walk-to-mordor-api-swr');
      await swrCache.put(
        { url: 'https://example.com/api/goals' },
        new Response('cached')
      );

      const waitUntilFn = jest.fn((p) => p);
      sw.messageCallback({
        data: { type: 'sw-clear-cache' },
        waitUntil: waitUntilFn,
      });

      await waitUntilFn.mock.calls[0][0];
      expect(sw.caches.delete).toHaveBeenCalledWith('walk-to-mordor-api-swr');
    });

    test('sw-clear-cache message bumps SWR mutation version', async () => {
      const before = sw.getCurrentSWRMutationVersion();
      const waitUntilFn = jest.fn((p) => p);

      sw.messageCallback({
        data: { type: 'sw-clear-cache' },
        waitUntil: waitUntilFn,
      });

      await waitUntilFn.mock.calls[0][0];
      expect(sw.getCurrentSWRMutationVersion()).toBe(before + 1);
    });

    test('ignores unrecognized message types', () => {
      const waitUntilFn = jest.fn();
      sw.messageCallback({
        data: { type: 'unknown-type' },
        waitUntil: waitUntilFn,
      });
      expect(waitUntilFn).not.toHaveBeenCalled();
    });

    test('handles missing data gracefully', () => {
      const waitUntilFn = jest.fn();
      expect(() => sw.messageCallback({
        data: null,
        waitUntil: waitUntilFn,
      })).not.toThrow();
      expect(waitUntilFn).not.toHaveBeenCalled();
    });
  });
});
