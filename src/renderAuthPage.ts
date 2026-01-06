// Render authentication pages (login/register)

export function renderAuthPage() {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Login - Walk to Mordor</title>
        
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
        <link href="/css/main.css" rel="stylesheet" />
        <link href="/css/auth.css" rel="stylesheet" />
      </head>
      <body>
        <div class="auth-container">
          <header class="auth-header">
            <h1>Walk to Mordor</h1>
            <p>Track your journey through Middle-earth</p>
          </header>
          
          <div class="auth-forms">
            <!-- Login Form -->
            <div id="login-form-container" class="auth-form active">
              <h2>Login</h2>
              <form id="login-form">
                <div class="form-group">
                  <label for="login-username">Username</label>
                  <input type="text" id="login-username" name="username" required autocomplete="username" />
                </div>
                <div class="form-group">
                  <label for="login-password">Password</label>
                  <input type="password" id="login-password" name="password" required autocomplete="current-password" />
                </div>
                <div id="login-error" class="error-message"></div>
                <button type="submit" class="btn-primary">Login</button>
              </form>
              <p class="auth-toggle">
                Don't have an account? <a href="#" id="show-register">Register here</a>
              </p>
            </div>
            
            <!-- Registration Form -->
            <div id="register-form-container" class="auth-form">
              <h2>Register</h2>
              <form id="register-form">
                <div class="form-group">
                  <label for="register-username">Username</label>
                  <input type="text" id="register-username" name="username" required autocomplete="username" 
                         pattern="[a-zA-Z0-9_]{3,30}" title="3-30 characters, letters, numbers, and underscores only" />
                  <small>3-30 characters, letters, numbers, and underscores only</small>
                </div>
                <div class="form-group">
                  <label for="register-email">Email</label>
                  <input type="email" id="register-email" name="email" required autocomplete="email" />
                </div>
                <div class="form-group">
                  <label for="register-password">Password</label>
                  <input type="password" id="register-password" name="password" required autocomplete="new-password" />
                  <small>At least 8 characters with uppercase, lowercase, and number/symbol</small>
                </div>
                <div id="password-strength" class="password-strength">
                  <div class="strength-item" id="strength-length">✗ At least 8 characters</div>
                  <div class="strength-item" id="strength-upper">✗ One uppercase letter</div>
                  <div class="strength-item" id="strength-lower">✗ One lowercase letter</div>
                  <div class="strength-item" id="strength-number">✗ One number or symbol</div>
                </div>
                <div id="register-error" class="error-message"></div>
                <div id="register-success" class="success-message"></div>
                <button type="submit" class="btn-primary">Register</button>
              </form>
              <p class="auth-toggle">
                Already have an account? <a href="#" id="show-login">Login here</a>
              </p>
            </div>
          </div>
        </div>
        
        <!-- Scripts -->
        <script src="/js/auth.js"></script>
      </body>
    </html>
  `;
}
