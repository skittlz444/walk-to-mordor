import { User } from "./auth/session";

export function renderHtml(totalDistance?: number, user?: User | null) {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Walk to Mordor</title>
        
        <!-- PWA Meta Tags -->
        <meta name="description" content="Track your walking progress on the journey to Mordor" />
        <meta name="theme-color" content="#0f3460" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Walk to Mordor" />
        
        <!-- Web App Manifest -->
        <link rel="manifest" href="wtm/manifest.json" />
        
        <!-- Favicon and App Icons -->
        <link rel="icon" type="image/svg+xml" href="wtm/icons/icon.svg" />
        <link rel="apple-touch-icon" href="wtm/icons/icon-192x192.png" />
        
        <!-- Stylesheets -->
        <link href="wtm/css/mobiscroll.javascript.min.css" rel="stylesheet" />
        <link href="wtm/css/main.css" rel="stylesheet" />
        
        <!-- Scripts -->
        <script src="wtm/js/mobiscroll.javascript.min.js" defer></script>
        <script src="wtm/js/main.js" defer></script>
        
        <!-- Service Worker Registration -->
        <script>
          // Global authentication state
          window.WTM_AUTH = {
            isAuthenticated: ${user ? 'true' : 'false'},
            user: ${user ? JSON.stringify({
              id: user.id,
              email: user.email,
              name: user.name,
              samsungHealthConnected: !!user.samsung_health_linked_at
            }) : 'null'}
          };
          
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('wtm/sw.js')
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
      <header>
        <h1>Total distance travelled</h1>
        <div id="total-distance-value">${totalDistance ?? 0} km</div>
        <div id="last-goal"></div>
        ${user ? `
        <div id="user-info">
          <div class="user-details">
            <span>Welcome, ${user.name || user.email}!</span>
            ${user.samsung_health_linked_at ? 
              '<span class="samsung-status">📱 Samsung Health Connected</span>' : 
              '<span class="samsung-status">📱 Samsung Health Not Connected</span>'
            }
          </div>
          <div class="user-actions">
            ${!user.samsung_health_linked_at ? 
              '<button id="link-samsung-btn" class="auth-btn">Link Samsung Health</button>' : ''
            }
            <button id="logout-btn" class="auth-btn">Logout</button>
          </div>
        </div>
        ` : `
        <div id="auth-section">
          <div class="auth-prompt">
            <p>Sign in to sync your walking data and access personal progress tracking</p>
          </div>
          <div class="auth-buttons">
            <button id="google-login-btn" class="auth-btn google-btn">
              <span class="auth-icon">🔍</span>
              Sign in with Google
            </button>
            <button id="facebook-login-btn" class="auth-btn facebook-btn">
              <span class="auth-icon">📘</span>
              Sign in with Facebook
            </button>
          </div>
        </div>
        `}
      </header>
      <section id="goals-section">
        <div id="goals-list"></div>
      </section>
      <div id="eventcalendar-container">
        <div id="eventcalendar"></div>
      </div>
      <div id="popup"></div>
      <div id="goal-popup"></div>
      </body>
    </html>
`;
}
