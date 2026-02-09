export function renderMapPage() {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Map - Walk to Mordor</title>
        
        <!-- PWA Meta Tags -->
        <meta name="description" content="Track your walking progress on the journey to Mordor" />
        <meta name="theme-color" content="#0f3460" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Walk to Mordor" />
        
        <!-- Web App Manifest -->
        <link rel="manifest" href="/manifest.json" />
        
        <!-- Favicon and App Icons -->
        <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        
        <!-- Stylesheets -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link href="/css/main.css" rel="stylesheet" />
        <link href="/css/drawer.css" rel="stylesheet" />
        <link href="/css/map.css" rel="stylesheet" />
        
        <!-- Service Worker Registration -->
        <script>
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                  console.log('SW registered: ', registration);
                })
                .catch((registrationError) => {
                  console.log('SW registration failed: ', registrationError);
                });
            });
          }
        </script>
      </head>
      <body>
        <!-- Drawer overlay -->
        <div id="drawer-overlay" class="drawer-overlay" onclick="closeDrawer();"></div>
        
        <!-- Side drawer -->
        <aside id="drawer" class="drawer">
          <div class="drawer-header">
            <h2>Menu</h2>
            <button class="drawer-close" onclick="closeDrawer();" aria-label="Close menu">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <nav class="drawer-nav">
            <a href="/" class="drawer-link">
              <i class="fas fa-home"></i>
              <span>Dashboard</span>
            </a>
            <a href="/map" class="drawer-link active">
              <i class="fas fa-map"></i>
              <span>Map</span>
            </a>
            <button class="drawer-link" onclick="showProfileModal();">
              <i class="fas fa-user"></i>
              <span>Profile</span>
            </button>
          </nav>
        </aside>
        
        <!-- Main content -->
        <header class="map-header">
          <button type="button" class="hamburger-icon" aria-label="Open menu" title="Menu" onclick="openDrawer();">
            <i class="fas fa-bars"></i>
          </button>
          <h1>Middle-earth Map</h1>
          <div class="header-spacer"></div>
        </header>
        
        <main class="map-main">
          <!-- Map Island - Preact component will hydrate here -->
          <div id="map-root" data-island="MapIsland"></div>
        </main>
        
        <!-- Preact Islands - Load before vanilla JS that depends on it -->
        <script type="module" src="/js/client/islands.js"></script>
        
        <!-- Scripts -->
        <script src="/js/validators.js"></script>
        <script src="/js/profile.js"></script>
        <script src="/js/map.js"></script>
      </body>
    </html>
`;
}
