// Build timestamp - this should be replaced during build process
const BUILD_TIMESTAMP = '{{BUILD_TIMESTAMP}}';
const CACHE_NAME = `walk-to-mordor-{{BUILD_TIMESTAMP}}`;
const urlsToCache = [
  '/css/main.css',
  '/css/mobiscroll.javascript.min.css',
  '/js/main.js',
  '/js/mobiscroll.javascript.min.js',
  '/manifest.json'
];

// SWR (Stale-While-Revalidate) API caching
const SWR_CACHE_NAME = 'walk-to-mordor-api-swr';
const SWR_CACHE_VERSION = '{{SWR_CACHE_VERSION}}';
const SWR_VERSION_CACHE_NAME = 'walk-to-mordor-swr-version';
const SWR_TTL_MS = 300000; // 5 minutes
const SWR_UNSAFE_CACHE_HEADERS = [
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'upgrade'
];

const SWR_ENDPOINTS = [
  '/api/session',
  '/api/goals',
  '/api/calendar-progress',
  '/api/total-distance',
  '/api/user/parties',
  '/api/friends'
];

// Monotonic mutation version to prevent stale in-flight GET revalidations
// from re-populating SWR cache after a successful API mutation.
let swrMutationVersion = 0;

function isSWREndpoint(pathname) {
  return SWR_ENDPOINTS.includes(pathname);
}

function getCurrentSWRMutationVersion() {
  return swrMutationVersion;
}

function bumpSWRMutationVersion() {
  swrMutationVersion += 1;
  return swrMutationVersion;
}

function getCacheKey(request) {
  var authHeader = request.headers.get('Authorization') || '';
  if (!authHeader) return request.url;
  var hash = Array.from(authHeader).reduce(function(h, c) {
    return ((h << 5) - h + c.charCodeAt(0)) | 0;
  }, 0);
  return request.url + '?_auth=' + hash.toString(36);
}

async function cacheWithTimestamp(cache, request, response) {
  const headers = new Headers(response.headers);
  SWR_UNSAFE_CACHE_HEADERS.forEach(function(headerName) {
    headers.delete(headerName);
  });
  headers.set('x-swr-cached-at', Date.now().toString());
  const timestamped = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
  await cache.put(getCacheKey(request), timestamped);
}

async function notifyClients(url) {
  var clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(function(client) {
    client.postMessage({ type: 'sw-cache-updated', url: url });
  });
}

async function revalidateAndNotify(request, swrCache, requestMutationVersion) {
  var mutationVersionAtStart = typeof requestMutationVersion === 'number'
    ? requestMutationVersion
    : getCurrentSWRMutationVersion();
  try {
    var response = await fetch(request);
    if (response && response.ok) {
      if (mutationVersionAtStart !== getCurrentSWRMutationVersion()) {
        return;
      }
      await cacheWithTimestamp(swrCache, request, response.clone());
      await notifyClients(request.url);
    }
  } catch (err) {
    // Background revalidation failed silently — cached data still served
  }
}

async function fetchAndCache(request, swrCache, requestMutationVersion) {
  var mutationVersionAtStart = typeof requestMutationVersion === 'number'
    ? requestMutationVersion
    : getCurrentSWRMutationVersion();
  var response = await fetch(request);
  if (response && response.ok) {
    if (mutationVersionAtStart === getCurrentSWRMutationVersion()) {
      await cacheWithTimestamp(swrCache, request, response.clone());
    }
  }
  return response;
}

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Service Worker: Cache failed:', error);
      })
  );
});

// Activate event - clean up old caches and handle SWR version busting
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up old static asset caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== SWR_CACHE_NAME && cacheName !== SWR_VERSION_CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Check SWR cache version and bust if changed
      (async () => {
        var versionCache = await caches.open(SWR_VERSION_CACHE_NAME);
        var storedVersion = await versionCache.match('version');
        var storedVersionText = storedVersion ? await storedVersion.text() : null;

        if (storedVersionText !== SWR_CACHE_VERSION) {
          await caches.delete(SWR_CACHE_NAME);
          await versionCache.put('version', new Response(SWR_CACHE_VERSION));
        }
      })()
    ])
  );
});

// Fetch event - serve from cache when offline, fallback to network
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Invalidate SWR cache on same-origin API mutations (PUT/POST/DELETE/PATCH)
  if (requestUrl.origin === self.location.origin && requestUrl.pathname.startsWith('/api/') && event.request.method !== 'GET') {
    bumpSWRMutationVersion();
    event.waitUntil(
      caches.open(SWR_CACHE_NAME).then(function(cache) {
        return cache.keys().then(function(keys) {
          return Promise.all(keys.map(function(key) { return cache.delete(key); }));
        });
      })
    );
    return;
  }

  // Skip non-GET requests (non-API, e.g. form POSTs)
  if (event.request.method !== 'GET') {
    return;
  }

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // API requests: SWR for allowlisted endpoints, network-only for the rest.
  if (requestUrl.pathname.startsWith('/api/')) {
    if (isSWREndpoint(requestUrl.pathname)) {
      var requestMutationVersion = getCurrentSWRMutationVersion();
      var swrCachePromise = caches.open(SWR_CACHE_NAME);
      event.respondWith(
        swrCachePromise.then(function(swrCache) {
          return swrCache.match(getCacheKey(event.request)).then(function(cached) {
            if (cached) {
              var cachedAt = parseInt(cached.headers.get('x-swr-cached-at') || '0', 10);
              var isStale = cachedAt > 0 && Date.now() - cachedAt > SWR_TTL_MS;
              if (isStale) {
                // Stale entries are still served while background revalidation refreshes the cache.
                event.waitUntil(revalidateAndNotify(event.request, swrCache, requestMutationVersion));
                return cached;
              }
              // Fresh entries still revalidate in the background so every cache hit follows SWR.
              event.waitUntil(revalidateAndNotify(event.request, swrCache, requestMutationVersion));
              return cached;
            }
            // Cold cache: network-first, then cache
            return fetchAndCache(event.request, swrCache, requestMutationVersion);
          });
        })
      );
    } else {
      // Non-SWR API endpoints: network-only (existing behavior)
      event.respondWith(fetch(event.request));
    }
    return;
  }

  // Never cache HTML navigations to avoid stale redirect/auth behavior.
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response('Offline - Please check your connection', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      })
    );
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response;
        }
        
        // Fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            const responseToCache = response.clone();

            // Cache only static assets.
            const isStaticAsset =
              event.request.destination === 'style' ||
              event.request.destination === 'script' ||
              event.request.destination === 'image' ||
              event.request.destination === 'font' ||
              event.request.destination === 'manifest' ||
              requestUrl.pathname.startsWith('/css/') ||
              requestUrl.pathname.startsWith('/js/') ||
              requestUrl.pathname === '/manifest.json';
            
            if (isStaticAsset) {
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            
            return response;
          })
          .catch(() => {
            // Return a basic offline message when cache and network fail.
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return new Response('Offline - Please check your connection', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain' }
              });
            }
            return Response.error();
          });
      })
  );
});

// Message handler — clear SWR cache on auth change or explicit request
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'sw-clear-cache') {
    bumpSWRMutationVersion();
    event.waitUntil(caches.delete(SWR_CACHE_NAME));
  }
});
