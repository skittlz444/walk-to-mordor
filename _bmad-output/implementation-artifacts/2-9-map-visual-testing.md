# Story 2.9: Map Visual Testing

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Developer maintaining the Walk to Mordor application**,
I want **Playwright visual regression tests that verify the map renders correctly at various states**,
so that **future code changes don't inadvertently break the map's visual appearance and interactions**.

## Acceptance Criteria

1. **Snapshot Tests - Default State**:
   - [ ] Create snapshot test for map at default zoom level (1x).
   - [ ] Verify map canvas renders without errors.
   - [ ] Base Middle-earth map image is visible.
   - [ ] Snapshot captures standard viewport (Desktop Chrome 1280x720).

2. **Snapshot Tests - Zoom States**:
   - [ ] Create snapshot for map zoomed OUT (0.5x scale).
   - [ ] Create snapshot for map zoomed IN (2x scale).
   - [ ] Verify pan position is consistent between test runs.

3. **Path Rendering Tests**:
   - [ ] Test with mock progress data (e.g., 100km completed).
   - [ ] Verify completed path segment is visually distinct (gold/amber line).
   - [ ] Verify path starts from Hobbiton and extends to user position.
   - [ ] Snapshot captures path rendering correctly.

4. **Waypoint Visibility Tests**:
   - [ ] Test waypoint markers visible at default zoom.
   - [ ] Test waypoint visibility changes at zoomed out level (fewer waypoints).
   - [ ] Test waypoint visibility at zoomed in level (more waypoints visible).
   - [ ] Verify unlocked vs locked waypoint visual differentiation.

5. **Calendar Toggle Interaction Test**:
   - [ ] Test clicking "Log Walk" FAB opens calendar modal.
   - [ ] Snapshot of map with calendar modal overlay visible.
   - [ ] Snapshot of map after modal is dismissed.

6. **Documentation & CI**:
   - [ ] Document snapshot update process in `TESTING.md` or `docs/`.
   - [ ] Tests run successfully in CI pipeline (GitHub Actions).
   - [ ] Snapshot baseline images checked into repository.

7. **Cross-Browser/Viewport Testing**:
   - [ ] Tests pass on Chromium (primary).
   - [ ] Tests pass on Mobile Chrome (Pixel 5 viewport).
   - [ ] Optional: Firefox baseline (documented if differences exist).
8. **Deterministic Baselines**:
   - [ ] All snapshots run with a canonical viewport (Desktop: 1280x720, Mobile: Pixel 5), fixed mock progress (e.g., 100 km + seeded milestones), and the selected base map asset (document which of the 8K/10K WebP files is used) so that CI and local machines capture identical frames.
   - [ ] Document these seeds alongside the snapshot update instructions.

## Tasks / Subtasks

- [ ] **1. Create Map Visual Test File (`tests/ui/map-visual.spec.js`)**
    - [ ] Import test helpers from `helpers/common.js`.
    - [ ] Create `test.describe('Map Visual Regression')` block.
    - [ ] Add `test.beforeEach` that navigates to `/map` route.
    - [ ] Configure mock progress data for consistent test state.

- [ ] **2. Implement Mock Data Setup for Consistent Snapshots**
    - [ ] Create helper function `setupMapTestState(page, options)`.
    - [ ] Options include: `{ totalDistance: number, milestones?: Milestone[] }`.
    - [ ] Use localStorage or API mocking to inject consistent progress state.
   - [ ] Ensure user position is deterministic for snapshot comparison (e.g., always seed distance=100km with the same `fellowship-path` data and record which map asset is loaded).

- [ ] **3. Default Zoom Snapshot Test**
    - [ ] Navigate to `/map`.
    - [ ] Wait for map canvas to fully render (`page.waitForSelector('canvas')`).
    - [ ] Wait for any loading indicators to disappear.
    - [ ] Capture full-page or element snapshot: `await expect(page.locator('#map-root')).toHaveScreenshot('map-default-zoom.png')`.

- [ ] **4. Zoomed Out Snapshot Test (0.5x)**
    - [ ] Navigate to `/map`.
    - [ ] Trigger zoom out action (simulate wheel event or use zoom controls).
    - [ ] Wait for zoom transition to complete.
    - [ ] Capture snapshot: `'map-zoomed-out.png'`.

- [ ] **5. Zoomed In Snapshot Test (2x)**
    - [ ] Navigate to `/map`.
    - [ ] Trigger zoom in action.
    - [ ] Wait for zoom transition to complete.
    - [ ] Capture snapshot: `'map-zoomed-in.png'`.

- [ ] **6. Path Rendering Snapshot Test**
    - [ ] Setup mock progress: `totalDistance: 100` (approx. Hobbiton to Woody End).
    - [ ] Navigate to `/map`.
    - [ ] Wait for path to render on canvas.
    - [ ] Capture snapshot: `'map-path-100km.png'`.
    - [ ] Add test for longer progress (e.g., 500km) to verify path extends: `'map-path-500km.png'`.

- [ ] **7. Waypoint Visibility Tests**
    - [ ] At default zoom, verify major waypoints visible.
    - [ ] At zoomed out (0.5x), verify only major waypoints shown (count check).
    - [ ] At zoomed in (2x), verify additional waypoints appear.
    - [ ] Snapshot comparison to verify waypoint density changes.

- [ ] **8. Calendar Modal Toggle Test**
    - [ ] Navigate to `/map`.
    - [ ] Click FAB (Log Walk button).
    - [ ] Wait for modal to appear (`page.waitForSelector('.modal-overlay')`).
    - [ ] Capture snapshot with modal: `'map-with-calendar-modal.png'`.
    - [ ] Dismiss modal (click outside or ESC).
    - [ ] Verify modal closes.
    - [ ] Capture snapshot after dismiss: `'map-modal-dismissed.png'`.

- [ ] **9. Mobile Viewport Snapshot (Pixel 5)**
    - [ ] Configure test to use `devices['Pixel 5']` viewport.
    - [ ] Navigate to `/map`.
    - [ ] Capture snapshot: `'map-mobile-default.png'`.
    - [ ] Test touch gestures for zoom if applicable.

- [ ] **10. CI Pipeline Integration**
    - [ ] Ensure `.github/workflows/pr-tests.yml` runs visual tests.
    - [ ] Configure snapshot storage path: `tests/ui/map-visual.spec.js-snapshots/`.
    - [ ] Add CI flag for updating snapshots: `npx playwright test --update-snapshots`.
    - [ ] Document snapshot update procedure.

- [ ] **11. Documentation Updates**
    - [ ] Update `docs/` or `TESTING.md` with visual testing section.
    - [ ] Document how to update baselines after intentional UI changes.
    - [ ] Document how to debug snapshot failures (diff images).
    - [ ] Document cross-browser visual differences (if any).

## Dev Notes

### Architecture & Pattern Compliance

- **Test Framework**: Playwright (per existing project configuration in `playwright.config.js`).
- **Snapshot Storage**: Store in `tests/ui/map-visual.spec.js-snapshots/` (Playwright default).
- **Test File Location**: `tests/ui/map-visual.spec.js` (follows existing pattern).
- **Test Helpers**: Extend `tests/ui/helpers/common.js` as needed.

### Technical Requirements

#### Playwright Visual Testing API

Use Playwright's built-in visual comparison:

```javascript
// Example snapshot assertion
await expect(page.locator('#map-root')).toHaveScreenshot('map-default.png', {
  maxDiffPixels: 100,  // Allow minor anti-aliasing differences
  threshold: 0.2,       // 20% pixel diff threshold
});
```

#### Canvas-Specific Considerations

Konva.js renders to `<canvas>`. Key considerations:
1. **Wait for render complete**: Canvas may not be immediately ready. Use:
   ```javascript
   await page.waitForFunction(() => {
     const canvas = document.querySelector('#map-root canvas');
     return canvas && canvas.width > 0 && canvas.height > 0;
   });
   ```
2. **Anti-aliasing variance**: Different browsers render canvas slightly differently. Configure appropriate `threshold` and `maxDiffPixels`.
3. **Animation completion**: Wait for any pan/zoom animations to finish before snapshot.

#### Mock Data Strategy

To ensure deterministic snapshots:
1. **Mock API responses** for `/api/total-distance` and `/api/goals`.
2. **Use Playwright route interception**:
   ```javascript
   await page.route('**/api/total-distance', route => {
     route.fulfill({
       status: 200,
       contentType: 'application/json',
       body: JSON.stringify({ totalDistance: 100 })
     });
   });
   ```
3. **Seed consistent milestones** via mock data helper.

### Project Structure Notes

- **Map route**: `/map` (per Story 2.1).
- **Map container**: `#map-root` element with Preact island mounted.
- **Canvas element**: Konva Stage renders a `<canvas>` inside `#map-root`.
- **FAB selector**: `.map-walk-button` or similar (defined in Story 2.8).
- **Modal selector**: `.modal-overlay` (existing pattern).

### Dependencies

This story depends on completion of:
- **Story 2.1**: Map page shell & navigation (provides `/map` route).
- **Story 2.2**: Map canvas & base image layer (provides Konva Stage).
- **Story 2.3**: Journey path rendering (provides path visualization).
- **Story 2.4**: Current position marker (provides user marker).
- **Story 2.5**: Waypoint markers (provides waypoint visualization).
- **Story 2.6**: Waypoint detail popup (optional for visual tests).
- **Story 2.7**: Map state management (provides Preact Signals store).
- **Story 2.8**: Map walk logging (provides FAB and calendar toggle).

### References

- [Source: docs/architecture.md#ADR-002] - Konva.js decision and visual testing strategy.
- [Source: _bmad-output/test-design-system.md#R-002] - Risk mitigation for map complexity via visual regression.
- [Source: playwright.config.js] - Existing Playwright configuration.
- [Source: tests/ui/helpers/common.js] - Test helper patterns.
- [Source: _bmad-output/implementation-artifacts/2-8-map-walk-logging.md] - FAB and calendar integration details.

### Snapshot Update Workflow

When intentional UI changes are made:

1. Run tests locally to see failures:
   ```bash
   npm run test:ui -- --grep "Map Visual"
   ```

2. Review diff images in `test-results/` folder.

3. If changes are intentional, update baselines:
   ```bash
   npm run test:ui -- --update-snapshots --grep "Map Visual"
   ```

4. Commit updated snapshot files:
   ```bash
   git add tests/ui/map-visual.spec.js-snapshots/
   git commit -m "chore: update map visual snapshots after [reason]"
   ```

> Always mention the canonical viewport, map asset, and mock progress seed used when recording new baselines so reviewers can reproduce the results.

### CI Considerations

- **Consistent Environment**: CI uses headless Chromium. Ensure local development also uses headless for baseline generation.
- **Docker Consistency**: If snapshots differ between local and CI, consider using Docker for baseline generation.
- **Screenshot on Failure**: Playwright auto-captures screenshots on failure. Enable `trace: 'retain-on-failure'` for debugging.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

