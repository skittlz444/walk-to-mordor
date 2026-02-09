# Story 2.8: Map Walk Logging

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Walker viewing the Map**,
I want **to log my daily walk distances directly from the Map view without navigating away**,
so that **I can see my journey progress update in real-time on the map and stay engaged with my journey visualization**.

## Acceptance Criteria

1. **Log Walk Button**:
   - [ ] Add a floating action button (FAB) to the Map view.
   - [ ] **Icon Options** (choose one):
     - Walking person icon (🚶 or SVG) - preferred for thematic consistency.
     - Calendar icon.
     - Plus/Add icon.
   - [ ] Button uses consistent styling with existing map controls.
   - [ ] Touch-friendly (≥48px diameter on mobile, ≥44px minimum).
   - [ ] Accessible: `aria-label="Log a walk"`.

2. **Calendar/Input Toggle**:
   - [ ] Clicking the button opens the **existing** calendar and distance entry modal.
   - [ ] **Reuse existing components** from `public/js/progress.js` and `public/js/calendar.js`.
   - [ ] Modal overlay appears above the map canvas (higher z-index).
   - [ ] **New**: Overlay is dismissible via X button, clicking outside, or ESC key.
   - [ ] Calendar shows existing walk entries from the user's history (existing behavior).

3. **Distance Entry (Existing Modal)**:
   - [ ] Uses the **same** `showDistanceModal()` function from `public/js/progress.js`.
   - [ ] All existing features preserved: date display, distance input with "km" suffix, +1km/+5km/Reset quick buttons.
   - [ ] Supports both adding new entries and editing existing entries (existing behavior).
   - [ ] No new Preact distance entry component needed - leverage existing vanilla JS.

4. **State Update & Reactive Map Changes**:
   - [ ] Entering a distance updates the global `userProgress` signal (via `refreshUserProgress()`).
   - [ ] **Path Update**: Completed path segment extends/updates reactively.
   - [ ] **User Marker Update**: Marker moves to new calculated position.
   - [ ] **Auto-Pan/Zoom**: Map smoothly pans/zooms to center on new user location.

5. **Milestone Trigger**:
   - [ ] If new distance unlocks a goal, trigger the standard "Goal Unlocked" modal (`GoalModal` with `isCongratulations: true`).
   - [ ] Multiple newly unlocked goals show sequentially (one modal at a time).

6. **Component Reuse**:
   - [ ] **DO NOT** create new Preact calendar/distance components - reuse existing vanilla JS.
   - [ ] Expose hooks from `public/js/progress.js` for Map integration:
     - `window.showDistanceModal(event, date)` - already exists.
     - `window.onWalkSaved` callback - add if needed for Map reactivity.
   - [ ] Map view calls existing functions; only the FAB and dismiss wrapper are new.

7. **Error Handling**:
   - [ ] Display user-friendly error message if save fails.
   - [ ] Provide retry mechanism.
   - [ ] Log errors to console for debugging.

## Tasks / Subtasks

- [ ] **1. Expose Walk Logging Hooks in Legacy JS (`public/js/progress.js` - minimal additions)**
    - [ ] Add `window.onWalkSaved` callback hook (called after successful save/update/delete).
    - [ ] Ensure `window.showDistanceModal(event, date)` is globally accessible (already is).
    - [ ] Add optional `onDismiss` callback to modal creation for external close handling.
    - [ ] **DO NOT refactor** existing modal logic - add hooks only.

- [ ] **2. Create Map Walk Logging FAB (`client/src/components/map/MapWalkButton.tsx`)**
    - [ ] Floating action button with **walking person icon** (🚶 SVG or font icon).
    - [ ] Alternative icons: calendar, plus - configurable via `icon` prop.
    - [ ] Position: Bottom-right corner, above map attribution if any.
    - [ ] Styled consistently with map controls (slight transparency, hover effect).
    - [ ] Touch-friendly size (≥48px diameter on mobile, ≥44px minimum).
    - [ ] Accessible: `aria-label="Log a walk"`.
    - [ ] On click: calls `onClick` prop (handled by island).

- [ ] **3. Create Map Walk Logging Island (`client/src/islands/MapWalkIsland.tsx`)**
    - [ ] Main orchestrating component for map walk logging.
    - [ ] State: `isModalOpen: Signal<boolean>`.
    - [ ] On FAB click:
        - [ ] Store current `userProgress.totalDistance` for comparison.
        - [ ] Call `window.showDistanceModal(null, new Date())` to open existing modal.
        - [ ] Register `window.onWalkSaved` callback for reactivity.
    - [ ] On walk saved (via `window.onWalkSaved` callback):
        - [ ] Call `refreshUserProgress()` from mapStore.
        - [ ] Compare old vs new `totalDistance` to find newly unlocked milestones.
        - [ ] If new milestones unlocked, queue them and show `GoalModal` with `isCongratulations: true`.
        - [ ] After all modals dismissed, auto-pan map to new position.
    - [ ] Cleanup: Remove callback on unmount.

- [ ] **4. Integrate with Map State (`client/src/stores/mapStore.ts` - additions)**
    - [ ] Add `panToPosition(position: {x: number, y: number}, scale?: number): void` action.
        - [ ] Smoothly animates map view to center on given coordinates.
        - [ ] Optional scale parameter to zoom level.
    - [ ] Add `panToUserCurrentPosition(): void` convenience action.
        - [ ] Uses `currentPosition` computed signal.
        - [ ] Calls `panToPosition` with user's current location.

- [ ] **5. API Integration**
    - [ ] **No new API code needed** - existing `public/js/progress.js` handles all API calls.
    - [ ] Existing endpoints used by legacy code:
        - [ ] `GET /api/calendar-progress` - Fetch user's walk history.
        - [ ] `POST/PUT/DELETE /api/calendar-progress` - CRUD operations.
    - [ ] Map island only needs:
        - [ ] `GET /api/total-distance` - Already in mapStore via `refreshUserProgress()`.

- [ ] **6. Milestone Unlocking Logic (`client/src/utils/goal-unlock-check.ts`)**
    - [ ] `checkNewlyUnlockedGoals(oldProgress: number, newProgress: number, milestones: Milestone[]): Milestone[]`.
    - [ ] Returns array of milestones where `distance > oldProgress` AND `distance <= newProgress`.
    - [ ] Results ordered by distance ascending (show in journey order).

- [ ] **7. Goal Congratulations Queue (`client/src/islands/MapWalkIsland.tsx`)**
    - [ ] State: `congratsQueue: Signal<Milestone[]>`, `showingCongrats: Signal<Milestone | null>`.
    - [ ] When new milestones unlocked, push all to queue.
    - [ ] Show first milestone from queue in `GoalModal` with `isCongratulations: true`.
    - [ ] On modal close, shift queue and show next, or close modal layer if queue empty.
    - [ ] After queue exhausted, call `panToUserCurrentPosition()`.

- [ ] **8. Smooth Pan Animation (`client/src/stores/mapStore.ts`)**
    - [ ] Implement Konva-compatible smooth pan/zoom animation.
    - [ ] Duration: ~500ms ease-out.
    - [ ] Update `mapViewState` signal on animation frame.
    - [ ] Consider using `requestAnimationFrame` or Konva Tween.

- [ ] **9. Testing**
    - [ ] **Unit Tests** (`client/src/components/map/MapWalkButton.test.tsx`):
        - [ ] Renders FAB with walking icon.
        - [ ] Renders alternative icons when configured.
        - [ ] Calls onClick when clicked.
        - [ ] Has correct aria-label.
        - [ ] Meets touch target size requirements.
    - [ ] **Unit Tests** (`client/src/utils/goal-unlock-check.test.ts`):
        - [ ] Returns empty array when no new milestones.
        - [ ] Returns correct milestones when progress crosses thresholds.
        - [ ] Orders results by distance ascending.
    - [ ] **Integration Tests** (Playwright - `tests/ui/map-walk-logging.spec.js`):
        - [ ] Map page shows walk logging FAB.
        - [ ] Clicking FAB opens calendar modal.
        - [ ] Can select date and enter distance.
        - [ ] Submitting entry updates map path visually.
        - [ ] User marker moves to new position.
        - [ ] Modal closes after save.
    - [ ] **Visual Snapshot Tests** (Playwright):
        - [ ] Map with walk modal open.
        - [ ] Map after walk logged (path extended).

## Dev Notes

### Architecture & Pattern Compliance

- **Preact Signals (ADR-003)**: Use signals from `@preact/signals` for all component state.
  - `useSignal()` for local component state.
  - Import global signals from `mapStore.ts` for cross-component reactivity.
  - Reference: [docs/architecture.md#ADR-003](docs/architecture.md#ADR-003)

- **Konva.js (ADR-002)**: Map canvas uses Konva Stage.
  - Pan animations may use Konva Tween for smoothness.
  - Reference: [docs/architecture.md#ADR-002](docs/architecture.md#ADR-002)

- **TypeScript Strict**: No `any` types.
  - Define `WalkEntry` interface in `client/src/types/walk.ts`.
  - Reuse `Goal` type from `client/src/types/goal.ts`.

- **Islands Architecture**: New components go in `client/src/`.
  - **REUSE existing** `public/js/progress.js` and `public/js/calendar.js` for modal/calendar functionality.
  - Only create new Preact components for: FAB button, MapWalkIsland orchestrator, and milestone unlock utility.
  - DO NOT rewrite legacy calendar/distance modal - add hooks only.

### Project Structure Notes

New files to create:
```
client/src/
├── components/
│   └── map/
│       ├── MapWalkButton.tsx      # NEW - Floating action button (walking icon)
│       └── MapWalkButton.test.tsx # NEW - Unit tests
├── islands/
│   └── MapWalkIsland.tsx          # NEW - Map walk logging orchestrator
└── utils/
    └── goal-unlock-check.ts       # NEW - Milestone unlock detection
```

Files to modify:
```
public/js/progress.js              # ADD window.onWalkSaved callback hook
client/src/stores/mapStore.ts      # ADD panToPosition, panToUserCurrentPosition actions
```

### API Endpoints

**Handled by legacy `public/js/progress.js`** (no new code needed):
- `GET/POST/PUT/DELETE /api/calendar-progress` - All CRUD operations

**Used by MapWalkIsland** (already exists in mapStore):

| Endpoint | Method | Response | Notes |
|----------|--------|----------|-------|
| `/api/total-distance` | GET | `{ totalDistance }` | Called via `refreshUserProgress()` |

### Type Definitions

No new complex types needed - reusing existing legacy modal. Only utility types:

```typescript
// client/src/utils/goal-unlock-check.ts
import type { Milestone } from '../types/map';

export function checkNewlyUnlockedGoals(
  oldProgress: number,
  newProgress: number,
  milestones: Milestone[]
): Milestone[];
```

```typescript
// MapWalkButton props
interface MapWalkButtonProps {
  onClick: () => void;
  icon?: 'walk' | 'calendar' | 'plus';  // default: 'walk'
}
```

### Previous Story Intelligence (Story 2.7)

From story 2.7 (Map State Management), the following are available:

**Existing Signals to Use:**
- `userProgress: Signal<UserProgress | null>` - Contains `totalDistance`, `lastUpdated`.
- `milestones: Signal<Milestone[]>` - List of all goals with coordinates.
- `mapViewState: Signal<MapViewState>` - Current `x`, `y`, `scale`.
- `currentPosition: computed` - User's x,y position on path.
- `unlockedMilestones: computed` - Milestones where distance <= totalDistance.

**Existing Actions to Use:**
- `refreshUserProgress(): Promise<void>` - Fetches fresh progress from API.
- `updateMapView(newState: Partial<MapViewState>): void` - Updates map position.

**New Actions to Add (Task 4):**
- `panToPosition(position, scale?)` - Animate map to specific coordinates.
- `panToUserCurrentPosition()` - Animate map to user's current location.

### Legacy Code Reference

The existing walk logging UI is in `public/js/progress.js`:
- `showDistanceModal(event, date)` - Opens the distance entry modal.
- Uses DOM manipulation to create modal overlay.
- Quick entry buttons: +1km, +5km, Reset.
- Calls `PUT/POST/DELETE /api/calendar-progress`.

**Minimal modifications needed (Task 1):**
- Add `window.onWalkSaved` callback hook after successful save/update/delete.
- Ensure `showDistanceModal` is exposed globally (already is).
- Optionally add `onDismiss` callback for external close notification.

### Existing GoalModal Usage

`client/src/islands/GoalModal.tsx` is already implemented:
- Props: `goal: Goal`, `currentDistance: number`, `isCongratulations?: boolean`, `onClose: () => void`.
- When `isCongratulations: true`, shows celebration banner.
- Handles ESC key and backdrop click to close.

### Performance Considerations

- **Debounce Pan Animation**: Don't trigger pan on every signal change. Pan once after walk logged.
- **Legacy Modal Reuse**: No new DOM creation - leverage existing modal with callback hooks.
- **Milestone Check**: Only compute newly unlocked milestones once per save, not reactively.

### Mobile Considerations

- **FAB Position**: Bottom-right, above any map attribution or controls.
- **Walking Icon**: Use SVG for crisp rendering at all sizes.
- **Modal Style**: Uses existing modal styling from `public/css/main.css` - no changes needed.
- **Touch Targets**: FAB must be ≥48px diameter on mobile.

### Error Handling Strategy

1. **Network Errors**: Show "Failed to save. Please try again." with Retry button.
2. **Validation Errors**: Show inline error message (e.g., "Distance must be positive").
3. **API Errors**: Display error message from API response if available.
4. **Console Logging**: Always `console.error()` for debugging.

### References

- [docs/architecture.md#ADR-003](docs/architecture.md#ADR-003) - Preact Signals
- [docs/architecture.md#ADR-002](docs/architecture.md#ADR-002) - Konva.js
- [docs/frontend-guide.md](docs/frontend-guide.md) - Island component patterns
- [_bmad-output/implementation-artifacts/2-7-map-state-management.md](_bmad-output/implementation-artifacts/2-7-map-state-management.md) - Map state signals and actions
- [_bmad-output/planning-artifacts/epics.md#story-28](_bmad-output/planning-artifacts/epics.md#story-28) - Original story definition

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

