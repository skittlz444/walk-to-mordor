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
const PUSH_CONFIG_CACHE_NAME = 'walk-to-mordor-push-config';
const PUSH_CONFIG_KEY = '/__wtm_push_config__';
const DEFAULT_PUSH_URL = '/journey';
const DEFAULT_PUSH_ICON = '/icons/icon-192x192.png';
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

function urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData = atob(base64);
  var outputArray = new Uint8Array(rawData.length);

  for (var i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function persistPushAuth(sessionToken) {
  var cache = await caches.open(PUSH_CONFIG_CACHE_NAME);

  if (!sessionToken) {
    await cache.delete(PUSH_CONFIG_KEY);
    return;
  }

  await cache.put(
    PUSH_CONFIG_KEY,
    new Response(JSON.stringify({ sessionToken: sessionToken }), {
      headers: { 'content-type': 'application/json' }
    })
  );
}

async function readPushAuth() {
  var cache = await caches.open(PUSH_CONFIG_CACHE_NAME);
  var response = await cache.match(PUSH_CONFIG_KEY);

  if (!response) {
    return null;
  }

  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

async function broadcastToClients(message) {
  var clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clientList.forEach(function(client) {
    client.postMessage(message);
  });
}

async function fetchPushVapidKey() {
  var response = await fetch('/api/push/vapid-key');
  if (!response.ok) {
    throw new Error('Unable to fetch VAPID key');
  }

  var payload = await response.json();
  var vapidPublicKey = payload && payload.data ? payload.data.vapidPublicKey : null;
  if (!vapidPublicKey) {
    throw new Error('Push notifications are not configured');
  }

  return vapidPublicKey;
}

function normalizePushPayload(rawPayload) {
  var payload = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};
  return {
    title: typeof payload.title === 'string' && payload.title ? payload.title : 'Walk to Mordor',
    body: typeof payload.body === 'string' ? payload.body : '',
    url: typeof payload.url === 'string' && payload.url ? payload.url : DEFAULT_PUSH_URL,
    icon: typeof payload.icon === 'string' && payload.icon ? payload.icon : DEFAULT_PUSH_ICON,
  };
}

async function handlePushEvent(event) {
  var rawPayload = {};

  if (event.data) {
    try {
      rawPayload = await event.data.json();
    } catch (_error) {
      rawPayload = {
        title: 'Walk to Mordor',
        body: await event.data.text(),
      };
    }
  }

  var payload = normalizePushPayload(rawPayload);
  await self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: payload.icon,
    data: { url: payload.url },
  });
}

async function handleNotificationClick(event) {
  var notificationUrl = event.notification && event.notification.data && typeof event.notification.data.url === 'string'
    ? event.notification.data.url
    : DEFAULT_PUSH_URL;
  var targetUrl = new URL(notificationUrl, self.location.origin).toString();
  var targetOrigin = new URL(targetUrl).origin;
  var clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  for (var i = 0; i < clientList.length; i += 1) {
    var client = clientList[i];
    if (client.url === targetUrl && typeof client.focus === 'function') {
      await client.focus();
      return;
    }
  }

  // Fall back to any same-origin window — navigate it to the target URL then focus
  for (var i = 0; i < clientList.length; i += 1) {
    var client = clientList[i];
    try {
      if (new URL(client.url).origin === targetOrigin) {
        if (typeof client.navigate === 'function') {
          await client.navigate(targetUrl);
        }
        if (typeof client.focus === 'function') {
          await client.focus();
        }
        return;
      }
    } catch (e) {
      // skip clients with unparseable URLs
    }
  }

  if (typeof self.clients.openWindow === 'function') {
    await self.clients.openWindow(targetUrl);
  }
}

async function handlePushSubscriptionChange() {
  var pushAuth = await readPushAuth();
  if (!pushAuth || !pushAuth.sessionToken) {
    await broadcastToClients({ type: 'sw-push-resubscribe-required' });
    return;
  }

  try {
    var vapidPublicKey = await fetchPushVapidKey();
    var subscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    var json = subscription.toJSON();
    if (!json.keys || !json.keys.auth || !json.keys.p256dh) {
      throw new Error('Push subscription is missing required keys');
    }

    var response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer ' + pushAuth.sessionToken,
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          auth: json.keys && json.keys.auth,
          p256dh: json.keys && json.keys.p256dh,
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        await persistPushAuth('');
      }
      throw new Error('Unable to sync refreshed push subscription');
    }
  } catch (_error) {
    await broadcastToClients({ type: 'sw-push-resubscribe-required' });
  }
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

self.addEventListener('push', function(event) {
  event.waitUntil(handlePushEvent(event));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(handleNotificationClick(event));
});

self.addEventListener('pushsubscriptionchange', function(event) {
  event.waitUntil(handlePushSubscriptionChange());
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
    return;
  }

  if (event.data && event.data.type === 'sw-set-push-auth') {
    event.waitUntil(persistPushAuth(event.data.sessionToken));
    return;
  }

  if (event.data && event.data.type === 'sw-clear-push-auth') {
    event.waitUntil(persistPushAuth(''));
    return;
  }
});
