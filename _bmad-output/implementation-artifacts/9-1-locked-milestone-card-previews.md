# Story 9.1: Locked Milestone Card Previews

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to be able to click on locked upcoming milestones to see a blurred preview of what's to come,
So that I feel motivated to keep walking by teasing the upcoming narrative and imagery without spoiling it.

## Acceptance Criteria

1. **Given** a user has not yet reached a milestone (total distance < milestone distance)
   **When** the milestone card renders in the goals list on the journey page
   **Then** the card remains visually minimal as it currently is (no background images) but becomes clickable, showing a pointer cursor.
2. **And** the distance remaining (milestone distance - user total distance) is displayed prominently (e.g., "42.3 km to go") on the card.
3. **And** clicking the locked milestone card OPENS the `GoalModal` (contrary to previous strict locking behavior) but in a special "locked preview" mode.
4. **And** when the `GoalModal` is opened for a locked goal:
   - The title and distance remaining are fully legible.
   - The main image uses the thumbnail (`{image_id}-thumb.webp`) heavily blurred (e.g. `blur(12px)`) and scaled to fill the space. A lock icon is overlaid to reinforce the state.
   - The description text is visually obscured using CSS `color: transparent` and `text-shadow` to render it illegible, or is replaced with a standard "Unlock this milestone to read the journal entry" placeholder, maintaining the layout's structural height.
5. **And** the user's `showFutureGoalsUnlocked` preference is respected — if the user has opted to preview all milestones unlocked, the descriptions are legible, the high-res images load normally, and they behave as they did before.
6. **And** the change works seamlessly between the journey page goals list and the map waypoint detail popups (clicking the 'expand' button on a locked map popup also opens the locked modal view).
7. **And** visual styling is consistent with the dark fantasy theme (subtle lock icon overlays).
8. **And** the locked card and modal UI are accessible.

## Tasks / Subtasks

- [ ] Task 1: Update Preact Global Store Imports (AC: #5)
  - [ ] Import `showFutureGoalsUnlocked` from `client/src/stores/appStore.ts` into components where it's missing if required.
- [ ] Task 2: Implement GoalModal Locked State (AC: #3, #4, #7)
  - [ ] Modify `client/src/islands/GoalModal.tsx` to handle a locked property (determined by checking if the user's distance is less than the goal distance and `!showFutureGoalsUnlocked.value`).
  - [ ] When locked: skip requesting the high-res image. ONLY render the thumbnail image with `filter: blur(12px) brightness(0.6)` and `transform: scale(1.1)`.
  - [ ] Add an absolutely positioned lock icon overlay in the center of the blurred image. 
  - [ ] Add CSS classes or inline styles to apply `color: transparent; text-shadow: 0 0 8px rgba(255, 255, 255, 0.5); user-select: none;` to the description text, or replace the text completely with a generic lock message.
- [ ] Task 3: Update Goal Cards / Journey Page Display (AC: #1, #2)
  - [ ] Ensure `client/src/islands/NextGoalCard.tsx` and `client/src/islands/UpcomingGoalCard.tsx` are fully clickable to launch the `GoalModal` (remove cursor restriction).
  - [ ] Provide a Lock icon next to the title text on the card if possible.
- [ ] Task 4: Update Map Waypoint Details Popups (AC: #6)
  - [ ] Enhance `client/src/components/map/WaypointPopup.tsx` to display locked status.
  - [ ] Apply the 4px-8px blur filter to `waypoint-popup-thumb` image if the waypoint is locked.
  - [ ] Ensure the expand button is ENABLED so they can access the locked `GoalModal` state.

## Dev Notes

- **Relevant Architecture Patterns and Constraints:**
  - This project uses "Islands Architecture" with Preact components mounted over SSR HTML. All dynamic changes belong in `client/src/` components.
  - `legacy JS` in `public/js/` generally shouldn't be heavily modified for UI logic unless unavoidable. Goal cards are hydratable Preact Islands.
  - Image handling rules (from `docs/asset-workflow.md`): Images live at `/img/thumbs/{image_id}-thumb.webp` and `/img/highres/{image_id}.webp`. Check `GoalModal.tsx` for the blur-up implementation logic (two stacked `<img>` nodes with opacity transitions).
  - State management uses Preact Signals (`@preact/signals`). You can directly subscribe to `showFutureGoalsUnlocked` from `client/src/stores/appStore.ts` inside the components.
  
- **Source Tree Components to Touch:**
  - `client/src/islands/UpcomingGoalCard.tsx`
  - `client/src/islands/NextGoalCard.tsx`
  - `client/src/components/map/WaypointPopup.tsx`
  - `client/src/islands/MapIsland.tsx` (to pass locked state down to WaypointPopup if necessary)
  
- **Testing Standards Summary:**
  - Maintain >90% code coverage. 
  - Ensure updated components are tested via Vitest (e.g., `UpcomingGoalCard.test.tsx`, `NextGoalCard.test.tsx`, `WaypointPopup.test.tsx`). Mock `showFutureGoalsUnlocked` to verify both locked and unlocked behaviors.

### Project Structure Notes

- **Alignment with unified project structure:** Fits in standard front-end Preact islands and map components.

### References

- [Source: _bmad-output/planning-artifacts/epics-phases-4-15.md#story-91-locked-milestone-card-previews]
- [Source: docs/frontend-guide.md]
- [Source: docs/asset-workflow.md#image-ids]

## Dev Agent Record

### Agent Model Used

Gemini 3.1 Pro (Preview)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created

### File List
- _bmad-output/implementation-artifacts/9-1-locked-milestone-card-previews.md
