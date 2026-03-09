# Story 6.6: Map Social Panel & Friends on Map

Status: ready-for-dev
Issue: #304

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **walker with friends on the platform**,
I want **to see my friends' avatar markers at their journey positions on the map and control social visibility from a unified panel**,
so that **walking to Mordor feels like a shared adventure where I can track my friends' progress visually alongside my own**.

## Acceptance Criteria

### AC1: Replace fellowship selector toggle with unified Social panel toggle

- Replace the existing `.map-party-toggle` button (the `fa-users` icon at the bottom of `.map-controls`) with a "Social" toggle button.
- The button opens a panel (`.map-social-panel`) that replaces the current `.map-party-panel`.
- When opened, the panel contains two independent sections (AC2 and AC3).
- The panel follows the existing map panel design: `position: absolute`, glassmorphic dark background (`var(--bg-secondary)`), gold border (`var(--accent-gold)`), `border-radius: 8px`, `z-index: 15`, `box-shadow: 0 4px 12px var(--shadow-std)`).
- The panel must have the same open/close toggle behavior as the current party panel (click to open, click button again to close).
- The panel's position mirrors the current `.map-party-panel` alignment: right-aligned below the map controls.
- The `.map-controls` button size remains 40px desktop / 36px mobile (existing `map.css` sizes).

### AC2: "View As" section in Social panel

- The first section of the Social panel is "View As" — a label followed by the current fellowship selection buttons.
- Include "My Journey" personal option plus all user's fellowships — identical to the current party panel behavior.
- The selected view is highlighted with `var(--accent-gold)` text and bold weight (same as current `.map-party-option.selected`).
- Selecting a fellowship switches the map to display that fellowship's progress (reuse existing `handlePartyViewChange` logic exactly).
- This section must be hidden if user has no fellowships (same conditional as current `hasParties` check).

### AC3: "Friends on Map" section in Social panel

- The second section of the Social panel is "Friends on Map" — a label with a toggle switch.
- The toggle controls whether friend avatar markers are visible on the map canvas.
- Toggle state persists to `localStorage` under key `wtm_friends_on_map` (default: `false` — friends hidden until user opts in).
- The toggle uses the same visual style as existing preference toggles (slider pattern from `public/css/profile.css`), adapted for the dark map panel context.
- When toggled ON, fetch `GET /api/friends/positions` and render friend markers (AC5–AC8).
- When toggled OFF, remove all friend markers from the canvas and clear the cached positions signal.
- This section is always visible (even if user has no friends — in that case, show "Add friends to see them on the map" hint text below the toggle).

### AC4: Create `GET /api/friends/positions` endpoint

- New endpoint in `src/friend-handlers.ts` (or the handlers file created by Story 6.2).
- Returns `{ friends: [{ user_id, username, avatar_id, total_distance }] }` where `total_distance` is in **km** (matching all other distance APIs).
- Only returns accepted friends: query `friendships` where `status = 'accepted'` and the current user is either `requester_id` or `addressee_id`.
- For each friend, compute `total_distance` as `COALESCE(SUM(p.distance), 0)` from the `progress` table.
- Requires authentication (401 if no valid session).
- Wire in `src/index.ts` at `GET /api/friends/positions` and add to `getAllowedMethods()`.
- Response shape matches `docs/api-reference.md` specification.

### AC5: Render friend avatar markers on the Konva canvas

- Create `client/src/components/map/FriendMarkers.ts` — a new Konva rendering module following the pattern of `UserMarker.ts` and `WaypointMarkers.ts`.
- For each friend from the positions API:
  - Compute their map position using `getUserPosition(fellowshipPath, friendDistanceMiles)` (convert km → miles first using `KM_TO_MILES`).
  - Render a 32px circular avatar:
    - If `avatar_id` is set: load `Konva.Image` from `/img/avatars/thumbs/{avatar_id}.webp`, clip to circle.
    - If `avatar_id` is null: render a `Konva.Circle` with a `Konva.Text` initial (uppercase first letter of username) on a deterministic HSL background (`hsl((username.charCodeAt(0) * 137) % 360, 50%, 35%)`).
  - Each marker is a `Konva.Group` containing the avatar visual + a thin white stroke border (2px).
- Markers are placed on a **new Konva layer** (`friendMarkerLayerRef`) inserted between `pathLayerRef` (Layer 2) and `markerLayerRef` (Layer 3) — so friends render above paths but **below** the user's own position marker.
- Export `createFriendMarkers()`, `updateFriendMarkers()`, `destroyFriendMarkers()` functions.

### AC6: Friend markers scale with zoom

- Friend avatar markers maintain a constant **screen size** of 32px using the same `markerScale()` approach from `map-utils.ts` that `UserMarker` and `WaypointMarkers` use.
- On each zoom/pan update, call `setScale(stageScale)` on each friend marker group to apply inverse scaling.
- Scaling logic: `const scale = markerScale(stageScale, 6, 2, 16);` then `group.scaleX(scale); group.scaleY(scale);`

### AC7: Frustum culling — only render visible friend markers

- On each pan/zoom, calculate the visible viewport bounds in map coordinates.
- Only add friend marker groups to the layer if their position is within the visible bounds (with a small margin for partially visible markers).
- Friends outside the viewport should have their groups removed from the layer (not destroyed — they can be re-added on next pan).
- This is a performance optimization matching the `visibleMilestones` computed signal pattern in `mapStore.ts`.

### AC8: Tap/click friend avatar — show mini-card

- When user taps or clicks a friend avatar marker on the canvas, show a mini-card tooltip.
- The mini-card is an HTML overlay (DOM element positioned over the canvas, same pattern as `WaypointPopup.tsx`), not a Konva element.
- Mini-card content:
  - Friend's avatar (64px, using `Avatar` component from Story 6.5 or inline image + initials logic).
  - Username (bold).
  - Total distance (e.g., "245.5 km").
  - "View Profile →" link navigating to `/friends/:userId`.
- Mini-card is positioned using `getScreenPosition()` from `map-popup-utils.ts` (same utility as waypoint popups).
- Prefer showing the mini-card **above** the avatar marker; fall back to below/left/right using `getOptimalPopupPosition()`.
- Mini-card is dismissible: click outside, tap outside, or press ESC.
- Only one mini-card can be open at a time (close any existing one before opening a new one).
- Opening a friend mini-card also closes any open waypoint popup (and vice versa).

### AC9: Overlap handling for nearby friends

- When two or more friend avatars overlap at similar distances (their map positions are within 20px at the current scale):
  - At normal zoom: offset overlapping avatars slightly along the perpendicular axis of the path at that point, creating a stacked appearance.
  - At low zoom (scale < 0.5): cluster nearby friends into a single circle with a count badge (e.g., "3" in a small gold circle). Tapping the cluster zooms in to that area.
- This is a nice-to-have optimization — a simpler initial implementation that just renders all markers at their exact positions is acceptable for the first pass, with overlap handling as a follow-up refinement.

### AC10: Client-side caching of friend positions

- Cache the `GET /api/friends/positions` response for 5 minutes client-side.
- Use a signal + timestamp pattern: `friendPositions` signal holds the data, `friendPositionsFetchedAt` tracks last fetch time.
- On toggle ON: if cache is fresh (< 5 minutes), use cached data. Otherwise, fetch fresh data.
- On fellowship view change: do NOT re-fetch friend positions (they are independent of which fellowship is selected).
- On manual refresh or page navigation: clear the cache.

### AC11: Cross-cutting quality requirements

- Maintain >90% test coverage for all new backend code.
- Add Jest tests for `GET /api/friends/positions`: valid response shape, requires auth, only returns accepted friends, computes total_distance correctly, returns empty array when no friends.
- Add Vitest unit tests for `FriendMarkers.ts`: marker creation, position calculation, initials fallback, scale updates.
- Add Vitest unit tests for social panel toggle logic and localStorage persistence.
- Extend Playwright tests for the map page: Social panel opens/closes, friend toggle state persists, friend markers appear when toggled on.
- All friend markers must have meaningful Konva `name` attributes for test selection (e.g., `friend-marker-{userId}`).
- Mini-card must be keyboard accessible (focus trap when open, ESC to close).
- Toggle switch must be accessible (ARIA label, keyboard operable).

## Tasks / Subtasks

- [ ] **Task 1: Create `GET /api/friends/positions` API endpoint** (AC: #4)
  - [ ] In `src/friend-handlers.ts` (created by Story 6.2), add `handleFriendPositions(request, env)` handler function.
  - [ ] SQL query: `SELECT u.id as user_id, u.username, u.avatar_id, COALESCE(SUM(p.distance), 0) as total_distance FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END LEFT JOIN progress p ON p.user_id = u.id WHERE ((f.requester_id = ? AND f.addressee_id = u.id) OR (f.addressee_id = ? AND f.requester_id = u.id)) AND f.status = 'accepted' GROUP BY u.id`.
  - [ ] Wire route in `src/index.ts`: `if (url.pathname === '/api/friends/positions' && method === 'GET')` → `handleFriendPositions(request, env)`.
  - [ ] Add to `getAllowedMethods()` switch for `/api/friends/positions` → `'GET, OPTIONS'`.
  - [ ] Add Jest tests in `tests/api/friend-handlers.test.ts`:
    - Returns 401 when unauthenticated.
    - Returns empty `friends: []` when user has no accepted friends.
    - Returns correct `{ user_id, username, avatar_id, total_distance }` for accepted friends.
    - Excludes pending/rejected friend requests.
    - Computes `total_distance` correctly (sum of progress entries in km).
    - Returns `avatar_id: null` for friends without an avatar.

- [ ] **Task 2: Refactor MapIsland party panel into Social panel** (AC: #1, #2, #3)
  - [ ] In `client/src/islands/MapIsland.tsx`:
    - Rename `showPartyPanel` signal to `showSocialPanel`.
    - Replace the `map-party-toggle` button with a `map-social-toggle` button (keep the `fa-users` icon or switch to `fa-user-group`).
    - Replace the `map-party-panel` div with a `map-social-panel` div containing two sections.
  - [ ] **"View As" section**:
    - Add a `<div className="social-panel-section">` with `<h4>View As</h4>` label.
    - Move existing fellowship option buttons into this section (same `map-party-option` class, same click handlers).
    - Conditionally render this section only when `hasParties.value` is true.
  - [ ] **"Friends on Map" section**:
    - Add a `<div className="social-panel-section">` with `<h4>Friends on Map</h4>` label.
    - Add a toggle switch that controls `showFriendsOnMap` signal.
    - Add hint text "Add friends to see them on the map" when user has no friends (detect via empty positions response or a `hasFriends` signal).
    - Always render this section.
  - [ ] Add `showFriendsOnMap` signal with localStorage persistence:
    - Initialize from `localStorage.getItem('wtm_friends_on_map') === 'true'`.
    - On toggle change, persist to `localStorage.setItem('wtm_friends_on_map', String(value))`.
  - [ ] When `showFriendsOnMap` toggled ON: trigger friend positions fetch + marker rendering.
  - [ ] When `showFriendsOnMap` toggled OFF: destroy friend markers, clear positions signal.

- [ ] **Task 3: Update CSS for Social panel** (AC: #1, #3)
  - [ ] In `public/css/main.css`:
    - Add `.map-social-panel` styles (reuse `.map-party-panel` base styles: same background, border, border-radius, z-index, box-shadow).
    - Add `.social-panel-section` with padding, border-bottom divider between sections.
    - Add `.social-panel-section h4` — small uppercase label (`font-size: 0.75rem`, `color: var(--text-muted)`, `letter-spacing: 0.05em`, `margin-bottom: 6px`).
    - Add `.friends-toggle` — compact toggle switch matching the dark panel context. Slider background `var(--bg-dark-alt)`, active color `var(--accent-teal)`, 36px wide × 20px tall.
    - Add `.friends-toggle-row` — flex row with label and toggle switch.
    - Add `.friends-hint` — small muted text (`font-size: 0.8rem`, `color: var(--text-muted)`, `margin-top: 4px`).
  - [ ] In `public/css/map.css`:
    - Replace `.map-party-panel` positioning with `.map-social-panel` positioning (same `top`/`right` alignment).
    - Update the `@media (max-width: 768px)` responsive rules for the new class name.
    - Add `.map-social-toggle` button styles (inherit from `.map-party-toggle`, same dimensions).

- [ ] **Task 4: Create `FriendMarkers.ts` Konva rendering module** (AC: #5, #6, #7)
  - [ ] Create `client/src/components/map/FriendMarkers.ts`.
  - [ ] Define interfaces:
    ```ts
    interface FriendMarkerData {
      user_id: number;
      username: string;
      avatar_id: string | null;
      total_distance: number; // km
    }
    interface FriendMarkerNodes {
      layer: Konva.Layer;
      markers: Map<number, Konva.Group>; // keyed by user_id
      update(friends: FriendMarkerData[], pathNodes: PathNode[], stageScale: number): void;
      setScale(stageScale: number): void;
      updateVisibility(viewportBounds: { x: number; y: number; width: number; height: number }): void;
      destroy(): void;
    }
    ```
  - [ ] Implement `createFriendMarkers(stage: Konva.Stage, insertBeforeLayer: Konva.Layer): FriendMarkerNodes`.
    - Create a new `Konva.Layer({ listening: true })` and insert it before `markerLayerRef` (user marker layer).
    - For each friend, create a `Konva.Group` with:
      - If `avatar_id` set: `Konva.Image` loaded from `/img/avatars/thumbs/{avatar_id}.webp`, clipped to circle via `clipFunc`. Use `Konva.Image.fromURL()` or the `Image()` constructor with onload.
      - If `avatar_id` null: `Konva.Circle` with HSL fill + `Konva.Text` with first initial.
      - White stroke border (`Konva.Circle`, stroke `#fff`, strokeWidth 2).
    - Set `group.name('friend-marker-' + friend.user_id)` for test selection.
    - Position each group using `getUserPosition(pathNodes, friend.total_distance * KM_TO_MILES)`.
  - [ ] Implement `setScale(stageScale)` — apply `markerScale(stageScale, 6, 2, 16)` to each group.
  - [ ] Implement `updateVisibility(viewportBounds)` — frustum culling: hide groups outside bounds, show groups inside.
  - [ ] Implement `destroy()` — remove all groups and the layer from the stage.
  - [ ] Wire click/tap handlers: `group.on('click tap', () => onSelect(friend))`.
  - [ ] Add Vitest tests in `client/src/components/map/__tests__/FriendMarkers.test.ts`.

- [ ] **Task 5: Create `FriendMiniCard.tsx` popup component** (AC: #8)
  - [ ] Create `client/src/components/map/FriendMiniCard.tsx`.
  - [ ] Props: `friend: { user_id, username, avatar_id, total_distance }`, `position: { x: number, y: number }`, `onClose: () => void`.
  - [ ] Render:
    - Avatar image (64px) or initials fallback (same deterministic color logic as `Avatar` component from Story 6.5, or inline if Avatar is not yet available).
    - Username (bold, `var(--text-primary)`).
    - Total distance (e.g., "245.5 km", `var(--text-secondary)`).
    - "View Profile →" link (`<a href="/friends/${friend.user_id}">`, `var(--accent-teal)` color).
  - [ ] Positioning: absolutely positioned `<div>` at `left: {position.x}px; top: {position.y}px`, using `getOptimalPopupPosition()` for placement preference.
  - [ ] Style: dark card background (`var(--bg-secondary)`), gold border (`var(--accent-gold)`), rounded corners, `z-index: 20`, `box-shadow`.
  - [ ] Dismissible: `useEffect` with click-outside handler + ESC key handler (same pattern as `WaypointPopupContainer.tsx`).
  - [ ] Add CSS in `public/css/main.css` (or `public/css/map.css`) for `.friend-mini-card`.
  - [ ] Add Vitest tests for the component.

- [ ] **Task 6: Integrate friend markers into MapIsland lifecycle** (AC: #5, #6, #7, #8, #10)
  - [ ] In `client/src/islands/MapIsland.tsx`:
    - Add `friendMarkerRef = useRef<FriendMarkerNodes | null>(null)`.
    - Add `friendPositions` signal (cached positions data).
    - Add `friendPositionsFetchedAt` signal (timestamp for 5-min cache).
    - Add `selectedFriend` signal for mini-card state (`null` or friend data).
    - Add `friendPopupPosition` signal for mini-card screen position.
  - [ ] On `showFriendsOnMap` toggled ON:
    - Check cache freshness. If stale (> 5 min), fetch `GET /api/friends/positions`.
    - Call `createFriendMarkers(stageRef.current, markerLayerRef.current)`.
    - Call `friendMarkerRef.current.update(friends, fellowshipPath, currentScale.value)`.
  - [ ] On `showFriendsOnMap` toggled OFF:
    - Call `friendMarkerRef.current.destroy()`.
    - Set `friendMarkerRef.current = null`.
    - Clear `selectedFriend.value = null`.
  - [ ] On zoom/pan: if friend markers exist, call `setScale(currentScale.value)` and `updateVisibility(viewportBounds)`.
  - [ ] On friend marker click: compute screen position with `getScreenPosition()`, set `selectedFriend.value` and `friendPopupPosition.value`.
  - [ ] On waypoint popup open: close friend mini-card. On friend mini-card open: close waypoint popup.
  - [ ] Render `FriendMiniCard` in the JSX when `selectedFriend.value` is set.
  - [ ] On view change (fellowship switch): do NOT re-fetch friend positions. Friends are visible regardless of which fellowship view is active.

- [ ] **Task 7: Overlap handling (nice-to-have refinement)** (AC: #9)
  - [ ] In `FriendMarkers.ts`, after positioning all markers:
    - Detect overlapping groups (positions within 20px at current scale).
    - Offset overlapping markers along the perpendicular axis of the path segment.
  - [ ] At low zoom (scale < 0.5):
    - Cluster nearby friends into a single circle with a count badge.
    - On cluster click: zoom in to that area using `animateTo({ x, y, scale })`.
  - [ ] This task can be deferred to a follow-up PR if the basic implementation without overlap handling works well.

- [ ] **Task 8: Update documentation** (AC: #11)
  - [ ] Update `docs/api-reference.md` — add `GET /api/friends/positions` endpoint documentation.
  - [ ] Update `docs/frontend-guide.md` — document `FriendMarkers.ts` module, `FriendMiniCard.tsx` component, Social panel.
  - [ ] Update `docs/ui-overview.md` — document the Social panel replacing the fellowship-only selector.
  - [ ] Update `docs/architecture.md` — confirm map Konva layer ordering now includes friend marker layer.

- [ ] **Task 9: Extend Playwright UI tests** (AC: #11)
  - [ ] In `tests/ui/map.spec.js` (or new file):
    - Test: Social panel toggle opens/closes the panel.
    - Test: "View As" section shows fellowship options when user has fellowships.
    - Test: "Friends on Map" toggle persists state to localStorage.
    - Test: Friend markers appear on the Konva canvas when toggle is ON and user has friends.
    - Test: Tapping a friend marker shows the mini-card with correct data.
    - Test: Mini-card "View Profile →" link navigates to `/friends/:id`.
    - Test: ESC key closes the mini-card.

## Dev Notes

### Story Foundation

Story 6.6 is the **capstone of Epic 6** — it brings friends onto the map, the primary interaction surface of the app. The existing map has a fellowship selector panel (a dropdown of party buttons) that this story **replaces** with a unified "Social" panel containing both the fellowship view selector and a new "Friends on Map" toggle. When enabled, friends appear as avatar markers at their journey positions on the Konva canvas, tappable for a mini-card linking to their profile.

The business value is social engagement: seeing friends walking alongside you on the journey to Mordor transforms a solo tracking app into a social experience. This completes the Epic 6 social identity vision.

### Hard Dependencies

**Story 6.2** (Friend Request API) must be implemented first — it creates:
- The `friendships` table and all friend CRUD endpoints.
- The friend list and search APIs.
- Without these, `GET /api/friends/positions` has nothing to query.

**Story 6.1** (Friends Database Schema & Avatar System) must be implemented first — it creates:
- The `avatar_id` and `friend_code` columns on `users`.
- The `friendships` table schema.
- The avatar image assets in `public/img/avatars/` and `public/img/avatars/thumbs/`.

**Story 2.3** (Journey Path Rendering) is already implemented — it provides `fellowshipPath`, `calculateCutoffPoint()`, and `getUserPosition()`.

**Story 3.6** (Fellowship UI / Party Selector) is already implemented — the current map party panel that this story refactors.

**Story 6.5** (Avatar UI) may or may not be implemented before this story. If it is:
- Use the `Avatar` Preact component from `client/src/components/Avatar.tsx` in the mini-card.
- If not yet available, implement inline avatar rendering in the mini-card (same deterministic initials logic) and refactor to use `Avatar` component later.

At story-creation time, Stories 6.1–6.5 are all `ready-for-dev` — none are implemented yet.

### Existing Implementation Touchpoints

#### MapIsland (`client/src/islands/MapIsland.tsx`) [Source: client/src/islands/MapIsland.tsx]
- **1450+ lines** — the entire map lives in this single island.
- Local signals: `showPartyPanel` (line 271), `userDistance`, `currentScale`, `position`, `selectedWaypoint`, `popupPosition`, etc.
- `handlePartyViewChange(selection)` (line 768): switches between personal and fellowship views, updates paths, marker, waypoints.
- Party toggle button (lines 1348–1357): `.map-party-toggle` button with `fa-users` icon.
- Party panel (lines 1359–1380): `.map-party-panel` div with "My Journey" + fellowship buttons.
- MapLegend (lines 1383–1390): visible when party view is active.
- WaypointPopupContainer (lines 1392–1401): HTML overlay for waypoint detail popups.
- **Konva layers** (created in init, bottom to top):
  1. `layerRef` — tile images (listening: true for drag).
  2. `pathLayerRef` — journey path lines + member paths (listening: false).
  3. `markerLayerRef` — user marker + waypoint markers (listening: true).
- **A new friend marker layer must be inserted between layers 2 and 3.**

#### Map State: `mapStore.ts` [Source: client/src/stores/mapStore.ts]
- `userProgress` signal — total km walked.
- `milestones` signal — goal waypoints with x, y coordinates.
- `currentPosition` computed signal — calls `getUserPosition()`.
- `visibleMilestones` computed — viewport-culled milestones (frustum culling pattern to reuse).
- `viewportSize` signal — set by MapIsland on resize.
- No friend-related signals yet.

#### Party State: `partyStore.ts` [Source: client/src/stores/partyStore.ts]
- `userParties` signal — all user's active parties.
- `selectedView` signal — persisted to `localStorage('wtm_party_view')`.
- `hasParties` computed — `userParties.value.length > 0`.
- `selectView(selection)` action — fetches party progress, updates signals.
- The pattern for `showFriendsOnMap` localStorage persistence should mirror `selectedView`.

#### Path Utilities: `map-utils.ts` [Source: client/src/utils/map-utils.ts]
- `getUserPosition(pathNodes, userDistanceMiles): Point` (line 30) — convenience wrapper for path interpolation.
- `calculateCutoffPoint(pathNodes, userDistance): PathSplit` (line 73) — full interpolation with completed/future points.
- `dynamicStrokeWidth(baseWidth, scale, min, max): number` (line 311) — inverse scaling for constant screen size.
- `markerScale(stageScale, baseStroke, minStroke, maxStroke): number` (line 331) — scaling factor for marker groups.
- **Friend markers must use `getUserPosition()` for positioning and `markerScale()` for zoom scaling.**

#### Popup Utilities: `map-popup-utils.ts` [Source: client/src/utils/map-popup-utils.ts]
- `getScreenPosition(item, stagePosition, stageScale): { x, y }` — converts map coords to screen px.
- `getOptimalPopupPosition(screenPos, popupSize, viewportSize): 'above' | 'below' | 'right' | 'left'` — placement preference.
- `calculatePanOffset(screenPos, popupSize, viewportSize)` — calculates needed pan to show popup.
- **Friend mini-card should reuse these exact utilities.**

#### UserMarker (`client/src/components/map/UserMarker.ts`) [Source: client/src/components/map/UserMarker.ts]
- Creates a `Konva.Group` with goldrod circle + white stroke + halo glow.
- `setScale(stageScale)` uses `markerScale(stageScale, 6, 2, 20)` — friend markers should use similar but slightly smaller values (e.g., `markerScale(stageScale, 6, 2, 16)`) so they're subtly smaller than the user marker.
- `setPosition(pos, animate)` — updates group position with optional animation.
- Placed on `markerLayerRef` (topmost Konva layer) — **user marker must remain above friend markers**.

#### WaypointMarkers (`client/src/components/map/WaypointMarkers.ts`) [Source: client/src/components/map/WaypointMarkers.ts]
- Creates `Konva.Group` per waypoint with circles/diamonds.
- `onSelect` callback pattern: `group.on('click tap', () => onSelect(wp))`.
- Clustering logic for nearby waypoints — reference for friend overlap handling.
- Placed on `markerLayerRef`.

#### WaypointPopupContainer (`client/src/components/map/WaypointPopupContainer.tsx`) [Source: client/src/components/map/WaypointPopupContainer.tsx]
- Controller for desktop/mobile popup routing.
- `ResizeObserver` measures popup size.
- ESC key handler: `document.addEventListener('keydown', ...)`.
- Click-outside handler pattern to reuse for friend mini-card.

#### Worker Router (`src/index.ts`) [Source: src/index.ts]
- Manual `if/else` dispatch chain.
- Friend routes should be placed in the existing friend route block (created by Story 6.2).
- `getAllowedMethods()` is a `switch` statement + `matchRoute` checks.
- Pattern: `if (url.pathname === '/api/friends/positions' && method === 'GET') return handleFriendPositions(request, env);`

#### CSS Design System [Source: public/css/main.css]
All CSS variables defined in `public/css/main.css` — use **without fallbacks** per repo convention:
- `--bg-primary: #000`, `--bg-secondary: #1a1a1a`, `--bg-dark-alt: #2a2a2a`
- `--accent-gold: #FFD700` — panel border, selected option highlight
- `--accent-teal: #16c79a` — toggle active state, "View Profile" link
- `--accent-dark-blue` — option hover background
- `--text-primary: #fff`, `--text-secondary: #ccc`, `--text-muted: #999`
- `--border-gray: #333`, `--shadow-std`
- `--radius-md: 8px`, `--radius-sm: 4px`

#### Existing Party Panel CSS [Source: public/css/main.css#L324-L365, public/css/map.css#L110-L140]
- `main.css` defines the panel styles: background, border, padding, option buttons.
- `map.css` defines the **positioning**: `top: calc(1.5rem + 3 * (40px + 0.5rem)); right: calc(1.5rem + 40px + 0.5rem);` — this positions the panel to align with the 4th button in `.map-controls`.
- Mobile responsive: button size 36px instead of 40px, adjusted panel position.
- **New Social panel must replace these, keeping the same positioning math.**

### Critical Implementation Guardrails

- **Do NOT create a new Konva `Stage` or separate canvas.** Friend markers live on the same stage as all other map elements, on their own `Konva.Layer`.
- **Do NOT modify `partyStore.ts` signals for friend data.** Create separate friend-specific signals (either in a new `friendStore.ts` or local to `MapIsland`). Party view and friend visibility are independent concerns.
- **Do NOT break the existing fellowship view switching.** The "View As" section of the Social panel must behave identically to the current party panel. Test that all fellowship selection still works after the refactor.
- **Do NOT use `react-konva`.** This project uses the imperative `Konva` API directly. `FriendMarkers.ts` must follow the pattern of `UserMarker.ts` and `WaypointMarkers.ts` (plain TypeScript functions returning Konva nodes).
- **Friend distance is in km from the API, but map utils expect miles.** Always convert: `friend.total_distance * KM_TO_MILES` before calling `getUserPosition()`. The `KM_TO_MILES` constant is already defined in `MapIsland.tsx`.
- **Do NOT fetch friend positions when friends toggle is OFF.** Only fetch when the user actively turns the toggle ON (or on page load if the persisted state is ON).
- **Do NOT re-fetch friend positions on fellowship view change.** Friends are visible regardless of which "View As" option is selected.
- **Layer ordering is critical.** The new friend marker layer MUST be inserted between the path layer and the user marker layer. Use `stage.add(friendLayer)` followed by reordering: `friendLayer.moveToTop(); markerLayerRef.current.moveToTop();` — this ensures friends are above paths but below the user's own marker.
- **Image loading is async.** `Konva.Image.fromURL()` loads images asynchronously. Render the initials fallback immediately, then swap to the image when loaded. Handle 404s gracefully (keep initials if image fails to load).
- **The `Avatar` Preact component (Story 6.5) is for DOM elements only — not Konva.** Friend markers on the canvas must use Konva primitives (`Konva.Image`, `Konva.Circle`, `Konva.Text`). The `Avatar` component can be used in the `FriendMiniCard.tsx` (which is a DOM overlay).
- **Do NOT hard-code friend data.** Always fetch from the API. The positions endpoint returns `total_distance` in km — the client handles all interpolation.
- **ESC key handling must be coordinated.** When a friend mini-card is open, ESC closes it. When a waypoint popup is open, ESC closes it. They should not interfere — close the topmost overlay first.

### Distance Conversion Reference

The map uses **miles** internally for path interpolation, but all APIs return **km**:
- `KM_TO_MILES = 0.621371` (defined in MapIsland.tsx)
- `MILES_TO_KM = 1.60934` (defined in MapIsland.tsx)
- When calling `getUserPosition(fellowshipPath, distance)`, `distance` must be in **miles**.
- When displaying distance in the mini-card, show **km** (the native unit from the API).

### Konva Layer Ordering (After This Story)

| # | Layer | Contents | listening |
|---|---|---|---|
| 1 | `layerRef` | Map tiles | yes (drag) |
| 2 | `pathLayerRef` | Journey path lines + member paths | false |
| 3 | **`friendMarkerLayerRef`** | **Friend avatar markers (NEW)** | **yes** |
| 4 | `markerLayerRef` | User position marker + waypoint markers | yes |

HTML overlays (DOM, rendered above all Konva layers):
- `.map-controls` — zoom/recenter/social toggle buttons
- `.map-social-panel` — social panel (replaces `.map-party-panel`)
- `FriendMiniCard` — friend detail mini-card (NEW)
- `WaypointPopupContainer` — waypoint popup/sheet
- `MapLegend` — party color legend
- `MapWalkIsland` — FAB + modals

### API Contract: `GET /api/friends/positions`

**Request:** `GET /api/friends/positions` with `Authorization: Bearer <sessionToken>` header.

**Response (200):**
```json
{
  "friends": [
    {
      "user_id": 42,
      "username": "samwise",
      "avatar_id": "samwise",
      "total_distance": 245.5
    },
    {
      "user_id": 99,
      "username": "frodo",
      "avatar_id": null,
      "total_distance": 180.2
    }
  ]
}
```

**Response (401):** `{ "error": "Unauthorized" }` — no valid session.

### Project Structure Notes

- New backend handler: `handleFriendPositions` in `src/friend-handlers.ts` (created by Story 6.2) — aligns with existing handler file pattern.
- New Konva module: `client/src/components/map/FriendMarkers.ts` — follows `UserMarker.ts` and `WaypointMarkers.ts` pattern.
- New Preact component: `client/src/components/map/FriendMiniCard.tsx` — follows `WaypointPopup.tsx` pattern.
- CSS updates: `public/css/main.css` (panel styles) and `public/css/map.css` (panel positioning) — replaces existing party panel classes.
- No new islands needed — all friend map logic lives inside `MapIsland.tsx`.
- No new SSR renderers or page routes needed — the map page already exists.
- No new migrations needed — `friendships` table and `avatar_id` column are created by Stories 6.1 and 6.2.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.6] — Epic acceptance criteria
- [Source: client/src/islands/MapIsland.tsx] — Main map island (party panel, Konva init, layer creation)
- [Source: client/src/components/map/UserMarker.ts] — User position marker (pattern for friend markers)
- [Source: client/src/components/map/WaypointMarkers.ts] — Waypoint markers (click handler, clustering pattern)
- [Source: client/src/components/map/WaypointPopupContainer.tsx] — Popup controller (ESC handler, click-outside pattern)
- [Source: client/src/components/map/WaypointPopup.tsx] — Desktop popup (positioning, styling pattern)
- [Source: client/src/utils/map-utils.ts] — getUserPosition, calculateCutoffPoint, dynamicStrokeWidth, markerScale
- [Source: client/src/utils/map-popup-utils.ts] — getScreenPosition, getOptimalPopupPosition, calculatePanOffset
- [Source: client/src/stores/mapStore.ts] — Map signals (userProgress, visibleMilestones viewport culling)
- [Source: client/src/stores/partyStore.ts] — Party signals (selectedView, localStorage persistence pattern)
- [Source: public/css/main.css#L324-L365] — Party panel styles (to replace with Social panel)
- [Source: public/css/map.css#L78-L140] — Party toggle + panel positioning (to replace)
- [Source: docs/api-reference.md#Friends] — GET /api/friends/positions contract
- [Source: docs/architecture.md] — Map stack, Konva layers, friend route topology
- [Source: docs/frontend-guide.md] — Island patterns, SocialPanelIsland docs, Avatar component
- [Source: docs/ux-design.md#Section 10] — Map Social Panel UX observations
- [Source: docs/data-models.md] — friendships table, users.avatar_id, progress table

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (GitHub Copilot)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created

### File List
