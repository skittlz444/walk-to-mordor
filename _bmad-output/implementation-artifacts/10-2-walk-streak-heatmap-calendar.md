# Story 10.2: Walk Streak & Heatmap Calendar

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see a visual heatmap of my walking history and my current streak,
so that I feel achievement from consistency and can see patterns in my activity.

## Acceptance Criteria

1. **Given** a user has logged walk data in the `progress` table
   **When** the user navigates to the dedicated `/stats` page and selects the Heatmap sub-navigation tab (e.g., `/stats/heatmap` or `#heatmap`),
   **Then** a heatmap calendar is displayed showing the past 365 days (or since account creation, whichever is shorter).
2. **And** each day cell is colored by intensity: no walk (empty/dark), light walk (light shade), heavy walk (bright shade) — using 4–5 intensity buckets based on distance.
3. **And** hovering/tapping a day shows the date and distance logged.
4. **And** the current walk streak (consecutive days with ≥ 1 walk logged) is displayed prominently (e.g., "🔥 12-day streak").
5. **And** the longest-ever streak is also shown.
6. **And** a new `GET /api/stats/heatmap` endpoint returns `{ days: [{ date, distance }], currentStreak, longestStreak }`.
7. **And** the heatmap is responsive — on mobile, it shows fewer columns (e.g., last 6 months) or scrolls horizontally.
8. **And** the heatmap component is implemented as a Preact component in `client/src/components/HeatmapCalendar.tsx`.
9. **And** tests cover the API endpoint (streak calculation edge cases: gaps, single day, no data) and component rendering.

## Tasks / Subtasks

- [x] Create Database / Backend Logic (AC: 6, 9)
  - [x] Implement `/api/stats/heatmap` endpoint.
  - [x] Query past 365 days of progress for the user: `SELECT date, distance FROM progress WHERE user_id = ? AND date >= date('now', '-365 days') ORDER BY date ASC`.
  - [x] Add streak calculation (iterate backwards from today, count consecutive days; also track longest streak).
  - [x] Add Jest tests for heatmap endpoint covering streak calculation edge cases.
- [x] Create Preact UI Component (AC: 1, 2, 3, 7, 8)
  - [x] Create `client/src/components/HeatmapCalendar.tsx`.
  - [x] Render 52-column × 7-row CSS grid or SVG.
  - [x] Map data to 4-5 intensity buckets (e.g. 0 km, 0–2 km, 2–5 km, 5–10 km, 10+ km).
  - [x] Add tooltips/hover states displaying date and distance logged.
  - [x] Ensure mobile responsiveness (scrollable or showing fewer months block).
- [x] Implement Streak UI elements (AC: 4, 5)
  - [x] Display current and longest streak prominently within the heatmap sub-navigation view on the `/stats` page.
- [x] Lord of the Rings / Walk to Mordor Styling Integration
  - [x] Apply dark fantasy / Middle-earth themed color scale (e.g. parchment textures, elvish gold/green intensity levels, thematic phrasing).

### Review Findings

- [x] [Review][Patch] Current streak undercounts users with streaks longer than 365 days [src/stats-handlers.ts:224]
- [x] [Review][Patch] Heatmap always renders a full 365-day grid instead of stopping at account creation [client/src/components/HeatmapCalendar.tsx:23]
- [x] [Review][Patch] Heatmap mixes local and UTC date math, which can shift cells and window boundaries by a day [client/src/components/HeatmapCalendar.tsx:30]

## Dev Notes

- **Aesthetic / Styling Requirement:** Keep the UI meticulously aligned with the Lord of the Rings / Walk to Mordor theme. Replace standard GitHub "green squares" with colors fitting the app's dark fantasy styling (dark background with green/gold/ember intensity levels). Tooltips should feel like reading a ranger's field journal or map legend.
- **Architecture Constraints:** Must be implemented as a Preact component in `client/src/`. No vanilla JS in `public/js/`.
- **API Optimization:** The backend `GET /api/stats/heatmap` should perform efficiently. Use the D1 read replica wrapper (`db.read()`) if available.
- **Streak Calculation:** Ensure the logic accounts for timezone differences properly, typically relying on the user's logged dates or UTC truncations as standardized by existing progress data.

### Project Structure Notes

- Client components belong in `client/src/components/`.
- Tests for backend: `tests/`. Vitest client test results/artifacts: `test-results/client/junit.xml`.

### References

- [Source: _bmad-output/planning-artifacts/epics-phases-4-15.md#story-10-2]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation, no debugging required.

### Completion Notes List

- **Backend**: Added `handleHeatmap` to `src/stats-handlers.ts` with two D1 queries — 365-day windowed progress and all-time dates for longest streak. Current streak counts backwards from today; longest streak iterates all-time data.
- **Route wiring**: Added `/api/stats/heatmap` GET route in `src/index.ts` with `getAllowedMethods` entry.
- **Backend tests**: 7 new Jest tests covering: auth failure, empty data, consecutive streak, gap detection, all-time vs windowed longest streak, single-day streak, DB errors. All pass. stats-handlers.ts at 100% stmt/line coverage.
- **Client component**: `HeatmapCalendar.tsx` Preact component with 52-week × 7-day CSS grid, 5 intensity buckets, tooltip on hover/click, month and day labels, mobile-responsive via horizontal scroll wrapper.
- **Client fetch util**: `client/src/utils/heatmap.ts` with typed `fetchHeatmapData()` following `palantir.ts` pattern.
- **Island wiring**: Removed `disabled` from Heatmap tab in `StatsIsland.tsx`, replaced placeholder with `<HeatmapCalendar />`.
- **Styling**: Middle-earth themed palette (dark green→forest green→bright green→elvish gold), dark background, gold borders, thematic loading text ("Consulting the archives of Minas Tirith"), ranger-journal tooltip feel.
- **Streak UI**: Fire emoji current streak + sword emoji longest streak cards displayed prominently above the heatmap grid.
- **Client tests**: 14 Vitest tests covering loading/error states, data display, streak values, intensity levels, legend, month labels, tooltip interactions, grid cell count, auth header verification.
- **Validation**: Lint 0 errors, build succeeds, 35 backend suites (1177 tests) pass, 43 client suites (678 tests) pass. No regressions.

### Change Log

- 2026-04-08: Implemented story 10.2 — Walk Streak & Heatmap Calendar (all tasks complete)

### File List

**New files:**
- client/src/components/HeatmapCalendar.tsx
- client/src/components/__tests__/HeatmapCalendar.test.tsx
- client/src/utils/heatmap.ts

**Modified files:**
- src/stats-handlers.ts (added handleHeatmap handler + HeatmapDayRow interface)
- src/index.ts (added route + import + getAllowedMethods entry)
- tests/api/stats-handlers.test.ts (added 7 handleHeatmap tests)
- client/src/islands/StatsIsland.tsx (enabled heatmap tab, wired HeatmapCalendar component)
- public/css/palantir.css (added heatmap CSS: grid, streaks, legend, tooltip, intensity levels)
