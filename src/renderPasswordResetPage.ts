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
        <link rel="stylesheet" href="/js/client/islands.css" />
      </head>
      <body>
        <div class="auth-container">
          <header class="auth-header">
            <h1>Walk to Mordor</h1>
            <p>Password Reset</p>
          </header>
          
          <div data-island="PasswordResetIsland" data-mode="request"></div>
        </div>
        
        <!-- Scripts -->
        <script type="module" src="/js/client/islands.js"></script>
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
        <link rel="stylesheet" href="/js/client/islands.css" />
      </head>
      <body>
        <div class="auth-container">
          <header class="auth-header">
            <h1>Walk to Mordor</h1>
            <p>Set New Password</p>
          </header>
          
          <div data-island="PasswordResetIsland" data-mode="reset"></div>
        </div>
        
        <!-- Scripts -->
        <script type="module" src="/js/client/islands.js"></script>
      </body>
    </html>
  `;
}
