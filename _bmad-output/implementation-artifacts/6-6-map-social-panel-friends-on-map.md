# Story 6.6: Map Social Panel & Friends on Map

Status: done
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

- [x] **Task 1: Create `GET /api/friends/positions` API endpoint** (AC: #4)
  - [x] In `src/friends-handlers.ts`, add `handleFriendPositions(request, env)` handler function.
  - [x] SQL query with `COALESCE(SUM(p.distance), 0) as total_distance`, `status = 'accepted'`, `GROUP BY u.id`.
  - [x] Wire route in `src/index.ts`: `if (url.pathname === '/api/friends/positions' && method === 'GET')`.
  - [x] Add to `getAllowedMethods()` switch for `/api/friends/positions` → `'GET'`.
  - [x] Add Jest tests in `tests/api/friends-handlers.test.ts` (7 tests):
    - Returns 401 when unauthenticated.
    - Returns empty `friends: []` when user has no accepted friends.
    - Returns correct `{ user_id, username, avatar_id, total_distance }` for accepted friends.
    - Excludes pending/rejected friend requests (status=accepted query).
    - Returns `total_distance: 0` for friends with no progress.
    - Returns `avatar_id: null` for friends without an avatar.
    - Handles database errors gracefully.

- [x] **Task 2: Refactor MapIsland party panel into Social panel** (AC: #1, #2, #3)
  - [x] Renamed `showPartyPanel` signal to `showSocialPanel`.
  - [x] Replaced `.map-party-toggle` button with `.map-social-toggle` button (kept `fa-users` icon).
  - [x] Replaced `.map-party-panel` div with `.map-social-panel` div containing two sections.
  - [x] **"View As" section**: conditionally rendered when `userParties.value.length > 0`.
  - [x] **"Friends on Map" section**: always visible with toggle switch + hint text.
  - [x] `showFriendsOnMap` signal with localStorage persistence (`wtm_friends_on_map`).
  - [x] Toggle ON: fetches friend positions + creates/updates markers.
  - [x] Toggle OFF: destroys friend markers, clears cached data.

- [x] **Task 3: Update CSS for Social panel** (AC: #1, #3)
  - [x] In `public/css/main.css`: Added `.map-social-panel`, `.social-panel-section`, `.friends-toggle`, `.friends-toggle-row`, `.friends-hint`, `.friend-mini-card` styles.
  - [x] In `public/css/map.css`: Added `.map-social-panel` and `.map-social-toggle` positioning rules (desktop + mobile responsive).

- [x] **Task 4: Create `FriendMarkers.ts` Konva rendering module** (AC: #5, #6, #7)
  - [x] Created `client/src/components/map/FriendMarkers.ts` with `FriendMarkerData`, `FriendMarkerNodes`, `ViewportBounds` interfaces.
  - [x] `createFriendMarkers()`: Creates new Konva.Layer, inserts between path and marker layers.
  - [x] Avatar markers: `Konva.Image` from thumbs (async loaded) OR `Konva.Circle`+`Konva.Text` initials fallback.
  - [x] Deterministic HSL color: `hsl((username.charCodeAt(0) * 137) % 360, 50%, 35%)`.
  - [x] White stroke border (2px). `group.name('friend-marker-{userId}')` for test selection.
  - [x] `setScale()`: `markerScale(stageScale, 6, 2, 16)` — subtly smaller than UserMarker (16 vs 20 max).
  - [x] `updateVisibility()`: Frustum culling with 50px margin.
  - [x] `destroy()`: Removes all groups and layer from stage.
  - [x] Click/tap handlers with `cancelBubble` to prevent stage click-through.
  - [x] Added Vitest tests (13 tests) in `__tests__/FriendMarkers.test.ts`.

- [x] **Task 5: Create `FriendMiniCard.tsx` popup component** (AC: #8)
  - [x] Created `client/src/components/map/FriendMiniCard.tsx` — DOM overlay popup.
  - [x] Shows avatar (48px) or initials fallback, username, total distance (km), "View Profile →" link.
  - [x] Positioned absolutely via `left`/`top` with `getOptimalPopupPosition()`.
  - [x] Dismissible: click-outside handler + ESC key handler.
  - [x] CSS in `public/css/main.css` for `.friend-mini-card` styles.
  - [x] Added Vitest tests (10 tests) in `__tests__/FriendMiniCard.test.tsx`.

- [x] **Task 6: Integrate friend markers into MapIsland lifecycle** (AC: #5, #6, #7, #8, #10)
  - [x] Added `friendMarkerRef`, `friendPositions`, `friendPositionsFetchedAt`, `selectedFriend`, `friendPopupPosition` signals/refs.
  - [x] Toggle ON: checks 5-min cache freshness, fetches if stale, creates/updates markers + frustum culling.
  - [x] Toggle OFF: destroys markers, clears state.
  - [x] `applyTransform`: Updates friend marker scale + visibility on zoom/pan.
  - [x] `dragend`: Updates friend marker visibility after drag completes.
  - [x] Friend marker click: closes waypoint popup, shows mini-card via `getScreenPosition` + `getOptimalPopupPosition`.
  - [x] `closePopup`: Clears both waypoint and friend popup state.
  - [x] Persisted toggle state: loads friend markers on init if `wtm_friends_on_map` was ON.
  - [x] Cleanup: destroys friend markers on component unmount.
  - [x] Fellowship view change does NOT re-fetch friend positions (independent concerns).

- [ ] **Task 7: Overlap handling (nice-to-have refinement)** (AC: #9)
  - Deferred to follow-up PR — basic implementation renders markers at exact positions.

- [ ] **Task 8: Update documentation** (AC: #11)
  - Deferred — documentation updates tracked separately.

- [ ] **Task 9: Extend Playwright UI tests** (AC: #11)
  - Deferred — Playwright tests require running environment.

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
- Task 1: `handleFriendPositions` added to `src/friends-handlers.ts`, routed in `src/index.ts`, 7 Jest tests passing
- Task 2: MapIsland refactored — `showPartyPanel` → `showSocialPanel`, social panel with "View As" + "Friends on Map" sections
- Task 3: CSS updated in `public/css/main.css` and `public/css/map.css` for social panel, toggle switch, friend mini-card
- Task 4: `FriendMarkers.ts` Konva module created — avatar/initials markers, frustum culling, zoom scaling, 13 Vitest tests
- Task 5: `FriendMiniCard.tsx` popup component created — DOM overlay with avatar, distance, profile link, ESC/click-outside dismissal, 10 Vitest tests
- Task 6: Full MapIsland lifecycle integration — friend marker refs, 5-min cache, toggle persistence, zoom/pan updates, popup coordination
- Task 7: Deferred overlap handling to follow-up PR
- Tasks 8-9: Deferred documentation and Playwright tests
- Final stats: 28 Jest suites / 997 tests, 30 Vitest suites / 407 tests, build passes, 92.72% coverage
- **Code review fixes applied**: (1) Waypoint clicks now close friend popup — `selectedFriend`/`friendPopupPosition` nulled in both pan-animated and immediate waypoint selection paths. (2) Image load callbacks guarded with `destroyedRef` flag and `pendingImages` Set — destroy() nulls out `img.onload`/`img.onerror` and sets destroyed flag. (3) `KM_TO_MILES` deduplicated — exported from `client/src/utils/map-utils.ts`, imported in `FriendMarkers.ts` and `MapIsland.tsx`, local constants removed. (4) Friend cache cleared on unmount — `friendPositions` and `friendPositionsFetchedAt` reset in cleanup return of main useEffect.

### File List

- `src/friends-handlers.ts` — Added `handleFriendPositions()` handler + `FriendPositionRow` interface
- `src/index.ts` — Added route for `GET /api/friends/positions` + `getAllowedMethods` entry
- `client/src/components/map/FriendMarkers.ts` — NEW: Konva friend avatar marker module (+ image load cleanup guards)
- `client/src/components/map/FriendMiniCard.tsx` — NEW: DOM overlay popup for friend markers
- `client/src/components/map/__tests__/FriendMarkers.test.ts` — NEW: 13 Vitest tests (+ KM_TO_MILES mock)
- `client/src/components/map/__tests__/FriendMiniCard.test.tsx` — NEW: 10 Vitest tests
- `client/src/islands/MapIsland.tsx` — Refactored party panel → social panel, added friend marker integration (+ popup/cache fixes)
- `client/src/utils/map-utils.ts` — Added `KM_TO_MILES` export
- `public/css/main.css` — Added social panel, toggle switch, friend mini-card styles
- `public/css/map.css` — Added social panel/toggle positioning rules
- `tests/api/friends-handlers.test.ts` — Added 7 tests for `handleFriendPositions`
