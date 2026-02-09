# Story 2.3: Journey Path Rendering

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Walker**,
I want **to see the path of the Fellowship on the map and which parts I have completed**,
so that **I can visualize my progress along the specific route to Mordor**.

## Acceptance Criteria

1.  **Path Data Structure**:
    *   A robust data structure (`client/src/data/paths/fellowship-path.ts`) exists defining the ordered coordinates `[x, y]` of the full 1779 mile journey.
    *   **Nullable Distance**: Path nodes can be purely visual (geometry) with `distance: null`, or "anchors" with known `distance: number` (corresponding to milestones).
    *   The path is defined independently of the Goals table to allow for high-fidelity visual curves (splines or dense points) between sparse narrative milestones.
2.  **Path Visualization**:
    *   The `MapIsland` renders the full Fellowship path on top of the base map.
    *   **Visual Styles**:
        *   **Future Path**: Faint dashed line (e.g., Sepia/Dark Grey, opacity 0.5).
        *   **Completed Path**: Distinct solid line (e.g., Red/Gold, opacity 1.0).
    *   **Zoom Scaling**: The line thickness adjusts inversely to the zoom level to maintain visibility without clutter.
        *   *Example*: Thicker at 1mm (zoomed out), thinner at 3x zoom, but clamping to a min/max pixel width (e.g., never less than 2px, never more than 10px visual width).
3.  **Progress Interpolation (Vector-based)**:
    *   System calculates the exact "cut-off" point based on `user.totalDistance`.
    *   **Sparse Data Handling**: If `user.distance` falls between two "Anchor Points" (points with defined distance), the system interpolates position using the **vector distance** of all intermediate visual points.
        *   *Scenario*: Anchor A (0km) -> Point B (null) -> Point C (null) -> Anchor D (10km). Total geometric length = 20 units.
        *   If user is at 5km (50%), the cut-off point is exactly halfway along the geometric path (at the midpoint of the total polyline segments between A and D).
4.  **Performance**:
    *   Path rendering uses optimized Konva `Line` components (`listening={false}`).
    *   Rendering remains smooth during pan/zoom.

## Tasks / Subtasks

- [ ] **1. Data Engineering**
    - [ ] Create `client/src/data/paths/fellowship-path.ts` (Prepare for multiple paths in future).
    - [ ] Define type: `interface PathNode { x: number; y: number; distance?: number | null; }`.
    - [ ] **Data Strategy**: Map key locations (Anchors) first. Add intermediate geometric points (null distance) to trace the roads/rivers correctly.
        -   **Source of Truth**: During this story, manually capture coordinates that align to the selected base map asset (8K/10K WebP). Document the tracing approach so future journeys can reuse the same reference frame.
        -   *Tooling*: Use the temporary click-logger from the previous plan to trace the map image.
- [ ] **2. Path Logic (`client/src/utils/map-utils.ts`)**
    - [ ] Implement `calculateCutoffPoint(pathNodes, userDistance)`:
        -   Find the "Bounding Anchors": The last node with `distance <= user` (StartAnchor) and first node with `distance > user` (EndAnchor).
        -   Calculate `segmentProgress`: `(userDist - startDist) / (endDist - startDist)`.
        -   Calculate `geometricLength`: Sum of Euclidean distances of all segments between StartAnchor and EndAnchor.
        -   Traverse the segments from StartAnchor, consuming `segmentProgress * geometricLength` until the exact pixel coordinate is found.
        -   Return split arrays: `{ completedPoints: Point[], futurePoints: Point[] }`.
- [ ] **3. Component Implementation (`client/src/components/map/JourneyPath.tsx`)**
    - [ ] Create `JourneyPath` component using `react-konva` `Line`.
    - [ ] Render `FutureLine` and `CompletedLine`.
    - [ ] **Implement Dynamic Stroke Width**:
        -   Accept `scale` prop (passed from Stage).
        -   Calculate width: `const strokeWidth = clamp(baseWidth / scale, minWidth, maxWidth)`.
        -   *Goal*: Line looks "constant physical width" to the user, or slightly enhances detail when zoomed.
    - [ ] **Smoothing (Optional)**:
        -   Set `bezier={true}` or `tension` (e.g. 0.3) on the Line component to enable smooth curves between points where high-density micro-points are not necessary.
- [ ] **4. Integration**
    - [ ] Update `client/src/islands/MapIsland.tsx` to pass `scale` to `JourneyPath`.
- [ ] **5. Testing**
    - [ ] Update `tests/ui/map-canvas.spec.js`:
        -   Verify Interpolation: Set user distance to specific value (e.g., 50% between two milestones) and verify the path split visually aligns at the midpoint of the curve.
        -   Verify Zoom: Visual snapshot at 1x vs 3x zoom to confirm line weight adjustments.

## Dev Notes

### Architecture & Data Decisions
-   **Why File vs DB?**: We are storing the path in `ts/json` code.
    -   *Reasoning*: The "Fellowship Path" is canonical lore data, not user data. It is effectively a static asset. Serving it from a bundle is faster (zero DB latency) and simpler than a D1 query.
    -   *Future Proofing*: When "Multiple Journeys" (e.g. Bilbo's path) are added, we simply add `bilbo-path.ts` or `bilbo-path.json`.
-   **Why Not Goal Table?**: Goals are sparse (sometimes 30-50 miles apart). A straight line between them looks incorrect on a map (cutting across mountains/rivers).
-   **Intermediate Points**: By allowing `distance: null`, we can add as many "shaping points" (waypoints) as needed to make the line look like a real road/path without needing to calculate the exact book-mileage for every bend in the road.

### Interpolation Algorithm Details
For a segment `Anchor A (0km) -> p1 -> p2 -> p3 -> Anchor B (100km)`:
1.  Calculate total pixel length of A->p1->p2->p3->B. Let's say it's 500 pixels.
2.  User is at 25km (25% progress).
3.  Target pixel distance = 0.25 * 500 = 125 pixels.
4.  Walk the segments:
    -   `dist(A, p1) = 50px`. Remaining: 75px.
    -   `dist(p1, p2) = 50px`. Remaining: 25px.
    -   `dist(p2, p3) = 100px`. Stop!
5.  Perform simple linear interpolation on segment `p2->p3` at 25px (25% of that 100px segment).
6.  Result: The "Cut" is 25% along the line from p2 to p3.

### Source Tree Hints
-   `client/src/data/paths/fellowship-path.ts`: The data file.
-   `client/src/utils/map-utils.ts`: The heavy lifting math.

### Dependencies
-   **Story 2.2**: Base map rendering.
-   **User Data**: Needs access to `user.totalDistance`.

### Potential Risks
-   **Missing Coordinates**: The biggest risk is the lack of accurate `[x,y]` data for the map image.
    -   *Mitigation*: The developer **MUST** create a minimal set of coordinates for this story to pass. Do not mock it with random data; trace the actual map image and treat `fellowship-path.ts` as the canonical dataset tied to the chosen map asset. If the asset ever changes, this file must be regenerated to keep everything aligned.
