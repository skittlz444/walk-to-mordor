# Story 8.1: Unified Preact Signal Global Store

Status: ready-for-dev

## Story

As a user,
I want the app to manage state consistently across all pages,
so that my session, progress, and fellowship data are always in sync without stale state bugs.

## Acceptance Criteria

1. **Given** state is currently scattered across `mapStore.ts`, `partyStore.ts`, `localStorage`, and bridge globals
   **When** `appStore.ts` is created in `client/src/stores/`
   **Then** it provides computed signals for: session data (userId, username, avatarId, preferences), user progress (totalDistance, currentMilestone), and active party context

2. **Given** the app loads any authenticated page
   **When** `appStore.ts` initializes
   **Then** it hydrates from a single `/api/session` response on page load (not multiple calls)

3. **Given** existing stores (`mapStore.ts`, `partyStore.ts`) duplicate session state
   **When** they integrate with `appStore`
   **Then** they read session-derived data (userId, avatarId, showFutureGoalsUnlocked) from `appStore` signals rather than fetching `/api/session` independently

4. **Given** islands that currently call `/api/session` directly (MapIsland, PartyJoinIsland, FriendAddIsland)
   **When** they migrate to read from `appStore` signals
   **Then** they no longer make their own `/api/session` requests

5. **Given** legacy JS depends on `window.userPreferences` and `body.authenticated`
   **When** `appStore` initializes
   **Then** bridge globals (`window.userPreferences`, `window.partyStore`) continue to work — `appStore` keeps `window.userPreferences` in sync via effect

6. **Given** the store is created
   **When** all existing backend (Jest) and client (Vitest) tests run
   **Then** all pass with no regressions

7. **Given** new `appStore` code
   **When** unit tests are written
   **Then** they cover initialization, signal reactivity, error states, and bridge global sync with >90% coverage

## Tasks / Subtasks

- [ ] Task 1: Create `appStore.ts` with session, progress, and preference signals (AC: #1, #2)
  - [ ] 1.1 Define `SessionState` interface in `client/src/types/session.ts`
  - [ ] 1.2 Create `client/src/stores/appStore.ts` with core signals
  - [ ] 1.3 Implement `initializeAppStore()` — single `/api/session` fetch → hydrate all signals
  - [ ] 1.4 Add bridge global sync: effect that writes `window.userPreferences` when preference signals change
  - [ ] 1.5 Export `isAuthenticated` computed, `sessionToken` signal (reads from `localStorage`)
- [ ] Task 2: Integrate `mapStore` with `appStore` (AC: #3)
  - [ ] 2.1 Remove `/api/session` fetch from `initializeMap()` — read `showFutureGoalsUnlocked` from `appStore`
  - [ ] 2.2 Remove duplicate `/api/session` fetch from `MapIsland.tsx` Konva init — read `avatarId` from `appStore`
  - [ ] 2.3 `mapStore.showFutureGoalsUnlocked` becomes a computed that reads from `appStore.preferences`
- [ ] Task 3: Integrate `partyStore` with `appStore` (AC: #3)
  - [ ] 3.1 If `partyStore` accesses session data, delegate to `appStore` signals
- [ ] Task 4: Migrate islands off direct `/api/session` calls (AC: #4)
  - [ ] 4.1 `MapIsland.tsx` — remove session fetch, read from `appStore`
  - [ ] 4.2 `PartyJoinIsland.tsx` — replace `checkAuth()` with `appStore.isAuthenticated`
  - [ ] 4.3 `FriendAddIsland.tsx` — replace `checkAuth()` with `appStore.isAuthenticated`
  - [ ] 4.4 Create shared `getAuthHeaders()` utility in `client/src/utils/auth.ts` that reads `appStore.sessionToken`
  - [ ] 4.5 Migrate islands that inline `localStorage.getItem('sessionToken')` to use the shared utility
- [ ] Task 5: Ensure bridge globals and legacy interop (AC: #5)
  - [ ] 5.1 `window.userPreferences` stays in sync via Preact `effect()` in `appStore`
  - [ ] 5.2 `window.partyStore` bridge continues to work (no change needed — it's already exposed from `index.tsx`)
  - [ ] 5.3 `preferenceChanged` CustomEvent still dispatched when preferences change (for MapIsland listener)
  - [ ] 5.4 Verify `body.authenticated` class still set by `main.js` (no change — `main.js` is untouched)
- [ ] Task 6: Write unit tests for `appStore` (AC: #6, #7)
  - [ ] 6.1 `client/src/stores/appStore.test.ts` — initialization, signal reactivity, error states
  - [ ] 6.2 Test bridge global sync (`window.userPreferences` updated when signals change)
  - [ ] 6.3 Test `isAuthenticated` computed from sessionToken
  - [ ] 6.4 Update existing `mapStore.test.ts` for integration changes
  - [ ] 6.5 Update existing `partyStore.test.ts` for integration changes
- [ ] Task 7: Run full test suites and verify no regressions (AC: #6)
  - [ ] 7.1 `npx jest --no-cache` — all 28 backend suites pass
  - [ ] 7.2 `cd client && npx vitest run` — all client suites pass

## Dev Notes

### Problem Statement

The app currently has **up to 4 redundant `/api/session` calls** on the map page:
1. `main.js` → `checkAuth()` (line 23)
2. `main.js` → preferences block (line 88) — second `/api/session` fetch
3. `mapStore.initializeMap()` → fetches `/api/session` for `showFutureGoalsUnlocked`
4. `MapIsland.tsx` → Konva init fetches `/api/session` for `avatarId`

Additionally, there are **two parallel preference systems** that can drift:
- `window.userPreferences` (vanilla JS mutable object)
- `mapStore.showFutureGoalsUnlocked` (Preact signal)

These are loosely coupled via `preferenceChanged` CustomEvent.

### Architecture Approach

**Consolidate, don't replace.** `appStore` becomes the single session truth for the Preact layer. Existing `mapStore` and `partyStore` remain as domain-specific slices that compose with `appStore`.

```
appStore.ts (session truth)
├── signals: userId, username, avatarId, isAdmin, preferences, totalDistance
├── computed: isAuthenticated, currentMilestone
├── init: single /api/session fetch
└── bridge: effect → window.userPreferences sync

mapStore.ts (map domain)
├── signals: mapViewState, viewportSize, loadingState, milestones
├── computed: currentPosition, visibleMilestones
└── reads: showFutureGoalsUnlocked from appStore (not own signal)

partyStore.ts (fellowship domain)
├── signals: userParties, selectedView, partyProgress
└── unchanged: selectedView still persists to localStorage
```

### Critical Constraints

1. **DO NOT modify `public/js/main.js`** — legacy bootstrap must remain untouched. `main.js` will continue its own `/api/session` calls and set `body.authenticated`. The Preact layer's `appStore` operates in parallel. Deduplicating `main.js` session calls is out of scope.

2. **`window.userPreferences` must stay in sync** — `goals.js` reads `window.userPreferences.showFutureGoalsUnlocked` on re-render (lines 190-199, 216-218, 407-412). The `appStore` must write to this global via an `effect()` whenever preference signals change.

3. **`window.partyStore` bridge is already handled** — `client/src/index.tsx` exposes the full `partyStore` namespace. No changes needed.

4. **`preferenceChanged` CustomEvent** — `MapIsland` listens for this event (dispatched by ProfileIsland after preference save). The event flow must continue to work. `appStore` should also listen for this event to update its own signals.

5. **`partyStore.selectedView` initializes eagerly from localStorage** at module load time. This is fine — it doesn't depend on session data.

6. **Token management stays in `localStorage`** — `sessionToken` is written by `AuthForms` island and read by many islands. `appStore` should provide a signal wrapper around `localStorage.getItem('sessionToken')` but NOT move the storage mechanism.

### Existing Patterns to Follow

- **Signal declaration style**: See `mapStore.ts` — module-level `signal()` + `computed()` with JSDoc, exported action functions (not classes).
- **Test style**: See `mapStore.test.ts` / `partyStore.test.ts` — happy-dom environment, Vitest, mock `fetch` via `vi.fn()`, test signal reactivity.
- **Type files**: Types go in `client/src/types/` — create `session.ts` for session-related interfaces.
- **No `any`**: TypeScript strict mode. Define interfaces for the `/api/session` response shape.

### `/api/session` Response Shape

The `/api/session` endpoint returns (camelCase):
```typescript
interface SessionResponse {
  userId: number;
  username: string;
  avatarId: string | null;
  isAdmin: boolean;
  showFutureGoalsUnlocked: boolean;
  defaultViewMap: boolean;
}
```

### Islands That Need Migration

| Island | Current behavior | After migration |
|---|---|---|
| `MapIsland.tsx` | Fetches `/api/session` for `showFutureGoalsUnlocked` + `avatarId` | Read from `appStore.preferences` and `appStore.avatarId` |
| `PartyJoinIsland.tsx` | `checkAuth()` calls `/api/session` | Read `appStore.isAuthenticated` |
| `FriendAddIsland.tsx` | `checkAuth()` calls `/api/session` | Read `appStore.isAuthenticated` |
| `PartyManageIsland` | Inline `localStorage.getItem('sessionToken')` | Use shared `getAuthHeaders()` from `client/src/utils/auth.ts` |
| `PartyListIsland` | Inline `localStorage.getItem('sessionToken')` | Use shared `getAuthHeaders()` |
| `PartyDetailIsland` | Inline `localStorage.getItem('sessionToken')` | Use shared `getAuthHeaders()` |
| `FriendsListIsland` | Inline `localStorage.getItem('sessionToken')` | Use shared `getAuthHeaders()` |
| `FriendProfileIsland` | Inline `localStorage.getItem('sessionToken')` | Use shared `getAuthHeaders()` |

### What NOT to Change

- `public/js/main.js` — leave legacy bootstrap untouched
- `public/js/goals.js` — continues reading `window.userPreferences` (no Preact changes)
- `public/js/progress.js` — continues mounting DistanceModal via bridge globals
- `partyStore.selectedView` localStorage persistence — keep as-is
- `mapStore` localStorage caching for milestones and map state — keep as-is
- Service Worker (`public/sw.js`) — not part of this story

### Project Structure Notes

- New files: `client/src/stores/appStore.ts`, `client/src/stores/appStore.test.ts`, `client/src/types/session.ts`, `client/src/utils/auth.ts`
- Modified files: `client/src/stores/mapStore.ts`, `client/src/stores/mapStore.test.ts`, `client/src/islands/MapIsland.tsx`, `client/src/islands/PartyJoinIsland.tsx`, `client/src/islands/FriendAddIsland.tsx`, plus islands listed above for `getAuthHeaders` migration
- No backend changes — this is a client-only refactor
- No migration files — no database changes
- No new CSS — no visual changes

### Testing Strategy

- **Unit tests (Vitest, happy-dom)**: `appStore.test.ts` — mock `fetch`, test signal initialization from session response, test error handling (401 → unauthenticated state), test bridge global sync, test `isAuthenticated` computed.
- **Integration**: Update `mapStore.test.ts` to verify it reads `showFutureGoalsUnlocked` from `appStore` rather than fetching `/api/session`.
- **Regression**: Full suite runs (`npx jest --no-cache` + `cd client && npx vitest run`) must pass.
- **No E2E changes expected** — behavior is identical from user perspective. Run `npm run test:ui -- --run` if time permits.

### References

- [Source: docs/architecture.md — Key Architectural Patterns > SSR Shell + Islands]
- [Source: docs/architecture.md — Key Architectural Patterns > Hydration Signals]
- [Source: docs/frontend-guide.md — State Management]
- [Source: _bmad-output/planning-artifacts/epics-phases-4-15.md — Epic 8 Story 8.1]
- [Source: client/src/stores/mapStore.ts — signal patterns and initializeMap()]
- [Source: client/src/stores/partyStore.ts — signal patterns and localStorage persistence]
- [Source: client/src/index.tsx — bridge globals (window.preact, window.preactIslands, window.partyStore)]
- [Source: public/js/main.js — legacy session bootstrap and window.userPreferences]
- [Source: public/js/goals.js — window.userPreferences.showFutureGoalsUnlocked consumption]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
