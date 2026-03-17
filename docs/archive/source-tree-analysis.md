---
name: source-tree-analysis
description: Annotated directory map, entry points, and feature-to-file mapping for the project.
---

# Source Tree Analysis

Last updated: 2026-03-17

## Directory Tree

```text
walk-to-mordor/
  src/               # Worker entry, route dispatch, API handlers, SSR page renderers
  client/            # Preact islands app (Vite build + Vitest tests)
    src/islands/     # Page-level and programmatic Preact islands + co-located tests
    src/components/  # Shared UI: Avatar, ActivityFeed, map/ (Konva layers), admin/
    src/stores/      # Preact Signals: mapStore (progress/milestones), partyStore (party view)
    src/data/        # Waypoint coordinates and fellowship path data
    src/utils/       # Map geometry, caching, color palette helpers
    src/types/       # TypeScript interfaces (Goal, MapViewState, etc.)
  public/            # Static assets served by Workers Assets binding
    css/             # Feature-scoped stylesheets (main, auth, calendar, map, party, etc.)
    js/              # Legacy vanilla JS + Vite-built island bundle (js/client/)
    img/             # Map tiles, avatars, goal images, image-manifest.json
  migrations/        # D1 SQL migrations (0001–0124)
  tests/api/         # Jest API tests (miniflare environment)
  tests/ui/          # Playwright E2E specs (chromium) + helpers/
  scripts/           # Node.js asset pipeline tools (image optimization, tiling, manifest)
  docs/              # Living project documentation
```

## Organization Decisions

- **Islands Architecture**: Legacy vanilla JS (`public/js/`) coexists with Preact islands (`client/`). Never rewrite working legacy JS without explicit permission. New features go in `client/`.
- **SSR shells**: Each route has a `render*Page.ts` in `src/` that provides the HTML shell with `data-island` mount points. The shell controls which CSS files and scripts load.
- **`renderLayout.ts`**: Shared full-page layout factory. Extra stylesheets must be explicitly listed in the page renderer's config — CSS from other features won't auto-include.
- **`renderHtml.ts`**: Bare HTML factory used only by the map page (separate from `renderLayout`).
- **Legacy/island interop**: Bridge globals (`window.preact`, `window.preactIslands`, `window.partyStore`) allow cross-boundary communication.
- **Static assets over R2**: Goal images, avatars, and map tiles are committed in `public/img/`. No cloud storage integration.
- **Validators mirrored**: `src/validators.ts` and `public/js/validators.js` must stay in sync.

## Feature Domain → File Mapping

| Feature | Server handlers | Client islands/components | CSS |
|---|---|---|---|
| Auth (login, register, session) | `auth-handlers.ts`, `auth-utils.ts` | `AuthForms.tsx` | `auth.css` |
| Password reset | `auth-handlers.ts` | (legacy `password-reset.js`) | `auth.css` |
| Email | `email-utils.ts`, `email-templates.ts` | — | — |
| Progress tracking | `progress-handlers.ts` | `DistanceModal.tsx`, `MapWalkIsland.tsx` | `progress.css`, `calendar.css` |
| Goals / milestones | `goals-handlers.ts` | `GoalModal.tsx`, `NextGoalCard.tsx`, `UpcomingGoalCard.tsx` | `goals.css` |
| Map | `map-handlers.ts` | `MapIsland.tsx`, `components/map/*` | `map.css` |
| Fellowship (parties) | `party-handlers.ts` | `PartyListIsland`, `PartyDetailIsland`, `PartyManageIsland`, `PartyJoinIsland`, `PartySelector` | `party.css` |
| Fellowship invites | `fellowship-invite-handlers.ts` | (within party islands) | `party.css` |
| Friends / social | `friends-handlers.ts` | `FriendsListIsland`, `FriendAddIsland`, `FriendProfileIsland` | `friends.css` |
| Admin | `admin-handlers.ts` | `AdminDashboardIsland`, `AdminGoals*Island`, `AdminUsersListIsland`, `AdminMetricsIsland`, `ImageBrowserModal` | `admin.css` |
| Navigation | — | `DrawerIsland.tsx` | `drawer.css` |
| Avatars | `avatar-slugs.ts` | `Avatar.tsx`, `UserMarker.ts`, `FriendMarkers.ts` | — |

## Entry Points

| Entry point | Role |
|---|---|
| `src/index.ts` | Worker entry: `matchRoute()` router, CORS, method guards |
| `client/src/index.tsx` | Island hydration entry: discovers `[data-island]` mounts |
| `public/js/main.js` | Legacy app controller: session management, `body.authenticated` signal |
| `public/sw.js` | Service worker: cache-first strategy, build-stamped `CACHE_NAME` |

## Hydration Signals

- `body.authenticated` — set by `main.js` after session check; legacy JS depends on this.
- `[data-hydrated="true"]` — set by island entry after Preact mounts; Playwright tests wait on this.

## Migration Milestones

| Range | Purpose |
|---|---|
| 0001–0005 | Core schema: progress, goals, constraints |
| 0006–0010 | Auth: users, sessions, password reset tokens |
| 0011–0019 | Goal description batch updates |
| 0020–0021 | Email confirmation tokens, `image_id` on goals |
| 0022–0116 | Goal image assignments |
| 0117–0118 | User preference columns |
| 0119 | Fellowship: parties, party_members |
| 0120–0121 | Admin column, audit log |
| 0122 | Friendships, social identity (friend_code) |
| 0123 | Fellowship invites |
| 0124 | Party messages |

## Testing Structure

- **Backend (Jest)**: `tests/api/` — miniflare environment, one test file per handler module. Run: `npx jest --no-cache`.
- **Client (Vitest)**: Co-located `*.test.tsx` files in `client/src/islands/` and `client/src/components/`. Run: `cd client && npx vitest run`. Uses `happy-dom`.
- **E2E (Playwright)**: `tests/ui/` — chromium, 3 workers. Run: `npm run test:ui -- --run`. Helpers in `tests/ui/helpers/` (auth, cleanup, fixtures, mock-auth bypass via `TEST_MOCK_TOKEN`).
- **Key pattern**: Playwright tests must use API pre-configuration (e.g., `PUT /api/user/preferences`) instead of `page.route()` session interception — route interception blocks auth/hydration flow.

## Asset Pipeline

- `scripts/optimize-images.js` → `public/img/highres/` + `public/img/thumbs/` (WebP)
- `scripts/optimize-avatars.js` → `public/img/avatars/` + `thumbs/` (64×64 WebP)
- `scripts/tile-map-image.js` → `public/img/map/tiles/` (6-level pyramid)
- `scripts/generate-image-manifest.js` → `public/img/image-manifest.json`
- Vite build → `public/js/client/islands.js` + `islands.css` (generated, do not hand-edit)
