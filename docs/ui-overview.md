# UI Overview

The Frontend is built using a "Server-Side Rendered Shell + Client-Side Hydration" pattern.

## Server-Side Rendering (SSR)
Files: `src/renderHtml.ts`, `src/renderAuthPage.ts`, `src/renderPasswordResetPage.ts`

The Cloudflare Worker generates the full HTML document string. This includes:
- `<head>` with meta tags, PWA manifest, and styles.
- `<body>` with the container elements (`<main>`, `<div id="eventcalendar">`).
- Script tags pointing to `public/js/` modules.

## Client-Side Logic
Located in `public/js/`.

- **`main.js`**: Core orchestration. Checks auth status on load, fetches initial data, and initializes other modules.
- **`validators.js`**: Shared validation logic (mirrors server-side validators).
- **`calendar.js`**: Renders the interactive calendar component using Vanilla JS DOM manipulation. Handles date selection.
- **`progress.js`**: Handles API calls related to fetching and saving progress.
- **`goals.js`**: Fetches goals and calculates which ones have been achieved based on total distance.
- **`profile.js`**: Manages the profile modal and user settings updates.

## Styling
- **`client/src/base.css`** (or `public/css/main.css`): Main stylesheet.
- Uses standard CSS variables for theming.
- Responsive design for mobile support (PWA capable).

## PWA Features
- **Manifest**: `public/manifest.json`
- **Service Worker**: `public/sw.js` for caching and offline support.
