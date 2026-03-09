# UI Overview

Last updated: 2026-03-09

## Rendering Pattern

The UI uses SSR shells from the Worker plus client hydration.

- SSR page composition: `src/renderLayout.ts` and page renderers in `src/render*.ts`
- Shared island bundle: `/js/client/islands.js`
- Shared legacy runtime scripts (on non-public pages): `/js/profile.js`, `/js/main.js`

This is intentionally not an SPA. Route handling remains server-driven.

## Page Shells

### Main Journey Page (`/journey`)

Rendered by `src/renderHtml.ts`.

- Mount points for goals and calendar containers
- Vanilla modules loaded: `validators.js`, `calendar.js`, `progress.js`, `goals.js`
- Programmatic islands used by vanilla modules for specific UI regions

### Map Page (`/map`)

Rendered by `src/map-handlers.ts`.

- Auto-hydrated island mount: `MapIsland`
- Adds map-specific styles and scripts

### Fellowship Pages

Rendered by:

- `src/renderPartyListPage.ts` -> `PartyListIsland`
- `src/renderPartyDetailPage.ts` -> `PartyDetailIsland`
- `src/renderPartyManagePage.ts` -> `PartyManageIsland`
- `src/renderPartyJoinPage.ts` -> `PartyJoinIsland`

### Friends Pages

Rendered by:

- `src/renderFriendsPage.ts` -> `FriendsListIsland` (friends list, pending requests, username search, share friend link)
- `src/renderFriendProfilePage.ts` -> `FriendProfileIsland` (friend profile with avatar, distance, shared fellowships)
- `src/renderFriendAddPage.ts` -> `FriendAddIsland` (friend link landing page for `/friends/add/:friendCode`)

### Admin Pages

Rendered by:

- `src/renderAdminPage.ts` -> `AdminDashboardIsland` (dashboard shell with sidebar nav, breadcrumbs, stat cards)
- `src/renderAdminGoalsPage.ts` -> `AdminGoalsListIsland` (paginated goals table with search, sort, row-click navigation)
- `src/renderAdminGoalEditPage.ts` -> `AdminGoalEditIsland` (goal edit form with markdown preview, validation, save/back actions)

Admin pages use `/css/admin.css` for layout and card styles. Admin nav includes links to Dashboard, Goals (active on goals pages), Users (disabled), Metrics (disabled), and a "Back to Site" link to `/journey`.

## Island Inventory

Registered in `client/src/index.tsx`.

Auto-hydrated islands:

- `AdminDashboardIsland`
- `AdminGoalEditIsland`
- `AdminGoalsListIsland`
- `AuthForms`
- `DrawerIsland`
- `FriendsListIsland`
- `FriendProfileIsland`
- `FriendAddIsland`
- `MapIsland`
- `PartyListIsland`
- `PartyDetailIsland`
- `PartyManageIsland`
- `PartyJoinIsland`

Programmatic islands used by legacy scripts or targeted mounts:

- `DistanceModal`
- `GoalModal`
- `NextGoalCard`
- `UpcomingGoalCard`
- `PartySelector`
- `MapIsland` also contains the Social Panel (unified panel replacing fellowship-only selector; includes fellowship view selector + "Show Friends" toggle for friend avatar markers — not a separate island)

## Legacy JS Modules

Primary modules in `public/js/`:

- `main.js`: app bootstrap and shared state wiring
- `profile.js`: profile and preference modal behavior
- `calendar.js`/`progress.js`: progress CRUD workflows
- `goals.js`: goal list and modal orchestration
- `validators.js`: shared frontend validation helpers

## State Management

- New island/map/fellowship state uses Preact Signals stores in `client/src/stores/`.
- Legacy UI state remains in vanilla module state and browser storage.
- Bridge globals exposed from islands entry allow gradual interoperability.

## Styling

- Global styles: `public/css/main.css`
- Drawer: `public/css/drawer.css`
- Feature styles include `party.css`, `map.css`, `calendar.css`, `progress.css`, `auth.css`
- Theme behavior and variable conventions are documented in `docs/css-theming.md`.

## Navigation

- `DrawerIsland` navigation links: Journey, Map, Fellowships, Friends
- **Friends nav link** displays a badge count of pending incoming friend requests
- **Fellowships nav link** displays a badge count of pending fellowship invites
- Home route (`/`) performs auth-aware redirect to `/journey` or `/map` based on session preferences.
- Party route precedence is intentionally ordered to avoid dynamic route collisions (`/party/join/:inviteCode` before `/party/:id`).
- Friends route precedence: `/friends/add/:friendCode` before `/friends/:id`.
