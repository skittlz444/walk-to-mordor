export interface PageConfig {
    title: string;
    description: string;
    /** Additional CSS <link> tags (just the href values) */
    stylesheets?: string[];
    /** Additional inline <style> content */
    inlineStyles?: string;
    /** CSS class(es) for <body> */
    bodyClass?: string;
    /** Full HTML for <header> content (inside the header tag) */
    headerContent: string;
    /** CSS class for <header> tag */
    headerClass?: string;
    /** Full HTML for <main> content (inside the main tag) */
    mainContent: string;
    /** CSS class for <main> tag */
    mainClass?: string;
    /** Additional <script> tags to load before profile.js / main.js */
    scripts?: string[];
}

export function renderLayout(config: PageConfig): string {
    const extraStylesheets = (config.stylesheets ?? [])
        .map(href => `        <link href="${href}" rel="stylesheet" />`)
        .join('\n');

    const extraScripts = (config.scripts ?? [])
        .map(src => `      <script src="${src}"></script>`)
        .join('\n');

    const bodyClass = config.bodyClass ? ` class="${config.bodyClass}"` : '';
    const headerClass = config.headerClass ? ` class="${config.headerClass}"` : '';
    const mainClass = config.mainClass ? ` class="${config.mainClass}"` : '';

    const inlineStyleBlock = config.inlineStyles
        ? `
        <style>
${config.inlineStyles}
        </style>
`
        : '';

    return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${config.title}</title>
        
        <!-- PWA Meta Tags -->
        <meta name="description" content="${config.description}" />
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
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" crossorigin="anonymous" />
        <link href="/css/main.css" rel="stylesheet" />
        <link href="/css/drawer.css" rel="stylesheet" />
${extraStylesheets}
        ${inlineStyleBlock}
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
      <body${bodyClass}>
      <header${headerClass}>
        <div class="header-controls">
          <div data-island="DrawerIsland"></div>
        </div>
        ${config.headerContent}
      </header>
      <main${mainClass}>
        ${config.mainContent}
      </main>
      
      <!-- Preact Islands - Load before vanilla JS that depends on it -->
      <script type="module" src="/js/client/islands.js"></script>
      
      <!-- Scripts -->
${extraScripts}
      <script src="/js/profile.js"></script>
      <script src="/js/main.js"></script>
      </body>
    </html>
`;
}
