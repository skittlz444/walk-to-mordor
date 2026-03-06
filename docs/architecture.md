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

### Page Routes

- `/` home redirect shell (`src/renderHomePage.ts`)
- `/journey` main journey UI (`src/renderHtml.ts`)
- `/map` map UI (`src/map-handlers.ts`)
- `/login`, `/password-reset`, `/reset-password`
- `/party`, `/party/:id`, `/party/:id/manage`, `/party/join/:inviteCode`

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

## Authentication Model

Auth is token-based via `Authorization: Bearer <token>`.

- Session validation is centralized in `validateSession()` (`src/auth-handlers.ts`).
- In test mode (`ALLOW_TEST_AUTH=true`), mock bearer tokens using `TEST_MOCK_TOKEN_<username>` are supported.
- User preference fields (`showFutureGoalsUnlocked`, `defaultViewMap`) are returned by `/api/session` and updated via `/api/user/preferences`.

## Data Architecture

D1 remains the source of truth.

- Core domain tables: `users`, `sessions`, `progress`, `goals`
- Auth support tables: `password_reset_tokens`, `email_confirmation_tokens`
- Fellowship tables: `parties`, `party_members`, `party_progress_log`

Refer to `docs/data-models.md` for full schema details and constraints.

## Testing Architecture

- Backend: Jest + Supertest
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
