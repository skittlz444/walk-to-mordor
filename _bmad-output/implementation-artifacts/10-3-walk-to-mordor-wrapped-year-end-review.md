# Story 10.3: Walk-to-Mordor Wrapped — Year-End Review

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin user (for testing),
I want to see a year-in-review summary of my walking journey,
So that I can celebrate my annual achievements and test the Wrapped experience before wider release.

## Acceptance Criteria

**Given** an admin user has logged walks during the calendar year
**When** the user navigates to the "Year in Review" section (accessible from the stats area for admin users only)
**Then** a multi-page narrative experience is displayed with:
- **Total distance for the year** ("You walked XXX km — that's X% of the journey to Mordor!")
- **Total walk count and active days**
- **Best streak of the year**
- **Favorite walking month** (month with highest total)
- **Milestones unlocked this year** (with images; if the user unlocked more than a set threshold, e.g., 10, display only milestones where `special IS NOT NULL`)
- **Fellowship highlights** (if applicable: "You and The Fellowship walked XX km together")
- **A Tolkien-flavored narrative summary** (template-based, e.g., "Like Bilbo in the Shire, you took your first step on [first walk date]…"; this should also omit minor milestones if the user passed many, focusing on special milestones (where `special IS NOT NULL`) to keep the narrative concise)
**And** the review is paginated as a scrollable card sequence (swipeable on mobile)
**And** a "Share" button generates a static shareable image or card (using Canvas API or pre-rendered template)
**And** the share image includes: total distance, milestones unlocked count, and a themed background
**And** a new `GET /api/stats/wrapped?year=YYYY` endpoint returns the annual summary data
**And** the `GET /api/stats/wrapped` endpoint restricts access to admin users (`user.is_admin === 1`)
**And** the UI only displays the Wrapped entry point in the stats area if the user is an admin
**And** the Wrapped experience is implemented as a Preact island (`WrappedIsland`)
**And** tests cover data aggregation, rendering, and the admin-only access control

## Tasks / Subtasks

- [x] Task 1: Create the new `/api/stats/wrapped` endpoint (AC: Data aggregation, Admin only)
  - [x] Subtask 1.1: Add route handler in `src/stats-handlers.ts` or `src/index.ts` for `GET /api/stats/wrapped`
  - [x] Subtask 1.2: Enforce admin role check (e.g. using `requireAdmin` or checking `user.is_admin === 1`)
  - [x] Subtask 1.3: Aggregate data from `progress` table (`strftime('%Y', date) = ?`) to compute total distance, walk count, best streak, favorite month, and milestones unlocked (applying the threshold logic to only include milestones where `special IS NOT NULL` if the total count is high)
  - [x] Subtask 1.4: Include logic for fellowship highlights if applicable
  - [x] Subtask 1.5: Write unit tests for the endpoint (admin success and non-admin denial, data aggregation calculations)
- [x] Task 2: Build the Wrapped UI component (AC: Multi-page narrative, template-based, Preact island)
  - [x] Subtask 2.1: Create `client/src/islands/WrappedIsland.tsx` (or inside `/components/stats/`)
  - [x] Subtask 2.2: Implement the scrollable/swipeable card sequence
  - [x] Subtask 2.3: Build the template-based narrative strings
  - [x] Subtask 2.4: Integrate the "Share" button and Canvas rendering for the shareable card
- [x] Task 3: Integrate with Stats Area (AC: Admin visibility only)
  - [x] Subtask 3.1: Only show the "Year in Review" link/button in the Stats area if the current user is an admin
  - [x] Subtask 3.2: Hook up the routing to display `WrappedIsland`
- [x] Task 4: Add e2e / client tests
  - [x] Subtask 4.1: Test UI rendering and pagination
  - [x] Subtask 4.2: Verify share image rendering function
  - [x] Subtask 4.3: Verify the UI does not appear for non-admin users

## Dev Notes

- **IMPORTANT USER INSTRUCTION**: This feature is currently gated to ADMIN USERS ONLY and will live within the "stats area" during this testing phase.
- Use string templates with variable interpolation for narration (not AI generated).
- For the share image, use `<canvas>` to render a themed card to keep things simple, keeping the design branded but not overly complex.
- Year data: aggregate from the `progress` table. E.g., `strftime('%Y', date) = ?`.

### Project Structure Notes

- Backend handler: `src/stats-handlers.ts` or add to existing relevant handlers. Ensure authentication and admin checks.
- Frontend Island: `client/src/islands/WrappedIsland.tsx`. The global app store (`appStore.ts`) already holds session info including `is_admin`, so consume that for conditional rendering.

### References

- Epics Phase 4-15 (`_bmad-output/planning-artifacts/epics-phases-4-15.md`), Epic 10 Story 10.3
- Existing admin checks: `src/auth-utils.ts` (`requireAdmin`)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None

### Completion Notes List

- All 4 tasks and subtasks implemented and tested
- Backend: `handleWrappedStats` with 10 DB queries, admin gating via `validateAdminSession`, milestone threshold filtering (>10 → special only), fellowship highlights, Tolkien-flavored narrative builder
- Frontend: WrappedIsland Preact component with 7 card types (hero/walks/streak/month/milestones/fellowships/narrative), touch swipe support, share image via Canvas API (600x400 PNG)
- StatsIsland: Admin-gated "Year in Review" tab using `isAdmin` signal, hash routing (#wrapped)
- CSS: Full wrapped.css with card scroll-snap, gold accent theme, responsive design
- Tests: 32 new tests total (8 backend, 14 WrappedIsland, 5 StatsIsland, 5 wrapped utility)
- Backend suite: 1190 tests pass, 92.86% statement coverage
- Client suite: 705 tests pass
- Lint: 0 errors
- Build: succeeds
- Initial test failures fixed: `getAuthHeaders()` reads localStorage not signal; `fireEvent.click` needed for Preact signal re-renders

### File List

- `src/stats-handlers.ts` — Modified: added `handleWrappedStats` export with data aggregation, milestone filtering, narrative builder
- `src/index.ts` — Modified: added route, import, and getAllowedMethods entry for `/api/stats/wrapped`
- `client/src/utils/wrapped.ts` — New: API fetch utility, WrappedData/WrappedMilestone/FellowshipHighlight/FavoriteMonth types
- `client/src/islands/WrappedIsland.tsx` — New: Preact island with multi-card pagination, swipe, share canvas
- `client/src/islands/StatsIsland.tsx` — Modified: added admin-gated "Year in Review" tab
- `public/css/wrapped.css` — New: full wrapped component styling (~220 lines)
- `public/css/main.css` — Modified: added `@import url("./wrapped.css")`
- `tests/api/stats-handlers.test.ts` — Modified: added 8 wrapped endpoint tests
- `client/src/islands/WrappedIsland.test.tsx` — New: 14 component tests
- `client/src/islands/StatsIsland.test.tsx` — New: 5 admin tab gating tests
- `client/src/utils/wrapped.test.ts` — New: 5 API utility tests

### Review Findings

- [x] [Review][Patch] Restore service-worker template placeholders instead of checked-in build values [public/sw.js:2]
- [x] [Review][Patch] Fallback to an allowed stats tab when `#wrapped` is opened by a non-admin user [client/src/islands/StatsIsland.tsx:25]
- [x] [Review][Patch] Make wrapped summary calculations treat valid `0 km` entries consistently across counts, streaks, and first-walk logic [src/stats-handlers.ts:381]
- [x] [Review][Patch] Guard share-card average rendering when `walk_count` is zero [client/src/islands/WrappedIsland.tsx:456]
- [x] [Review][Patch] Reject malformed year values instead of accepting `parseInt()` prefixes like `2025abc` [src/stats-handlers.ts:357]
