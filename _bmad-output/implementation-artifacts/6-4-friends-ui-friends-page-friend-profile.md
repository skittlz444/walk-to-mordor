# Story 6.4: Friends UI — Friends Page & Friend Profile

Status: ready-for-dev
Issue: #302

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **walker who wants to discover, manage, and interact with friends**,
I want **a Friends page for managing friend relationships, a Friend Profile page for viewing friend details, a friend-code landing page for link-based friend discovery, and fellowship-invite surfaces integrated into the existing Fellowships and Fellowship Detail pages**,
so that **the social features built in Stories 6.1–6.3 are accessible through polished, discoverable UI surfaces that follow the existing dark-card design system and Island Architecture conventions**.

## Acceptance Criteria

### AC1: Create the Friends page at `/friends` with SSR shell and Preact island

- Create `/friends` route in `src/index.ts` serving HTML from `renderFriendsPage()`.
- Create `src/renderFriendsPage.ts` following the exact `renderLayout()` pattern used by `renderPartyListPage.ts`.
- Create `client/src/islands/FriendsListIsland.tsx` with these sections:
  - **Pending Requests section** (collapsible) at the top showing incoming friend requests from `GET /api/friends/pending`. Each row shows avatar (32px circle), username, and "Accept" / "Reject" buttons. Hide section when count is 0.
  - **Friends list** below: each row shows avatar (32px circle), username, "Last Progressed" date (e.g. "3 days ago" using relative time). Clicking a friend navigates to `/friends/:userId`.
  - **Search section**: username search input (minimum 3 characters, debounced 300ms) calling `GET /api/friends/search?q=<value>`. Results show avatar, username, friendship status badge ("Friends ✓" / "Pending" / "Add Friend" button for non-friends).
  - **Share friend link section**: display the personal friend link `{origin}/friends/add/{friendCode}` with "Copy Link" and "Share" buttons using the same copy/share pattern as `PartyDetailIsland.tsx` invite code sharing.
  - **Empty state**: "No friends yet" with prompt to search or share link.
  - **Loading skeleton** while initial data loads.
- Register `FriendsListIsland` in `client/src/index.tsx` in both `autoHydratedIslands` and `allIslands`.

### AC2: Create the Friend Link Landing page at `/friends/add/:friendCode` with SSR shell and Preact island

- Add `/friends/add/:friendCode` route in `src/index.ts` — must be checked **before** `/friends/:id` to prevent route shadowing.
- Create `src/renderFriendAddPage.ts` following the `renderLayout()` pattern.
- Create `client/src/islands/FriendAddIsland.tsx`:
  - Extract `friendCode` from the URL path.
  - Call `GET /api/friends/resolve/:friendCode` to get the target user preview (username, avatar_id).
  - **Authenticated users**: Show avatar (128px), username, and "Send Friend Request" button calling `POST /api/friends/request/code`.
  - **Non-authenticated users**: Show the same preview with a "Log in to Add Friend" button that redirects to `/login?returnTo=/friends/add/:friendCode` using the same `returnTo` pattern as `PartyJoinIsland.tsx`.
  - **Error states**: Invalid code (404), already friends, pending request, self-add.
  - **Success state**: "Friend request sent!" message with link back to `/friends`.
- Register `FriendAddIsland` in `client/src/index.tsx`.

### AC3: Create the Friend Profile page at `/friends/:id` with SSR shell and Preact island

- Add `/friends/:id` route in `src/index.ts` after `/friends/add/:friendCode` to avoid shadowing.
- Create `src/renderFriendProfilePage.ts` following the `renderLayout()` pattern.
- Add a new backend endpoint `GET /api/friends/:userId/profile` in `src/friends-handlers.ts` that:
  - Requires authentication.
  - Validates that the current user has an accepted friendship with the target user (returns 404 if not friends — privacy enforcement).
  - Returns `{ username, avatar_id, total_distance, member_since, current_goal_title, fellowships: [{ id, name, is_shared }] }` where `is_shared` indicates the current user is also an active member.
  - `total_distance` is computed as `SELECT COALESCE(SUM(distance), 0) FROM progress WHERE user_id = ?`.
  - `member_since` is `users.created_at`.
  - `current_goal_title` is the next unlocked goal title (first goal whose distance exceeds the friend's total distance). If all goals passed, use the last goal title.
  - Fellowships query returns all non-dissolved parties the friend is an active member of, decorated with `is_shared` when the current user is also active in that party.
- Create `client/src/islands/FriendProfileIsland.tsx`:
  - Extract `userId` from the URL path.
  - Call `GET /api/friends/:userId/profile`.
  - Show: username (large), avatar image (128px) or initials fallback, total distance walked, member since date.
  - **Fellowships section**: list the friend's fellowships. Highlight shared ones with a "✦ Shared" badge. Non-shared show name only (no join shortcut).
  - **Remove Friend** button with confirmation dialog using the same `party-confirm-overlay` / `party-confirm-dialog` pattern.
  - **Back navigation**: `← Friends` breadcrumb using the `.party-breadcrumb` class pattern.
  - On 404 response, display "User not found or not a friend" message.
- Register `FriendProfileIsland` in `client/src/index.tsx`.

### AC4: Add "Friends" nav link with pending-request badge to the DrawerIsland

- Add a "Friends" link (`<a href="/friends">`) to the DrawerIsland navigation between "Fellowships" and "Admin".
- Add a badge showing the count of pending incoming friend requests. Fetch `GET /api/friends/pending` on drawer mount (alongside the existing session check) and display the count from the response.
- Add a badge on the "Fellowships" link showing the count of pending fellowship invites. Fetch `GET /api/user/fellowship-invites` on drawer mount and display the count.
- Only show badges when count > 0.
- Add `.drawer-badge` CSS to `public/css/drawer.css`.

### AC5: Add "Pending Fellowship Invites" section to the Fellowships list page (`PartyListIsland`)

- On the existing Fellowships page (`/party`), fetch `GET /api/user/fellowship-invites` (Story 6.3 endpoint).
- If pending invite count > 0, render a "Pending Invites" section above "Your Fellowships".
- Each invite card shows: party name, member count, total distance, "Invited by: {inviter_username}", created_at.
- "Accept" and "Decline" buttons per invite card.
- Accept calls `POST /api/user/fellowship-invites/:inviteId/accept` then refetches both invites and the active parties list.
- Decline calls `POST /api/user/fellowship-invites/:inviteId/reject` then removes the invite from the list.
- Use existing `party-btn party-btn--primary` for Accept, `party-btn party-btn--danger` for Decline.

### AC6: Add "Add Friend" button on Fellowship Detail page member list (`PartyDetailIsland`)

- On the Fellowship Detail page (`/party/:id`), fetch `GET /api/friends` alongside existing data to get the current user's friend list.
- For each member in the member list who is NOT the current user and NOT already a friend or pending: show an inline "Add Friend" icon/button.
- Clicking sends `POST /api/friends/request { user_id: member.user_id }` and optimistically changes the button to "Pending".
- For members who ARE already friends: show a "Friends ✓" label.
- For members with pending requests: show "Pending" label.
- Keep the existing member list layout intact; add the friend action as a small inline element.

### AC7: Add route registrations and allowed methods for all new page routes and the friend profile API

- Register in `src/index.ts`:
  - `GET /friends` → page route
  - `GET /friends/add/:friendCode` → page route (before `/friends/:id`)
  - `GET /friends/:id` → page route (after `/friends/add/:friendCode`)
  - `GET /api/friends/:userId/profile` → API route
- Update `getAllowedMethods()` for `GET /api/friends/:userId/profile`.
- Ensure route ordering prevents shadowing: `/friends/add/:friendCode` must come before `/friends/:id`.

### AC8: Follow cross-cutting quality requirements

- All new pages follow existing accessibility patterns (ARIA labels, focus management, keyboard navigation, WCAG AA contrast).
- All new pages functional on ≥320px screens (responsive design).
- Use `history.pushState` for client-side navigation where appropriate (friend list → profile transitions).
- Avatar rendering: when `avatar_id` is set, render `<img src="/img/avatars/{avatar_id}.webp" />`. When NULL, render a circle with the user's first initial (uppercase) on a deterministic background color. This is an inline implementation — Story 6.5 creates the reusable `Avatar` component; this story should keep the logic minimal and co-located.
- Add Playwright UI tests for all new page routes and critical user flows.
- Maintain >90% test coverage for new backend code.

## Tasks / Subtasks

- [ ] **Task 1: Add the friend profile backend endpoint** (AC: #3, #7)
  - [ ] Add `GET /api/friends/:userId/profile` handler in `src/friends-handlers.ts`.
  - [ ] Validate authentication and friendship existence (return 404 if not friends).
  - [ ] Query total distance, member since, current goal title, and fellowships (with `is_shared` decoration).
  - [ ] Wire the route in `src/index.ts` and update `getAllowedMethods()`.
  - [ ] Add handler-level tests in `tests/api/friends-handlers.test.ts` for the new endpoint.

- [ ] **Task 2: Create SSR page renderers** (AC: #1, #2, #3, #7)
  - [ ] Create `src/renderFriendsPage.ts` using `renderLayout()` with `mainContent: '<div data-island="FriendsListIsland"></div>'`.
  - [ ] Create `src/renderFriendAddPage.ts` using `renderLayout()` with `mainContent: '<div data-island="FriendAddIsland"></div>'`.
  - [ ] Create `src/renderFriendProfilePage.ts` using `renderLayout()` with `mainContent: '<div data-island="FriendProfileIsland"></div>'`.
  - [ ] Add all three page routes in `src/index.ts` with correct ordering: exact `/friends` first, then `/friends/add/:friendCode` (via `matchRoute`), then `/friends/:id` (via `matchRoute`).

- [ ] **Task 3: Create FriendsListIsland** (AC: #1, #8)
  - [ ] Create `client/src/islands/FriendsListIsland.tsx`.
  - [ ] Implement parallel initial fetch: `GET /api/friends` + `GET /api/friends/pending`.
  - [ ] Implement pending requests section (collapsible, accept/reject actions).
  - [ ] Implement friends list with avatar, username, relative "last progressed" time, click-to-navigate.
  - [ ] Implement username search with 3-char minimum, 300ms debounce, and result rendering with friendship-status decoration.
  - [ ] Implement share friend link section with copy/share buttons (reuse `PartyDetailIsland` copy pattern).
  - [ ] Get `friendCode` from the session or a lightweight endpoint — check if `GET /api/session` already returns it, or use `GET /api/friends` response to include it.
  - [ ] Implement empty state, loading skeleton, error with retry.
  - [ ] Register in `client/src/index.tsx`.

- [ ] **Task 4: Create FriendAddIsland** (AC: #2, #8)
  - [ ] Create `client/src/islands/FriendAddIsland.tsx`.
  - [ ] Extract `friendCode` from URL path.
  - [ ] Call `GET /api/friends/resolve/:friendCode` for user preview.
  - [ ] Authenticated flow: show preview + "Send Friend Request" button.
  - [ ] Non-authenticated flow: show preview + "Log in to Add Friend" button with `returnTo` redirect.
  - [ ] Handle error states (invalid code, already friends, pending, self-add).
  - [ ] Register in `client/src/index.tsx`.

- [ ] **Task 5: Create FriendProfileIsland** (AC: #3, #8)
  - [ ] Create `client/src/islands/FriendProfileIsland.tsx`.
  - [ ] Extract `userId` from URL path.
  - [ ] Call `GET /api/friends/:userId/profile`.
  - [ ] Render profile card: username, avatar (128px or initials), total distance, member since.
  - [ ] Render fellowships section with shared/non-shared distinction.
  - [ ] Implement "Remove Friend" with confirmation dialog reusing the `party-confirm-overlay` pattern.
  - [ ] On remove, call `DELETE /api/friends/:friendshipId` (need friendship ID from profile response) and navigate back to `/friends`.
  - [ ] Implement breadcrumb back-navigation (`← Friends`).
  - [ ] Handle 404 (not friends / nonexistent user).
  - [ ] Register in `client/src/index.tsx`.

- [ ] **Task 6: Update DrawerIsland with Friends link and badges** (AC: #4)
  - [ ] Add "Friends" nav link after "Fellowships".
  - [ ] Add state for `pendingFriendsCount` and `pendingFellowshipInvitesCount`.
  - [ ] Fetch both counts on mount: `GET /api/friends/pending` and `GET /api/user/fellowship-invites` (both return `count` in response).
  - [ ] Render badge spans on "Friends" and "Fellowships" links when count > 0.
  - [ ] Add `.drawer-badge` styles in `public/css/drawer.css`.

- [ ] **Task 7: Add fellowship invite section to PartyListIsland** (AC: #5)
  - [ ] Fetch `GET /api/user/fellowship-invites` alongside existing party list fetch.
  - [ ] Render "Pending Invites" section above "Your Fellowships" when invites exist.
  - [ ] Implement accept/decline per invite with API calls and list refresh.
  - [ ] Use existing `party-btn` classes for accept/decline buttons.

- [ ] **Task 8: Add "Add Friend" button to PartyDetailIsland member list** (AC: #6)
  - [ ] Fetch `GET /api/friends` alongside existing party detail fetch.
  - [ ] Cross-reference member user IDs against friend list and pending requests.
  - [ ] Render inline "Add Friend" / "Pending" / "Friends ✓" per non-self member.
  - [ ] Handle friend request send with optimistic UI update.

- [ ] **Task 9: Add CSS for friends pages and drawer badges** (AC: #1, #3, #4, #8)
  - [ ] Create `public/css/friends.css` for friend-specific styles OR extend `party.css` — evaluate which approach keeps styles most maintainable.
  - [ ] Add avatar inline styles (circle clip, initials fallback with deterministic background).
  - [ ] Add search result decoration styles (friendship status labels).
  - [ ] Add shared fellowship badge styles ("✦ Shared") for the profile page.
  - [ ] Add collapsible section styles for pending requests.
  - [ ] Add `.drawer-badge` styles in `public/css/drawer.css`.

- [ ] **Task 10: Add Playwright UI tests** (AC: #8)
  - [ ] Create `tests/ui/friends.spec.js` with tests for:
    - Friends page loads and displays friend list.
    - Pending requests section shows and handles accept/reject.
    - Username search returns results with correct status labels.
    - Friend link copy button works.
    - Friend profile page loads from list navigation.
    - Remove friend confirmation dialog works.
    - Friend add landing page resolves code and sends request.
    - Unauthenticated friend add page shows login redirect button.
    - Fellowship pending invites section on Fellowships page.
    - "Add Friend" button on Fellowship Detail member list.
  - [ ] Extend `tests/ui/navigation.spec.js` (if exists) for drawer badge and Friends link.

- [ ] **Task 11: Add backend tests for friend profile endpoint** (AC: #3, #7, #8)
  - [ ] Add tests in `tests/api/friends-handlers.test.ts` for:
    - Unauthenticated access returns 401.
    - Non-friend user returns 404.
    - Malformed userId returns 400.
    - Successful profile response with correct shape.
    - Profile includes shared fellowship decoration.
    - Profile with no fellowships returns empty array.
  - [ ] Extend `tests/api/index.test.ts` for new page routes and API route registration.

- [ ] **Task 12: Align living documentation** (AC: #8)
  - [ ] Update `docs/frontend-guide.md` if island names, registration, or patterns diverge from current docs.
  - [ ] Update `docs/api-reference.md` for the new `GET /api/friends/:userId/profile` endpoint.
  - [ ] Update `docs/ui-overview.md` for new Friends pages.

## Dev Notes

### Story Foundation

Story 6.4 is the first UI surface for Epic 6's social features. It turns the backend APIs from Stories 6.2 and 6.3 into discoverable pages. The business value is making friend discovery, management, and fellowship invites visible to users through polished, consistent surfaces that match the existing dark-themed card design system.

This is the largest UI story in Epic 6 — it touches 3 new pages, 3 new islands, 2 modified islands, navigation drawer badge infrastructure, and a new backend endpoint. The implementation complexity is manageable because almost every UI pattern already exists in the fellowship pages and can be directly replicated.

### Hard Dependencies

Do not start implementation until these Stories are actually implemented (not merely `ready-for-dev`):

- **Story 6.1** for `friendships` table, `users.friend_code`, `users.avatar_id`, and avatar assets in `public/img/avatars/`.
- **Story 6.2** for the complete friend API surface: `GET /api/friends`, `GET /api/friends/pending`, `GET /api/friends/search`, `GET /api/friends/resolve/:friendCode`, `POST /api/friends/request`, `POST /api/friends/request/code`, `POST /api/friends/:friendshipId/accept`, `POST /api/friends/:friendshipId/reject`, `DELETE /api/friends/:friendshipId`.
- **Story 6.3** for fellowship invite surfaces: `GET /api/user/fellowship-invites`, `POST /api/user/fellowship-invites/:inviteId/accept`, `POST /api/user/fellowship-invites/:inviteId/reject`, and `POST /api/party/:id/invite-friend`.

At story-creation time, all three are `ready-for-dev` — none are implemented yet.

### Existing Implementation Touchpoints

#### Worker Router (`src/index.ts`)
- Manual `if/else` dispatch chain. Every new route must also be added to `getAllowedMethods()`.
- Parameterized routes use `matchRoute()` plus strict positive-integer guards.
- Page routes return `new Response(renderXxxPage(), { headers: { 'content-type': 'text/html' } })`.
- **Route ordering is critical**: `/friends/add/:friendCode` must come before `/friends/:id` to prevent "add" being parsed as a numeric id. The existing router already demonstrates this pattern — `/party/join/:code` comes before `/party/:id/manage` which comes before `/party/:id`.

#### SSR Page Renderers
- `renderLayout()` in `src/renderLayout.ts` is the shared layout function. Every page renderer is a minimal function that calls it with a `PageConfig` object.
- `PageConfig` fields: `title`, `description`, `stylesheets[]`, `headerContent`, `mainContent`, and optional `bodyClass`, `publicPage`, `scripts[]`.
- The layout always injects `<div data-island="DrawerIsland"></div>` in the header.
- The layout loads `/js/client/islands.js` and `/js/client/islands.css` (the Preact bundle).
- Example from `renderPartyDetailPage.ts`:
  ```ts
  return renderLayout({
    title: 'Walk to Mordor - Fellowship',
    description: 'View Fellowship details and progress',
    stylesheets: ['/css/party.css'],
    headerContent: '<h1>Fellowship</h1>',
    mainContent: '<div data-island="PartyDetailIsland"></div>',
  });
  ```

#### Preact Island Registration (`client/src/index.tsx`)
- Islands are imported and registered in two maps:
  - `autoHydratedIslands` — auto-mounted by `hydrateIslands()` which scans for `[data-island]` attributes.
  - `allIslands` — available via `window.preactIslands` for programmatic mounting.
- Add all three new islands (`FriendsListIsland`, `FriendAddIsland`, `FriendProfileIsland`) to both maps.

#### DrawerIsland (`client/src/islands/DrawerIsland.tsx`)
- Current nav links: Journey → Map → Fellowships → (Admin if admin) → Profile button.
- Session data is fetched via `GET /api/session` to check `isAdmin`.
- No existing badge infrastructure — badges need to be added as new CSS and state.
- The DrawerIsland currently does NOT fetch pending counts; additional API calls are needed.
- Each badge fetch should be fire-and-forget (non-blocking) so drawer opens instantly.

#### PartyListIsland (`client/src/islands/PartyListIsland.tsx`)
- Currently fetches `GET /api/user/parties` on mount.
- Shows active party cards as clickable links to `/party/:id`.
- Has create/join form sections.
- The pending fellowship invite section needs to be added above "Your Fellowships".

#### PartyDetailIsland (`client/src/islands/PartyDetailIsland.tsx`)
- Members section renders a `<ul className="party-member-list">` with member rows.
- Each member row has: color swatch, name, join date, contribution distance.
- `member.user_id` is available for cross-referencing against the friend list.
- The invite code copy/share pattern is implemented here — reuse for friend link sharing.
- The confirm overlay/dialog pattern is implemented here — reuse for "Remove Friend" confirmation.

#### API Client Pattern
- All islands use `getAuthHeaders()` returning `{ Authorization: 'Bearer {token}', 'Content-Type': 'application/json' }`.
- Unauthenticated requests (401) redirect to `/login` or show login prompt.
- Standard pattern: `useCallback` + `useEffect` for data fetching with loading/error/retry states.
- Toast pattern for success/error feedback.

#### CSS Design System
- All CSS variables are defined in `public/css/main.css`:
  - `--bg-primary: #000`, `--bg-secondary: #1a1a1a`, `--bg-dark-alt: #2a2a2a`
  - `--accent-gold: #FFD700`, `--accent-blue: #007bff`, `--accent-teal: #16c79a`
  - `--text-primary: #fff`, `--text-secondary: #ccc`, `--text-muted: #999`
  - `--border-gray: #333`, `--status-error: #dc3545`, `--status-success: #28a745`
- `public/css/party.css` has the complete button system (`.party-btn`, `.party-btn--primary`, `--danger`, `--secondary`, `--small`, `--gold`, `--full`), card system (`.party-card`, `.party-card--clickable`), member list, breadcrumbs, confirm dialogs, toasts, loading/error/empty states.
- `public/css/drawer.css` uses `--bg-secondary`, `--border-gray`, `--hover-overlay`, `--accent-gold`, `--text-primary`, `--text-secondary`.
- **Decision**: Friends pages should reuse `party.css` classes extensively since the UI patterns are nearly identical. Only create `friends.css` for friend-specific elements (avatar circles, search results, shared fellowship badges) or extend `party.css` if the additions are minimal.

### Critical Implementation Guardrails

- **Do not build the reusable `Avatar` component.** That is Story 6.5. For this story, inline the avatar logic: if `avatar_id` exists, render `<img src="/img/avatars/{avatar_id}.webp" />` with `border-radius: 50%`; if null, render a `<div>` with the first initial on a deterministic background color (e.g., `hsl((username.charCodeAt(0) * 137) % 360, 50%, 35%)`).
- **Do not add `/api/session` changes for friend code or pending counts.** Keep the drawer fetches as separate lightweight API calls. Story 6.5 or a future optimization story can consolidate them into the session response if needed.
- **Do not skip the `returnTo` redirect pattern.** The `FriendAddIsland` must use `window.location.href = '/login?returnTo=' + encodeURIComponent(window.location.pathname)` exactly like `PartyJoinIsland.tsx`. Note: verify the login page actually consumes `returnTo` — the current auth island appears to redirect to `/` unconditionally after login. If `returnTo` is not consumed by the login flow, document this as a known gap but still pass the parameter so the infrastructure is ready when the login page is updated.
- **Do not invent new API response shapes.** The new `GET /api/friends/:userId/profile` endpoint should follow the same `createSuccessResponse()` envelope pattern used by all other handlers.
- **Do not make the drawer badge fetches blocking.** Use fire-and-forget fetches that update state when complete. The drawer should be usable immediately.
- **Do not expand the friend profile endpoint beyond the data needed by the profile page.** Keep it focused: username, avatar_id, total_distance, member_since, current_goal_title, fellowships[].
- **Do not add "Invite to Fellowship" from the friend profile page** — the UX design mentions this but the epic ACs do not include it as a requirement for Story 6.4. It can be added later if needed.
- **Route ordering is safety-critical.** `/friends/add/:friendCode` MUST come before `/friends/:id` in the router. The friendCode param is a string (8-char alphanumeric), and the id param is a positive integer — but the router's `matchRoute()` will match both. Place the more specific route first.
- **Do not duplicate the fellowship join logic.** When accepting fellowship invites on the Fellowships page, call the Story 6.3 endpoints and then refetch the parties list. Do not re-implement join behavior.
- **Keep the member "Add Friend" button minimal.** It's an inline action on the existing member list — do not restructure the member list layout. A small button or icon after the member name is sufficient.

### Architecture Compliance

- Runtime: single Cloudflare Worker monolith with manual route dispatch.
- D1 is the source of truth; new endpoint uses prepared statements and existing helpers.
- Frontend: Islands Architecture — new Preact islands in `client/src/islands/`, SSR renderers in `src/`.
- Strict TypeScript, no `any` in new code.
- All CSS uses variables from `public/css/main.css` without fallback values.
- No new third-party library is required.

### Library / Framework Requirements

- **Preact** — use `useState`, `useEffect`, `useCallback` from `preact/hooks` (same as all existing islands).
- **FontAwesome 6.4** — already loaded globally by `renderLayout()`. Use `fas fa-*` classes for icons (user-plus, check, times, spinner, copy, share-alt, chevron-down, chevron-up, search, arrow-left).
- **Konva.js** — NOT used in this story (map social panel is Story 6.6).
- **No new dependencies.**

### File Structure Requirements

New files:
- `src/renderFriendsPage.ts` — SSR renderer for `/friends`
- `src/renderFriendAddPage.ts` — SSR renderer for `/friends/add/:friendCode`
- `src/renderFriendProfilePage.ts` — SSR renderer for `/friends/:id`
- `client/src/islands/FriendsListIsland.tsx` — main friends page island
- `client/src/islands/FriendAddIsland.tsx` — friend code landing island
- `client/src/islands/FriendProfileIsland.tsx` — friend profile island
- `public/css/friends.css` — friend-specific styles (if needed beyond party.css reuse)
- `tests/ui/friends.spec.js` — Playwright UI tests
- `tests/api/friends-handlers.test.ts` — extend with profile endpoint tests (file created by Story 6.2)

Modified files:
- `src/index.ts` — 3 page routes + 1 API route + `getAllowedMethods()` update
- `src/friends-handlers.ts` — add profile handler (file created by Story 6.2)
- `client/src/index.tsx` — register 3 islands
- `client/src/islands/DrawerIsland.tsx` — add Friends link + badge state + badge fetches + Fellowships badge
- `client/src/islands/PartyListIsland.tsx` — add pending fellowship invite section
- `client/src/islands/PartyDetailIsland.tsx` — add "Add Friend" buttons to member list
- `public/css/drawer.css` — add badge styles
- `docs/api-reference.md` — document new profile endpoint
- `docs/frontend-guide.md` — update island list
- `docs/ui-overview.md` — update page inventory

### Testing Requirements

#### Backend Tests (`tests/api/friends-handlers.test.ts`)
- `GET /api/friends/:userId/profile`:
  - 401 when unauthenticated
  - 400 for malformed userId (non-positive-integer)
  - 404 when users are not friends
  - 404 when target user does not exist
  - 200 with correct profile shape for valid friend
  - Profile includes `is_shared: true` for shared fellowships
  - Profile includes `is_shared: false` for non-shared fellowships
  - Profile with zero total distance returns `total_distance: 0`
  - Profile with no fellowships returns empty array

#### Router Tests (`tests/api/index.test.ts`)
- Page routes return 200 with HTML content-type for `/friends`, `/friends/add/:code`, `/friends/:id`
- `GET /api/friends/:userId/profile` returns in allowed methods

#### Playwright UI Tests (`tests/ui/friends.spec.js`)
- Friends page renders friend list
- Pending requests section appears and handles accept/reject
- Search returns results with correct status decorations
- Copy link button copies to clipboard
- Friend profile page loads via navigation from list
- Remove friend dialog confirms and navigates back
- Friend add page resolves code and shows user preview
- Unauthenticated add page redirects to login
- Fellowships page shows pending invite section
- Fellowship detail page shows "Add Friend" buttons

### Previous Story Intelligence

#### From Story 6.3 (fellowship invite API)
- Fellowship invites use a `fellowship_invites` table with `status` supporting `pending`, `accepted`, `rejected`.
- `GET /api/user/fellowship-invites` returns `{ invites: [...], count: number }`.
- Accept uses `POST /api/user/fellowship-invites/:inviteId/accept`.
- Reject uses `POST /api/user/fellowship-invites/:inviteId/reject`.
- Dissolved parties must not surface actionable invites.

#### From Story 6.2 (friend request API)
- `GET /api/friends` returns `[{ id, username, avatar_id, last_progressed }]`.
- `GET /api/friends/pending` returns `{ requests: [...], count: number }`.
- `GET /api/friends/search?q=x` returns `[{ id, username, avatar_id, friendship_status }]` where status is `null`/`pending`/`accepted`.
- `GET /api/friends/resolve/:friendCode` returns `{ username, avatar_id }`.
- `POST /api/friends/request` accepts `{ user_id }`.
- `POST /api/friends/request/code` accepts `{ friend_code }`.
- `POST /api/friends/:friendshipId/accept` — only addressee.
- `POST /api/friends/:friendshipId/reject` — deletes the row.
- `DELETE /api/friends/:friendshipId` — mutual unfriend.

#### From Story 6.1 (schema & assets)
- `users.friend_code` is an 8-char alphanumeric string.
- `users.avatar_id` is a slug like `gandalf-grey`; images at `/img/avatars/{slug}.webp`, thumbs at `/img/avatars/thumbs/{slug}.webp`.
- Default avatar (null `avatar_id`) renders initials.

### Git Intelligence Summary

Recent repository activity is dependency maintenance and admin search improvements. The latest feature work established patterns for:
- Small, focused handler changes with comprehensive test coverage.
- Domain-specific CSS that reuses the design system variables.
- Preact islands that fetch data on mount with loading/error/retry states.

### UX Design Discrepancy Note

The UX design (`docs/ux-design.md`) states friend profile should show "friend's current goal name (no distance — privacy)." The epic ACs state "total distance walked." The implementation should follow the **epic ACs** (total distance) since those represent the final planning breakdown. `current_goal_title` is included in the profile endpoint as a compromise — it adds narrative context without being the sole data point.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.4: Friends UI — Friends Page & Friend Profile]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6: Friends & Social Identity]
- [Source: _bmad-output/implementation-artifacts/6-3-fellowship-invite-via-friends-api.md]
- [Source: _bmad-output/implementation-artifacts/6-2-friend-request-api.md]
- [Source: _bmad-output/implementation-artifacts/6-1-friends-database-schema-avatar-system.md]
- [Source: _bmad-output/project-context.md]
- [Source: docs/ux-design.md#Section 6-8]
- [Source: docs/frontend-guide.md]
- [Source: docs/architecture.md]
- [Source: src/renderLayout.ts]
- [Source: src/renderPartyDetailPage.ts]
- [Source: src/renderPartyListPage.ts]
- [Source: src/index.ts]
- [Source: client/src/index.tsx]
- [Source: client/src/islands/DrawerIsland.tsx]
- [Source: client/src/islands/PartyListIsland.tsx]
- [Source: client/src/islands/PartyDetailIsland.tsx]
- [Source: client/src/islands/PartyJoinIsland.tsx]
- [Source: public/css/main.css]
- [Source: public/css/party.css]
- [Source: public/css/drawer.css]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Story created from Epic 6 planning artifact plus exhaustive codebase exploration of SSR patterns, island registration, drawer navigation, route dispatch, CSS design system, API client patterns, and UX specifications.

### Completion Notes List

- Stories 6.1, 6.2, and 6.3 are all `ready-for-dev` at story-creation time — none are implemented. This story cannot begin until all three are live.
- The new `GET /api/friends/:userId/profile` endpoint is required by this story but was not part of Stories 6.2 or 6.3. It is scoped here because it is a UI-driven data requirement.
- The `returnTo` query parameter is passed to `/login` by `PartyJoinIsland` but the login auth form currently redirects to `/` unconditionally. The `FriendAddIsland` should still pass `returnTo` for forward compatibility; the login page fix is a separate concern.
- Social docs (`docs/architecture.md`, `docs/frontend-guide.md`) already describe Friends islands and routes that do not yet exist. This story implements them.
- The Avatar component (`client/src/components/Avatar.tsx`) is Story 6.5 scope. This story inlines minimal avatar rendering logic.
- UX design conflict on friend profile: UX docs say "no distance," epic says "total distance walked." Followed epic ACs.

### File List

- _bmad-output/implementation-artifacts/6-4-friends-ui-friends-page-friend-profile.md
