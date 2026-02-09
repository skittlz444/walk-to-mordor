# Story 2.4: Current Position Marker

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Walker**,
I want **to see my exact location on the Middle-earth map**,
so that **I can understand where I am relative to the Fellowship's journey and upcoming milestones**.

## Acceptance Criteria

1.  **Position Calculation**:
    *   System accurately calculates the {x, y} coordinates on the map corresponding to the user's current `totalDistance`.
    *   Position aligns perfectly with the end of the "Completed Path" (from Story 2.3).
2.  **Marker Rendering**:
    *   A distinctive marker (icon or stylized shape) is rendered at the calculated coordinates.
    *   **Scale Independence**: The marker maintains a consistent visual size (e.g., 32x32px) regardless of the map's zoom level. When zoomed out, it doesn't vanish; when zoomed in, it doesn't become giant.
    *   **Z-Index**: Marker renders *above* the path and base map, but *below* the UI overlay (zoom controls).
3.  **Interactivity**:
    *   **Tooltip**: Hovering (desktop) or tapping (mobile) the marker shows a tooltip with "Current Location: [X] km".
    *   **Animation**: When the map loads or distance updates, the marker transitions smoothly to its new position (duration: ~300-500ms).
4.  **Initial Viewport Centering**:
    *   When the map loads, the view automatically centers on the user's current location marker.
    *   **Default Zoom**: The map defaults to a zoomed-in state (e.g., max zoom or high detail level) to provide immediate local context, rather than showing the full map.
    *   **Edge Handling**: Centering logic respects map boundaries (prevents showing gray void if user is near map edge).
5.  **Re-center Control**:
    *   A visible "Re-center" button (icon: crosshairs/target) is available in the map UI (e.g., near zoom controls).
    *   Clicking the button animates the view back to the user's current position and zoom level, primarily useful if the user has panned away to explore.

## Tasks / Subtasks

- [ ] **1. Logic & Utils**
    - [ ] Implementation in `client/src/utils/map-utils.ts`:
        -   Ensure `calculateCutoffPoint` (or new `calculateUserPosition`) returns the specific `Point {x, y}` for the user's current distance.
        -   Validates edge cases: user at 0km, user past 1779 miles (End).
- [ ] **2. Component Implementation (`client/src/components/map/UserMarker.tsx`)**
    - [ ] Create `UserMarker` component using `react-konva`.
    - [ ] **Visuals**: Use a `Konva.Group` containing:
        -   `Konva.Circle` (halo/shadow effect).
        -   `Konva.Image` or `Konva.Star/Circle` (the actual marker avatar - e.g., the Fellowship ring or user avatar).
    - [ ] **Scale Logic**: access `stageScale` (prop or store) and apply inverse scaling (`scale = 1 / stageScale`) to the Group.
    - [ ] **Tooltip**: Implement `Konva.Label` (Tag + Text) that appears on `mouseenter`/`tap`.
- [ ] **3. Integration**
    - [ ] Update `client/src/islands/MapIsland.tsx`:
        -   Import and render `<UserMarker />` inside the `<Layer>`.
        -   Pass necessary props (`position`, `scale`).
        -   **Camera Logic**: Implement `centerOnPosition(x, y, zoom)` logic to focus on user on mount. Review appropriate zoom level (start with max zoom).
        -   **UI Control**: Add "Re-center" button to the map controls overlay overlay that triggers `centerOnPosition`.
- [ ] **4. Testing**
    - [ ] **Unit**: Test `map-utils.ts` calculation ensures point falls on a specific segment.
    - [ ] **Visual (Playwright)**:
        -   Test `maps-marker.spec.ts`:
        -   Snapshot at default zoom.
        -   Snapshot at 3x zoom (verify marker didn't scale up 3x).

## Dev Notes

### Architecture & Pattern Compliance
-   **Konva Component**: Must be wrapped in `react-konva` components.
-   **Inverse Scaling**: This is a critical pattern for map markers.
    ```javascript
    // Concept
    const scale = 1 / mapStore.scale.value;
    <Group x={pos.x} y={pos.y} scaleX={scale} scaleY={scale}>...</Group>
    ```
-   **Assets**: If a custom image (e.g. Ring icon) is not available in `public/images`, use a styled `Konva.Star` (Gold color) or `Konva.Circle` (Gold with white ring) as a fallback until assets are finalized. **Do not block on missing assets.** But do warn on missing assets.

### Previous Story Intelligence (Story 2.3)
-   Story 2.3 established `fellowship-path.ts` and `map-utils.ts`.
-   **Reuse**: The `calculateCutoffPoint` function likely determines the *split point*. The user's position IS that split point. Ensure this utility returns the point coordinate explicitly, or refactor it slightly to export a `getPersonPosition(path, distance)` helper that `calculateCutoffPoint` also uses.

### Technical specifics: Konva Tooltips
-   Tooltips inside Canvas can be tricky with clipping.
-   Use `Konva.Label` component.
-   Ensure the tooltip is added to the *top-most* Layer (or simply last in the display list of the current layer) to prevent occlusion by the path.

### Relevant Files
-   `client/src/utils/map-utils.ts` (Logic)
-   `client/src/components/map/UserMarker.tsx` (New Component)
-   `client/src/islands/MapIsland.tsx` (Integration)
-   `client/src/stores/mapStore.ts` (State)

## Dev Agent Record

### Agent Model Used
{{agent_model_name_version}}

### Completion Notes List
- Confirmed reliance on Story 2.3's path logic.
- Defined inverse scaling pattern for visual consistency.
- Specified fallback visuals if assets missing.
