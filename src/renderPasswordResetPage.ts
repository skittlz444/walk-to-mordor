// Render password reset pages

export function renderPasswordResetRequestPage() {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Password Reset - Walk to Mordor</title>
        
        <!-- PWA Meta Tags -->
        <meta name="description" content="Reset your password for Walk to Mordor" />
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
            <p>Password Reset</p>
          </header>
          
          <div class="auth-forms">
            <div class="auth-form active">
              <h2>Reset Your Password</h2>
              <p>Enter your email address and we'll generate a password reset token for you.</p>
              <form id="password-reset-request-form">
                <div class="form-group">
                  <label for="reset-email">Email</label>
                  <input type="email" id="reset-email" name="email" required autocomplete="email" />
                </div>
                <div id="reset-error" class="error-message"></div>
                <div id="reset-success" class="success-message"></div>
                <button type="submit" class="btn-primary">Request Password Reset</button>
              </form>
              <p class="auth-toggle">
                <a href="/login">Back to Login</a>
              </p>
            </div>
          </div>
        </div>
        
        <!-- Scripts -->
        <script src="/js/password-reset.js"></script>
      </body>
    </html>
  `;
}

export function renderPasswordResetPage() {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Set New Password - Walk to Mordor</title>
        
        <!-- PWA Meta Tags -->
        <meta name="description" content="Set your new password for Walk to Mordor" />
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
            <p>Set New Password</p>
          </header>
          
          <div class="auth-forms">
            <div class="auth-form active">
              <h2>Set Your New Password</h2>
              <form id="password-reset-form">
                <input type="hidden" id="reset-token" name="token" />
                <div class="form-group">
                  <label for="new-password">New Password</label>
                  <input type="password" id="new-password" name="password" required autocomplete="new-password" />
                  <small>At least 8 characters with uppercase, lowercase, and number/symbol</small>
                </div>
                <div id="password-strength" class="password-strength">
                  <div class="strength-item" id="strength-length">✗ At least 8 characters</div>
                  <div class="strength-item" id="strength-upper">✗ One uppercase letter</div>
                  <div class="strength-item" id="strength-lower">✗ One lowercase letter</div>
                  <div class="strength-item" id="strength-number">✗ One number or symbol</div>
                </div>
                <div id="reset-error" class="error-message"></div>
                <div id="reset-success" class="success-message"></div>
                <button type="submit" class="btn-primary">Set New Password</button>
              </form>
              <p class="auth-toggle">
                <a href="/login">Back to Login</a>
              </p>
            </div>
          </div>
        </div>
        
        <!-- Scripts -->
        <script src="/js/password-reset.js"></script>
      </body>
    </html>
  `;
}
