# Story 10.3: Walk-to-Mordor Wrapped — Year-End Review

Status: ready-for-dev

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

- [ ] Task 1: Create the new `/api/stats/wrapped` endpoint (AC: Data aggregation, Admin only)
  - [ ] Subtask 1.1: Add route handler in `src/stats-handlers.ts` or `src/index.ts` for `GET /api/stats/wrapped`
  - [ ] Subtask 1.2: Enforce admin role check (e.g. using `requireAdmin` or checking `user.is_admin === 1`)
  - [ ] Subtask 1.3: Aggregate data from `progress` table (`strftime('%Y', date) = ?`) to compute total distance, walk count, best streak, favorite month, and milestones unlocked (applying the threshold logic to only include milestones where `special IS NOT NULL` if the total count is high)
  - [ ] Subtask 1.4: Include logic for fellowship highlights if applicable
  - [ ] Subtask 1.5: Write unit tests for the endpoint (admin success and non-admin denial, data aggregation calculations)
- [ ] Task 2: Build the Wrapped UI component (AC: Multi-page narrative, template-based, Preact island)
  - [ ] Subtask 2.1: Create `client/src/islands/WrappedIsland.tsx` (or inside `/components/stats/`)
  - [ ] Subtask 2.2: Implement the scrollable/swipeable card sequence
  - [ ] Subtask 2.3: Build the template-based narrative strings
  - [ ] Subtask 2.4: Integrate the "Share" button and Canvas rendering for the shareable card
- [ ] Task 3: Integrate with Stats Area (AC: Admin visibility only)
  - [ ] Subtask 3.1: Only show the "Year in Review" link/button in the Stats area if the current user is an admin
  - [ ] Subtask 3.2: Hook up the routing to display `WrappedIsland`
- [ ] Task 4: Add e2e / client tests
  - [ ] Subtask 4.1: Test UI rendering and pagination
  - [ ] Subtask 4.2: Verify share image rendering function
  - [ ] Subtask 4.3: Verify the UI does not appear for non-admin users

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

Gemini 3.1 Pro (Preview)

### Debug Log References

### Completion Notes List

### File List
