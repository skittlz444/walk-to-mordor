# UI Overview

The Frontend is built using a "Server-Side Rendered Shell + Client-Side Hydration" pattern. Interactive components use **Preact islands** that hydrate into server-rendered HTML containers.

## Server-Side Rendering (SSR)
Files: `src/renderHtml.ts`, `src/renderAuthPage.ts`, `src/renderPasswordResetPage.ts`

The Cloudflare Worker generates the full HTML document string. This includes:
- `<head>` with meta tags, PWA manifest, and styles.
- `<body>` with the container elements (`<main>`, `<div id="eventcalendar">`).
- Script tags pointing to `public/js/` modules and the compiled Preact islands bundle.

## Client-Side Logic
Located in `public/js/`.

- **`main.js`**: Core orchestration. Checks auth status on load, fetches initial data, and initializes other modules.
- **`validators.js`**: Shared validation logic (mirrors server-side validators).
- **`calendar.js`**: Renders the interactive calendar component using Vanilla JS DOM manipulation. Handles date selection.
- **`progress.js`**: Handles API calls related to fetching and saving progress.
- **`goals.js`**: Fetches goals and calculates which ones have been achieved based on total distance. Renders the next goal as a `NextGoalCard` Preact island, upcoming goals as `UpcomingGoalCard` islands, and opens `GoalModal` for detail views.
- **`profile.js`**: Manages the profile modal and user settings updates.

## Preact Islands
Entry point: `client/src/index.tsx` — registers and hydrates islands.

| Island | Mount Method | Purpose |
|--------|-------------|---------|
| `AuthForms` | Auto-hydrated via `data-island="AuthForms"` | Login/registration forms on auth page |
| `GoalModal` | Programmatic via `goals.js` | Goal detail modal with image, description, achievement animation |
| `NextGoalCard` | Programmatic via `goals.js` | Highlighted next milestone card with segment progress |
| `UpcomingGoalCard` | Programmatic via `goals.js` | Upcoming milestone cards |

Islands are built with Vite and output to `public/js/client/islands.js`.

## Styling
- **`client/src/base.css`** (or `public/css/main.css`): Main stylesheet.
- Uses standard CSS variables for theming (see [CSS Theming](css-theming.md)).
- Responsive design for mobile support (PWA capable).

## PWA Features
- **Manifest**: `public/manifest.json`
- **Service Worker**: `public/sw.js` for caching and offline support.
