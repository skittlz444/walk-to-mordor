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
              <!-- Login Form -->
              <div id="login-form-container" class="auth-form-container">
                <form id="login-form" class="auth-form">
                  <h3>Login</h3>
                  <div class="form-group">
                    <input type="text" name="username" placeholder="Username" required>
                  </div>
                  <div class="form-group">
                    <input type="password" name="password" placeholder="Password" required>
                  </div>
                  <div id="login-error" class="error-message" style="display: none;"></div>
                  <button type="submit" class="auth-btn login-btn">Login</button>
                  <p class="auth-link">
                    Don't have an account? <a href="#" id="show-register-link">Register here</a>
                  </p>
                </form>
              </div>
              
              <!-- Register Form -->
              <div id="register-form-container" class="auth-form-container" style="display: none;">
                <form id="register-form" class="auth-form">
                  <h3>Register</h3>
                  <div class="form-group">
                    <input type="text" name="username" placeholder="Username" required>
                  </div>
                  <div class="form-group">
                    <input type="email" name="email" placeholder="Email" required>
                  </div>
                  <div class="form-group">
                    <input type="password" name="password" placeholder="Password" required>
                  </div>
                  <div class="form-group">
                    <input type="password" name="confirm-password" placeholder="Confirm Password" required>
                  </div>
                  <div id="register-error" class="error-message" style="display: none;"></div>
                  <button type="submit" class="auth-btn register-btn">Register</button>
                  <p class="auth-link">
                    Already have an account? <a href="#" id="show-login-link">Login here</a>
                  </p>
                </form>
              </div>
            </div>
            <div id="user-section" style="display: none;">
              <div class="user-info">
                <span id="user-display"></span>
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
      <script src="wtm/js/auth.js"></script>
      <script src="wtm/js/main.js"></script>
      </body>
    </html>
`;
}
