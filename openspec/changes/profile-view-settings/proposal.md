# Profile View / Settings Split

## Why

`/profile` today is both the user's personal page and the only settings surface. It is built around a compact settings form (username, email, avatar gallery, preference toggles, journey switch, push, logout) that also hosts the achievement badge grid. Users have no read-only way to look at their own journey: the friend view (`/friends/:id`) is the page that looks like a personal profile — avatar, name, stats, badges — while the user's own profile is a form.

**Product intent**: split the profile into two pages — a **view** page that feels like the friend profile view (see your stats, badges, community) and a **settings** page where everything is changed. The view page carries a clear button to settings, and clicking your avatar on the view page opens the avatar picker modal.

**Supporting facts**:
- `renderProfilePage.ts` is mounted at `GET /profile` (`src/index.ts:195`) with `ProfileIsland` + `PushPermissionIsland` + `BadgeDisplayIsland` in one page.
- `ProfileIsland` (534 lines) is the only island that mixes presentation with editing, and it silently renders a blank form when its session fetch returns 401.
- `/api/total-distance` and `/api/goals` already exist, so own distance and goal data are reachable — but three things the view page needs are not: `memberSince` (`users.created_at` is exposed by no self-facing API today), a server-resolved next-goal title (the goal-vs-distance resolution exists only inside other handlers), and a compact fellowship summary (the party endpoints return management payloads).
- No avatar picker modal exists; the avatar gallery is an inline radiogroup inside `ProfileIsland` (`client/src/islands/ProfileIsland.tsx:379-425`).

## What Changes

- **Route split**: `GET /profile` becomes the **view** page (read-only profile); a new `GET /profile/settings` serves the settings page. `/friends/:id` is unchanged.
- **View page** (`ProfileViewIsland`): read-only avatar *button* + username, stats grid (total distance, member since), "Heading to" goal line, active journey line, a fellowships card when the user belongs to a fellowship, and the existing `BadgeDisplayIsland` badge grid. Prominent **Settings** button. Clicking the avatar opens the avatar picker modal. The view stays read-only: logout and journey switching remain settings-only.
- **Avatar picker modal** (`AvatarPickerModal`): shared component extracted from `ProfileIsland`'s avatar section; used by the view page (opened via the avatar) and the settings page (opened via a "Change avatar" button). Preserves the save-on-select semantics; current-avatar preview stays visible outside the gallery while it loads.
- **Settings page** (`ProfileSettingsIsland`): carries every editing behaviour `ProfileIsland` has today (username/email, avatar, two preference toggles, journey switch with carry/reset confirm dialog + `clearMapCache`, Save/Logout), plus back links to the view page and a new 401 → `/login` branch. `PushPermissionIsland` moves to this page unchanged.
- **New self-overview API**: `GET /api/profile/overview` (auth-guarded) returns everything the view page needs in one request, including the first-ever self-facing `memberSince` (ISO-converted UTC) and a server-resolved `currentGoalTitle` (null when the storyline has no goals). No DB migration, no schema change.
- **Page wrapper**: both renderers own one page wrapper (`.party-page` / `.profile-page`) so the badge grid, push card, hero, and CTA align instead of islands self-wrapping.
- **Navigation loop**: drawer Profile → view; view Settings button → settings; settings breadcrumb/button → view; explicit links (no `history.back()`), both islands redirect on 401. Settings is deep-linkable.
- **Styles**: new `public/css/profile-view.css` owns the shared profile styles — avatar button, Settings CTA, stat skeleton, settings back row, and the avatar picker modal — and is loaded by both renderers; everything else reuses `party.css` / `friends.css` / `profile.css` / `badge-display.css`.
- **Test migration is part of this change**: existing Jest suites that mock/import `renderProfilePage` (`tests/api/index.test.ts`, `tests/api/renderBadgePages.test.ts`) and Playwright suites that wait for `ProfileIsland` on `/profile` (`tests/ui/profile.spec.js`, `preference-toggle.spec.js`, `map-shell.spec.js`, `email-confirmation.spec.js`) are migrated to the new pages; `npm run test:ui` is a mandatory validation task.
- **Design review artifacts**: tracked high-fidelity HTML mockups (view, settings, avatar modal). The PNG screenshots under gitignored `_inspection-screenshots/profile-view-settings/` are gitignored review outputs, regenerable from the mockups.

## Capabilities

### New Capabilities

- `profile-view-settings`: view/settings page split, self-overview API, `ProfileViewIsland` / `ProfileSettingsIsland` islands, shared `AvatarPickerModal`, avatar-as-button on the view page, navigation loop with 401 redirects, and profile loading/error states.

### Modified Capabilities

- None. `profile-badge-display` (badge endpoint, presentation, grids, and its render-nothing zero-badge behaviour), `shared-achievement-infrastructure`, and `/friends/:id` are untouched. `hono-router` does not spec per-page renderer routes, so the `/profile` page behaviour change needs no delta.

## Impact

- **Worker page routes** (`src/index.ts`): `GET /profile` now renders the view page; adds `GET /profile/settings`.
- **SSR renderers**: `src/renderProfilePage.ts` is deleted and replaced by `src/renderProfileViewPage.ts` + `src/renderProfileSettingsPage.ts`; both own the page wrapper.
- **New API**: `src/profile-handlers.ts` gains `handleGetProfileOverview(request, db, userId)`, composing `calculateUserStorylineDistance` (`src/goals-handlers.ts:61`), `resolveUserStoryline`, `listStorylineGoals`, `users.created_at` (ISO-converted), and the fellowship query; wired as `app.get('/api/profile/overview', authGuard, ...)`.
- **Frontend islands**: `ProfileIsland.tsx` is deleted and split into `ProfileViewIsland.tsx` + `ProfileSettingsIsland.tsx`; new shared `client/src/components/AvatarPickerModal.tsx`; registry changes in `client/src/index.tsx`.
- **CSS**: new `public/css/profile-view.css` (view chrome + shared avatar modal + back row); `profile.css` stays the settings-page stylesheet.
- **Docs**: `docs/api-reference.md` (overview endpoint + handler-map row + a page-routes section), `docs/frontend-guide.md` (page/island split; stale `ProfileIsland` references replaced), `docs/design-guide.md` (view page components).
- **Tests**: Jest (new overview handler/routes, both new renderers, migrated `renderBadgePages`/`index` suites), Vitest (view, settings, avatar modal), Playwright (migrated profile suites to `/profile` view and `/profile/settings`).
- **No migration**: no D1 DDL/DML and no new `migrations/*.sql`; rollback is a plain code revert with no data rollback.
- **Explicitly out of scope**: avatar uploads, in-app password change (none exists today), any change to the friend profile page, `BadgeDisplayIsland`, or the achievements API.
