# Story 3.6: Fellowship UI - Journey & Map Party Selector

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a User who belongs to one or more Fellowships,
I want to be able to toggle between my personal progress and my parties' combined progress on the Journey and Map pages,
so that I can visualize our shared journey and see the specific contributions of each party member.

## Acceptance Criteria

1. Create a `PartySelector` Preact island component that fetches the user's active parties via `GET /api/user/parties`.
2. Mount the `PartySelector` above the main content area on the Journey (Dashboard) page. On the Map page, use a button that opens the fellowship selector similar to how there is a button to open the calendar area.
3. If the user is not a member of any party, the selector should be hidden.
4. If the user is a member of at least one party, show a dropdown/selector to choose between "Personal" and each party name.
5. When a party is selected, display a visual indicator banner (e.g., "👥 Viewing: [Fellowship Name]") to distinguish it from the personal view.
6. **Journey Page Integration:** When a party is selected, display the party's combined distance and milestone progress instead of personal progress. The `NextGoalCard` and `UpcomingGoalCard` components must re-render with the party's progress data. Show a brief loading indicator during data fetch.
7. **Map Page Integration:** When a party is selected, display the party's combined distance path. Show per-member contributed segments with color-coded lines. Each member is assigned a distinct color computed deterministically from `user_id % palette_size` (palette size = 12). Goals on the map should be locked/unlocked based on the viewed fellowship's total distance and the individual user's lock/unlock preference.
8. **Map Legend:** Include a map legend showing member name + color swatch when in party view.
9. **Color Palette:** Define a 12-color maximum distinctness palette. For members beyond 12, just repeat the colors (they will be spread out enough). Departed members whose contributions are kept should be shown in a muted/desaturated version of their color. Departed members with removed contributions should not be shown.
10. **Milestone Modal Trigger:** When switching to a party view, call `GET /api/party/:id/progress` and check `newly_passed_milestones`. If any exist, display the milestone modal for the latest passed milestone. Do not re-trigger the modal when simply toggling between parties at different positions unless a new milestone was passed since the last view.
11. Persist the user's last selected view (personal/party ID) in `localStorage` for page reload continuity.
12. **Edge Case Handling:** If the persisted party ID returns a 403 (user kicked) or 404 (party dissolved) from the API, fall back to the "Personal" view silently and clear the stale `localStorage` value.

## Tasks / Subtasks

- [x] Task 1: PartySelector Component (AC: 1, 2, 3, 4, 5, 11, 12)
  - [x] Create `PartySelector.tsx` in `client/src/islands/`.
  - [x] Fetch user parties on mount.
  - [x] Implement dropdown UI and visual banner.
  - [x] Manage selected state and persist to `localStorage`.
  - [x] Handle 403/404 errors by falling back to "Personal" view.
- [x] Task 2: Journey Page Integration (AC: 6)
  - [x] Update Journey page to use `PartySelector`.
  - [x] Fetch party progress when a party is selected.
  - [x] Pass party progress data to `NextGoalCard` and `UpcomingGoalCard`.
- [x] Task 3: Map Page Integration (AC: 7, 8, 9)
  - [x] Update Map page to use `PartySelector` via a button similar to the calendar area.
  - [x] Fetch party progress when a party is selected.
  - [x] Render color-coded path segments based on member contributions.
  - [x] Implement map legend.
  - [x] Implement 12-color palette and styling for departed members (repeating colors for >12 members).
- [x] Task 4: Milestone Modal Trigger (AC: 10)
  - [x] Check `newly_passed_milestones` in the progress response.
  - [x] Trigger milestone modal if new milestones exist.

## Dev Notes

- **Architecture Details**: 
  - The API endpoints were created in Stories 3.3 and 3.4.
  - The `PartySelector` should be a Preact island that communicates with other islands (like the Map or Goal cards) via Preact Signals or a shared state context.
- **Color Palette**: Define the 12 colors in CSS variables or a shared JS constant to ensure consistency between the map rendering and the legend.
- **Map Rendering**: Konva.js is used for the map. You will need to draw multiple `Konva.Line` segments for the party path, one for each member's contribution.

### Project Structure Notes

- New components go in `client/src/islands/` or `client/src/components/`.
- Ensure CSS variables for the new colors are added to `public/css/main.css` or a dedicated theme file.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6: Fellowship UI - Journey & Map Party Selector]
- [Source: docs/architecture.md#ADR-004: Fellowship Data Model Direction]
- [Source: docs/ux-design.md]

### change-impact

Requirements expanded from original spec:
- This story replaces the original "Dashboard Integration" scope.
- Now covers multi-party selection on Journey/Map pages.
- Per-member color-coded map segments (deterministic colors from user ID).
- Party milestone modal triggering (FR_PARTY_09 primary implementation).
- Map legend, loading states, stale localStorage handling.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4.6)

### Debug Log References

No debug issues encountered.

### Completion Notes List

- Created partyStore with Preact Signals for shared party state management
- Created 12-color maximum distinctness palette with muted variants for departed members
- PartySelector island: dropdown UI, banner, loading states, localStorage persistence, 403/404 fallback
- Journey page integration: mounts PartySelector above goals, re-renders goals with party distance
- Map page integration: party toggle button in controls, MemberPaths Konva.Line rendering, MapLegend overlay
- Milestone modal triggering via newly_passed_milestones with session-level dedup
- All 268 client tests pass, all 408 backend tests pass
- Browser-tested on both Journey and Map pages with test account

### File List

- `client/src/stores/partyStore.ts` — NEW: Party state management (signals, fetch, persist, milestone tracking)
- `client/src/utils/party-colors.ts` — NEW: 12-color palette, getMemberColor(), getMutedMemberColor()
- `client/src/islands/PartySelector.tsx` — NEW: Preact island for party/personal view toggle
- `client/src/components/map/MemberPaths.ts` — NEW: Konva.Line creation for per-member path segments
- `client/src/components/map/MapLegend.tsx` — NEW: HTML overlay legend with member names + colors
- `client/src/index.tsx` — MODIFIED: Added PartySelector to island registry, exposed partyStore on window
- `client/src/islands/MapIsland.tsx` — MODIFIED: Added party toggle button, member paths, legend integration
- `src/renderHtml.ts` — MODIFIED: Added party-selector-mount div
- `public/js/goals.js` — MODIFIED: Added party selector mounting + view change handler
- `public/js/progress.js` — MODIFIED: Store personal distance on window._personalDistance
- `public/css/main.css` — MODIFIED: Added party color CSS variables, selector/banner/legend/panel styles
- `client/src/utils/party-colors.test.ts` — NEW: Tests for color palette
- `client/src/stores/partyStore.test.ts` — NEW: Tests for store signals and actions
- `client/src/islands/PartySelector.test.tsx` — NEW: Component tests
- `client/src/components/map/MemberPaths.test.ts` — NEW: Tests for member path creation
- `client/src/components/map/MapLegend.test.tsx` — NEW: Tests for legend component

## Change Log

| Date | Summary |
|---|---|
| 2026-03-01 | Story 3.6 implemented: PartySelector island, Journey + Map integration, color-coded member paths, map legend, milestone modal trigger. 268 client tests, 408 backend tests passing. |
