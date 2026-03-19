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
const SWR_CACHE_VERSION = '{{SWR_CACHE_VERSION}}';
const SWR_CACHE_NAME = 'walk-to-mordor-api-swr';
const SWR_VERSION_CACHE = 'walk-to-mordor-swr-version';
const SWR_TTL_MS = 300000; // 5 minutes

const SWR_ENDPOINTS = [
  '/api/session',
  '/api/goals',
  '/api/calendar-progress',
  '/api/total-distance',
  '/api/user/parties',
  '/api/friends'
];

function isSWREndpoint(pathname) {
  return SWR_ENDPOINTS.includes(pathname);
}

async function cacheWithTimestamp(cache, request, response) {
  var headers = new Headers(response.headers);
  headers.set('x-swr-cached-at', Date.now().toString());
  var timestamped = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
  await cache.put(request, timestamped);
}

async function notifyClients(url) {
  var clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(function(client) {
    client.postMessage({ type: 'sw-cache-updated', url: url });
  });
}

async function revalidateAndNotify(request, swrCache) {
  try {
    var response = await fetch(request);
    if (response && response.ok) {
      await cacheWithTimestamp(swrCache, request, response.clone());
      await notifyClients(request.url);
    }
  } catch (err) {
    // Network failure during revalidation — stale cache remains valid
  }
}

async function fetchAndCache(request, swrCache) {
  try {
    var response = await fetch(request);
    if (response && response.ok) {
      await cacheWithTimestamp(swrCache, request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Network error', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
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

// Activate event - clean up old caches and check SWR version
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up old static asset caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Keep current static cache, SWR cache, and SWR version cache
            if (cacheName !== CACHE_NAME &&
                cacheName !== SWR_CACHE_NAME &&
                cacheName !== SWR_VERSION_CACHE) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Check SWR cache version — bust if schema changed
      caches.open(SWR_VERSION_CACHE).then(function(versionCache) {
        return versionCache.match('version').then(function(storedVersion) {
          if (!storedVersion) {
            return versionCache.put('version', new Response(SWR_CACHE_VERSION));
          }
          return storedVersion.text().then(function(storedVersionText) {
            if (storedVersionText !== SWR_CACHE_VERSION) {
              return caches.delete(SWR_CACHE_NAME).then(function() {
                return versionCache.put('version', new Response(SWR_CACHE_VERSION));
              });
            }
          });
        });
      })
    ])
  );
});

// Fetch event - serve from cache when offline, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // SWR caching for allowlisted API endpoints
  if (requestUrl.pathname.startsWith('/api/')) {
    if (isSWREndpoint(requestUrl.pathname)) {
      event.respondWith(
        caches.open(SWR_CACHE_NAME).then(function(swrCache) {
          return swrCache.match(event.request).then(function(cached) {
            if (cached) {
              // Return cached immediately, revalidate in background
              event.waitUntil(revalidateAndNotify(event.request, swrCache));
              return cached;
            }
            // Network-first on cold cache
            return fetchAndCache(event.request, swrCache);
          });
        })
      );
      return;
    }
    // Non-SWR API endpoints: network-only
    event.respondWith(fetch(event.request));
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
