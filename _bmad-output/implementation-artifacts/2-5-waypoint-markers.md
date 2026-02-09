# Story 2.5: Waypoint Markers (Milestones on Map)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Walker**,
I want **to see milestone markers on the map showing locations I've visited and upcoming destinations**,
so that **I can visualize my journey's narrative waypoints and anticipate what lies ahead**.

> **Scope Note**: This story intentionally ships the map with **locked styling for all future milestones** (except the "next" highlight). Unlocking behavior and user preferences arrive in Story 2.10.

## Acceptance Criteria

1. **Waypoint Data Source**:
   - Waypoints are derived from the `goals` table milestones (171+ milestones).
   - Each waypoint links to a corresponding goal via `distance` matching against `fellowship-path.ts` anchor nodes.
   - Waypoints that don't have explicit coordinates in the path data are interpolated using the same algorithm as user position (Story 2.3).

2. **Waypoint Rendering**:
   - Waypoints render as Konva shapes (circles/icons) at their calculated map coordinates.
   - **Unlocked Waypoints** (distance ≤ user's totalDistance):
     - Full color (gold/amber theme matching completed path).
     - Interactive - responds to click/tap events.
   - **Next Waypoint** (first waypoint where distance > user's totalDistance):
     - Subtle glow or ring effect to indicate "next destination" (similar to next goal highlight in Journey list).
     - This is the ONLY waypoint with the glow effect.
   - **Locked Waypoints** (distance > user's totalDistance, excluding next):
     - Muted/grayed appearance (opacity ~0.4).
     - Non-interactive or shows "locked" tooltip on interaction.
     - No glow effect.
   - **Default Behavior**: All future waypoints use the locked treatment in this story; there is no user-facing toggle yet.
   - **Note**: See **Story 2.10** for the toggle that will eventually let users opt into showing future goals as unlocked (and will flip the global default).

3. **Scale-Independent Markers**:
   - Waypoint markers maintain consistent visual size (e.g., 16-24px) regardless of zoom level.
   - Use inverse scaling pattern: `scale = 1 / stageScale` (established in Story 2.4).
   - Markers never shrink below minimum readable size (~12px) or grow larger than ~32px.

4. **Zoom-Based Visibility (Decluttering)**:
   - **Major Waypoints Definition**: Milestones where `special IS NOT NULL` in the goals table.
   - **Low Zoom (< 1.0x)**: Show only "major" waypoints (those with `special` field populated).
   - **Medium Zoom (1.0x - 2.0x)**: Show major waypoints + additional waypoints (every 2nd or 3rd).
   - **High Zoom (≥ 2.0x)**: Show ALL waypoints in the visible viewport area.
   - Transitions between visibility states should be smooth (fade in/out, not abrupt pop).
   - **Note**: Specific zoom breakpoints are targets and may be adjusted at implementation time based on visual testing.
   - **Clustering (Optional)**: If at maximum zoom waypoints are still cluttered in dense areas:
     - Display a single group icon with a badge showing count of grouped waypoints.
     - Click/tap on group icon expands to show individual waypoints for selection.
     - Implementation is optional based on natural placement testing - only implement if needed.

5. **Waypoint Interaction**:
   - Click/tap on unlocked waypoint fires an event (to be consumed by Story 2.6 for popup).
   - For now: Log waypoint data to console and/or update a signal for selected waypoint.
   - Cursor changes to `pointer` on hover over unlocked waypoints.

6. **Performance**:
   - Only render waypoints within the visible viewport (+ padding buffer).
   - Use `listening={false}` on locked waypoints to reduce event overhead.
   - Batch waypoint rendering using a single Layer or Group.

## Tasks / Subtasks

- [ ] **1. Data Engineering - Waypoint Coordinates**
    - [ ] **Extend `fellowship-path.ts`**: Ensure anchor nodes (nodes with `distance: number`) exist for all 171+ goals.
        - If a goal's distance doesn't have a corresponding anchor, add one OR document that interpolation is required.
    - [ ] Create `client/src/data/waypoints.ts`:
        - Type: `interface Waypoint { id: number; distance: number; title: string; x: number; y: number; special?: string; }`.
        - Export function `getWaypointCoordinates(pathNodes: PathNode[], goals: Goal[]): Waypoint[]` that:
          1. For each goal, finds the corresponding position using path interpolation logic from `map-utils.ts`.
          2. Returns array of waypoints with populated `x, y` coordinates.
    - [ ] **API Endpoint** (if not exists): Ensure `/api/goals` returns all goals (id, distance, title, special).
- [ ] **2. Signals / State**
    - [ ] Extend `client/src/stores/mapStore.ts`:
        - Add `waypoints: Signal<Waypoint[]>` (populated on map load).
        - Add `selectedWaypoint: Signal<Waypoint | null>` (for Story 2.6 popup integration).
        - Add `visibleWaypointFilter: Signal<'all' | 'major' | 'minimal'>` (computed from zoom level).
    - [ ] Create computed signal `filteredWaypoints` that returns waypoints based on:
        - Current zoom level (determines filter).
        - Viewport bounds (only waypoints within visible area + buffer).
- [ ] **3. Component Implementation (`client/src/components/map/WaypointMarker.tsx`)**
    - [ ] Create `WaypointMarker` component using `react-konva`:
        - Props: `waypoint: Waypoint`, `isUnlocked: boolean`, `isNext: boolean`, `scale: number`, `onClick?: (wp: Waypoint) => void`.
        - Render `Konva.Group` with inverse scaling applied.
        - **Unlocked Visual**: `Konva.Circle` with gold fill, white stroke.
        - **Next Waypoint Visual**: Same as unlocked BUT with glow effect (shadowBlur) - only ONE marker gets this.
        - **Locked Visual**: `Konva.Circle` with gray fill, reduced opacity, no glow.
        - **Interaction**: Attach `onClick` handler (unlocked only), `onMouseEnter/Leave` for cursor change.
    - [ ] Export `WaypointMarkerList` component that:
        - Iterates over `filteredWaypoints`.
        - Renders individual `WaypointMarker` for each.
        - Passes `isUnlocked` based on comparison with `userProgress.value`.
        - Passes `isNext` = true for exactly ONE waypoint (first where distance > userProgress).
- [ ] **4. Visibility Logic**
    - [ ] Implement `getWaypointVisibility(zoomLevel: number): 'all' | 'major' | 'minimal'`:
        - `zoomLevel < 1.0` → 'major' (only waypoints where `special !== null`).
        - `zoomLevel >= 1.0 && < 2.0` → 'expanded' (major + every 3rd).
        - `zoomLevel >= 2.0` → 'all'.
        - **Note**: These thresholds are initial targets; adjust based on visual testing.
    - [ ] Implement `isMajorWaypoint(waypoint: Waypoint): boolean`:
        - Returns true if: `waypoint.special !== null` (has special text in goals table).
    - [ ] Implement `isNextWaypoint(waypoint: Waypoint, userDistance: number): boolean`:
        - Returns true if this is the first waypoint where `waypoint.distance > userDistance`.
    - [ ] Implement viewport culling:
        - Get current viewport bounds from Stage position and scale.
        - Filter waypoints to only those within bounds (+ 100px padding).
    - [ ] **(Optional) Clustering Logic**:
        - If testing reveals dense areas at max zoom, implement grouping.
        - Group waypoints within X pixels of each other into single marker with badge.
        - Click expands group to show individuals.
- [ ] **5. Integration (`MapIsland.tsx`)**
    - [ ] Import and render `<WaypointMarkerList />` inside the map Layer.
    - [ ] Pass necessary props from store (scale, userProgress).
    - [ ] Wire up `onWaypointClick` to update `selectedWaypoint` signal (prep for Story 2.6).
    - [ ] Subscribe to zoom level changes to update visibility filter.
- [ ] **6. Testing**
    - [ ] **Unit Tests** (`client/src/data/waypoints.test.ts`):
        - Test `getWaypointCoordinates` returns correct x,y for known goal distances.
        - Test interpolation for goal distances between anchor points.
    - [ ] **Unit Tests** (`client/src/components/map/WaypointMarker.test.tsx`):
        - Test unlocked vs locked rendering (snapshot or property checks).
        - Test onClick fires only for unlocked.
    - [ ] **Playwright Visual** (`tests/ui/map-waypoints.spec.js`):
        - Snapshot at low zoom (verify only major waypoints visible).
        - Snapshot at high zoom (verify all waypoints in area visible).
        - Test click on unlocked waypoint updates selectedWaypoint state.

## Dev Notes

### Architecture & Pattern Compliance

- **Konva + react-konva**: All map components MUST use react-konva wrappers.
- **Inverse Scaling Pattern**: Critical for visual consistency. From Story 2.4:
  ```tsx
  // Apply inverse scale to keep marker visually constant size
  const visualScale = 1 / stageScale;
  <Group x={waypoint.x} y={waypoint.y} scaleX={visualScale} scaleY={visualScale}>
    <Circle radius={12} fill={isUnlocked ? '#FFD700' : '#666'} />
  </Group>
  ```
- **Preact Signals**: Use signals from `mapStore.ts` for reactive state.
- **TypeScript Strict**: No `any` types. Define all interfaces.

### Project Structure Notes

- **New Files**:
  - `client/src/data/waypoints.ts` - Waypoint coordinate calculation
  - `client/src/components/map/WaypointMarker.tsx` - Individual marker component
  - `client/src/components/map/WaypointMarkerList.tsx` - Collection renderer (optional, can be in WaypointMarker.tsx)
- **Modified Files**:
  - `client/src/stores/mapStore.ts` - Add waypoint signals
  - `client/src/islands/MapIsland.tsx` - Integrate waypoint layer
  - `client/src/data/paths/fellowship-path.ts` - Ensure anchor coverage

### Previous Story Intelligence

**From Story 2.3 (Journey Path Rendering)**:
- `fellowship-path.ts` defines `PathNode { x: number; y: number; distance?: number | null }`.
- Anchor nodes have `distance: number`, visual-only nodes have `distance: null`.
- `map-utils.ts` contains `calculateCutoffPoint(pathNodes, userDistance)` - **reuse this logic** for waypoint positioning.

**From Story 2.4 (Current Position Marker)**:
- Inverse scaling pattern established for scale-independent markers.
- `mapStore.ts` should have `scale` signal.
- Tooltip pattern using `Konva.Label` (may be useful for waypoint hover).

### Technical Specifics

**Waypoint Color Palette** (matching existing theme):
- Unlocked: `#FFD700` (Gold) with white stroke `#FFFFFF`
- Next Waypoint: `#FFD700` (Gold) with glow effect (shadowBlur: 10-15, shadowColor: gold)
- Locked: `#666666` (Gray) with opacity 0.4
- Selected/Hover: `#FFA500` (Orange) or scale up slightly

**Zoom Thresholds** (initial targets - adjust based on visual testing):
```typescript
const ZOOM_THRESHOLD_MAJOR = 1.0;    // Below this: show only special waypoints
const ZOOM_THRESHOLD_ALL = 2.0;      // Above this: show all waypoints
// Between thresholds: show special + every 3rd
```

**Major Milestones** (waypoints where `special IS NOT NULL`):
- These are the narrative-significant locations already flagged in the goals table.
- No hardcoded list needed - use the `special` field as the source of truth.
- Examples include: Bag End, Bree, Rivendell, Moria, Lothlórien, etc.

### Goals API Reference

Current goals table schema (from `docs/data-models.md`):
```sql
goals (
  id: INTEGER PRIMARY KEY,
  distance: REAL,      -- km threshold
  title: TEXT,
  special: TEXT        -- optional special text
)
```

**Note**: Goals do NOT have x/y coordinates - these must be derived from path data.

### Dependencies

- **Story 2.3**: Path data structure and interpolation logic (REQUIRED).
- **Story 2.4**: Inverse scaling pattern and mapStore setup (REQUIRED).
- **Story 2.6**: Will consume waypoint click events for popup (downstream).

### Potential Risks & Mitigations

1. **Risk**: Not all 171 goals have corresponding anchor points in path data.
   - **Mitigation**: Use interpolation logic. If a goal's distance falls between anchors, calculate position geometrically.

2. **Risk**: Too many waypoints cause performance issues at high zoom.
   - **Mitigation**: Viewport culling + `listening={false}` on locked markers.

3. **Risk**: Waypoint clustering makes map unreadable.
   - **Mitigation**: Visibility tiers based on zoom. Test thresholds visually.
   - **Mitigation**: If still cluttered at max zoom, implement optional grouping with expandable badges.

4. **Risk**: Zoom thresholds don't work well with actual map/path data.
   - **Mitigation**: Thresholds are initial targets; developer should adjust based on visual testing during implementation.

---

## Related Story: 2.10 - User Goal Visibility Preference

**Scope**: Separate story to implement user preference for locked/unlocked future goal visibility.

**Summary**:
- Add `show_future_goals_locked` BOOLEAN column to `users` table (default: FALSE to preserve current unlocked behavior).
- Add toggle in Profile Settings modal: "Show future goals as locked" (off by default).
- When enabled: Future waypoints (and Journey list goals) display as locked/grayed.
- When disabled (default): All waypoints display as unlocked (current behavior).
- Applies to both Map waypoint markers AND Journey (goals list) view.

**Why Separate Story**: This is a cross-cutting feature affecting multiple views (Map + Journey) and requires database migration + profile UI changes.

---

### References

- [Source: docs/architecture.md#ADR-002] - Konva.js decision
- [Source: docs/architecture.md#Component Organization] - File structure
- [Source: _bmad-output/implementation-artifacts/2-3-journey-path-rendering.md] - Path data structure
- [Source: _bmad-output/implementation-artifacts/2-4-current-position-marker.md] - Inverse scaling pattern
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5] - Original acceptance criteria

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Story depends on Stories 2.3 and 2.4 being complete (path logic + scaling pattern).
- Goals table lacks x/y coordinates; must derive from path interpolation.
- Visibility tiers prevent clutter at low zoom levels.
- Inverse scaling is CRITICAL for consistent marker appearance.

### File List

- `client/src/data/waypoints.ts` (new)
- `client/src/components/map/WaypointMarker.tsx` (new)
- `client/src/stores/mapStore.ts` (modify)
- `client/src/islands/MapIsland.tsx` (modify)
- `client/src/data/paths/fellowship-path.ts` (verify/modify)
- `tests/ui/map-waypoints.spec.js` (new)
