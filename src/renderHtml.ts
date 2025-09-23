export function renderHtml() {
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
        <link href="/wtm/css/main.css" rel="stylesheet" />
        <link href="/wtm/css/auth.css" rel="stylesheet" />
        
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
        <div class="header-actions">
          <div class="user-dropdown">
            <button id="user-menu-btn" class="user-menu-toggle" onclick="toggleUserMenu()">
              <i class="fas fa-user"></i>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div id="user-dropdown-menu" class="user-dropdown-menu">
              <button onclick="handleSamsungHealthLink()">
                <i class="fas fa-link"></i>
                Link Samsung Health
              </button>
              <button onclick="handleLogout()">
                <i class="fas fa-sign-out-alt"></i>
                Logout
              </button>
            </div>
          </div>
        </div>
        <h1>Total distance travelled</h1>
        <div id="total-distance-value">Loading...</div>
        <div id="last-goal"></div>
      </header>
      <section id="goals-section">
        <div id="goals-list"></div>
      </section>
      <div id="eventcalendar-container">
        <div id="eventcalendar"></div>
      </div>
      
      <!-- Scripts -->
      <script src="/wtm/js/validators.js"></script>
      <script src="/wtm/js/calendar.js"></script>
      <script src="/wtm/js/progress.js"></script>
      <script src="/wtm/js/goals.js"></script>
      <script src="/wtm/js/auth.js"></script>
      <script src="/wtm/js/samsung-health.js"></script>
      <script src="/wtm/js/main.js"></script>
      </body>
    </html>
`;
}

export function renderAuthHtml() {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Walk to Mordor - Login</title>
        
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
        <link href="/wtm/css/main.css" rel="stylesheet" />
        <link href="/wtm/css/auth.css" rel="stylesheet" />
      </head>
      <body class="auth-page">
        <div class="auth-container">
          <div class="auth-header">
            <h1>Walk to Mordor</h1>
            <p>Track your walking progress on the journey to Mordor</p>
          </div>
          
          <div class="auth-forms">
            <!-- Login Form -->
            <div id="login-form" class="auth-form active">
              <h2>Login</h2>
              <form onsubmit="handleLogin(event)">
                <div class="form-group">
                  <label for="login-username">Username</label>
                  <input 
                    type="text" 
                    id="login-username" 
                    name="username" 
                    required 
                    autocomplete="username"
                  />
                </div>
                <div class="form-group">
                  <label for="login-password">Password</label>
                  <input 
                    type="password" 
                    id="login-password" 
                    name="password" 
                    required 
                    autocomplete="current-password"
                  />
                </div>
                <button type="submit" class="auth-button">Login</button>
                <div class="auth-links">
                  <a href="#" onclick="showRegister()">Don't have an account? Register</a>
                </div>
              </form>
            </div>
            
            <!-- Register Form -->
            <div id="register-form" class="auth-form">
              <h2>Register</h2>
              <form onsubmit="handleRegister(event)">
                <div class="form-group">
                  <label for="register-username">Username</label>
                  <input 
                    type="text" 
                    id="register-username" 
                    name="username" 
                    required 
                    pattern="[a-zA-Z0-9_-]{3,20}"
                    title="3-20 characters, letters, numbers, underscores, and hyphens only"
                    autocomplete="username"
                  />
                  <small>3-20 characters, letters, numbers, underscores, and hyphens only</small>
                </div>

                <div class="form-group">
                  <label for="register-password">Password</label>
                  <input 
                    type="password" 
                    id="register-password" 
                    name="password" 
                    required 
                    minlength="8"
                    pattern="^(?=.*[a-zA-Z])(?=.*\\d).{8,}$"
                    title="At least 8 characters with letters and numbers"
                    autocomplete="new-password"
                  />
                  <small>At least 8 characters with letters and numbers</small>
                </div>
                <button type="submit" class="auth-button">Register</button>
                <div class="auth-links">
                  <a href="#" onclick="showLogin()">Already have an account? Login</a>
                </div>
              </form>
            </div>
            
            <!-- Password Reset Form removed (no email required) -->
          </div>
          
          <div id="auth-message" class="auth-message"></div>
        </div>
        
        <!-- Scripts -->
        <script src="/wtm/js/auth.js"></script>
      </body>
    </html>
`;
}
