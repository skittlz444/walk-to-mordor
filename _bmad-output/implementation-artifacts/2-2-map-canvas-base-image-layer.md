# Story 2.2: Map Canvas & Base Image Layer

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Walker**,
I want **to view a map of Middle-earth that I can pan and zoom**,
so that **I can explore the world and see where my journey takes place**.

## Acceptance Criteria

1.  **Map Initialization**:
    *   The `MapIsland` component renders a **Konva Stage** that fills the available viewport.
    *   The map initially centers on the default starting position (Hobbiton) or the center of the map.
    *   **Base Layer**: A high-resolution Middle-earth map image renders as the background layer.
2.  **Pan Interaction**:
    *   User can click/touch and drag to pan the map.
    *   **Panning Bounds**: The map cannot be dragged completely off-screen (viewport must always contain a portion of the map).
    *   Cursor changes to `grab`/`grabbing` during interaction.
3.  **Zoom Interaction**:
    *   User can zoom using mouse wheel (Desktop) or pinch gestures (Mobile/Touch).
    *   **Zoom Limits**:
        *   Minimum Zoom: `0.5x` (or fit-to-screen). *Implementation Note: The absolute minimum zoom must always calculate the scale required to fit the entire map within the viewport.*
        *   Maximum Zoom: `3.0x` (Detailed view). *Note: Max zoom limit is flexible based on asset resolution.*
    *   Zoom centers on the mouse pointer or pinch center (not just top-left).
4.  **Responsiveness**:
    *   Map canvas resizes correctly if the browser window is resized.
    *   Touch gestures (drag, pinch) work smoothly on mobile devices without interfering with browser navigation.
5.  **Touch QA Coverage**:
    *   Pinch-to-zoom and touch panning behave identically to desktop interactions (respecting the same bounds and scale limits).
    *   Tests exercise multi-touch gestures on both tablet and phone breakpoints to prevent regressions.
6.  **Performance**:
    *   Map panning/zooming maintains 60fps on average devices.
    *   Large map image uses `konva` optimization (caching or appropriate rendering settings).

## Tasks / Subtasks

- [x] **1. Assets & Setup**
    - [x] **Use Existing Directory**: `public/img/map/` (Assets already converted).
    - [x] **Select Map Image**: Two high-res candidates are available in `public/img/map/*.webp` (8K and 10K).
        - [x] Load one of these into the component.
        - [x] *Decision Deferred*: Choose either based on visual preference during implementation.
    - [x] Ensure `konva` and `react-konva` are installed (should be from Story 2.1).
- [x] **2. Component Implementation (`MapIsland.tsx`)**
    - [x] Import `Stage`, `Layer`, `Image` from `react-konva`.
    - [x] Implement `useMapImage` hook to load the image asset.
    - [x] **Render Stage**: Set width/height based on container parent or window.
    - [x] **Render Layer**: Add `Image` component with the map asset.
- [x] **3. Interaction Logic**
    - [x] **Pan**: Enable `draggable` on the Main Layer (or a Group containing the map).
        - [x] Add `dragBoundFunc` to restrict panning within map edges.
    - [x] **Zoom**: Add `onWheel` event listener to Stage.
        - [x] Implement calculated scaling logic (scale by factor ~1.1).
        - [x] Adjust position to zoom towards pointer.
    - [x] **Touch Zoom**: Add `onTouchMove` / `onTouchEnd` logic for 2-finger pinch calculation (calculate distance delta between touches).
- [x] **4. Testing**
    - [x] Create `tests/ui/map-canvas.spec.js`:
        - [x] Load Map Page.
        - [x] Locate `canvas` element.
        - [x] **Visual**: Take snapshot of initial load.
        - [x] **Action**: Simulate drag (mouse move).
        - [x] **Visual**: Take snapshot after drag (verify move).
        - [x] **Action**: Simulate Scroll (zoom).
        - [x] **Visual**: Take snapshot after zoom (verify scale change).
        - [x] **Touch**: On a mobile viewport, simulate two-finger pinch/expand gestures and ensure scale + bounds respect the same constraints.
        - [x] **Touch**: Simulate single-finger drag on mobile and verify kinetic panning doesn’t trigger browser back/forward gestures.

## Dev Notes

### Architecture & Libraries
-   **Library**: Use `react-konva` with `preact/compat`.
    -   *Crucial*: Ensure `vite.config.ts` alias is working, otherwise Konva might throw errors about React context.
-   **Asset**: The map image is likely large.
    -   **Available Options**: `public/img/map/` contains an 8K (23MB) and 10K (20MB) WebP converted file.
    -   **Constraint**: User specified high-priority on **Visual Detail** over legacy device support.
        -   *Note*: 10K image exceeds 8192px texture limits on some GPUs. If rendering fails (black screen), fall back to the 8K version.
    -   **Filetype Preference**:
        1.  **WebP** (Best balance of quality/size).
        2.  **JPG** (Good compression, no transparency).
        3.  **PNG** (Lossless but potentially huge file size).
    -   *Avoid SVG* for complex fantasy maps as high node counts will kill performance.
    -   Consider dimensions around 2000px-4000px width.
    -   Use `new window.Image()` inside a `useEffect` or `use-image` hook to pre-load.
-   **Touch Controls**: Konva `draggable: true` handles basic panning. For pinch-to-zoom, you must implement manual `onTouchMove` logic to calculate the distance delta between two fingers. There is no simple "enable pinch" flag.
-   **Zoom Calculation**:
    ```javascript
    // Standard Konva Zoom Logic
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    // ... calculate new pos ...
    ```

### Source Tree Hints
-   **Component**: `client/src/islands/MapIsland.tsx` (Reuse/Modify existing).
-   **Assets**: `public/img/map/` (Existing).
-   **Tests**: `tests/ui/`

### Dependencies
-   **Story 2.1**: Must have the `MapIsland` mount point ready.
-   **Konva**: `npm install konva react-konva`.

## Dev Agent Record

### Agent Model Used
{{agent_model_name_version}}

### File List
-   client/src/islands/MapIsland.tsx
-   public/images/map/middle-earth-classic.jpg (Binary/Asset)
-   tests/ui/map-canvas.spec.js
