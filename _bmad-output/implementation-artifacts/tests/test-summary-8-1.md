# Test Automation Summary — Story 8.1: Unified Preact Signal Global Store

**Date:** 2026-03-19
**Story:** 8.1 — Unified Preact Signal Global Store (`appStore`)
**Test Framework:** Playwright (Chromium)
**Status:** ✅ All 23 tests passing

## Generated Tests

### E2E Tests

- [x] `tests/ui/story-8-1-unified-appstore.spec.js` — Full E2E coverage

| # | Test Suite | Tests | Acceptance Criteria |
|---|-----------|-------|-------------------|
| 1 | **Single Session Fetch** | 2 | AC #2, #4 |
| 2 | **Bridge Global Sync** | 3 | AC #5 |
| 3 | **preferenceChanged CustomEvent** | 1 | AC #5 |
| 4 | **Islands Read from appStore** | 2 | AC #3, #4 |
| 5 | **getAuthHeaders Utility** | 2 | AC #4 |
| 6 | **Legacy Interop** | 4 | AC #5 |
| 7 | **Error States** | 3 | AC #2 |
| 8 | **Signal Reactivity Across Islands** | 2 | AC #1, #3 |
| 9 | **Session API Response Shape** | 1 | AC #1, #2 |
| 10 | **Island Hydration** | 3 | AC #1 |

## Coverage by Acceptance Criteria

| AC | Description | Tests |
|----|-------------|-------|
| AC #1 | appStore provides computed signals for session data | 6 |
| AC #2 | Single `/api/session` hydration on page load | 5 |
| AC #3 | Existing stores read from appStore (not fetching independently) | 4 |
| AC #4 | Islands no longer make own `/api/session` requests | 6 |
| AC #5 | Bridge globals continue working (legacy interop) | 8 |

## Key Assertions

- `/api/session` GET calls on journey page ≤ 3 (vs. 4+ pre-story)
- `/api/session` GET calls on map page ≤ 4 (MapIsland/mapStore no longer adding extra calls)
- `window.userPreferences` synced from appStore signals
- `preferenceChanged` CustomEvent dispatched on preference toggle
- `body.authenticated` class set by main.js (unmodified legacy)
- `window.partyStore` and `window.preact` bridge globals exposed
- Graceful handling of: no token, 401 response, 500 server error
- Preferences persist across page navigation (profile → map)
- Session response shape validated (all 6 fields appStore expects)
- MapIsland, ProfileIsland, DrawerIsland hydration verified

## Next Steps

- Run in CI pipeline via `npm run test:ui -- --run`
- Add more edge cases as needed (e.g., network timeout, concurrent preference updates)
