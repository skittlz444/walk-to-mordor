# Story 10.1: The Palantir Weekly Insight Orb

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see a weekly summary of my walking stats and pace,
so that I can track my consistency, see my trajectory, and stay motivated.

## Acceptance Criteria

1. **Trigger Condition:** The Palantír insight popup is triggered when a user visits either the Journey page or the Maps page.
2. **Weekly Cooldown:** The Palantír popup should strictly appear only once a week per user. Once dismissed, it must not reappear on either the Maps or Journey page until the next weekly cycle. This cooldown state should be synchronized and persisted so both pages share the same cooldown.
3. **Data Pre-requisite:** The user must have logged at least one walk in the past 30 days to see the Palantír.
4. **Displayed Insights:** When shown, the Palantír displays:
   - **This week's distance:** Sum of walks in the last 7 days.
   - **Pace trend:** Comparison of this week vs. the previous week (e.g., up/down/same arrow with percentage).
   - **Projection:** Estimated time to the next major milestone (where `special` is set). If this major milestone is estimated to be < 2 weeks away at the current pace, display it ("At this pace, you'll reach [Major Milestone] in ~X days"). If it is estimated to be > 2 weeks away, fall back to the next immediate regular goal.
   - **Fellowships comparison:** Because a user can be in multiple fellowships, the component must summarize their contribution for their top 2 active fellowships by percentage to keep the UI clean (e.g., a list showing "Contributed X% to [Fellowship A] and Y% to [Fellowship B]'s progress this week").
5. **No Walks State:** If the user has no walks logged this week, the Palantír displays an encouraging theme-fitting message, such as: "The Palantír sees no movement… perhaps tomorrow?"
6. **Thematic Design (Lord of the Rings theme):** 
   - The component must be richly styled as a glowing Obsidian Palantír (crystal ball) resting on a dark iron pedestal.
   - Use deep blacks, glowing ember orange, or mystic blue accents (aligning with the dark fantasy theme).
   - Add subtle pulsing or swirling animations to the orb to simulate magical foresight.
   - Incorporate LOTR-styled typography and borders for the popup modal.
7. **Backend Data:** A new `GET /api/stats/weekly` endpoint must be implemented to compute this insight data server-side, returning stats including the multi-fellowship breakdown.
8. **Dedicated Stats Page:** Create a new `/stats` page accessible via a new entry in the main navigation. This page must include a sub-navigation menu (e.g., tabs) to serve as a hub for future stat views (like Heatmap). The Palantír component should be permanently visible within the "Palantír" sub-navigation view to always display the latest weekly insights (ignoring the weekly cooldown).

## Tasks / Subtasks

- [x] Task 1: API Endpoint (`/api/stats/weekly`) (AC: 4, 5, 7)
  - [x] Subtask 1.1: Create SQL query to sum past 7 days and prior 7 days distances.
  - [x] Subtask 1.2: Calculate pace trend and projection (evaluating next major milestone distance < 2 weeks vs. immediate next goal).
  - [x] Subtask 1.3: Calculate percentage contribution against each fellowship the user is a member of, but only return/display the top 2 by percentage.
- [x] Task 2: State & Cooldown Tracking (AC: 1, 2)
  - [x] Subtask 2.1: Add a mechanism (e.g., in localStorage or D1 `users` table preferences, or via `appStore.ts`) to track the `last_palantir_view` timestamp.
  - [x] Subtask 2.2: Ensure the Maps and Journey Preact islands check this shared cooldown before popping up.
- [x] Task 3: Thematic UI Component (`PalantirInsightModal.tsx`) (AC: 4, 5, 6)
  - [x] Subtask 3.1: Design and implement the modal with the Palantír aesthetic (glowing effects, dark iron theme).
  - [x] Subtask 3.2: Implement the stats layout showing personal progress and the multi-fellowship breakdown list.
  - [x] Subtask 3.3: Implement the dismiss action that updates the cooldown tracker.
- [x] Task 4: Integration (AC: 1, 3)
  - [x] Subtask 4.1: Integrate `PalantirInsightModal` into both Journey page and Maps page islands.
  - [x] Subtask 4.2: Verify rendering logic: only render if 30-day activity exists and the 1-week cooldown has elapsed.
- [x] Task 5: Dedicated Stats Page & Sub-Navigation (AC: 8)
  - [x] Subtask 5.1: Create `/stats` structure and HTML shell, ensuring it includes a sub-navigation menu (e.g., standard site tabs) to act as a hub for different stat views.
  - [x] Subtask 5.2: Add a "Stats" link to the main app layout navigation.
  - [x] Subtask 5.3: Add "The Palantír" as the primary active tab/view in the new Stats sub-navigation (e.g., `/stats/palantir` or `#palantir`).
  - [x] Subtask 5.4: Render the Palantír component within this sub-view in an "always-open" mode (bypassing the weekly cooldown).

### Review Findings

- [x] [Review][Patch] Scope the Palantír cooldown storage per user instead of per browser [client/src/stores/appStore.ts:53]
- [x] [Review][Patch] Prevent the Journey and Map Palantír popups from showing for users without 30-day activity, and avoid consuming cooldown in that empty state [client/src/islands/PalantirIsland.tsx:21]
- [x] [Review][Patch] Guard the Journey and Map Palantír popups behind authentication so they cannot flash a "Not authenticated" error before redirect [client/src/islands/PalantirIsland.tsx:21]
- [x] [Review][Patch] Compare pace using matching 7-day windows instead of an 8-day current window versus a 7-day previous window [src/stats-handlers.ts:85]
- [x] [Review][Patch] Return a meaningful pace change for a first active week instead of "up" with 0% change [src/stats-handlers.ts:103]

## Dev Notes

- **Asset Acquisition:** If specific standalone images (e.g., Palantír artwork, pedestal textures) are required to fulfill the thematic UI requirements, explicitly pause and ask the user to provide or generate these assets during implementation.
- **Architecture:** Maintain the "Islands Architecture". Build this as a new Preact component in `client/src/components/`, and integrate it cleanly without rewriting working legacy Vanilla JS out of scope. Use Preact Signals (e.g., `appStore.ts` if adding cooldown state there).
- **Backend:** For `GET /api/stats/weekly`, ensure to use the `db.read()` wrapper (Epic 8 pattern) rather than `env.DB.prepare()` directly.
- **Fellowships:** A user can be part of multiple parties. Make sure the API queries the `parties` and `party_members` tables (possibly with `progress` scoped to those periods) to get the party totals accurately and individually.
- **Styling:** Rely on existing CSS variables (`--gold-accent`, `--bg-dark`, etc.). Use CSS animations for the glowing Palantír effect (`@keyframes pulse {...}`).

### Project Structure Notes

- Client code goes in `client/src/components/PalantirInsightModal.tsx`.
- Backend endpoint goes in a suitable handler file, possibly `src/stats-handlers.ts` or extending an existing one. Register the new `/stats` HTML render route in `src/index.ts`. Ensure the structural layout supports a sub-nav header section.
- Navigation updates typically go in the `src/views/partials/` layout files (or wherever global navigation is defined).

### References

- Cite: `docs/architecture.md`
- Cite: `docs/design-guide.md` (for dark fantasy themes)
- Extracted from: `epics-phases-4-15.md`

## Dev Agent Record

### Agent Model Used

Gemini 3.1 Pro (Preview)

### Debug Log References
None

### Completion Notes List
- Story fully scoped. ACs modified to include multi-fellowship support, visual LOTR theme instructions, and cross-page unified weekly cooldown.
- Added dedicated Stats page (new UI tab) where the Palantir insight stays permanently visible.
- Added sub-navigation design to the Stats page to serve as the hub layout for future statistical interfaces.
- Updated projection logic to prioritize major milestones within a 2-week window, falling back to the next immediate goal.
- Limited fellowship contribution summary to the top 2 fellowships to maintain a clean UI.
- **Added instruction for the developer to request any specific missing image assets from the user during implementation.**
- Pre-existing bug fixed: `tsconfig.jest.json` had `"ignoreDeprecations": "6.0"` which was invalid in TypeScript 5.9.3, causing ALL Jest tests to fail. Removed to unblock the suite.
- Palantír CSS is entirely CSS-variables-based (no embedded images needed); the orb is rendered via CSS gradients and animations.
- `vi.mock()` (not `vi.spyOn`) is required for ESM named-export mocking in Vitest — critical lesson for future component tests.

### Change Log
| Date | Change | Author |
|------|--------|--------|
| 2026-04-xx | Full implementation: Tasks 1–5 complete. All tests pass (1167 Jest + 656 Vitest). | GitHub Copilot (Claude Sonnet 4.6) |

### File List
- `_bmad-output/implementation-artifacts/10-1-the-palantir-weekly-insight-orb.md`
- `src/stats-handlers.ts` — new `handleWeeklyStats()` API handler
- `src/renderStatsPage.ts` — SSR shell for `/stats` page
- `src/index.ts` — added `/api/stats/weekly` + `/stats` routes; `getAllowedMethods` entry
- `tsconfig.jest.json` — removed invalid `ignoreDeprecations: "6.0"` (pre-existing bug fix)
- `client/src/components/PalantirInsightModal.tsx` — Palantír UI component
- `client/src/islands/PalantirIsland.tsx` — cooldown-guarded island for Journey page
- `client/src/islands/StatsIsland.tsx` — stats page island with sub-navigation
- `client/src/islands/MapIsland.tsx` — integrated Palantír modal with cooldown guard
- `client/src/islands/DrawerIsland.tsx` — added "Stats" nav link
- `client/src/index.tsx` — registered `PalantirIsland` + `StatsIsland`
- `client/src/stores/appStore.ts` — added `lastPalantirViewTs`, `palantirCooldownElapsed`, `markPalantirViewed`
- `public/css/palantir.css` — full LOTR-themed CSS (orb, pedestal, animations, stats page layout)
- `public/css/main.css` — added `@import url("./palantir.css")`
- `tests/api/stats-handlers.test.ts` — 7 Jest tests for `/api/stats/weekly`
- `tests/api/index.test.ts` — added `/stats` route test; mock wiring for `renderStatsPage`
- `client/src/stores/appStore.test.ts` — 5 new Palantír cooldown tests
- `client/src/components/__tests__/PalantirInsightModal.test.tsx` — 25 Vitest tests for the modal
