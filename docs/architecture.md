# Architecture

Last updated: 2026-03-06

## System Shape

Walk to Mordor runs as a single Cloudflare Worker monolith.

- Entry point: `src/index.ts`
- Runtime model: stateless request handlers
- Data store: D1 SQLite (`DB` binding)
- Static assets: Workers Assets binding from `public/` (`ASSETS` binding)
- Server rendering: HTML pages composed in `src/render*.ts`

## Request Flow

1. Request enters Worker `fetch()` in `src/index.ts`.
2. For `GET`/`HEAD`, Worker first checks static assets via `env.ASSETS.fetch(request)`.
3. `/api/*` requests enforce method allowlists and JSON body parsing where applicable.
4. API handlers execute domain logic (auth, progress, goals, party).
5. Page requests render SSR shells, then hydrate islands through `/js/client/islands.js`.

## Route Topology

### API Routes

- Auth and profile:
- `POST /api/register`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/session`
- `PUT /api/profile`
- `PUT /api/user/preferences`
- `POST /api/password-reset-request`
- `POST /api/password-reset`
- `GET /api/auth/confirm-email`
- `POST /api/auth/resend-confirmation`

- Progress and goals:
- `GET|POST|PUT|DELETE /api/calendar-progress`
- `GET /api/goals`
- `GET /api/total-distance`

- Fellowship/party:
- `POST /api/party`
- `GET /api/user/parties`
- `GET|POST /api/party/join/:inviteCode`
- `POST /api/party/:id/invite`
- `GET /api/party/:id/progress`
- `GET /api/party/:id/activity`
- `POST /api/party/:id/leave`
- `POST /api/party/:id/kick/:userId`
- `PUT /api/party/:id/settings`
- `POST /api/party/:id/transfer-leadership`

- Friends:
- `GET /api/friends`
- `GET /api/friends/pending`
- `GET /api/friends/search?q=`
- `GET /api/friends/resolve/:friendCode`
- `GET /api/friends/positions`
- `POST /api/friends/request`
- `POST /api/friends/request/code`
- `POST /api/friends/:friendshipId/accept`
- `POST /api/friends/:friendshipId/reject`
- `DELETE /api/friends/:friendshipId`

- Fellowship invites (friend-based):
- `POST /api/party/:id/invite-friend`
- `GET /api/user/fellowship-invites`
- `POST /api/user/fellowship-invites/:inviteId/accept`
- `POST /api/user/fellowship-invites/:inviteId/reject`

- Admin (requires `validateAdminSession` — 401 if unauthenticated, 403 if non-admin):
  - `GET|POST|PUT /api/admin/*` — prefix guard; all admin API routes require admin auth
  - `GET /api/admin/dashboard` — returns live system statistics (total users, distance, parties, goals)
  - `GET /api/admin/goals` — paginated, searchable, sortable list of goals
  - `POST /api/admin/goals` — create new goal (title, distance in miles, description, special, image_id) with audit logging
  - `GET /api/admin/goals/:id` — single goal full details
  - `PUT /api/admin/goals/:id` — update goal fields (title, distance, description, special, image_id) with audit logging
  - `GET /api/admin/images` — image asset inventory cross-referencing manifest vs goal assignments

### Page Routes

- `/` home redirect shell (`src/renderHomePage.ts`)
- `/journey` main journey UI (`src/renderHtml.ts`)
- `/map` map UI (`src/map-handlers.ts`)
- `/login`, `/password-reset`, `/reset-password`
- `/party`, `/party/:id`, `/party/:id/manage`, `/party/join/:inviteCode`
- `/friends` friends list (`src/renderFriendsPage.ts`)
- `/friends/:id` friend profile (`src/renderFriendProfilePage.ts`)
- `/friends/add/:friendCode` friend link landing (`src/renderFriendAddPage.ts`)
- `/admin` admin dashboard shell (`src/renderAdminPage.ts`) — requires admin auth; includes `AdminDashboardIsland` for stats
- `/admin/goals` admin goals list (`src/renderAdminGoalsPage.ts`) — requires admin auth; includes `AdminGoalsListIsland`
- `/admin/goals/new` admin add goal (`src/renderAdminGoalAddPage.ts`) — requires admin auth; includes `AdminGoalAddIsland` with form, distance preview, duplicate check
- `/admin/goals/:id` admin goal edit (`src/renderAdminGoalEditPage.ts`) — requires admin auth; includes `AdminGoalEditIsland` with form, markdown preview, save

## Frontend Architecture

### SSR Shell and Layout

`src/renderLayout.ts` provides a shared page shell:

- Base metadata + PWA tags + service worker registration
- Shared styles (`/css/main.css`, `/css/drawer.css`)
- Shared drawer island mount (`data-island="DrawerIsland"`)
- Shared island bundle injection (`/js/client/islands.js` + `/js/client/islands.css`)
- Optional extra scripts/styles per page

### Islands + Legacy JS Interop

- New interactive features live in `client/src/` and are hydrated islands.
- Legacy flow logic still exists in `public/js/` modules.
- `client/src/index.tsx` exposes bridge globals:
- `window.preact` for `render`/`h`
- `window.preactIslands` for programmatic island rendering
- `window.partyStore` for shared party state integration

This allows incremental migration without breaking existing vanilla workflows.

### Map Stack

- Primary map island: `MapIsland`
- Rendering technology: Konva + typed map utilities (`client/src/components/map`, `client/src/utils/map-*.ts`)
- State: Preact Signals stores (`client/src/stores/mapStore.ts`, `partyStore.ts`)
- Social panel: Unified panel replacing the fellowship-only selector — includes fellowship view selector and "Show Friends" toggle for friend avatar markers on the map

## Authentication Model

Auth is token-based via `Authorization: Bearer <token>`.

- Session validation is centralized in `validateSession()` (`src/auth-handlers.ts`).
- Admin validation is centralized in `validateAdminSession()` (`src/auth-handlers.ts`), which calls `validateSession` internally then checks `is_admin = 1` in the database.
- In test mode (`ALLOW_TEST_AUTH=true`), mock bearer tokens using `TEST_MOCK_TOKEN_<username>` are supported.
- User preference fields (`showFutureGoalsUnlocked`, `defaultViewMap`) are returned by `/api/session` and updated via `/api/user/preferences`.
- Admin status (`isAdmin`) is returned by `/api/session` for client-side conditional rendering.
- Admin status can only be granted via direct D1 database access: `UPDATE users SET is_admin = 1 WHERE username = '<admin_username>';`
- All admin actions are logged to the `admin_audit_log` table via `logAdminAction()` (`src/admin-handlers.ts`).

## Data Architecture

D1 remains the source of truth.

- Core domain tables: `users`, `sessions`, `progress`, `goals`
- Auth support tables: `password_reset_tokens`, `email_confirmation_tokens`
- Fellowship tables: `parties`, `party_members`, `party_progress_log`
- Social tables: `friendships`, `fellowship_invites`
- Admin tables: `admin_audit_log`

Refer to `docs/data-models.md` for full schema details and constraints.

## Testing Architecture

- Backend: Jest (direct Worker/handler tests, no Supertest)
- Client islands/stores/utils: Vitest
- Browser E2E: Playwright

Operational commands:

- `npm run test:ui` for Chromium-only fast UI runs (3 workers)
- `npm run test:ui:all` for sequential all-browser runs (each browser still uses parallel workers)

## Deployment

- Worker config: `wrangler.json`
- Build pipeline:
- `npm run build` builds islands and updates service-worker cache version metadata
- `npm run deploy` applies migrations (predeploy) and deploys Worker

## Architectural Constraints

- Keep canonical route set (`/`, `/journey`, `/map`, `/party*`, `/login*`), no `/wtm` alias reintroduction.
- Preserve hybrid frontend approach: no broad rewrite of working legacy `public/js` code unless explicitly scoped.
- Continue using static asset pipeline (`public/img` + `goals.image_id`) rather than introducing R2 for goal images.
