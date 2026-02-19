# Story 2.7: Map State Management

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Walker**,
I want **the map to remember my progress, milestone data, and viewing position**,
so that **I can seamlessly explore my journey without losing context when navigating or returning to the map**.

> **Sequencing Note**: This story establishes the shared `mapStore` signals/actions that the rest of Epic 2 relies on. Complete it before attempting Stories 2.5, 2.6, or 2.8 so they are not blocked on missing state management.

## Acceptance Criteria

1. **User Progress Signal**:
   - Create `userProgress: Signal<UserProgress>` with `{ totalDistance: number; lastUpdated: Date }`.
   - Fetch user's total distance from `/api/total-distance` API endpoint on map mount.
   - Signal updates reactively when user logs new activity (for Story 2.8 integration).
   - Handle unauthenticated state gracefully (redirect to auth or show message).

2. **Milestones Signal**:
   - Create `milestones: Signal<Milestone[]>` with goal data including coordinates.
   - Fetch milestone data from `/api/goals` API endpoint on map mount.
   - Data includes: `id`, `distance`, `title`, `special`, `image_id`, plus calculated `x`, `y` coordinates.
   - Milestone coordinate data is **cacheable** (goals don't change frequently).
   - Cache in `localStorage` with TTL (24 hours) to reduce API calls.

3. **Map View State Signal**:
   - Create `mapViewState: Signal<MapViewState>` with `{ x: number; y: number; scale: number }`.
   - `x, y` represent the stage/canvas position (pan offset).
   - `scale` represents the current zoom level (1.0 = default, range: 0.5 - 3.0).
   - Update signal on user pan/zoom interactions.

4. **Loading States**:
   - Create `isLoading: Signal<boolean>` for initial data fetch.
   - Create `loadingState: Signal<'idle' | 'loading' | 'success' | 'error'>` for granular control.
   - Show skeleton/spinner while loading user progress and milestones.
   - Map canvas renders only after initial data loads successfully.

5. **Error States**:
   - Create `error: Signal<Error | null>` for error tracking.
   - Display user-friendly error message when API calls fail.
   - Provide "Retry" button that re-triggers data fetching.
   - Log errors to console for debugging.

6. **LocalStorage Persistence**:
   - Persist `mapViewState` (x, y, scale) to `localStorage` under key `walk-to-mordor-map-state`.
   - Include `timestamp` with saved state for TTL validation.
   - **24-hour TTL**: On map mount, check if saved state is older than 24 hours.
     - If valid (< 24h): Restore last saved position (resume where user left off).
     - If expired (≥ 24h): Discard saved state, center map on user's **current position** at default zoom (1.0).
   - Debounce saves (500ms) to prevent excessive writes during continuous pan/zoom.
   - Handle `localStorage` unavailability gracefully (fail silently).

7. **Derived/Computed Signals**:
   - `currentPosition: computed` - Calculates user's x,y on path based on `userProgress.totalDistance`.
   - `unlockedMilestones: computed` - Filters milestones where `distance <= userProgress.totalDistance`.
   - `nextMilestone: computed` - First milestone where `distance > userProgress.totalDistance`.
   - `visibleMilestones: computed` - Milestones filtered by zoom level and viewport.

## Tasks / Subtasks

- [x] **1. Type Definitions (`client/src/types/map.ts`)**
    - [x] Create `UserProgress` interface: `{ totalDistance: number; lastUpdated: Date }`.
    - [x] Create `Milestone` interface extending `Goal`: `{ ...Goal, x: number; y: number }`.
    - [x] Create `MapViewState` interface: `{ x: number; y: number; scale: number }`.
    - [x] Create `MapLoadingState` type: `'idle' | 'loading' | 'success' | 'error'`.
    - [x] Export all types for use across map components.

- [x] **2. Core Store Creation (`client/src/stores/mapStore.ts`)**
    - [x] Import `signal`, `computed` from `@preact/signals`.
    - [x] Create core signals:
        - `userProgress: Signal<UserProgress | null>`.
        - `milestones: Signal<Milestone[]>`.
        - `mapViewState: Signal<MapViewState>`.
        - `loadingState: Signal<MapLoadingState>`.
        - `error: Signal<Error | null>`.
    - [x] Set initial values:
        - `userProgress`: `null`.
        - `milestones`: `[]`.
        - `mapViewState`: `{ x: 0, y: 0, scale: 1.0 }` (or from localStorage).
        - `loadingState`: `'idle'`.
        - `error`: `null`.

- [x] **3. Computed Signals (`client/src/stores/mapStore.ts`)**
    - [x] Create `isLoading: computed(() => loadingState.value === 'loading')`.
    - [x] Create `hasError: computed(() => error.value !== null)`.
    - [x] Create `unlockedMilestones: computed(() => milestones.value.filter(m => m.distance <= (userProgress.value?.totalDistance ?? 0)))`.
    - [x] Create `nextMilestone: computed(() => milestones.value.find(m => m.distance > (userProgress.value?.totalDistance ?? 0)))`.
    - [x] Create `currentPosition: computed(() => calculatePositionOnPath(userProgress.value?.totalDistance ?? 0))`.
        - Note: Uses path interpolation logic from `map-utils.ts` (Story 2.3).

- [x] **4. API Integration Functions**
    - [x] Create `fetchUserProgress(): Promise<UserProgress>`:
        - GET `/api/total-distance`.
        - Parse response: `{ totalDistance: number }`.
        - Return `{ totalDistance, lastUpdated: new Date() }`.
        - Throw on non-ok response.
    - [x] Create `fetchMilestones(): Promise<Milestone[]>`:
        - GET `/api/goals`.
        - Parse response array of Goal objects.
        - For each goal, calculate x,y coordinates by calling the `getWaypointCoordinates` helper built in Story 2.5 (do not reimplement interpolation logic here).
        - Return array of `Milestone` objects.
        - Throw on non-ok response.

- [x] **5. Cache Layer (`client/src/utils/map-cache.ts`)**
    - [x] Create `CACHE_KEYS` constant:
        - `MILESTONES: 'walk-to-mordor-milestones'`.
        - `MAP_VIEW: 'walk-to-mordor-map-state'`.
    - [x] Create `getCachedMilestones(): Milestone[] | null`:
        - Read from localStorage.
        - Parse JSON.
        - Check `timestamp` against 24h TTL.
        - Return null if expired or invalid.
    - [x] Create `cacheMilestones(milestones: Milestone[]): void`:
        - Write to localStorage with `{ data: milestones, timestamp: Date.now() }`.
    - [x] Create `getPersistedMapView(): MapViewState | null`:
        - Read from localStorage.
        - Parse and validate structure.
        - Check `timestamp` against **24h TTL**.
        - Return null if expired (≥ 24h) or invalid.
    - [x] Create `persistMapView(state: MapViewState): void`:
        - Write to localStorage with `{ ...state, timestamp: Date.now() }`.
        - Wrap in try/catch for quota errors.

- [x] **6. Store Actions**
    - [x] Create `initializeMap(): Promise<void>`:
        - Set `loadingState.value = 'loading'`.
        - Fetch user progress (always fresh).
        - Try cached milestones first, then fetch if expired.
        - Check persisted `mapViewState` from localStorage:
          - If valid (< 24h): Restore saved position.
          - If expired/missing: Calculate initial view centered on user's **current position** at default zoom (1.0).
        - On success: Set `loadingState.value = 'success'`.
        - On error: Set `error.value`, `loadingState.value = 'error'`.
    - [x] Create `retryLoad(): Promise<void>`:
        - Clear `error.value`.
        - Call `initializeMap()`.
    - [x] Create `updateMapView(newState: Partial<MapViewState>): void`:
        - Merge with existing state.
        - Update `mapViewState` signal.
        - Debounced persist to localStorage (500ms).
    - [x] Create `refreshUserProgress(): Promise<void>`:
        - Fetch fresh user progress.
        - Update `userProgress` signal.
        - (Used by Story 2.8 after logging a walk).
    - [x] Create `centerOnCurrentPosition(): MapViewState`:
        - Calculate user's current x,y from `userProgress.totalDistance`.
        - Return `MapViewState` with x,y offset to center that position in viewport.
        - Use default scale (1.0).
        - (Used on initial load when no valid persisted state exists).

- [x] **7. Debounced Persistence**
    - [x] Implement debounce utility or use existing one.
    - [x] Create `debouncedPersistMapView` that waits 500ms after last call.
    - [x] Wire into `updateMapView` action.

- [x] **8. Integration Ready Exports**
    - [x] Export all signals for component consumption.
    - [x] Export all actions for component use.
    - [x] Export computed signals.
    - [x] Ensure TypeScript exports are properly typed.

- [x] **9. Testing**
    - [x] **Unit Tests** (`client/src/stores/mapStore.test.ts`):
        - Test initial state values.
        - Test `initializeMap` success path (mock fetch).
        - Test `initializeMap` error handling.
        - Test `initializeMap` restores persisted state when < 24h old.
        - Test `initializeMap` centers on current position when persisted state ≥ 24h old.
        - Test `initializeMap` centers on current position when no persisted state.
        - Test `centerOnCurrentPosition` returns correct viewport offset.
        - Test `unlockedMilestones` computed returns correct filtered list.
        - Test `nextMilestone` computed returns first locked milestone.
        - Test `updateMapView` updates signal correctly.
        - Test localStorage persistence is called with timestamp.
    - [x] **Unit Tests** (`client/src/utils/map-cache.test.ts`):
        - Test cache write/read roundtrip.
        - Test milestone TTL expiration logic (24h).
        - Test map view TTL expiration logic (24h).
        - Test graceful handling of invalid JSON.
        - Test graceful handling of localStorage unavailable.

## Dev Notes

### Architecture & Pattern Compliance

- **Preact Signals (ADR-003)**: This story implements the foundation signal store for all map components.
  - Use `signal()` for mutable state.
  - Use `computed()` for derived values.
  - Signals are imported from `@preact/signals`.
  - Reference: [docs/architecture.md](docs/architecture.md#ADR-003)

- **TypeScript Strict**: No `any` types. All interfaces must be explicitly defined.
  - Extend existing `Goal` type from `client/src/types/goal.ts`.
  - Define new types in `client/src/types/map.ts`.

- **File Organization**: New files follow established patterns from [docs/architecture.md](docs/architecture.md):
  ```
  client/src/
  ├── stores/
  │   └── mapStore.ts      # NEW - Core state management
  ├── types/
  │   ├── goal.ts          # EXISTING - Goal interface
  │   └── map.ts           # NEW - Map-specific types
  └── utils/
      └── map-cache.ts     # NEW - LocalStorage cache utilities
  ```

### API Endpoints

| Endpoint | Method | Response | Notes |
|----------|--------|----------|-------|
| `/api/total-distance` | GET | `{ totalDistance: number }` | Requires authentication |
| `/api/goals` | GET | `Goal[]` | Public, cacheable |

### Existing Code to Reference

- **Goal Type**: `client/src/types/goal.ts` - Existing interface to extend.
- **Path Data**: Will need `fellowship-path.ts` or equivalent for coordinate mapping (Story 2.3).
- **Map Utils**: `client/src/utils/map-utils.ts` may have path interpolation logic (Story 2.3/2.4).

### Previous Story Dependencies

This story depends on concepts from earlier Epic 2 stories:
- **Story 2.3 (Journey Path)**: Defines path coordinate system and interpolation algorithm.
- **Story 2.4 (Current Position)**: Uses `calculatePositionOnPath()` for user marker placement.

And this store becomes a prerequisite for downstream stories:
- **Story 2.5 (Waypoints)**, **2.6 (Waypoint Popup)**, and **2.8 (Map Walk Logging)** should not start until this state layer exists, because they extend/consume the signals defined here.

### LocalStorage Schema

```typescript
// Key: 'walk-to-mordor-milestones'
interface CachedMilestones {
  data: Milestone[];
  timestamp: number; // Date.now()
}

// Key: 'walk-to-mordor-map-state'
interface PersistedMapView {
  x: number;
  y: number;
  scale: number;
  timestamp: number; // Date.now() - expires after 24h
}
```

### Performance Considerations

- **Milestone Caching**: Goals data rarely changes. Cache for 24h to reduce API calls.
- **Debounced Persistence**: Prevent localStorage thrashing during continuous pan/zoom.
- **Lazy Coordinate Calculation**: Don't recalculate all milestone coordinates on every render.

### Error Handling Strategy

1. **API Errors**: Set `error` signal, show retry UI.
2. **Cache Errors**: Silently fall back to fresh fetch.
3. **Persistence Errors**: Log warning, continue without persistence.
4. **Auth Errors**: Redirect to login or show appropriate message.

### Integration Points (For Subsequent Stories)

- **Story 2.8 (Map Walk Logging)**: Calls `refreshUserProgress()` after new entry.
- **Story 2.5 (Waypoints)**: Consumes `milestones`, `unlockedMilestones`, `nextMilestone`.
- **Story 2.4 (Position Marker)**: Consumes `currentPosition`.
- **Story 2.6 (Popup)**: Consumes `selectedWaypoint` (extend store in that story).

### References

- [Source: docs/architecture.md#ADR-003](docs/architecture.md#ADR-003) - Preact Signals decision
- [Source: docs/architecture.md#Component-Organization](docs/architecture.md#Component-Organization) - File structure patterns
- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.7](../_bmad-output/planning-artifacts/epics.md) - Original story requirements
- [Source: client/src/types/goal.ts](client/src/types/goal.ts) - Existing Goal interface

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

None - implementation completed without issues.

### Completion Notes List

- Created type definitions in `client/src/types/map.ts`:
  - `UserProgress` interface for tracking user distance
  - `Milestone` interface extending `Goal` with x,y coordinates
  - `MapViewState` interface for viewport state (x, y, scale)
  - `MapLoadingState` type union for granular loading states
  - `CachedMilestones` and `PersistedMapView` interfaces for localStorage structures

- Created centralized store in `client/src/stores/mapStore.ts`:
  - Core signals: `userProgress`, `milestones`, `mapViewState`, `loadingState`, `error`
  - Computed signals: `isLoading`, `hasError`, `unlockedMilestones`, `nextMilestone`, `currentPosition`, `visibleMilestones`
  - API functions: `fetchUserProgress()`, `fetchMilestones()` with proper error handling
  - Actions: `initializeMap()`, `retryLoad()`, `updateMapView()`, `refreshUserProgress()`, `centerOnCurrentPosition()`, `setViewportSize()`
  - Debounced persistence (500ms) for map view state

- Created cache utilities in `client/src/utils/map-cache.ts`:
  - 24-hour TTL for both milestones and map view state
  - Graceful handling of localStorage unavailability
  - `CACHE_KEYS` constants for consistency

- Comprehensive unit tests:
  - 37 tests for mapStore covering all signals, computed values, and actions
  - 19 tests for map-cache covering TTL expiration, invalid data, and error handling

- Used existing `getWaypointCoordinates()` from Story 2.5 for milestone coordinate calculation
- Used existing `getUserPosition()` from Story 2.3 for user position interpolation

### Change Log

- 2026-02-19: Code review fix - Added `visibleMilestones` computed signal (AC #7) and `setViewportSize` action
- 2026-02-19: Story 2.7 implemented - Map State Management foundation complete

### File List

**New Files:**
- `client/src/types/map.ts` - Map-specific type definitions (incl. ViewportSize interface)
- `client/src/stores/mapStore.ts` - Centralized reactive state store
- `client/src/stores/mapStore.test.ts` - Store unit tests (37 tests)
- `client/src/utils/map-cache.ts` - LocalStorage cache utilities
- `client/src/utils/map-cache.test.ts` - Cache unit tests (19 tests)

**Modified Files:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Status updated to in-progress → review
- `tests/ui/helpers/common.js` - Fixed date handling in createTestEvent helper

