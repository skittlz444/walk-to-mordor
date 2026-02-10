import { validateSession } from './auth-handlers';

function renderMapPage() {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Walk to Mordor - Middle Earth</title>
        
        <!-- PWA Meta Tags -->
        <meta name="description" content="Explore your journey across Middle-earth" />
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
      <body class="map-page">
        <header class="map-header">
          <div class="header-controls">
            <div data-island="DrawerIsland"></div>
          </div>
          <h1>Middle Earth</h1>
        </header>
        <main class="map-main">
          <div class="map-shell" data-island="MapIsland"></div>
        </main>
        
        <!-- Preact Islands -->
        <script type="module" src="/js/client/islands.js"></script>
        
        <!-- Scripts -->
        <script src="/js/profile.js"></script>
        <script src="/js/main.js"></script>
      </body>
    </html>
  `;
}

export async function handleMapPage(request: Request, env: any): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const sessionValidation = await validateSession(request, env);
    if (!sessionValidation.valid) {
      return sessionValidation.error;
    }
  }

  return new Response(renderMapPage(), {
    headers: {
      'content-type': 'text/html',
    },
  });
}
