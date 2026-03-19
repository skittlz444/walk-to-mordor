---
name: frontend-guide
description: Island hydration architecture, component patterns, build tooling, and frontend development rules.
---

# Frontend Guide

Last updated: 2026-03-17

## Frontend Shape

This is **not an SPA** — route handling is server-driven. The UI combines SSR shells with client-side island hydration.

- SSR page composition: `src/renderLayout.ts` and page renderers in `src/render*.ts`
- Legacy runtime: `public/js/*.js` — **do not rewrite without explicit permission**
- Islands runtime: `client/src/` (Preact + Signals)
- Shared island bundle: `/js/client/islands.js`
- New interactive features go in `client/src/` islands unless a change is explicitly legacy-only.

```text
client/src/
  components/   # Reusable TSX components (Avatar, map primitives)
  data/         # Static map/waypoint datasets
  islands/      # Mountable page islands
  stores/       # Preact Signals state stores (map, party, friends)
  types/        # Shared client types
  utils/        # Client utilities and cache helpers
  index.tsx     # Island registry and hydration entry
```

## Key Commands

| Command | Purpose |
|---|---|
| `npm run build:client` | One-off client build |
| `npm run dev:client` | Watch mode rebuilds |
| `npm run dev` | Full local app (worker + client watch + local D1 migrations) |
| `npm run build` | Production build (client + service worker cache version update) |
| `npm run lint` | Run ESLint across all configured scopes |
| `npm run lint:fix` | Run ESLint with auto-fix for fixable rules |
| `npm run test:client` | Client unit tests (Vitest, happy-dom) |
| `npm run test:client:coverage` | Client coverage |
| `npm run test:ui` | UI tests (Chromium, Playwright) |
| `npm run test:ui:all` | UI tests (all browsers sequentially) |

## Dev Pipeline

`npm run dev` is the single command for local development. It orchestrates setup steps and two long-running processes in one terminal.

### Lifecycle

1. **`build:sw:reset`** — resets the service worker cache version for dev mode.
2. **`seedLocalD1`** — applies D1 migrations to the local SQLite database.
3. **`build:client`** — runs a one-off Vite build so `public/js/client/` exists before Wrangler starts (critical on fresh clones where the directory is `.gitignore`d).
4. **Concurrent processes** via `concurrently`:
   - **`[vite]`** (cyan) — `npm run dev:client` watches `client/src/` and rebuilds `public/js/client/islands.js` on change.
   - **`[wrangler]`** (yellow) — `wrangler dev` serves the Worker and static assets from `public/`, with its own file-watching for `src/` changes.

### How It Works

Vite watch mode writes build output to `public/js/client/`. Wrangler's Assets binding (`wrangler.json` → `assets.directory: "./public"`) serves that directory. When you edit a client file, Vite rebuilds the bundle; refresh the browser to pick up changes.

The `--kill-others-on-fail` flag ensures that if either process crashes, the other is terminated immediately — no half-working dev server.

### Standalone Commands

| Command | What It Does |
|---|---|
| `npm run dev:client` | Vite watch only (no Worker) |
| `npx wrangler dev --var ALLOW_TEST_AUTH:true` | Worker dev server only (no client rebuild) |
| `npm run build:client` | One-off Vite production build |

### Troubleshooting

- **Missing islands bundle on first page load?** — Delete `public/js/client/` and re-run `npm run dev`. The initial `build:client` step will recreate it.
- **Stale client code?** — Stop the dev server, run `npm run build:client`, then restart `npm run dev`.
- **Port conflict?** — Wrangler defaults to port 8787. If it's in use, Wrangler will pick the next available port and print the URL.
- **One process keeps running after Ctrl+C?** — This shouldn't happen with `concurrently` v9+, but if it does, kill orphaned `node` or `workerd` processes manually.

## Island Hydration

Islands are registered in `client/src/index.tsx`. Two hydration modes:

### Auto-hydrated

Any `<div data-island="IslandName">` is discovered and hydrated on page load. Props via `data-props` JSON attribute. Most page-level islands use this.

### Programmatic

Legacy vanilla JS mounts islands into DOM containers at runtime — used for modals and inline components (e.g., `DistanceModal`, `GoalModal`, `NextGoalCard`).

```js
const { render, h } = window.preact;
const { DistanceModal } = window.preactIslands;
render(h(DistanceModal, { ...props }), containerEl);
```

## Creating a New Island

1. Create `client/src/islands/YourIsland.tsx`.
2. Register it in `client/src/index.tsx` (auto or programmatic registry).
3. Add `<div data-island="YourIsland">` in the SSR renderer, or mount via `window.__islands.render()` from vanilla JS.
4. Use Preact Signals for state; create a store in `client/src/stores/` if shared state is needed.
5. Build/run and verify hydration in browser.

## Naming & Registration Rules

- Island file names must be PascalCase ending with `Island.tsx`.
- Every island must be registered in `client/src/index.tsx` to be hydrated.
- SSR renderers in `src/render*.ts` control which CSS and islands are included per page.
- Extra stylesheets must be explicitly added in `renderLayout` config — they are **not** inherited automatically.

## State Management

- **New code**: Preact Signals stores in `client/src/stores/` (e.g., `mapStore.ts`, `partyStore.ts`).
- **Legacy code**: Module-scoped state and browser storage.
- Server state is source-of-truth via API responses.
- Use `localStorage` only for lightweight UX preferences or client cache hints.
- Bridge globals allow gradual interop between the two systems.

## Page Shell → Island Mapping

Each `src/render*.ts` file produces an SSR shell mounting one or more islands. Key patterns:

- `/journey` (`src/renderHtml.ts`) — mixes vanilla JS modules with programmatic islands
- `/map` (`src/map-handlers.ts`) — auto-hydrates `MapIsland`
- Fellowship pages — `src/renderParty*.ts`, each auto-hydrating a `Party*Island`
- Friends pages — `src/renderFriend*.ts`, each auto-hydrating a `Friend*Island`
- Admin pages — `src/renderAdmin*.ts`, each auto-hydrating an `Admin*Island`; all use `/css/admin.css`

## Feature → File Map

| Feature | Entry Point |
|---|---|
| Map + Social Panel | `client/src/islands/MapIsland.tsx` |
| Admin Dashboard | `client/src/islands/AdminDashboardIsland.tsx` |
| Admin Goals CRUD | `client/src/islands/AdminGoalsListIsland.tsx`, `AdminGoalEditIsland.tsx` |
| Friends | `client/src/islands/FriendsListIsland.tsx`, `FriendProfileIsland.tsx`, `FriendAddIsland.tsx` |
| Reusable Avatar | `client/src/components/Avatar.tsx` |
| Avatar slug inventory | `src/avatar-slugs.ts` (`VALID_AVATAR_SLUGS`) |

## Legacy JS Interop

Legacy vanilla JS lives in `public/js/`. Key modules: `main.js` (bootstrap), `calendar.js`/`progress.js` (CRUD), `goals.js` (goal list), `validators.js` (shared validation). Profile/preferences is now a Preact island at `/profile` (`ProfileIsland`).

### Bridge Globals

`client/src/index.tsx` exposes globals consumed by legacy scripts:

- `window.__islands.render(name, container, props)` — programmatic island mounting
- `window.preact` / `window.preactIslands` — Preact runtime references
- `window.partyStore` — fellowship state (`client/src/stores/partyStore.ts`)

Never remove these without migrating all dependent legacy code. Prefer signals and stores over adding new bridge globals.

## Styling

- Global: `public/css/main.css`; feature-specific CSS alongside (e.g., `party.css`, `map.css`, `auth.css`)
- Theme variables and conventions → `docs/design-guide.md`

## Navigation

- `DrawerIsland` provides nav links: Journey, Map, Fellowships, Friends
- Badge counts on Fellowships and Friends for pending invites/requests
- Home route (`/`) performs auth-aware redirect based on session preferences
- **Route precedence**: Static routes before dynamic — `/party/join/:inviteCode` before `/party/:id`; `/friends/add/:friendCode` before `/friends/:id`

## Linting

The project uses **ESLint v9+** with flat config (`eslint.config.mjs`) targeting three directory scopes:

### Three-Scope Strategy

| Scope | Files | Rules |
|---|---|---|
| **Strict TypeScript** | `src/**/*.ts` | `no-explicit-any` (error), `no-unused-vars` (error), `consistent-type-imports` (warn) |
| **Strict TypeScript + JSX** | `client/src/**/*.{ts,tsx}` | Same rules with JSX/Preact support |
| **Legacy JS (deprecated)** | `public/js/*.js`, `public/sw.js` | Relaxed — deprecation warning only |

### Why `public/js/client/` is Excluded

`public/js/client/` contains **Vite build output** (`islands.js`, CSS chunks). It is globally ignored because linting generated code produces hundreds of false positives. Never add this directory to lint scope.

### Legacy Deprecation

Every file in `public/js/` emits a **warning** (not error):

> _"Legacy JS: New code should be added to client/src/ (Preact islands). Do not expand legacy modules."_

This fires automatically via a `no-restricted-syntax` rule on the `Program` AST node. Existing legacy code is not required to be fixed — the warning exists as a guardrail against expanding legacy modules. To suppress the warning for a justified change, add `/* eslint-disable no-restricted-syntax */` at the top of the file with a comment explaining why.

### Commands

```bash
npm run lint          # Check all scopes (exit 0 = no errors; warnings allowed)
npm run lint:fix      # Auto-fix fixable issues (e.g., import type suggestions)
```

## Testing Conventions

- Use explicit waits/assertions (`expect(...).toBeVisible`, `waitForURL`).
- Avoid `waitForTimeout` except tiny gesture simulation delays.
- Use unique mock-auth tokens per test worker for isolation.
- Playwright route interception blocks auth/hydration — use API pre-configuration (e.g., `PUT /api/user/preferences`) instead of `page.route` for session-dependent test setup.
- Maintain >90% coverage for new client code.

## Service Worker Behavior

The service worker (`public/sw.js`) is a **classic script** (no ES module imports). It uses two separate caches:

| Cache | Name | Strategy | Versioning |
|---|---|---|---|
| Static assets | `walk-to-mordor-{BUILD_TIMESTAMP}` | Cache-first | Build-stamped, cleared on deploy |
| API responses | `walk-to-mordor-api-swr` | Stale-While-Revalidate | `SWR_CACHE_VERSION`, cleared on version mismatch |

### SWR Allowlisted Endpoints

Only these `GET` endpoints use SWR caching: `/api/session`, `/api/goals`, `/api/calendar-progress`, `/api/total-distance`, `/api/user/parties`, `/api/friends`. All other API endpoints remain network-only.

### sw-cache-updated postMessage

After a background revalidation updates the SWR cache, the SW sends `postMessage({ type: 'sw-cache-updated', url })` to all window clients. Islands can listen:

```js
navigator.serviceWorker.addEventListener('message', (event) => {
  if (event.data?.type === 'sw-cache-updated') {
    // Re-fetch or refresh signal for the updated URL
  }
});
```

### Build Scripts

- `public/js/update-cache-version.js` — replaces `{{BUILD_TIMESTAMP}}` and `{{SWR_CACHE_VERSION}}` placeholders at build time
- `public/js/reset-cache-version.js` — restores placeholders for development/git

## Pitfalls & Gotchas

- **CSS scoping**: Each SSR renderer controls its own stylesheet list. If your island needs styles from another page's CSS, add the stylesheet in the renderer.
- **Session contract**: `GET /api/session` returns camelCase fields (`avatarId`, `showFutureGoalsUnlocked`). Other endpoints may use snake_case — don't mix them up.
- **Vite config**: `client/package.json` must keep `"type": "module"` — required by `@preact/preset-vite` dependencies (zimmerframe is ESM-only). Removing it breaks the build.
- **Avatar fallbacks**: Components must fall back gracefully on missing avatars (initials circle for Avatar, gold ring for map marker). Never break layout on missing images.
