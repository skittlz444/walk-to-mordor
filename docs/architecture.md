---
name: architecture
description: System architecture, runtime topology, source tree layout, and project overview for walk-to-mordor.
---

# Architecture

Last updated: 2026-11-05

## Project Overview

Walk to Mordor is a Cloudflare Workers web app for tracking walking distance against Middle-earth milestones.

Feature domains:
- Account management (register, login, email confirmation, password reset)
- Personal progress (daily logging, calendar history, milestone unlocking)
- Interactive map (`/map` with friend markers and hover mini-cards)
- Goal content / campfire lore attached to unlocked milestones
- Fellowship system (parties, invites, messaging, unified activity feed)
- Personal challenges (daily random encounter roll → accept/decline → personalized distance goal → badge)
- Friends (search, requests, profiles)
- Avatar system (40+ selectable avatars with slug validation)
- Admin dashboard (goals CRUD, user management, metrics)

## Runtime Topology

- **Single Worker monolith**: `src/index.ts` — stateless request handlers, routed via Hono.
- **Framework**: [Hono](https://hono.dev) v4 — lightweight web framework for Cloudflare Workers.
- **Database**: D1 SQLite (`DB` binding) — source of truth.
- **Static assets**: Workers Assets binding from `public/` (`ASSETS` binding).
- **Email**: Resend API via `email-utils.ts` and `email-templates.ts`.
- **Frontend**: SSR HTML shells + Preact island hydration + legacy vanilla JS orchestration.

## Request Flow

1. Request enters Worker `fetch()` in `src/index.ts`.
2. `GET`/`HEAD` requests first check static assets via `env.ASSETS.fetch(request)`.
3. All other requests delegate to Hono's `app.fetch(request, env, ctx)`.
4. Hono routes requests based on path and method to the appropriate handler:
   - **SSR page routes** use `c.html()` to render HTML shells.
   - **Public API routes** (e.g., `/api/register`, `/api/login`) require no auth.
   - **Authenticated API routes** are protected by auth middleware that calls `validateSession()`.
   - **Admin API routes** are protected by admin middleware that calls `validateAdminSession()`.
5. Unmatched API routes return 404; unmatched page routes fall back to the SPA shell (`renderHtml()`).
6. Page requests render SSR shells (`src/render*.ts`), then hydrate islands via `client/src/index.tsx`.

### Routing Architecture

Routes are organized into three groups by auth scope, all registered directly on the main Hono app:

- **Public routes**: No auth required. Registered via `app.post()`, `app.get()` etc.
- **Authenticated routes**: Protected by `app.use('/api/*', authMiddleware)` which skips known public paths and admin paths.
- **Admin routes**: Protected by `app.use('/api/admin/*', adminMiddleware)`.

Middleware:
- **DbClient injection**: `app.use('*', dbMiddleware)` sets `c.get('db')` for all routes.
- **Auth guard**: Calls `validateSession()`, sets `c.get('userId')` on success, returns 401 on failure.
- **Admin guard**: Calls `validateAdminSession()`, sets `c.get('userId')` and `c.get('adminUserId')` on success, returns 403 on failure.

Handler wrappers are thin (2-5 lines each) and adapt existing handler signatures to Hono's `(c: Context) => Response` pattern:
```typescript
app.post('/api/register', async (c) =>
  handleRegister(c.req.raw, c.get('db'), await c.req.json(), c.env));
```

Parameterized routes use `c.req.param('name')` instead of the removed `matchRoute()` function:
```typescript
app.get('/api/party/:id/progress', async (c) => {
  const partyId = intParam(c.req.param('id'), 'party ID');
  if (partyId instanceof Response) return partyId;
  return handlePartyProgress(c.req.raw, c.get('db'), partyId, c.env.ALLOW_TEST_AUTH);
});
```

### Route → Handler Map

| Domain | Handler file |
|---|---|
| Auth & profile | `auth-handlers.ts` |
| Progress & goals | `progress-handlers.ts`, `goals-handlers.ts` |
| Goal content | `goal-content-handlers.ts`, `goal-content-helpers.ts` |
| Fellowship | `party-handlers.ts`, `fellowship-invite-handlers.ts` |
| Friends | `friends-handlers.ts` |
| Achievements | `achievement-handlers.ts`, `achievement-utils.ts` |
| Personal challenges | `event-handlers.ts`, `event-utils.ts` |
| Community campaigns | `campaign-handlers.ts`, `campaign-utils.ts` |
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
    src/utils/       # Map geometry, caching, color helpers, encounter trigger
    src/types/       # TypeScript interfaces
  public/            # Static assets served by Assets binding
    css/             # Feature-scoped stylesheets
    js/              # Legacy vanilla JS + Vite-built island bundle (js/client/)
    img/             # Map tiles, avatars, goal images, image-manifest.json
  migrations/        # D1 SQL migrations (0001–0167)
  tests/api/         # Jest API tests (miniflare environment)
  tests/ui/          # Playwright E2E specs + helpers/
  scripts/           # Asset pipeline (image optimization, tiling, manifest)
  docs/              # Living project documentation
```

### Entry Points

| Entry point | Role |
|---|---|
| `src/index.ts` | Worker entry: Hono router, auth guards, scheduled jobs |
| `client/src/index.tsx` | Island hydration: discovers `[data-island]` mounts; triggers the encounter popup on journey/map paths |
| `public/js/main.js` | Legacy app controller: session management, `body.authenticated` signal |
| `public/sw.js` | Service worker: cache-first for static assets, SWR for API endpoints |

Feature → file discovery: search `src/` for handler modules, `client/src/islands/` for islands, `public/css/` for stylesheets.

## Key Architectural Patterns

### SSR Shell + Islands

- `renderLayout.ts` provides a shared page shell. Extra stylesheets must be explicitly listed per page config — CSS from other features won't auto-include.
- `renderHtml.ts` is a bare HTML factory used only by the map page.
- New features: Preact islands in `client/src/`, hydrated via `client/src/index.tsx`.
- Legacy flow logic: vanilla JS in `public/js/` — do not rewrite without explicit permission.
- Bridge globals (`window.preact`, `window.preactIslands`, `window.partyStore`) allow cross-boundary communication.
- Validators: `public/js/validators.js` is generated from `src/validators.ts` + `src/validators-client.ts` by `npm run build:validators`; never edit it by hand.

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

### Goal Content Unlocks and Discovery Analytics

- Goal content APIs live in `src/goal-content-handlers.ts`; shared row validation, persistence helpers, and analytics writes live in `src/goal-content-helpers.ts`.
- Goal content does not have a separate lock. Public reads reuse the same goal unlock semantics as goal viewing and milestone journals through `journal-helpers`, including personal progress and optional fellowship `partyId` context.
- `GET /api/goals` exposes `has_content` so clients can show teaser state for locked goals without receiving content bodies.
- Discovery analytics (`teaser_impression`, `content_open`) are best-effort background writes. Routes schedule them with Cloudflare Workers `ExecutionContext.waitUntil(...)` so failed analytics inserts do not block modal opens, card rendering, or content reads.

### Personal Challenge Encounters

- **Definition vs occurrence:** `personal_encounter_definitions` holds reusable config; accepting creates an `encounter_occurrences` row with the personalized target, `started_at`, and deadlines. One definition (the seeded `nazgul-pursuit`) can generate repeated occurrences. Migration `0159` corrects pre-release databases because prototype event tables used the same names.
- **Daily roll:** `POST /api/events/daily-roll` is idempotent per UTC day via `UNIQUE(user_id, roll_date)` and returns the stored offer on repeat. Previously accepted/declined rolls, active challenges, and users below the activity threshold get `{ offer: null }`. The preview target is computed once at roll time and copied to the occurrence at acceptance.
- **Coverage and completion:** the coverage window is `[started_at, coverage_end_date]`, `grace_deadline` is the coverage end plus 3 days, and only `progress.date` values inside the window count (including walks logged during grace). Completion is cumulative credited distance ≥ `personalized_target`; there is **no** all-coverage-days precondition, so it can complete at acceptance or on any later reconciliation.
- **Reconciliation:** hooks in `src/progress-handlers.ts` run after progress create/update/delete. Each eligible walk upserts or deletes an `event_progress_ledger` row and refreshes the cached `event_participants.progress_distance`, so create/update/delete are all idempotent. Reconciliation errors are logged but never propagated — saving a walk must always succeed (same graceful-degradation rule as `syncPartyProgressLog`).
- **Settlement:** `scheduled()` (daily 09:00 UTC) settles active occurrences in its own try/catch block, so a failure cannot block push jobs. The condition is strictly `grace_deadline < today`; a challenge is never settled on its grace deadline day, keeping the last day of grace logging usable.
- **Trigger and modal:** `client/src/index.tsx` calls the trigger after `initializeAppStore()`, only on journey (`/`, `/journey`) and map (`/map`) paths, and programmatically mounts `EncounterPopupIsland` via `window.preactIslands`. The modal defers while another dialog (for example `BadgeAwardModal`) is open.
- **Badge award:** completion calls `awardAchievement` with the idempotency key `encounter_occurrence:<occurrence_id>`, so reconciliation retries cannot double-award and editing progress downward never revokes an earned badge.
- **Artwork:** the illustration uses the shared static image pipeline (`image_slug` → `public/img/highres/<slug>.webp` + thumb, manifest); badge art stays in `scripts/badge-art/`. See `docs/asset-workflow.md`.

### Community Campaigns

- **Definition vs run:** `campaign_definitions` holds identity/copy/artwork/badge link only. Each `campaign_runs` row carries one cycle's window, target, status, and terminal snapshot. A partial unique index allows at most one `upcoming`/`active` run per campaign; retriggering (admin action, future `community-campaigns-admin`) adds the next `run_number` instead of resetting a row.
- **Per-run opt-in:** `campaign_participants` is unique per `(user_id, campaign_id, run_id)`. Joining a new run is always explicit; removal in a prior run never blocks joining the next one. `campaign_progress_ledger` rows are retained across runs, so past leaderboards and snapshots stay queryable.
- **Walk-date credit, gated on the active run:** reconciliation checks `progress.date` against `[start_date, end_date]` and only credits runs with `status = 'active'`. `upcoming`, `completed`, and `expired` runs never credit or complete — this is also what blocks a future-dated walk from completing an unstarted run. Joining backfills existing in-window walks through the same idempotent ledger upsert.
- **Synchronous completion:** after a walk create/update/delete, the scoped ledger total is compared to `target_distance`. On target met, a guarded UPDATE (`WHERE status = 'active'`, proceed only on `changes > 0`) writes the final snapshot and calls `awardAchievement` with the per-run key `campaign:<slug>:run:<run_id>` for every active contributor. Reconciliation hooks run in `src/progress-handlers.ts`, mirroring personal challenges and `syncPartyProgressLog`: errors are logged, never propagated.
- **Lifecycle cron:** the existing daily 09:00 UTC `scheduled()` run adds an independent try/catch block: `upcoming → active` when `start_date <= DATE('now')`, and `active → expired` when `end_date < DATE('now')` and the total is below target (snapshot written at expiry). Completion is never done by cron, and cron never creates runs. All date comparisons are UTC.
- **Disabled campaigns are frozen:** `enabled = 0` excludes a campaign from listing, reconciliation, completion, lifecycle, and joining; re-enabling re-runs backfill reconciliation for the active run.
- **Public surface:** `GET /api/events*` is auth-optional — a valid token adds the caller's participation/contribution, an invalid or absent one is anonymous (not `401`). `POST /api/events/:id/join` is the only authenticated campaign action. The `/events` page (`src/renderEventsPage.ts` + `EventsIsland`) uses `publicPage: true`, so anonymous visitors are never redirected to `/login` and see a "Sign in to join" link instead of a join button. The island fetches `/api/events` then `/api/events/:id/community-progress` per active card; a failed progress call degrades to the card without the contributor list.

## Database Layer

D1 is the source of truth. Full schema: `docs/data-models.md`. Migrations in `migrations/`.

| Domain | Tables |
|---|---|
| Core | `users`, `sessions`, `progress`, `goals` |
| Goal content | `goal_content`, `content_discovery_events` |
| Auth support | `password_reset_tokens`, `email_confirmation_tokens` |
| Fellowship | `parties`, `party_members`, `party_progress_log`, `party_messages` |
| Social | `friendships`, `fellowship_invites` |
| Personal challenges | `personal_encounter_definitions`, `encounter_occurrences`, `daily_rolls`, `event_participants`, `event_progress_ledger` |
| Community campaigns | `campaign_definitions`, `campaign_runs`, `campaign_participants`, `campaign_progress_ledger` |
| Admin | `admin_audit_log` |

Migration ranges: 0001–0005 core schema · 0006–0010 auth · 0011–0021 goal updates + email · 0022–0116 goal images · 0117–0118 preferences · 0119–0124 fellowship / social / admin · 0125–0139 push, storyline, and journals · 0140–0141 goal content and discovery analytics · 0142–0159 achievements and personal challenges (0159 repairs legacy prototype event tables) · 0160–0167 campaign schema, seeds, and the beacon badge.

### Read/Write Separation

All database access flows through a `DbClient` wrapper created once per request in `src/index.ts`:

```typescript
// src/db.ts
export interface DbClient {
  readonly read: D1Database;
  readonly write: D1Database;
}

export function createDbClient(db: D1Database): DbClient {
  return { read: db, write: db };
}
```

Handlers use `db.read.prepare(...)` for SELECT queries and `db.write.prepare(...)` for INSERT/UPDATE/DELETE. Both properties delegate to the same D1Database instance today. When Cloudflare ships D1 read replicas, only `createDbClient()` changes — no handler modifications needed.

| Access | Usage |
|---|---|
| `db.read` | All `SELECT` queries (pure reads) |
| `db.write` | All `INSERT`, `UPDATE`, `DELETE` queries |
| `db.write.batch(...)` | Atomic multi-statement operations |

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

## Service Worker Caching Strategy

The service worker (`public/sw.js`) implements a multi-strategy caching approach:

### Static Assets — Cache-First
Static assets (CSS, JS, images, fonts, manifest) use cache-first with a build-stamped `CACHE_NAME` (`walk-to-mordor-<BUILD_TIMESTAMP>`). Old static caches are deleted on activate.

### API Endpoints — Stale-While-Revalidate (SWR)
Six read-heavy API endpoints use SWR caching via a separate `walk-to-mordor-api-swr` cache:

| Endpoint | Description |
|---|---|
| `/api/session` | User session data |
| `/api/goals` | Goal list |
| `/api/calendar-progress` | Calendar progress data |
| `/api/total-distance` | Total distance summary |
| `/api/user/parties` | User's fellowship list |
| `/api/friends` | Friends list |

**SWR behavior:** On cache hit, the cached response is returned immediately while a background fetch updates the cache. On cache miss, the request goes to the network and the response is cached for next time. Non-allowlisted API endpoints remain network-only.

**TTL metadata:** Each cached response stores an `x-swr-cached-at` header with a timestamp. The TTL (`SWR_TTL_MS`, default 5 minutes) is informational — stale entries are still served, and background revalidation always runs.

**Cache version busting:** `SWR_CACHE_VERSION` is stamped at build time (alongside `BUILD_TIMESTAMP`). On activate, if the stored version differs from the current version, the entire SWR cache is cleared. This ensures stale API response shapes don't persist after schema migrations.

### postMessage Protocol
After a background cache update, the SW broadcasts to all clients:
```javascript
{ type: 'sw-cache-updated', url: '<updated-request-url>' }
```
Islands or stores can subscribe via `navigator.serviceWorker.addEventListener('message', ...)` to reactively refresh when cached data changes.

### HTML Navigations — Network-Only
HTML navigations always go to the network with an offline fallback response.

### Write Requests
`POST`, `PUT`, `DELETE`, and `PATCH` requests are never SWR-cached and continue to use the network. Same-origin API mutations also clear the SWR cache so subsequent GETs do not reuse stale API data.
