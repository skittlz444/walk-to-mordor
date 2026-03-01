# Story 3.7: Fellowship UI - Fellowships Pages

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a User,
I want dedicated pages to view my Fellowships, see detailed party progress and member contributions, manage my parties, and join new ones via invite links,
so that I can fully interact with the Fellowship features in a structured and intuitive way.

## Acceptance Criteria

1. **Page 1: Fellowships List (`/party`)**
   - Create `/party` route with SSR shell (`renderPartyListPage.ts`) and a Preact island.
   - Add "Fellowships" link to the `DrawerIsland` navigation.
   - Show a list of all parties the user belongs to (via `GET /api/user/parties`), displaying name and active member count.
   - Always show "Create Fellowship" and "Join Fellowship" buttons/sections, regardless of whether the user is in a party or not.
   - Empty state: "You haven't joined a Fellowship yet" (if no parties).
   - "Create Fellowship" button opens a form: name (required, max 50 chars), `distance_mode` selector, `leave_distance_behavior` selector. Include plain-language helper text for settings that is sufficiently descriptive so the user has no ambiguity on what the toggles do.
   - "Join Fellowship" section with invite code input (shows preview before confirming).
   - Clicking a party navigates to `/party/:id`.
   - Dissolved parties shown in a collapsed "Past Fellowships" section.
2. **Page 2: Fellowship Detail (`/party/:id`)**
   - Back navigation: `← Fellowships / [Party Name]` linking to `/party`.
   - Show party name.
   - Display total party progress, distance to next milestone, and last milestone crossed. Clicking on the next/last milestone should open their goal modals, with the next one being locked based on the individual user's preference.
   - Member list: name, contribution, joined date, status, and color (matching Map segment color).
   - Activity feed placeholder (actual feed implemented in Story 3.8).
   - "Leave party" button with confirmation dialog explaining the impact based on `leave_distance_behavior`.
   - If leader: show "Manage Fellowship" button navigating to `/party/:id/manage`.
   - Invite link sharing: Display full invite URL with "Copy Link" and "Share" (Web Share API) buttons.
3. **Page 3: Fellowship Management (`/party/:id/manage`, leader only)**
   - Back navigation: `← [Party Name] / Manage` linking to `/party/:id`.
   - Redirect to `/party/:id` if not leader.
   - Update settings: name and `leave_distance_behavior` (via `PUT /api/party/:id/settings`).
   - Kick member controls with two-step confirmation and toggle to override distance removal.
   - Transfer leadership (via `POST /api/party/:id/transfer-leadership`) with confirmation.
   - Regenerate invite code button with confirmation.
4. **Join Landing Page (`/party/join/:inviteCode`)**
   - Create `/party/join/:inviteCode` route with SSR shell (`renderPartyJoinPage.ts`) and a Preact island.
   - Authenticated users: Show party preview and "Join Fellowship" button. Redirect to `/party/:id` on success.
   - Non-authenticated users: Show party preview and "Log in to Join" button (redirects to login with `returnTo`).
   - Handle error states (invalid code, dissolved party, already a member).
5. **Cross-cutting:**
   - Follow existing accessibility patterns (ARIA, focus, contrast).
   - Mobile-first responsive design (≥320px).
   - Use `history.pushState` or Preact Router for navigation where appropriate, or rely on SSR navigation.

## Tasks / Subtasks

- [x] Task 1: SSR Shells & Routing (AC: 1, 4)
  - [x] Create `src/renderPartyListPage.ts` (List view).
  - [x] Create `src/renderPartyDetailPage.ts` (Detail view).
  - [x] Create `src/renderPartyManagePage.ts` (Manage view).
  - [x] Create `src/renderPartyJoinPage.ts` (Join landing view).
  - [x] Add routes to `src/index.ts` (`/party`, `/party/:id`, `/party/:id/manage`, `/party/join/:inviteCode`).
  - [x] Update `DrawerIsland.tsx` to include the "Fellowships" link.
- [x] Task 2: Fellowships List Page Island (AC: 1)
  - [x] Create `PartyListIsland.tsx`.
  - [x] Implement list view, empty state, create form, and join form.
  - [x] Fetch data from `/api/user/parties`.
- [x] Task 3: Fellowship Detail Page Island (AC: 2)
  - [x] Create `PartyDetailIsland.tsx`.
  - [x] Fetch data from `/api/party/:id/progress`.
  - [x] Implement progress display, member list, and leave button.
  - [x] Leave a UI placeholder for the Activity Feed (to be implemented in Story 3.8).
  - [x] Implement invite link sharing UI.
- [x] Task 4: Fellowship Management Page Island (AC: 3)
  - [x] Create `PartyManageIsland.tsx`.
  - [x] Implement settings update form, kick member UI, transfer leadership UI, and regenerate invite code UI.
- [x] Task 5: Join Landing Page Island (AC: 4)
  - [x] Create `PartyJoinIsland.tsx`.
  - [x] Implement preview display and join/login buttons.
  - [x] Handle `returnTo` logic for unauthenticated users.

## Dev Notes

- **Architecture Details**: 
  - The API endpoints were created in Stories 3.2, 3.3, 3.4, and 3.5.
  - Follow the `renderLayout()` pattern used in SSR routing. We will maintain this pattern by creating separate SSR shells for each view (`renderPartyListPage`, `renderPartyDetailPage`, `renderPartyManagePage`, `renderPartyJoinPage`). Each shell will mount its respective Preact island
  - Use Preact islands for the interactive components on these pages.
- **Routing**: The application currently uses a mix of SSR routing and client-side islands. For the `/party/*` routes, you can either use separate SSR pages for each route or a single SSR page that loads a client-side router (like `preact-router`) for the sub-routes. Given the requirements, separate SSR shells (`renderPartyListPage`, `renderPartyJoinPage`) with islands that handle the specific views (`/party`, `/party/:id`, `/party/:id/manage`) might be the most consistent approach with the existing architecture.
- **Web Share API**: Use `navigator.share()` if available, fallback to clipboard copy.

### Project Structure Notes

- SSR rendering functions go in `src/`.
- Preact islands go in `client/src/islands/`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7: Fellowship UI - Fellowships Pages]
- [Source: docs/architecture.md#ADR-004: Fellowship Data Model Direction]
- [Source: docs/ux-design.md]

### change-impact

Requirements expanded from original spec:
- Restructured from single-page to 3-page flow (list → detail → management) plus a join landing page.
- Added `/party/join/:inviteCode` deep-link landing page for clickable invite links (FR_PARTY_03).
- Invite sharing expanded with full URL, Copy Link, and Web Share API.
- Non-authenticated user flow for invite deep-links with login redirect.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Task 1: Created 4 SSR shell render functions following `renderLayout()` pattern. Added routes in index.ts with correct ordering (join > manage > detail > list). Added "Fellowships" link to DrawerIsland navigation. Created party.css with full responsive styling.
- Task 2: Created PartyListIsland with active party list, empty state, create fellowship form (name/distance_mode/leave_behavior with helper text), join by invite code with preview step, and collapsed past fellowships section.
- Task 3: Created PartyDetailIsland with breadcrumb, progress stats grid (total distance, last milestone, member count, mode), sorted member list with color dots, activity feed placeholder for Story 3.8, invite link sharing with Copy Link and Web Share API, leave button with confirmation dialog explaining leave_distance_behavior impact.
- Task 4: Created PartyManageIsland with leader-only access (redirects non-leaders), settings update form, kick member with two-step confirmation and distance removal toggle, transfer leadership with confirmation, and regenerate invite code with confirmation.
- Task 5: Created PartyJoinIsland with invite code extraction from URL, party preview display, authenticated join button (redirects to /party/:id on success), and unauthenticated login button with returnTo parameter.
- API: Added invite_code and leader_id to GET /api/user/parties response to enable invite link sharing and leader identification on detail page.
- Tests: 23 new tests across party-pages.test.ts (SSR shells) and index.test.ts (routing). All 431 tests pass with zero regressions.

### File List

- src/renderPartyListPage.ts (new)
- src/renderPartyDetailPage.ts (new)
- src/renderPartyManagePage.ts (new)
- src/renderPartyJoinPage.ts (new)
- src/renderLayout.ts (modified - added publicPage option to skip auth scripts)
- src/index.ts (modified - added party page routes and imports)
- src/party-handlers.ts (modified - added invite_code and leader_id to user parties query)
- client/src/index.tsx (modified - registered 4 new islands)
- client/src/islands/DrawerIsland.tsx (modified - added Fellowships nav link)
- client/src/islands/PartyListIsland.tsx (new)
- client/src/islands/PartyDetailIsland.tsx (new)
- client/src/islands/PartyManageIsland.tsx (new)
- client/src/islands/PartyJoinIsland.tsx (new)
- public/css/party.css (new)
- tests/api/party-pages.test.ts (new)
- tests/api/index.test.ts (modified - added party page routing tests)

## Change Log

- 2026-03-01: Story 3.7 implementation complete. Created 4 SSR page shells, 4 Preact islands, party.css, and routing. Added publicPage option to renderLayout for unauthenticated join page. Fixed distance_mode form value mismatch (average→incremental). 23 new tests, 431 total passing. Visual testing verified on mobile and desktop viewports.
