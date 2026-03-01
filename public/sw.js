// Build timestamp - this should be replaced during build process
const BUILD_TIMESTAMP = '20260301-081902';
const CACHE_NAME = `walk-to-mordor-20260301-081902`;
const urlsToCache = [
  '/css/main.css',
  '/css/mobiscroll.javascript.min.css',
  '/js/main.js',
  '/js/mobiscroll.javascript.min.js',
  '/manifest.json'
];

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

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
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

  // Never cache API responses - always fetch fresh auth/session/preferences data.
  if (requestUrl.pathname.startsWith('/api/')) {
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
