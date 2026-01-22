// Build timestamp - this should be replaced during build process
const BUILD_TIMESTAMP = '{{BUILD_TIMESTAMP}}';
const CACHE_NAME = `walk-to-mordor-{{BUILD_TIMESTAMP}}`;
const urlsToCache = [
  '/',
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
            
            // Cache static assets but exclude distance-related API endpoints
            const url = event.request.url;
            const shouldCache = !url.includes('/api/calendar-progress') &&
                               !url.includes('/api/total-distance');
            
            if (shouldCache) {
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            
            return response;
          })
          .catch(() => {
            // If both cache and network fail, return a basic offline page
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/').then((cachedResponse) => {
                if (cachedResponse) {
                  return cachedResponse;
                }
                // Return a basic offline message
                return new Response('Offline - Please check your connection', {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'text/plain' }
                });
              });
            }
          });
      })
  );
});
