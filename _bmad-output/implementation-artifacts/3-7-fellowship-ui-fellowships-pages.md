# Story 3.7: Fellowship UI - Fellowships Pages

Status: ready-for-dev

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
   - Activity feed (last 10 activities via `GET /api/party/:id/activity`) displayed inline.
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

- [ ] Task 1: SSR Shells & Routing (AC: 1, 4)
  - [ ] Create `src/renderPartyListPage.ts`.
  - [ ] Create `src/renderPartyJoinPage.ts`.
  - [ ] Add routes to `src/index.ts` (`/party`, `/party/:id`, `/party/:id/manage`, `/party/join/:inviteCode`).
  - [ ] Update `DrawerIsland.tsx` to include the "Fellowships" link.
- [ ] Task 2: Fellowships List Page Island (AC: 1)
  - [ ] Create `PartyListIsland.tsx`.
  - [ ] Implement list view, empty state, create form, and join form.
  - [ ] Fetch data from `/api/user/parties`.
- [ ] Task 3: Fellowship Detail Page Island (AC: 2)
  - [ ] Create `PartyDetailIsland.tsx`.
  - [ ] Fetch data from `/api/party/:id/progress` and `/api/party/:id/activity`.
  - [ ] Implement progress display, member list, activity feed, and leave button.
  - [ ] Implement invite link sharing UI.
- [ ] Task 4: Fellowship Management Page Island (AC: 3)
  - [ ] Create `PartyManageIsland.tsx`.
  - [ ] Implement settings update form, kick member UI, transfer leadership UI, and regenerate invite code UI.
- [ ] Task 5: Join Landing Page Island (AC: 4)
  - [ ] Create `PartyJoinIsland.tsx`.
  - [ ] Implement preview display and join/login buttons.
  - [ ] Handle `returnTo` logic for unauthenticated users.

## Dev Notes

- **Architecture Details**: 
  - The API endpoints were created in Stories 3.2, 3.3, 3.4, and 3.5.
  - Follow the `renderLayout()` pattern used in `src/renderHtml.ts` for the new SSR shells.
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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
