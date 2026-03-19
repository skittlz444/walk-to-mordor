---
name: architecture
description: System architecture, runtime topology, source tree layout, and project overview for walk-to-mordor.
---

# Architecture

Last updated: 2026-03-17

## Project Overview

Walk to Mordor is a Cloudflare Workers web app for tracking walking distance against Middle-earth milestones.

Feature domains:
- Account management (register, login, email confirmation, password reset)
- Personal progress (daily logging, calendar history, milestone unlocking)
- Interactive map (`/map` with friend markers and hover mini-cards)
- Fellowship system (parties, invites, messaging, unified activity feed)
- Friends (search, requests, profiles)
- Avatar system (40+ selectable avatars with slug validation)
- Admin dashboard (goals CRUD, user management, metrics)

## Runtime Topology

- **Single Worker monolith**: `src/index.ts` — stateless request handlers.
- **Database**: D1 SQLite (`DB` binding) — source of truth.
- **Static assets**: Workers Assets binding from `public/` (`ASSETS` binding).
- **Email**: Resend API via `email-utils.ts` and `email-templates.ts`.
- **Frontend**: SSR HTML shells + Preact island hydration + legacy vanilla JS orchestration.

## Request Flow

1. Request enters Worker `fetch()` in `src/index.ts`.
2. `GET`/`HEAD` requests first check static assets via `env.ASSETS.fetch(request)`.
3. `/api/*` routes enforce method allowlists and JSON body parsing.
4. API handlers execute domain logic — full route listings in `docs/api-reference.md`.
5. Page requests render SSR shells (`src/render*.ts`), then hydrate islands via `client/src/index.tsx`.

### Route → Handler Map

| Domain | Handler file |
|---|---|
| Auth & profile | `auth-handlers.ts` |
| Progress & goals | `progress-handlers.ts`, `goals-handlers.ts` |
| Fellowship | `party-handlers.ts`, `fellowship-invite-handlers.ts` |
| Friends | `friends-handlers.ts` |
| Admin | `admin-handlers.ts` (requires `validateAdminSession`) |
| Pages | `render*.ts`, `map-handlers.ts` |

## Source Tree Layout

```text
walk-to-mordor/
  src/               # Worker entry, handlers, SSR page renderers
  client/            # Preact islands (Vite build + Vitest tests)
    src/islands/     # Page-level Preact islands + co-located tests
    src/components/  # Shared UI: Avatar, ActivityFeed, map/ (Konva), admin/
    src/stores/      # Preact Signals: mapStore, partyStore
    src/data/        # Waypoint coordinates, fellowship path data
    src/utils/       # Map geometry, caching, color helpers
    src/types/       # TypeScript interfaces
  public/            # Static assets served by Assets binding
    css/             # Feature-scoped stylesheets
    js/              # Legacy vanilla JS + Vite-built island bundle (js/client/)
    img/             # Map tiles, avatars, goal images, image-manifest.json
  migrations/        # D1 SQL migrations (0001–0124)
  tests/api/         # Jest API tests (miniflare environment)
  tests/ui/          # Playwright E2E specs + helpers/
  scripts/           # Asset pipeline (image optimization, tiling, manifest)
  docs/              # Living project documentation
```

### Entry Points

| Entry point | Role |
|---|---|
| `src/index.ts` | Worker entry: `matchRoute()` router, CORS, method guards |
| `client/src/index.tsx` | Island hydration: discovers `[data-island]` mounts |
| `public/js/main.js` | Legacy app controller: session management, `body.authenticated` signal |
| `public/sw.js` | Service worker: cache-first for static assets, SWR for API endpoints, build-stamped `CACHE_NAME` |

Feature → file discovery: search `src/` for handler modules, `client/src/islands/` for islands, `public/css/` for stylesheets.

## Key Architectural Patterns

### Service Worker Caching Strategy

The service worker (`public/sw.js`) employs two distinct caching strategies:

**Static Assets — Cache-First with Build Stamping**
- `CACHE_NAME` uses `BUILD_TIMESTAMP` for versioning (e.g., `walk-to-mordor-20260317-143022`)
- Pre-caches essential CSS/JS/manifest on install
- Dynamic caching for static assets on first request
- Old static caches deleted on activate

**API Responses — Stale-While-Revalidate (SWR)**
- Separate cache: `walk-to-mordor-api-swr` (`SWR_CACHE_NAME`)
- Only allowlisted `GET` endpoints are SWR-cached:
  - `/api/session`, `/api/goals`, `/api/calendar-progress`
  - `/api/total-distance`, `/api/user/parties`, `/api/friends`
- Cache hit: return cached immediately + background revalidation
- Cache miss: network-first, cache on success
- `POST`/`PUT`/`DELETE` always bypass cache (non-GET skipped early)
- TTL metadata via `x-swr-cached-at` header (default 5 min)
- Deploy-time cache busting via `SWR_CACHE_VERSION` (cleared on version mismatch during activate)

**Client Notification Protocol**
- After background cache update, the SW sends `postMessage({ type: 'sw-cache-updated', url })` to all window clients
- Islands/stores can listen via `navigator.serviceWorker.addEventListener('message', ...)`
- Client-side listeners are NOT implemented by the SW — each island opts in independently

### SSR Shell + Islands

- `renderLayout.ts` provides a shared page shell. Extra stylesheets must be explicitly listed per page config — CSS from other features won't auto-include.
- `renderHtml.ts` is a bare HTML factory used only by the map page.
- New features: Preact islands in `client/src/`, hydrated via `client/src/index.tsx`.
- Legacy flow logic: vanilla JS in `public/js/` — do not rewrite without explicit permission.
- Bridge globals (`window.preact`, `window.preactIslands`, `window.partyStore`) allow cross-boundary communication.
- Validators mirrored: `src/validators.ts` and `public/js/validators.js` must stay in sync.

### Map Stack

- `MapIsland` — Konva-based rendering with utilities in `client/src/components/map/` and `client/src/utils/map-*.ts`.
- State: Preact Signals stores (`mapStore.ts`, `partyStore.ts`).

### Hydration Signals

- `body.authenticated` — set by `main.js` after session check; legacy JS depends on this.
- `[data-hydrated="true"]` — set by island entry after Preact mounts; Playwright tests wait on this.

### Authentication

- Token-based: `Authorization: Bearer <token>`. Validation: `validateSession()` / `validateAdminSession()` in `auth-handlers.ts`.
- `/api/session` returns camelCase fields including `avatarId`, `showFutureGoalsUnlocked`, `isAdmin`.
- Test mode: `ALLOW_TEST_AUTH=true` enables mock tokens (`TEST_MOCK_TOKEN_<username>`).
- Admin grant: direct D1 only — `UPDATE users SET is_admin = 1 WHERE username = '...';`
- All admin actions logged to `admin_audit_log` via `logAdminAction()`.

## Database Layer

D1 is the source of truth. Full schema: `docs/data-models.md`. Migrations in `migrations/`.

| Domain | Tables |
|---|---|
| Core | `users`, `sessions`, `progress`, `goals` |
| Auth support | `password_reset_tokens`, `email_confirmation_tokens` |
| Fellowship | `parties`, `party_members`, `party_progress_log`, `party_messages` |
| Social | `friendships`, `fellowship_invites` |
| Admin | `admin_audit_log` |

Migration ranges: 0001–0005 core schema · 0006–0010 auth · 0011–0021 goal updates + email · 0022–0116 goal images · 0117–0118 preferences · 0119–0124 fellowship / social / admin.

## Build & Deploy

- Config: `wrangler.json`.
- `npm run build` — builds islands + updates service-worker cache version metadata.
- `npm run deploy` — applies migrations (predeploy) + deploys Worker.
- Vite 8: client build uses `rolldownOptions` (not `rollupOptions`).
- `client/package.json` declares `"type": "module"` for ESM compat with `@preact/preset-vite`.

### Asset Pipeline

- `scripts/optimize-images.js` → highres + thumbs (WebP).
- `scripts/optimize-avatars.js` → avatars + 64×64 thumbs (WebP).
- `scripts/tile-map-image.js` → 6-level tile pyramid.
- `scripts/generate-image-manifest.js` → `public/img/image-manifest.json`.
- Vite build → `public/js/client/islands.js` + `islands.css` (generated, do not hand-edit).

### Testing

| Layer | Tool | Command |
|---|---|---|
| Backend handlers | Jest | `npx jest --no-cache` |
| Client (happy-dom) | Vitest | `cd client && npx vitest run` |
| E2E (fast) | Playwright | `npm run test:ui -- --run` |
| E2E (all browsers) | Playwright | `npm run test:ui:all` |

Playwright tests must use API pre-configuration (e.g., `PUT /api/user/preferences`) instead of `page.route()` session interception — route interception blocks auth/hydration flow.

## External Services

- **Resend**: Transactional email (confirmation, password reset). Setup: `docs/email.md`.
- **Cloudflare Assets**: Static files from `public/` served via `ASSETS` binding. No CDN or R2 layer.

## Invariants / Key Constraints

- Keep canonical route set (`/`, `/journey`, `/map`, `/party*`, `/login*`) — no `/wtm` alias reintroduction.
- Preserve hybrid frontend: no broad rewrite of working legacy `public/js` code unless explicitly scoped.
- Static asset pipeline (`public/img` + `goals.image_id`) — no R2 for goal images.
- TypeScript strict mode enforced. No `any`. Define interfaces for all D1 results.
- `renderLayout.ts` controls CSS inclusion — extra stylesheets must be explicitly listed per page.
