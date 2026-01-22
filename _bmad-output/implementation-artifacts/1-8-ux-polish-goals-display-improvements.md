# Story 1.8: UX Polish - Goals Display Improvements (Issue #159)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Frodo (Story-Driven Walker)**,
I want **my next immediate goal highlighted with a progress bar**,
so that **I can see exactly how close I am to the next milestone without doing mental math**.

## Acceptance Criteria

1.  **Next Goal Emphasis**: The immediate next upcoming goal must be visually distinct (larger, highlighted, or badged) compared to subsequent goals.
2.  **Next Goal Progress Bar**: A visual progress bar must be displayed *inside* the card of the immediate next goal.
    *   The bar represents progress from the *previous* milestone (or 0km) to this *next* milestone.
    *   Example: Previous Goal @ 10km, Next Goal @ 20km. User @ 15km. Progress = 50%.
3.  **No Section Headers**: The goals list should remain a simple ordered timeline (removed previous requirement for region headers).
4.  **No Dashboard Global Bar**: Removed requirement for global dashboard progress bar.
5.  **Responsiveness**: The expanded "Next Goal" card must fit within mobile viewports.

## Tasks / Subtasks

- [ ] **Goals List Rendering Logic (`public/js/goals.js`)**
  - [ ] Modify `renderGoals()` loop.
  - [ ] Identify the **first** goal where `goal.distance > currentDistance`. This is the "Next Goal".
  - [ ] Flag this goal for special rendering.

- [ ] **Next Goal Styling (`public/css/goals.css`)**
  - [ ] Create `.goal-card.next-goal` class.
  - [ ] Add emphasis styling: e.g., slightly larger font, subtle gold border/box-shadow, or a "Next Target" badge.

- [ ] **Progress Bar Implementation**
  - [ ] Inside the `renderGoals()` logic for the Next Goal:
    - [ ] Get `previousDistance` (distance of the goal immediately preceding this one, or 0 if it's the first goal).
    - [ ] Calculate `segmentTotal = goal.distance - previousDistance`.
    - [ ] Calculate `segmentProgress = currentDistance - previousDistance`.
    - [ ] Calculate `percentage = Math.max(0, Math.min(100, (segmentProgress / segmentTotal) * 100))`.
  - [ ] Inject HTML for the progress bar into the Goal Card's DOM.
    - [ ] Structure: `<div class="goal-progress-track"><div class="goal-progress-fill" style="width: ${percentage}%"></div></div>`
  - [ ] Style the bar (Gold fill, dark track).

## Dev Notes

### Progress Calculation Logic
The progress bar is "Segment Progress", not "Total Journey Progress".
It answers: "How far through the current leg of the journey am I?"

```javascript
// Pseudocode inside render loop
let previousDist = 0;
goals.forEach(goal => {
  if (!nextGoalFound && goal.distance > currentDistance) {
     isNextGoal = true;
     nextGoalFound = true;
     
     // Calculate Segment Progress
     const segmentStart = previousDist;
     const segmentEnd = goal.distance;
     const segmentDist = segmentEnd - segmentStart;
     const userDistInSegment = currentDistance - segmentStart;
     const percent = (userDistInSegment / segmentDist) * 100;
  }
  previousDist = goal.distance;
});
```

### Files
- **Logic**: `public/js/goals.js`
- **Styling**: `public/css/main.css` (or `goals.css` if we split it out)

## Dev Agent Record

### Agent Model Used
{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
