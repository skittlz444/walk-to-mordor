# Story 2.10: User Goal Visibility Preference

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user tracking my journey to Mordor**,
I want **to choose whether future goals appear locked or unlocked based on my motivation style**,
so that **I can either preview upcoming milestones for anticipation OR be surprised as I reach them**.

## Acceptance Criteria

1. **Database Schema**
   - [ ] Add `show_future_goals_unlocked` INTEGER column to `users` table.
    - [ ] Column default: `1` (TRUE = future goals unlocked, which becomes the new global default once this story ships).
   - [ ] Create migration file following naming convention: `0117_add_goal_visibility_preference.sql`.

2. **API Endpoints**
   - [ ] `GET /api/session` returns `showFutureGoalsUnlocked` boolean in response.
   - [ ] `PUT /api/user/preferences` endpoint to update `show_future_goals_unlocked` column.
   - [ ] Request body: `{ showFutureGoalsUnlocked: boolean }`.
   - [ ] Returns 200 with updated preference on success.
   - [ ] Returns 401 if not authenticated.
   - [ ] Returns 400 for invalid input.

3. **Profile Modal Toggle**
   - [ ] Add toggle switch in Profile Settings modal with label: "Preview all milestones".
    - [ ] Toggle ON (default): Future goals (distance > user totalDistance) display as unlocked/visible.
    - [ ] Toggle OFF: Future goals display with the locked treatment from Story 2.5 (for users who want surprises).
   - [ ] Toggle persists immediately to database via API call.
   - [ ] Show loading state during save, error handling on failure.

4. **Map Waypoint Integration**
   - [ ] `mapStore.ts` includes `showFutureGoalsUnlocked` signal.
   - [ ] Load preference on map initialization from session or dedicated API.
    - [ ] When preference ON (default): All waypoints render as unlocked (gold color, interactive).
    - [ ] When preference OFF: Future waypoints render with locked styling (gray, opacity 0.4, non-interactive) to mimic Story 2.5's experience.
   - [ ] **Next waypoint special styling**: Always locked but with distinct "target" styling:
     - [ ] Different from regular locked (not just gray/faded).
     - [ ] Use accent color glow or pulsing animation to indicate "your next destination".
     - [ ] Non-interactive (clicking shows "reach this milestone first" or similar).
     - [ ] Visible at all zoom levels (same importance as user marker).

5. **Journey/Dashboard Goals List Integration**
   - [ ] Pass preference to `renderGoals()` function or make globally available.
    - [ ] When preference ON (default): Future goals display fully visible/unlocked.
    - [ ] When preference OFF: Future goals in list display with the locked styling shipped in Story 2.5.
   - [ ] **Next goal special styling**: Always locked but visually prominent:
     - [ ] Different styling from regular locked goals (not just gray).
     - [ ] Show "Next Milestone" badge or indicator.
     - [ ] Display distance remaining prominently.
     - [ ] Use accent border or highlight color.
   - [ ] Completed goals always show normally (strikethrough) regardless of preference.

6. **Session Loading**
   - [ ] Preference loaded with session data on app startup.
   - [ ] Available to both legacy JS (window.userPreferences or similar) and Preact islands.

## Tasks / Subtasks

- [ ] **1. Database Migration (AC: #1)**
    - [ ] Create migration file `migrations/0117_add_goal_visibility_preference.sql`.
    - [ ] Add column: `ALTER TABLE users ADD COLUMN show_future_goals_unlocked INTEGER NOT NULL DEFAULT 1;`
    - [ ] Backfill existing users to `1` so they retain the unlocked default once the migration runs.
    - [ ] Test migration locally with `npx wrangler d1 migrations apply walk-to-mordor --local`.

- [ ] **2. Update Session API (AC: #2, #6)**
    - [ ] Modify `GET /api/session` handler in `src/auth-handlers.ts`.
    - [ ] Include `showFutureGoalsUnlocked: user.show_future_goals_unlocked === 1` in response.
    - [ ] Update TypeScript interface for session response.

- [ ] **3. Create Preferences API Endpoint (AC: #2)**
    - [ ] Add `PUT /api/user/preferences` route in `src/index.ts`.
    - [ ] Create handler function in `src/auth-handlers.ts` or new `src/preferences-handlers.ts`.
    - [ ] Validate input: `showFutureGoalsUnlocked` must be boolean.
    - [ ] Update users table: `UPDATE users SET show_future_goals_unlocked = ? WHERE id = ?`.
    - [ ] Return updated preferences.
    - [ ] Write unit tests for preferences handler.

- [ ] **4. Update Profile Modal UI (AC: #3)**
    - [ ] Add HTML toggle switch to `public/js/profile.js` modal template.
    - [ ] Label: "Preview all milestones" with hint "Reveal future destinations on your journey".
    - [ ] Fetch current preference value when modal opens (from `/api/session`).
    - [ ] Style toggle to match existing modal button styling (dark theme).
    - [ ] On toggle change: Call `PUT /api/user/preferences` immediately.
    - [ ] Show loading indicator during save.
    - [ ] Show error/success feedback.
    - [ ] Emit event or update global state so map/goals can react without page refresh.

- [ ] **5. Map Store Integration (AC: #4)**
    - [ ] Add `showFutureGoalsUnlocked` signal to `client/src/stores/mapStore.ts`.
  - [ ] Initialize from session data on load (default: true = unlocked; fall back to `true` if the session payload is missing the field during rollout).
    - [ ] Export setter function for profile modal to update.
    - [ ] Update `WaypointMarker` component to consume preference.
  - [ ] When preference OFF: Apply locked styling to future waypoints (except next).
    - [ ] Implement "next waypoint" special styling (see AC #4 details).

- [ ] **6. Goals List Integration (AC: #5)**
    - [ ] Modify `renderGoals()` in `public/js/goals.js`.
    - [ ] Accept or read `showFutureGoalsUnlocked` preference.
  - [ ] When OFF: Style future goals with locked appearance.
    - [ ] Implement "next goal" special styling distinct from regular locked.
    - [ ] Use CSS classes: `.goal-locked`, `.goal-next-target`.
    - [ ] Add CSS variables for locked and next-target states in `public/css/main.css`.

- [ ] **7. Global State Bridge (AC: #6)**
    - [ ] Create `window.userPreferences = { showFutureGoalsUnlocked: boolean }` for legacy JS.
  - [ ] Initialize on page load from session data (default: true/unlocked so pages feel consistent with map).
    - [ ] Profile modal updates this when preference changes.
    - [ ] Dispatch custom event `'preferenceChanged'` that goals.js and map can listen to.

- [ ] **8. Testing**
    - [ ] Unit tests for preferences API handler.
    - [ ] Unit tests for session response includes preference.
    - [ ] Playwright test: Toggle preference in profile modal.
    - [ ] Playwright test: Map waypoints change appearance when preference toggled.
    - [ ] Playwright test: Goals list changes appearance when preference toggled.
    - [ ] Playwright test: Next goal has distinct styling from regular locked goals.
    - [ ] Ensure >90% coverage for new code.

- [ ] **9. Documentation**
    - [ ] Update `docs/data-models.md` with new users table column.
    - [ ] Update `docs/api-reference.md` with preferences endpoint.
    - [ ] Update `docs/frontend-guide.md` with preference event handling.

## Dev Notes

### Architecture & Pattern Compliance

- **Migration Pattern**: Follow existing `migrations/00XX_*.sql` naming. Next number is `0117`.
- **Handler Pattern**: API handlers in `src/*-handlers.ts` files. Consider new `preferences-handlers.ts` or extend `auth-handlers.ts`.
- **TypeScript**: Strict mode. Define interfaces for preferences API request/response.
- **State Management**: Preact Signals in `mapStore.ts` for map; global `window.userPreferences` for legacy JS.
- **Default Behavior After This Story**: Unlocked by default (users can toggle ON → locked if they prefer surprises).

### Technical Requirements

#### Database Schema Change

```sql
-- Migration 0117_add_goal_visibility_preference.sql
-- Add user preference for goal visibility style
-- Default 1 = unlocked (new global default once shipped)
-- Value 0 = locked (opt-in surprise mode)

ALTER TABLE users ADD COLUMN show_future_goals_unlocked INTEGER NOT NULL DEFAULT 1;
```

**SQLite Note**: D1/SQLite uses INTEGER for boolean (0 = false, 1 = true).

#### Session Response Enhancement

Current session response (from `/api/session`):
```typescript
interface SessionResponse {
  userId: number;
  username: string;
  email: string;
  // ... existing fields
}
```

Enhanced response:
```typescript
interface SessionResponse {
  userId: number;
  username: string;
  email: string;
  showFutureGoalsUnlocked: boolean;  // NEW - true = default, false = opt-in "surprise" mode
}
```

#### Preferences API Contract

```typescript
// PUT /api/user/preferences
interface UpdatePreferencesRequest {
  showFutureGoalsUnlocked?: boolean;
}

interface UpdatePreferencesResponse {
  showFutureGoalsUnlocked: boolean;
}
```

#### Profile Modal Toggle HTML

```html
<div class="form-group toggle-group">
  <label for="preview-milestones-toggle" class="toggle-label">
    Preview all milestones
    <small class="field-hint">Reveal future destinations on your journey</small>
  </label>
  <label class="toggle-switch">
    <input type="checkbox" id="preview-milestones-toggle" />
    <span class="toggle-slider"></span>
  </label>
</div>
```

#### Toggle Switch CSS

```css
/* Toggle switch styling - add to main.css */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 26px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-surface, #333);
  transition: 0.3s;
  border-radius: 26px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: var(--color-text-muted, #888);
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: var(--color-gold, #FFD700);
}

input:checked + .toggle-slider:before {
  transform: translateX(24px);
  background-color: #fff;
}

/* Locked goal styling */
.goal-locked {
  opacity: 0.4;
  color: var(--color-text-muted, #666) !important;
  pointer-events: none;
}

.goal-locked::before {
  content: "🔒 ";
}

/* Next goal "target" styling - distinct from regular locked */
.goal-next-target {
  opacity: 1;
  border: 2px solid var(--color-gold, #FFD700);
  border-radius: 8px;
  padding: 0.5em;
  background: rgba(255, 215, 0, 0.1);
  position: relative;
}

.goal-next-target::before {
  content: "🎯 Next: ";
  color: var(--color-gold, #FFD700);
  font-weight: bold;
}

.goal-next-target .distance-remaining {
  display: block;
  color: var(--color-gold, #FFD700);
  font-size: 1.1em;
  margin-top: 0.3em;
}
```

#### Map Store Signal

```typescript
// In client/src/stores/mapStore.ts
import { signal } from '@preact/signals';

// Default true = unlocked once this story ships
export const showFutureGoalsUnlocked = signal(true);

export function setShowFutureGoalsUnlocked(value: boolean) {
  showFutureGoalsUnlocked.value = value;
}

// Initialize from session
export function initializeFromSession(session: SessionData) {
  showFutureGoalsUnlocked.value = session.showFutureGoalsUnlocked ?? true;
}
```

#### Waypoint Marker Update

```tsx
// In WaypointMarker component
// Three states: unlocked, next-target, locked
const isUnlocked = milestone.distance <= userDistance;
const isNextTarget = !isUnlocked && milestone.id === nextMilestone?.id;
const isLocked = !isUnlocked && !isNextTarget;

// When preference is ON, treat locked as unlocked (but next-target stays special)
const showAsUnlocked = isUnlocked || (showFutureGoalsUnlocked.value && !isNextTarget);

// Next target always has special styling
if (isNextTarget) {
  return (
    <Circle
      fill="transparent"
      stroke="#FFD700"
      strokeWidth={2 / scale}
      shadowColor="#FFD700"
      shadowBlur={15}
      shadowEnabled={true}
      opacity={0.8}
      listening={false}  // Non-interactive until reached
      // Pulsing animation via Konva tween or CSS
    />
  );
}

// Regular waypoint
<Circle
  fill={showAsUnlocked ? '#FFD700' : '#666666'}
  opacity={showAsUnlocked ? 1 : 0.4}
  listening={showAsUnlocked}
  // ... other props
/>
```

#### Global Preferences Bridge

```javascript
// In page template or init script
window.userPreferences = window.userPreferences || {
  showFutureGoalsUnlocked: true  // Default: unlocked after Story 2.10
};

// Update after session fetch
fetch('/api/session', { headers: getAuthHeaders() })
  .then(res => res.json())
  .then(data => {
    window.userPreferences.showFutureGoalsUnlocked =
      typeof data.showFutureGoalsUnlocked === 'boolean' ? data.showFutureGoalsUnlocked : true;
  });

// Custom event for preference changes
window.dispatchEvent(new CustomEvent('preferenceChanged', {
  detail: { showFutureGoalsUnlocked: newValue }
}));
```

### Project Structure Notes

**Files to Create:**
- `migrations/0117_add_goal_visibility_preference.sql`
- Potentially `src/preferences-handlers.ts` (or extend `auth-handlers.ts`)

**Files to Modify:**
- `src/index.ts` - Add preferences route
- `src/auth-handlers.ts` - Update session response, add preference handler
- `public/js/profile.js` - Add toggle UI and API calls
- `public/css/main.css` - Add toggle, locked, and next-target styling
- `client/src/stores/mapStore.ts` - Add preference signal
- `client/src/components/map/WaypointMarker.tsx` - Consume preference signal, implement next-target styling
- `public/js/goals.js` - Apply locked/next-target styling based on preference
- `docs/data-models.md` - Document new column
- `docs/api-reference.md` - Document preferences endpoint

**Alignment Notes:**
- Default TRUE (unlocked) becomes the new normal once this ships; users can opt back into the locked/"surprise" experience.
- Toggle still provides a single source of truth for both legacy and Preact components.
- Next goal always has special "target" styling regardless of preference.
- Cross-cutting feature requires coordination between legacy JS and Preact islands.

### Dependencies

This story has **no blocking dependencies** - it can be implemented independently.

**Related Stories (informational only):**
- Story 2.5 (Waypoint Markers) - Defines locked/unlocked waypoint styling patterns.
- Story 2.7 (Map State Management) - Defines mapStore pattern.
- Profile modal already exists in legacy JS.

**Why No Dependencies:**
- DB migration is independent.
- API endpoint is additive (doesn't break existing).
- Profile modal enhancement is additive.
- Map/goals integration uses signals and events (decoupled).

### References

- [Source: docs/architecture.md#ADR-003] - Preact Signals for state management.
- [Source: migrations/0020_add_email_confirmation.sql] - Migration pattern for adding columns.
- [Source: public/js/profile.js] - Existing profile modal implementation.
- [Source: _bmad-output/implementation-artifacts/2-5-waypoint-markers.md] - Waypoint locked/unlocked styling.
- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.10] - Original acceptance criteria.
- [Source: client/src/stores/mapStore.ts] - Map state management pattern (if exists from 2.7).
- [Source: public/js/goals.js] - Goals rendering logic.

### Testing Strategy

**Unit Tests (Jest):**
1. Preferences handler validates input correctly.
2. Preferences handler updates database.
3. Session handler includes preference in response.
4. Invalid preference value returns 400.
5. Unauthenticated request returns 401.

**UI Tests (Playwright):**
1. Profile modal displays toggle with correct initial state (ON = unlocked).
2. Toggling preference calls API and shows success feedback.
3. Map waypoints change appearance when preference toggled ON (locked → unlocked).
4. Goals list changes appearance when preference toggled ON.
5. Next goal always shows special "target" styling regardless of preference.
6. Next waypoint on map has glow effect and is distinct from regular locked.
7. Preference persists after page reload.

**Coverage Target:** >90% for all new code.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
