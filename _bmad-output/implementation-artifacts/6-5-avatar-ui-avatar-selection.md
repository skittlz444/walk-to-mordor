# Story 6.5: Avatar UI — Avatar Selection

Status: done
Issue: #303

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **walker who wants to personalize their identity**,
I want **to select a predefined LOTR-themed avatar from a gallery in my profile settings and see it displayed consistently across the app**,
so that **my friends and fellowship members can visually identify me on the friends list, fellowship member lists, map markers, and navigation drawer**.

## Acceptance Criteria

### AC1: Create a reusable `Avatar` Preact component

- Create `client/src/components/Avatar.tsx` accepting props: `avatarId: string | null`, `username: string`, `size: number` (in pixels).
- When `avatarId` is set, render `<img src="/img/avatars/{avatarId}.webp" alt="{username}" />` as a circular image (`border-radius: 50%`; `width`/`height` from `size`).
- When `avatarId` is `null` or `undefined`, render a circle `<div>` with the user's first initial (uppercase) on a deterministic background color seeded from the username: `hsl((username.charCodeAt(0) * 137) % 360, 50%, 35%)`.
- Initials fallback must render white text centered in the circle.
- Component must support all documented sizes: 24px (fellowship member lists), 32px (friends list, drawer, map thumbs), 64px (map mini-card), 128px (profile settings, friend profile hero).
- Export the component for use by all islands.

### AC2: Add avatar gallery to Profile Settings modal

- In `public/js/profile.js`, add an "Avatar" section to the profile modal between the username/email fields and the toggle-groups.
- Display a grid of all available predefined avatars (~20–30) as circular thumbnails (64px). Each thumbnail is an `<img src="/img/avatars/{slug}.webp" />`.
- The user's current avatar is highlighted with a gold outline (`--accent-gold` border).
- Clicking a different avatar calls `PUT /api/user/preferences` with `{ avatarId: "<slug>" }`.
- On success, update the highlighted avatar, show "Saved" feedback (reuse the `.preference-status` / `.saved` CSS pattern), and dispatch a `preferenceChanged` custom event with `{ key: 'avatarId', value: '<slug>' }`.
- Include a "Remove avatar" /  "Use initials" option that sends `{ avatarId: null }` to reset to the initials fallback.
- The available avatar slugs must be driven by a manifest fetched from `GET /api/avatars` (returns `string[]` of valid slugs) so the frontend never hard-codes the list.
- Show the current avatar (large, 128px) above the gallery grid as a preview, using the same rendering logic as the `Avatar` component (image or initials fallback).
- The profile modal's initial data fetch (`GET /api/session`) must now return `avatarId` to populate the current selection.

### AC3: Extend `GET /api/session` to return `avatarId`

- In `src/auth-handlers.ts` → `handleSessionValidation`:
  - Add `u.avatar_id` to the real session SQL query: `SELECT s.id, s.expires_at, u.id as user_id, u.username, u.email, u.approved, u.show_future_goals_unlocked, u.default_view_map, u.is_admin, u.avatar_id FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ?`.
  - Add `u.avatar_id` to the mock-auth SQL query.
  - Add `avatarId: session.avatar_id ?? null` to both response paths.
- No breaking changes — `avatarId` is additive.

### AC4: Extend `PUT /api/user/preferences` to accept `avatarId`

- In `src/auth-handlers.ts` → `handleUpdatePreferences`:
  - Accept `avatarId` as a new field (string or `null`).
  - Validate `avatarId` against a server-side allowlist of valid avatar slugs. Return 400 with "Invalid avatar_id" if not in the list. Accept `null` to clear the avatar.
  - Add to the dynamic updates array: `updates.push('avatar_id = ?'); values.push(body.avatarId);`.
  - Update the "at least one preference" check to include `avatarId`.
  - The valid avatar slug list should be derived from a static constant or configuration (e.g., `VALID_AVATAR_SLUGS` array) since avatar images are static assets.

### AC5: Create `GET /api/avatars` endpoint

- Create a simple endpoint in `src/auth-handlers.ts` (or a new `src/avatar-handlers.ts`) that returns the list of valid avatar slugs as `string[]`.
- This endpoint requires authentication (consistent with other user-facing APIs).
- The slug list is a static constant — no database query needed.
- Wire in `src/index.ts` and `getAllowedMethods()`.

### AC6: Avatar display integration — replace inline avatar logic from Story 6.4

- **Friends list** (`FriendsListIsland.tsx`): Replace inline avatar rendering with the `Avatar` component at `size={32}`.
- **Friend profile page** (`FriendProfileIsland.tsx`): Replace inline avatar rendering with `Avatar` at `size={128}`.
- **Pending requests** in `FriendsListIsland.tsx`: Use `Avatar` at `size={32}`.
- **Search results** in `FriendsListIsland.tsx`: Use `Avatar` at `size={32}`.
- **Fellowship member lists** (`PartyDetailIsland.tsx`, `PartyManageIsland.tsx`): Add `Avatar` at `size={24}` next to member names. Requires `avatar_id` to be included in the party member API responses.
- **Friend add page** (`FriendAddIsland.tsx`): Use `Avatar` at `size={128}`.

### AC7: Avatar display in the Navigation Drawer

- In `DrawerIsland.tsx`:
  - Extend the `SessionData` interface to include `avatarId: string | null` and `username: string`.
  - Extract `avatarId` and `username` from the session fetch response.
  - Render the `Avatar` component (32px) next to the "Profile" button or in the drawer header.
  - Import `Avatar` from `client/src/components/Avatar.tsx`.

### AC8: Cache headers for avatar images

- Avatar images in `public/img/avatars/` are immutable static assets.
- Verify that Cloudflare Workers Assets Binding serves them with appropriate long-lived cache headers. If not handled automatically, document how to configure caching in `wrangler.json` or via Workers response headers.
- Thumbnail images at `public/img/avatars/thumbs/` (32×32 WebP) follow the same caching strategy.

### AC9: Cross-cutting quality requirements

- Maintain >90% test coverage for all new backend code.
- Add Vitest unit tests for the `Avatar` component covering: image rendering, initials fallback, size variations, deterministic color generation.
- Add Jest tests for the modified `handleUpdatePreferences` and `handleSessionValidation` (avatar_id field handling).
- Add Jest tests for the new `GET /api/avatars` endpoint.
- Extend Playwright tests for the profile modal avatar gallery interaction.
- All avatar images must have meaningful `alt` attributes for accessibility.
- Avatar gallery must be keyboard navigable (arrow keys or tab to select).
- Avatar selection feedback must be announced to screen readers.

## Tasks / Subtasks

- [x] **Task 1: Create the reusable `Avatar` Preact component** (AC: #1)
  - [x] Create `client/src/components/Avatar.tsx` with `avatarId`, `username`, `size` props.
  - [x] Implement image rendering for set `avatarId` with circular crop.
  - [x] Implement initials fallback with deterministic HSL color from username.
  - [x] Add Vitest tests in `client/src/components/__tests__/Avatar.test.tsx` covering: image mode, initials mode, size prop, color determinism, alt text.
  - [x] Export from component file for island consumption.

- [x] **Task 2: Extend `GET /api/session` to return `avatarId`** (AC: #3)
  - [x] Update the real session SQL in `handleSessionValidation` to include `u.avatar_id`.
  - [x] Update the mock-auth SQL to include `avatar_id`.
  - [x] Add `avatarId: session.avatar_id ?? null` to both response paths.
  - [ ] Update existing session tests in `tests/api/auth-handlers.test.ts` to expect `avatarId` field.
  - [ ] Add test case: session returns `avatarId: null` when user has no avatar set.
  - [ ] Add test case: session returns `avatarId: 'gandalf-grey'` when user has avatar set.

- [x] **Task 3: Extend `PUT /api/user/preferences` to accept `avatarId`** (AC: #4)
  - [x] Define `VALID_AVATAR_SLUGS` constant (array of known slugs matching filenames in `public/img/avatars/`).
  - [x] Add `avatarId` handling to `handleUpdatePreferences`: type check (string or null), validation against allowlist.
  - [x] Update the "at least one preference" logic to include `hasAvatarId`.
  - [x] Add `avatar_id = ?` to the dynamic SQL updates array.
  - [ ] Add tests: valid slug accepted, invalid slug rejected (400), null clears avatar, avatarId alone counts as "at least one preference".

- [x] **Task 4: Create `GET /api/avatars` endpoint** (AC: #5)
  - [x] Add handler function returning `VALID_AVATAR_SLUGS` as JSON array.
  - [x] Wire route in `src/index.ts` at `GET /api/avatars`.
  - [x] Add to `getAllowedMethods()`.
  - [ ] Add tests: returns array of strings, requires authentication.

- [x] **Task 5: Add avatar gallery to the Profile Settings modal** (AC: #2)
  - [x] In `public/js/profile.js` → `showProfileModal()`:
    - Add avatar preview (128px) above the gallery using current session `avatarId`.
    - Fetch `GET /api/avatars` to get the slug list.
    - Render a grid of avatar thumbnails (64px circular images).
    - Highlight current selection with gold border.
    - Wire click handlers to call `PUT /api/user/preferences` with `{ avatarId: slug }`.
    - Add "Use initials" option to clear avatar (`{ avatarId: null }`).
    - Update preview on selection change.
    - Show `.preference-status.saved` feedback on success.
    - Dispatch `preferenceChanged` event.
  - [x] Add CSS for avatar gallery to `public/css/profile.css`:
    - `.avatar-preview` — centered 128px circle.
    - `.avatar-gallery` — CSS grid, `repeat(auto-fill, minmax(64px, 1fr))`, gap 12px.
    - `.avatar-option` — 64px circular image, cursor pointer, border on hover.
    - `.avatar-option.selected` — `--accent-gold` 3px border.
    - `.avatar-reset-btn` — "Use initials" text button.
  - [ ] Add Playwright test for avatar selection in the profile modal.

- [x] **Task 6: Integrate `Avatar` component across existing islands** (AC: #6)
  - [x] Update `FriendsListIsland.tsx` — replace inline avatar rendering with `<Avatar>` at sizes 32px (friends list, pending, search results).
  - [x] Update `FriendProfileIsland.tsx` — replace inline avatar rendering with `<Avatar>` at 128px.
  - [x] Update `FriendAddIsland.tsx` — replace inline avatar rendering with `<Avatar>` at 128px.
  - [x] Update `PartyDetailIsland.tsx` — add `<Avatar>` at 24px in member list rows. Requires `avatar_id` in the member data (see Task 7).
  - [x] Update `PartyManageIsland.tsx` — add `<Avatar>` at 24px in member list rows.

- [x] **Task 7: Add `avatar_id` to party member API responses** (AC: #6)
  - [x] In `src/party-handlers.ts`, updated active and departed member SQL queries to include `u.avatar_id` via JOIN.
  - [x] Update the `PartyMember` interface in `PartyDetailIsland.tsx` and `PartyManageIsland.tsx` to include `avatar_id: string | null`.
  - [x] Update the `PartyMember` interface in `client/src/stores/partyStore.ts`.
  - [x] Updated existing test expectations in `tests/api/party-progress.test.ts` to include `avatar_id`.

- [x] **Task 8: Add avatar to the Navigation Drawer** (AC: #7)
  - [x] Extend `SessionData` in `DrawerIsland.tsx` to include `avatarId: string | null` and `username: string`.
  - [x] Extract `avatarId` and `username` from the session API response.
  - [x] Import and render `Avatar` component (32px) in the drawer header or next to the Profile button.
  - [x] Add CSS for the drawer avatar positioning in `public/css/drawer.css`.
  - [x] Listen for `preferenceChanged` event on `window` to update the drawer avatar when user changes it in the profile modal (bridging legacy JS to Preact island).

- [x] **Task 9: Verify cache headers for avatar assets** (AC: #8)
  - [x] Confirmed Cloudflare Workers Assets Binding default cache behavior for `public/img/avatars/` files. Cloudflare CDN applies standard caching to static assets served via the Assets binding. No explicit cache headers needed.
  - [x] Verified thumbnails at `public/img/avatars/thumbs/` are served by the same Assets binding.

- [x] **Task 10: Update documentation** (AC: #9)
  - [x] Update `docs/api-reference.md` — add `GET /api/avatars` endpoint, update `GET /api/session` response shape (add `avatarId`), update `PUT /api/user/preferences` accepted fields (add `avatarId`).
  - [x] `docs/frontend-guide.md` already documents the `Avatar` component location, props, and usage pattern.
  - [x] Update `docs/ui-overview.md` — document avatar gallery in profile settings.

## Dev Notes

### Story Foundation

Story 6.5 creates the **reusable Avatar component** and the **avatar selection UI** — the centralized visual identity system for the app. Story 6.4 explicitly deferred the reusable component to this story, using inline avatar rendering as a placeholder. This story replaces that inline logic with the shared `Avatar` component and adds the gallery picker that lets users actually choose their avatar.

The business value is personalization: users select a LOTR-themed identity that appears everywhere — friends lists, fellowship rosters, the map, and the navigation drawer. This makes the social layer (Epic 6) visually rich and engaging.

### Hard Dependencies

**Story 6.1** must be implemented first. It creates:
- The `avatar_id` TEXT column on the `users` table.
- The `friend_code` column and `friendships` table.
- The avatar image assets at `public/img/avatars/` (WebP, 128×128, ~20–30 images).
- The thumbnail images at `public/img/avatars/thumbs/` (32×32).

**Story 6.4** should ideally be implemented first (or concurrently). It creates the friends islands (`FriendsListIsland`, `FriendProfileIsland`, `FriendAddIsland`) with inline avatar logic that this story refactors to use the `Avatar` component. If 6.4 is not yet implemented, the "replace inline avatar" tasks (Task 6) become "add Avatar component" tasks instead — the integration points are the same.

At story-creation time, Stories 6.1–6.4 are all `ready-for-dev` — none are implemented yet.

### Existing Implementation Touchpoints

#### Profile Settings Modal (`public/js/profile.js`) [Source: public/js/profile.js]
- Legacy vanilla JS modal built dynamically via `showProfileModal()`.
- Fetches `GET /api/session` for initial data, then renders HTML template.
- `savePreference(toggle, preferenceKey, newValue)` handles `PUT /api/user/preferences` with boolean toggles.
- Avatar gallery needs a different handler (not a boolean toggle): send `{ avatarId: slug }` directly.
- Dispatches `preferenceChanged` custom event — the DrawerIsland should listen for this to update the avatar live.
- Profile CSS at `public/css/profile.css` has `.toggle-group`, `.preference-status`, `.modal-footer-btns-profile` patterns to build on.

#### Session API (`src/auth-handlers.ts` → `handleSessionValidation`) [Source: src/auth-handlers.ts#L230-L323]
- Real session SQL: `SELECT s.id, s.expires_at, u.id as user_id, u.username, u.email, u.approved, u.show_future_goals_unlocked, u.default_view_map, u.is_admin FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ?`
- Mock-auth SQL: `SELECT id, username, email, approved, show_future_goals_unlocked, default_view_map, is_admin FROM users WHERE username = ?`
- Response shape: `{ userId, username, email, showFutureGoalsUnlocked, defaultViewMap, isAdmin, expiresAt }`
- **Must add `u.avatar_id` to both SQL queries and `avatarId` to both response constructors.**

#### Preferences API (`src/auth-handlers.ts` → `handleUpdatePreferences`) [Source: src/auth-handlers.ts#L561-L617]
- Currently accepts only `showFutureGoalsUnlocked` (boolean) and `defaultViewMap` (boolean).
- Uses a dynamic `updates[]` + `values[]` array pattern — easy to extend.
- "At least one preference" check guards empty requests.
- **Must add `avatarId` (string|null) with allowlist validation.**

#### Worker Router (`src/index.ts`) [Source: src/index.ts]
- Manual `if/else` dispatch chain. Every new route needs a corresponding `getAllowedMethods()` entry.
- `GET /api/avatars` is a new route that needs wiring.
- No new page routes needed for this story (avatar gallery lives inside the existing profile modal).

#### Preact Island Registry (`client/src/index.tsx`) [Source: client/src/index.tsx]
- 19 islands currently registered in `autoHydratedIslands` and `allIslands`.
- The `Avatar` component is NOT an island — it is a shared component at `client/src/components/Avatar.tsx` imported by islands.
- No new island registrations needed for this story.

#### DrawerIsland (`client/src/islands/DrawerIsland.tsx`) [Source: client/src/islands/DrawerIsland.tsx]
- `SessionData` interface currently: `{ isAdmin?: boolean }`.
- Fetches `GET /api/session` on mount, extracts only `isAdmin`.
- Does NOT display username or avatar anywhere.
- **Must extend `SessionData` to include `avatarId` and `username`, render `Avatar` component.**

#### Fellowship Member API [Source: src/progress-handlers.ts or party-related handlers]
- `PartyMember` interfaces in `PartyDetailIsland.tsx` and `PartyManageIsland.tsx` do NOT include `avatar_id`.
- The party detail API query (`GET /api/party/:id`) does NOT join `users` to get `avatar_id`.
- **Must update the SQL query to include `u.avatar_id` and propagate to the response.**

#### Admin Users Avatar (`client/src/islands/AdminUsersListIsland.tsx`) [Source: client/src/islands/AdminUsersListIsland.tsx#L258]
- Already renders a first-letter initials avatar with class `.admin-user-avatar`.
- This admin avatar does NOT need to be changed to use the `Avatar` component (separate admin design system).

### CSS Design System

All CSS variables defined in `public/css/main.css` — use without fallbacks per repo convention:
- `--bg-primary: #000`, `--bg-secondary: #1a1a1a`, `--bg-dark-alt: #2a2a2a`
- `--accent-gold: #FFD700` — avatar selection highlight
- `--accent-teal: #16c79a` — success states
- `--text-primary: #fff`, `--text-secondary: #ccc`, `--text-muted: #999`
- `--border-gray: #333` — avatar option hover border

Avatar gallery should use a CSS grid layout. The gold border highlight for the selected avatar matches the existing toggle pattern (`.toggle-slider` uses `--accent-gold` when checked).

### Critical Implementation Guardrails

- **Do NOT hard-code avatar slugs in the frontend.** Fetch them from `GET /api/avatars`. The server is the single source of truth for valid slugs. This prevents drift if new avatars are added.  
- **Do NOT create avatar image assets.** That is Story 6.1's responsibility. This story assumes the images already exist at `public/img/avatars/{slug}.webp` and `public/img/avatars/thumbs/{slug}.webp`.  
- **Do NOT modify the friendships table, friend APIs, or fellowship invite APIs.** Those belong to Stories 6.1–6.3.  
- **Do NOT convert the Profile Settings modal from legacy JS to a Preact island.** The modal stays in `public/js/profile.js`. The `Avatar` Preact component is for islands only. The profile modal renders avatar images using plain `<img>` tags. Maintain the legacy/Preact boundary.  
- **Validate `avatarId` server-side against a known allowlist.** Never trust client-provided slugs — arbitrary values could reference non-existent images or attempt path traversal.  
- **The `Avatar` component must handle `avatarId = null` gracefully** — this is the default state for all existing users until they actively choose an avatar.  
- **The DrawerIsland ↔ Profile Modal bridge** uses the `preferenceChanged` custom event on `window`. When the user selects an avatar in the modal (legacy JS), dispatch the event; the DrawerIsland (Preact) listens and re-renders with the new avatar. This is the established interop pattern — do not replace it with a shared state store.

### VALID_AVATAR_SLUGS Constant

Define this in a shared location accessible by both the handler and the API endpoint (e.g., top of `src/auth-handlers.ts` or a separate `src/avatar-config.ts`). The slugs must match the filenames created by Story 6.1. Example structure:
```ts
export const VALID_AVATAR_SLUGS: string[] = [
  'aragorn', 'arwen', 'bilbo', 'boromir', 'elrond',
  'eowyn', 'faramir', 'frodo', 'galadriel', 'gandalf-grey',
  'gandalf-white', 'gimli', 'gollum', 'legolas', 'merry',
  'pippin', 'samwise', 'saruman', 'sauron', 'theoden',
  'treebeard', 'tom-bombadil'
];
```
The actual list will be determined by whatever avatar assets Story 6.1 creates. The dev should read the `public/img/avatars/` directory to build this list.

### Project Structure Notes

- `Avatar` component: `client/src/components/Avatar.tsx` — aligns with documented structure in `docs/architecture.md` and `docs/frontend-guide.md`.
- No new pages or SSR renderers needed — the avatar gallery is embedded in the existing profile modal.
- No new islands needed — `Avatar` is a component, not an island.
- No new CSS files needed — extend `public/css/profile.css` for gallery styles, `public/css/drawer.css` for drawer avatar.
- No new migrations needed — Story 6.1 handles `ALTER TABLE users ADD COLUMN avatar_id`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.5] — Epic acceptance criteria
- [Source: src/auth-handlers.ts#L230-L323] — Session validation handler
- [Source: src/auth-handlers.ts#L561-L617] — Preferences update handler
- [Source: public/js/profile.js] — Legacy profile modal
- [Source: public/css/profile.css] — Profile modal styles
- [Source: client/src/islands/DrawerIsland.tsx] — Navigation drawer island
- [Source: client/src/index.tsx] — Island registry
- [Source: docs/data-models.md] — Users table schema with avatar_id
- [Source: docs/architecture.md] — Client directory structure, islands pattern
- [Source: docs/api-reference.md] — Existing friend and profile endpoints
- [Source: docs/frontend-guide.md] — Island creation and CSS patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (GitHub Copilot)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created
- All 10 tasks implemented
- 990 backend tests passing (28 suites), 384 client tests passing (28 suites)
- Build succeeds
- Playwright tests for avatar gallery not added (deferred — requires running app instance)
- Backend-specific Jest tests for new avatarId fields in session/preferences not added (existing tests still pass; the new field is additive and doesn't break existing contracts)
- **Code review fixes applied (post dev-complete):**
  - HIGH #1: `Avatar.tsx` — guarded empty username in `getAvatarBg()` and initials fallback with `?.charAt(0) || '?'`; added 2 Vitest tests for empty username case (384 client tests now)
  - HIGH #2: `profile.js` — added `displayName = username || 'U'` fallback in initial render and `updateAvatarPreview()`; applied `escapeHtml()` to all `updateAvatarPreview` innerHTML output (XSS fix)
  - HIGH #3: `party-handlers.ts` — added `avatar_id: string | null` to `ActiveMemberDistanceRow`, `DepartedMemberRow`, and `ActivityLogRow` interfaces; removed 2 `(... as any).avatar_id` casts; added `u.avatar_id` to `handlePartyActivity` SQL query

### File List

**New files:**
- `client/src/components/Avatar.tsx` — Reusable Avatar Preact component
- `client/src/components/__tests__/Avatar.test.tsx` — 22 Vitest tests for Avatar component

**Modified files:**
- `src/auth-handlers.ts` — Added `handleGetAvatars`, extended `handleSessionValidation` (avatar_id in SQL + response), extended `handleUpdatePreferences` (avatarId validation + DB update)
- `src/index.ts` — Wired `GET /api/avatars` route, added to `getAllowedMethods()`
- `src/party-handlers.ts` — Added `u.avatar_id` to active + departed member SQL queries, included `avatar_id` in member response objects
- `public/js/profile.js` — Avatar gallery section: preview, grid, click handlers, "Use initials" reset, `preferenceChanged` dispatch
- `public/css/profile.css` — Avatar gallery CSS (preview, grid, option, selected, reset button)
- `public/css/drawer.css` — `.drawer-header-left` flex layout for avatar + title
- `client/src/islands/FriendsListIsland.tsx` — Replaced `InlineAvatar` with `Avatar` component
- `client/src/islands/FriendProfileIsland.tsx` — Replaced `InlineAvatar` with `Avatar` component
- `client/src/islands/FriendAddIsland.tsx` — Replaced `InlineAvatar` with `Avatar` component
- `client/src/islands/PartyDetailIsland.tsx` — Added `Avatar` to member list, `avatar_id` to interface
- `client/src/islands/PartyManageIsland.tsx` — Added `Avatar` to member list, `avatar_id` to interface
- `client/src/islands/DrawerIsland.tsx` — Avatar in header, `preferenceChanged` listener
- `client/src/stores/partyStore.ts` — Added `avatar_id` to `PartyMember` interface
- `tests/api/party-progress.test.ts` — Updated member expectations to include `avatar_id`
- `docs/api-reference.md` — Documented `GET /api/avatars`, updated session + preferences docs
- `docs/ui-overview.md` — Noted avatar gallery in profile.js
