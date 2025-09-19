export function renderHtml(totalDistance?: number) {
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
        <link rel="manifest" href="/wtm/manifest.json" />
        
        <!-- Favicon and App Icons -->
        <link rel="icon" type="image/svg+xml" href="/wtm/icons/icon.svg" />
        <link rel="apple-touch-icon" href="/wtm/icons/icon-192x192.png" />
        
        <!-- Stylesheets -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link href="wtm/css/main.css" rel="stylesheet" />
        
        <!-- Service Worker Registration -->
        <script>
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/wtm/sw.js')
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
        <div class="header-top">
          <div class="auth-section" id="auth-section">
            <div id="login-section" style="display: none;">
              <button id="google-login-btn" class="auth-btn google-btn">
                <i class="fab fa-google"></i> Sign in with Google
              </button>
            </div>
            <div id="user-section" style="display: none;">
              <div class="user-info">
                <span id="user-email"></span>
                <div class="user-actions">
                  <button id="profile-btn" class="auth-btn profile-btn">
                    <i class="fas fa-user"></i> Profile
                  </button>
                  <button id="logout-btn" class="auth-btn logout-btn">
                    <i class="fas fa-sign-out-alt"></i> Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <h1>Total distance travelled</h1>
        <div id="total-distance-value">${totalDistance ?? 0} km</div>
        <div id="last-goal"></div>
      </header>
      <section id="goals-section">
        <div id="goals-list"></div>
      </section>
      <div id="eventcalendar-container">
        <div id="eventcalendar"></div>
      </div>
      
      <!-- User Profile Modal -->
      <div id="profile-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content profile-modal">
          <div class="modal-header">
            <h3>User Profile</h3>
            <button class="modal-close" id="profile-modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="profile-section">
              <h4>Samsung Health Integration</h4>
              <div id="samsung-health-section">
                <div id="samsung-not-linked" style="display: none;">
                  <p>Connect your Samsung Health account to automatically sync your daily walking data.</p>
                  <button id="link-samsung-btn" class="auth-btn samsung-btn">
                    <i class="fas fa-link"></i> Link Samsung Health
                  </button>
                </div>
                <div id="samsung-linked" style="display: none;">
                  <p><i class="fas fa-check-circle" style="color: green;"></i> Samsung Health is connected</p>
                  <button id="unlink-samsung-btn" class="auth-btn unlink-btn">
                    <i class="fas fa-unlink"></i> Unlink Samsung Health
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Scripts -->
      <script src="https://apis.google.com/js/gapi.js" async defer></script>
      <script src="https://accounts.google.com/gsi/client" async defer></script>
      <script src="wtm/js/auth.js"></script>
      <script src="wtm/js/main.js"></script>
      </body>
    </html>
`;
}
