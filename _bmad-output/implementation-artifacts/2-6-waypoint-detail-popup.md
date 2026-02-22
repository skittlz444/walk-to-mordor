# Story 2.6: Waypoint Detail Popup

Status: complete

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Walker**,
I want **to click on an unlocked waypoint marker and see a popup with milestone details**,
so that **I can explore the lore and imagery associated with locations I've visited on my journey**.

## Acceptance Criteria

1. **Popup Trigger**:
   - Click/tap on any **unlocked** waypoint marker opens the detail popup.
   - Clicking a **locked** waypoint does nothing (or shows brief "locked" feedback).
   - Only **one** popup can be open at a time.

2. **Popup Content**:
   - **Milestone Name**: Goal title as heading.
   - **Distance**: Display the km distance (e.g., "42.5 km from Bag End").
   - **Special Text**: Display `special` field content (only if not null).
   - **Thumbnail Image**: Goal image (using `image_id` from goals table), WebP format, lazy-loaded.
   - **Expand Button**: Icon button (e.g., expand/arrows-out icon) that opens the full goal detail modal.
   - **Note**: Popup does NOT show description - that's for the expanded modal only.

3. **Popup Positioning**:
   - Popup appears **near** the clicked waypoint marker (doesn't cover it).
   - **Desktop**: Popup positioned to the side or above/below waypoint with offset.
   - **Mobile**: Popup slides up from bottom as a **sheet** (full-width, partial height).
   - Popup stays within viewport bounds (auto-adjust if waypoint near edge).

4. **Popup Dismissal**:
   - **Click outside** popup dismisses it.
   - **X button** in popup corner dismisses it.
   - **ESC key** dismisses it (desktop).
   - **Clicking another waypoint** replaces current popup with new one.
   - **Pan/zoom map** dismisses popup (to prevent orphaned popups during navigation).

5. **Visual Design**:
   - Dark fantasy theme matching existing UI (dark background, gold accents).
   - Rounded corners, subtle shadow/glow.
   - Smooth fade-in/out animation (150-200ms).
   - Image has placeholder/skeleton while loading.

6. **Accessibility**:
   - Popup is focusable (focus trap while open).
   - Close button has aria-label.
   - ESC key support.
   - Sufficient color contrast (WCAG AA).

7. **Performance**:
   - Popup renders as HTML overlay (NOT Konva canvas element) for accessibility.
   - Image lazy-loaded with blur-up from thumbnail.
   - No re-render of map canvas when popup opens/closes.

8. **Map Centering on Waypoint Click**:
   - When a waypoint is clicked, the map pans to center the waypoint + popup within the "safe zone".
   - **Safe Zone**: 25% margin from all edges (top, bottom, left, right). The usable center area is the middle 50% of the viewport.
   - **Desktop Behavior**:
     - Calculate bounding box of waypoint marker + popup combined (as if single unit).
     - Find center point of this combined bounding box.
     - If center is outside safe zone, pan map so center moves toward viewport center.
     - Pan stops when combined center enters the safe zone (don't overshoot to exact center).
   - **Mobile Behavior**:
     - Only the waypoint marker position matters (bottom sheet doesn't affect positioning).
     - Pan map so waypoint marker center is within the safe zone.
   - **No Movement**: If the target center is already within the safe zone, no panning occurs.
   - **Animation**: Pan should be smooth/animated (Konva `to()` tween or similar).

## Tasks / Subtasks

- [x] **1. State Management (`mapStore.ts`)**
    - [x] Verify `selectedWaypoint: Signal<Waypoint | null>` exists (from Story 2.5).
    - [x] Add `popupPosition: Signal<{ x: number; y: number } | null>` for screen coordinates.
    - [x] Add `isPopupVisible: computed(() => selectedWaypoint.value !== null)`.
    - [x] Add action `closePopup()` that sets `selectedWaypoint.value = null`.
    - [x] Add action `selectWaypoint(waypoint: Waypoint, screenX: number, screenY: number)`.
    - **Note:** State is managed directly in MapIsland.tsx using `useSignal` hooks rather than a separate mapStore.ts file. `selectedWaypoint`, `selectedCluster`, `popupPosition` signals are defined inline with `closePopup` callback.

- [x] **2. Screen Position Calculation & Map Centering**
    - [x] Create `client/src/utils/map-popup-utils.ts`:
        - `getScreenPosition(waypoint: Waypoint, stage: Konva.Stage): { x: number; y: number }`:
          - Converts waypoint's canvas coordinates to screen (DOM) coordinates.
          - Uses `stage.getAbsolutePosition()` and `stage.scaleX()`.
        - `getOptimalPopupPosition(waypointScreenPos, popupSize, viewportSize): { x, y, placement }`:
          - Determines best placement (above, below, left, right) based on available space.
          - Returns adjusted position that keeps popup within viewport.
        - `calculateSafeZoneBounds(viewportWidth: number, viewportHeight: number): { minX, maxX, minY, maxY }`:
          - Returns the safe zone bounds (25% margins).
          - Safe zone is the center 50% of viewport.
        - `isWithinSafeZone(point: { x, y }, bounds: SafeZoneBounds): boolean`:
          - Returns true if point is within the safe zone.
        - `calculatePanOffset(waypointScreenPos, popupSize, viewportSize, isMobile): { dx, dy } | null`:
          - Desktop: Calculate combined bounding box center of marker + popup.
          - Mobile: Use only marker position (no popup offset).
          - If center already in safe zone, return null (no pan needed).
          - Otherwise, return delta to move center into safe zone (toward viewport center, stopping at safe zone edge).

- [x] **3. Popup Component (`client/src/components/map/WaypointPopup.tsx`)**
    - [x] Create stateless Preact component with props:
        - `waypoint: Waypoint` (includes id, title, distance, special, image_id).
        - `position: { x: number; y: number }`.
        - `onClose: () => void`.
        - `onExpand: (waypointId: number) => void`.
    - [x] Render as **HTML `<div>`** (NOT Konva shape) positioned absolutely.
    - [x] Structure:
      ```
      ┌─────────────────────────────┬──┐
      │  [Thumbnail]  Title         │ X│
      │               Distance km    │  │
      │               Special text   │  │
      │               [⤢ Expand]     │  │
      └─────────────────────────────┴──┘
      ```
    - [x] Only show "Special text" row if `waypoint.special` is not null.
    - [x] Expand button uses icon (arrows-expand, external-link, or similar) - NOT text link.
    - [x] Apply dark theme styles (CSS or inline).
    - [x] Add click handler on container that stops propagation (prevents closing on internal click).
    - [x] Add close button with X icon.

- [x] **4. Mobile Sheet Variant (`client/src/components/map/WaypointSheet.tsx`)**
    - [x] Create mobile-optimized bottom sheet component.
    - [x] Slides up from bottom with animation.
    - [x] Full width, ~40% viewport height.
    - [ ] Swipe-down to dismiss (optional, nice-to-have). **NOT IMPLEMENTED**
    - [x] Same content structure as desktop popup.

- [x] **5. Popup Container / Controller (`client/src/components/map/WaypointPopupContainer.tsx`)**
    - [x] Subscribes to `selectedWaypoint` and `popupPosition` signals.
    - [x] Determines mobile vs desktop via `window.innerWidth` or media query hook.
    - [x] Renders `<WaypointPopup>` (desktop) or `<WaypointSheet>` (mobile).
    - [x] Handles dismiss logic:
        - [x] Click-outside detection (add overlay or document click listener).
        - [x] ESC key listener (add/remove on mount/unmount).
    - [x] Manages enter/exit animations (CSS transitions or `@preact/signals` for animation state).
    - **Bonus:** Also supports clustered waypoints via `ClusterListPopup` and `ClusterListSheet` components.

- [x] **6. Integration with MapIsland**
    - [x] Import and render `<WaypointPopupContainer />` **outside** Konva Stage (as sibling in DOM).
    - [x] Wire waypoint click handler (from Story 2.5) to call `selectWaypoint(waypoint, screenX, screenY)`.
    - [x] Add event listener to Stage for `dragstart` and `wheel` (zoom) → call `closePopup()`.
    - [x] Ensure popup z-index is above map canvas.
    - [x] **Map Centering Integration**:
        - [x] On waypoint click, calculate pan offset using `calculatePanOffset()`.
        - [x] If offset is non-null, animate stage position using Konva `to()` tween.
        - [x] Tween duration: ~300ms with easing (e.g., `Konva.Easings.EaseInOut`).
        - [x] After pan completes, update popup position if needed (or calculate position post-pan).

- [x] **7. Goal Image Loading**
    - [x] Fetch goal thumbnail from `/img/thumbs/{image_id}-thumb.webp`. (Path differs slightly from spec)
    - [x] Implement lazy loading with placeholder (gray box or blurred mini-thumb).
    - [x] Handle image load error (show fallback icon).

- [x] **8. Expand to Full Modal**
    - [x] Expand button click opens the full goal detail modal (NOT navigation).
    - [x] Reuse existing `GoalModal.tsx` component from `client/src/islands/`.
    - [x] Pass goal ID to modal; modal fetches full details including description.
    - [x] When modal opens, close the popup (or keep popup visible behind modal).
    - [x] Modal should have its own close behavior (X button, ESC, click outside).

- [x] **9. Testing**
    - [x] **Unit Tests** (`client/src/components/map/WaypointPopup.test.tsx`):
        - Test renders waypoint title, distance, image.
        - Test renders special text only when not null.
        - Test close button calls onClose.
        - Test expand button calls onExpand with correct ID.
    - [x] **Unit Tests** (`client/src/utils/map-popup-utils.test.ts`):
        - Test screen position calculation.
        - Test popup positioning avoids viewport overflow.
        - Test `calculateSafeZoneBounds` returns correct 25% margins.
        - Test `isWithinSafeZone` correctly identifies points inside/outside.
        - Test `calculatePanOffset` returns null when already in safe zone.
        - Test `calculatePanOffset` returns correct delta for desktop (marker + popup).
        - Test `calculatePanOffset` returns correct delta for mobile (marker only).
    - [x] **Playwright Visual** (`tests/ui/map-popup.spec.js`):
        - Snapshot popup on desktop view.
        - Snapshot sheet on mobile viewport.
        - Test ESC key closes popup.
        - Test click outside closes popup.
        - Test clicking different waypoint replaces popup.
        - Test map pans when clicking waypoint near edge.
        - Test map does NOT pan when clicking waypoint already in safe zone.

## Dev Notes

### Architecture & Pattern Compliance

- **Preact + Signals**: Follow patterns from `docs/architecture.md#ADR-001` and `ADR-003`.
- **TypeScript Strict**: No `any` types. Define all interfaces.
- **HTML Overlay (Not Konva)**: The popup MUST be a DOM element, not a Konva shape, for:
  - Proper text selection and accessibility.
  - Native scroll behavior in description.
  - Easier styling with CSS.
  - Browser-native focus management.

### Project Structure Notes

- **New Files**:
  - `client/src/components/map/WaypointPopup.tsx` - Desktop popup component
  - `client/src/components/map/WaypointSheet.tsx` - Mobile bottom sheet
  - `client/src/components/map/WaypointPopupContainer.tsx` - Controller/orchestrator
  - `client/src/utils/map-popup-utils.ts` - Position calculation utilities
  - `client/src/components/map/WaypointPopup.css` (or use inline styles/CSS-in-JS)
- **Modified Files**:
  - `client/src/stores/mapStore.ts` - Add popup-related signals
  - `client/src/islands/MapIsland.tsx` - Integrate popup container

### Integration with Story 2.5 (Waypoint Markers)

Story 2.5 establishes:
- `selectedWaypoint: Signal<Waypoint | null>` in mapStore.
- `WaypointMarker` component with `onClick` prop.
- Waypoint click fires event and updates signal.

This story **consumes** that signal to render the popup.

**Waypoint Interface** (from Story 2.5):
```typescript
interface Waypoint {
  id: number;
  distance: number;
  title: string;
  x: number;       // Canvas coordinates
  y: number;
  special?: string | null;  // Special text, shown in popup if not null
  image_id?: string;        // Link to goal image
}
```

**Note**: Description is NOT needed for popup - only fetched when full modal is opened.

### Screen Position Calculation

Converting canvas coords to screen coords:
```typescript
function getScreenPosition(
  waypoint: Waypoint, 
  stage: Konva.Stage
): { x: number; y: number } {
  // Get stage container's bounding rect
  const container = stage.container().getBoundingClientRect();
  
  // Apply stage transformation
  const stagePos = stage.position();
  const scale = stage.scaleX();
  
  const screenX = container.left + (waypoint.x * scale) + stagePos.x;
  const screenY = container.top + (waypoint.y * scale) + stagePos.y;
  
  return { x: screenX, y: screenY };
}
```

### Popup Styling Reference

Dark fantasy theme colors (from existing CSS):
```css
/* Background */
--popup-bg: #1a1a2e;          /* Dark navy */
--popup-border: #4a3f35;      /* Bronze/brown accent */

/* Text */
--text-primary: #e8e8e8;      /* Light gray */
--text-secondary: #a0a0a0;    /* Muted gray */
--text-accent: #ffd700;       /* Gold for title */

/* Interactive */
--link-color: #c9a227;        /* Golden link */
--link-hover: #ffd700;
--close-btn-color: #888;
--close-btn-hover: #fff;
```

### Mobile Breakpoint

Use 768px as mobile breakpoint (consistent with existing responsive design):
```typescript
const isMobile = window.innerWidth < 768;
// OR use matchMedia for reactive updates
const mobileQuery = window.matchMedia('(max-width: 767px)');
```

### Dependencies

- **Story 2.5** (Waypoint Markers): `selectedWaypoint` signal, Waypoint interface, click handling.
- **Story 2.2** (Map Canvas): Konva Stage reference for position calculation.
- **Story 2.4** (Position Marker): Pattern reference for coordinate handling.

### Existing Components to Consider

Check if these can be reused:
- `client/src/islands/GoalModal.tsx` - Existing goal detail modal (may want to invoke this for "View Full Details").
- `public/css/main.css` - Existing dark theme variables.

### Map Centering Algorithm

```typescript
const SAFE_ZONE_MARGIN = 0.25; // 25% from each edge

function calculatePanOffset(
  waypointScreenPos: { x: number; y: number },
  popupSize: { width: number; height: number },
  viewportSize: { width: number; height: number },
  popupPlacement: 'left' | 'right' | 'above' | 'below',
  isMobile: boolean
): { dx: number; dy: number } | null {
  // Calculate safe zone bounds
  const safeMinX = viewportSize.width * SAFE_ZONE_MARGIN;
  const safeMaxX = viewportSize.width * (1 - SAFE_ZONE_MARGIN);
  const safeMinY = viewportSize.height * SAFE_ZONE_MARGIN;
  const safeMaxY = viewportSize.height * (1 - SAFE_ZONE_MARGIN);
  
  // Calculate target center point
  let targetCenterX: number;
  let targetCenterY: number;
  
  if (isMobile) {
    // Mobile: only marker position matters
    targetCenterX = waypointScreenPos.x;
    targetCenterY = waypointScreenPos.y;
  } else {
    // Desktop: combined bounding box of marker + popup
    const combinedBounds = getCombinedBounds(waypointScreenPos, popupSize, popupPlacement);
    targetCenterX = (combinedBounds.left + combinedBounds.right) / 2;
    targetCenterY = (combinedBounds.top + combinedBounds.bottom) / 2;
  }
  
  // Check if already in safe zone
  if (targetCenterX >= safeMinX && targetCenterX <= safeMaxX &&
      targetCenterY >= safeMinY && targetCenterY <= safeMaxY) {
    return null; // No pan needed
  }
  
  // Calculate delta to move into safe zone (toward center, stop at edge)
  let dx = 0;
  let dy = 0;
  
  if (targetCenterX < safeMinX) dx = safeMinX - targetCenterX;
  else if (targetCenterX > safeMaxX) dx = safeMaxX - targetCenterX;
  
  if (targetCenterY < safeMinY) dy = safeMinY - targetCenterY;
  else if (targetCenterY > safeMaxY) dy = safeMaxY - targetCenterY;
  
  return { dx, dy };
}
```

### Potential Risks & Mitigations

1. **Risk**: Popup position jumps during map pan.
   - **Mitigation**: Close popup when user-initiated pan/zoom starts (not auto-pan from click).

2. **Risk**: Z-index conflict with other UI elements.
   - **Mitigation**: Use z-index: 1000+ for popup overlay.

3. **Risk**: Popup covers important map areas on small screens.
   - **Mitigation**: Mobile bottom sheet approach (doesn't cover map).

4. **Risk**: Image loading delay causes layout shift.
   - **Mitigation**: Fixed-size image container with placeholder.

5. **Risk**: Focus trap breaks map keyboard navigation.
   - **Mitigation**: Return focus to map/waypoint when popup closes.

6. **Risk**: Auto-pan animation conflicts with user trying to pan.
   - **Mitigation**: Cancel auto-pan if user starts dragging during animation.

7. **Risk**: Popup position needs recalculation after auto-pan.
   - **Mitigation**: Calculate final popup position AFTER pan animation completes, or calculate relative to waypoint (which moves with stage).

---

### References

- [Source: docs/architecture.md#ADR-002] - Konva.js decision
- [Source: docs/architecture.md#New Patterns] - Component file structure
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6] - Original acceptance criteria
- [Source: _bmad-output/implementation-artifacts/2-5-waypoint-markers.md] - Waypoint data structure & signals

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Popup renders as HTML DOM element, NOT Konva canvas shape (accessibility critical).
- Popup shows: name, distance, special (if not null), image, expand button. NO description.
- Expand button opens GoalModal.tsx - NOT navigation to a page.
- Depends on Story 2.5 for `selectedWaypoint` signal and waypoint click handling.
- Mobile uses bottom sheet pattern; desktop uses positioned popup.
- Close popup on user-initiated pan/zoom (NOT auto-pan from waypoint click).
- **Map centering**: On waypoint click, auto-pan so marker+popup center is within 25% margin safe zone.
- Mobile centering uses only marker position (bottom sheet doesn't affect positioning).
- Consider reusing existing `GoalModal.tsx` for expand functionality.

### File List

- `client/src/components/map/WaypointPopup.tsx` (new)
- `client/src/components/map/WaypointSheet.tsx` (new)
- `client/src/components/map/WaypointPopupContainer.tsx` (new)
- `client/src/utils/map-popup-utils.ts` (new)
- `client/src/stores/mapStore.ts` (modify)
- `client/src/islands/MapIsland.tsx` (modify)
- `tests/ui/map-popup.spec.js` (new)
