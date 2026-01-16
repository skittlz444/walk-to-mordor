# Story 1.7: UX Polish - Modal & Input Improvements (Issue #158)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Samwise (Consistent Walker)**,
I want **an easy-to-use, clear interface for logging my daily walks**,
so that **I can quickly record my kilometers without friction or confusion**.

## Acceptance Criteria

1.  **Modal Button Styling**: "Add Walk" and "Cancel" buttons in the logging modal must have background colors, padding, and hover states matching the application's authentication buttons (Solid colors, no transparent text-only buttons).
2.  **Distance Input Clarity**: The distance input field must clearly indicate "km" as the unit, either via a visible suffix or a persistent placeholder.
3.  **Quick Entry Buttons**: Add "+1km" and "+5km" buttons next to the input field. Clicking them increments the current input value (or sets it if empty).
4.  **Touch Friendliness**: All interactive elements (buttons, inputs) must meet a minimum target size of 44x44 CSS pixels for mobile usability.
5.  **Mobile Viewport**: Layout must remain broken-proof on small screens (iPhone SE / 320px width).

## Tasks / Subtasks

- [ ] **Analyze & Locate**
  - [ ] Identify the HTML structure for the "Add Walk" modal (likely in `src/renderHtml.ts` injected string or created via JS in `public/js/calendar.js`/`progress.js`).
  - [ ] Identify existing CSS styles for Auth buttons in `public/css/auth.css` or `public/css/main.css` to replicate.

- [ ] **Button Styling Implementation**
  - [ ] Assign classes to Modal buttons to match Auth button styles (e.g., `.btn`, `.btn-primary`, `.btn-secondary`).
  - [ ] Update `public/css/main.css` to ensure these classes apply correctly within the modal context.
  - [ ] Ensure adequate padding (e.g., `12px 24px`) and rounded corners.

- [ ] **Distance Input Enhancement**
  - [ ] Wrap the distance `input` in a container to allow a "km" suffix span.
  - [ ] Style the input to have a clear border and focus state.
  - [ ] Ensure input type is `number` with `step="0.01"` for partial kilometers.

- [ ] **Quick Entry Logic**
  - [ ] Add HTML buttons for `+1km` and `+5km`.
  - [ ] Write event listeners in `public/js/*.js` (likely `progress.js` or `calendar.js`) to handle clicks:
    - Parse current value (default to 0).
    - Add 1 or 5.
    - Update input value.
    - Trigger any `input` or `change` events if required for validation.

- [ ] **Accessibility & Responsiveness**
  - [ ] Verify touch targets size (adjust padding/height).
  - [ ] Ensure contrast ratios for new buttons meet WCAG AA.
  - [ ] Test layout flex/grid behavior on narrow screens.

## Dev Notes

### Technical Constraints
- **Stack**: **Vanilla JS**. Do NOT use Preact or modern framework features yet. Story 1.1 (Infrastructure) is not yet implemented.
- **File Manipulation**: The modal HTML might be generated server-side in `src/renderHtml.ts` or client-side in `public/js/`. Check both.
- **State**: Ensure quick buttons work even if the user has already typed a value (additive behavior).

### File Locations
- **CSS**: `public/css/main.css` (likely place for new modal styles).
- **JS**: `public/js/calendar.js` (often handles the daily logging click) or `public/js/progress.js`.
- **HTML Generation**: `src/renderHtml.ts` (Check for `id="add-walk-modal"` or similar).

### Implementation Tips
- **UX Reference**: See `docs/ux-design.md` section "Current UI Screens" > "Distance Entry Modal" for specific design critique.
- **Quick Buttons**: 
  ```javascript
  const current = parseFloat(input.value) || 0;
  input.value = (current + amount).toFixed(2);
  ```

## Dev Agent Record

### Agent Model Used
{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
