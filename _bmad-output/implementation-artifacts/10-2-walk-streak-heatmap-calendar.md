# Story 10.2: Walk Streak & Heatmap Calendar

Status: ready-for-dev

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

- [ ] Create Database / Backend Logic (AC: 6, 9)
  - [ ] Implement `/api/stats/heatmap` endpoint.
  - [ ] Query past 365 days of progress for the user: `SELECT date, distance FROM progress WHERE user_id = ? AND date >= date('now', '-365 days') ORDER BY date ASC`.
  - [ ] Add streak calculation (iterate backwards from today, count consecutive days; also track longest streak).
  - [ ] Add Jest tests for heatmap endpoint covering streak calculation edge cases.
- [ ] Create Preact UI Component (AC: 1, 2, 3, 7, 8)
  - [ ] Create `client/src/components/HeatmapCalendar.tsx`.
  - [ ] Render 52-column × 7-row CSS grid or SVG.
  - [ ] Map data to 4-5 intensity buckets (e.g. 0 km, 0–2 km, 2–5 km, 5–10 km, 10+ km).
  - [ ] Add tooltips/hover states displaying date and distance logged.
  - [ ] Ensure mobile responsiveness (scrollable or showing fewer months block).
- [ ] Implement Streak UI elements (AC: 4, 5)
  - [ ] Display current and longest streak prominently within the heatmap sub-navigation view on the `/stats` page.
- [ ] Lord of the Rings / Walk to Mordor Styling Integration
  - [ ] Apply dark fantasy / Middle-earth themed color scale (e.g. parchment textures, elvish gold/green intensity levels, thematic phrasing).

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

Not recorded.

### Debug Log References

### Completion Notes List

### File List
