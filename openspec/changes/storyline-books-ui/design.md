## Context

`storyline-books-core` has shipped. The session response now includes `activeBook`, the total-distance response includes book context, goals return absolute distances with `bookMetadata`, and switch endpoints accept `{ bookId, mode: 'reset' | 'carry' }`. All backend book infrastructure is live.

This change wires that data into the user-facing surfaces. It updates existing Preact islands and legacy JavaScript without rewriting working code — following the "Islands Rule" from the project guidelines.

The surfaces affected:
- **Profile page**: `ProfileIsland` already handles storyline switching. Book switching extends this pattern.
- **Party management**: `PartyManageIsland` already handles party storyline switching. Book switching mirrors it.
- **Journey page**: Legacy `public/js/main.js` and `public/js/goals.js` drive the journey view. Book-aware changes are additive.
- **Map page**: Konva.js milestone markers and social markers need book-aware filtering.

## Goals / Non-Goals

**Goals:**
- Let new users select a starting book during onboarding storyline setup.
- Show active book on profile and party management alongside storyline.
- Provide book switching with reset and carry actions, with disabled carry explanations.
- Add a view mode toggle (whole-story vs current-book) to the journey page.
- Persist view mode using the same scope as the current personal/fellowship view selection.
- Update journey total-distance display for book-relative distances.
- Pass `viewMode=book` to the goals API in current-book view.
- Filter map milestones to the active book in current-book view.
- Keep friend and fellowship markers globally visible with storyline context in labels.

**Non-Goals:**
- No changes to the map rendering engine or Konva version.
- No rewriting of the legacy goals list into Preact.
- No changes to admin surfaces (in `storyline-books-admin`).
- No changes to backend APIs or D1 schema.

## Decisions

### Book switching reuses the storyline switch UI patterns

`ProfileIsland` and `PartyManageIsland` already have storyline selector dropdowns with switch logic. Book selection extends this by adding a second dropdown alongside the storyline selector. When the user selects a different book, the switch endpoint `PUT /api/user/book` (or `PUT /api/party/:id/book`) is called with `{ bookId, mode }`.

The UI shows available modes: "Reset" (start fresh from the book's beginning), "Carry" (bring current progress forward), or "Carry Not Available" (greyed out with hover explanation when progress exceeds target book length).

Rationale: reuses tested UI patterns and avoids creating a separate book management page.

### View mode persisted in localStorage via Preact Signal

The current-book vs whole-story toggle uses a Preact `signal` persisted to `localStorage`, following the same pattern as `partyStore.selectedView`. The `PartySelector` island already demonstrates this: Preact Signals drive reactive distance display on the journey page, with persistence via `localStorage`. The book view mode follows the same convention.

A small `BookViewToggle` Preact island (or component mounted programmatically) reads/writes `window._bookViewMode` and exposes it as a signal. Legacy code in `public/js/progress.js` reads the flag from `window._bookViewMode` to decide which distance to display.

Rationale: the restructuring plan explicitly says "same persistence scope as the current personal/fellowship view selection." The party store already uses localStorage + Preact Signals. Mirroring this avoids inventing a new pattern.

### Journey distance display switches based on view mode

In `public/js/progress.js`, `fetchAndUpdateTotalDistance` already stores `window._personalDistance = data.totalDistance`. With book context now available in the `/api/total-distance` response (`data.activeBook`), the function also stores `window._activeBook = data.activeBook`.

When updating the DOM element `#total-distance-value`, the code checks `window._bookViewMode === 'book'`:
- Book mode: display `data.activeBook.bookProgress` km
- Story mode: display `data.totalDistance` km (unchanged)

The distance passed to `renderGoals()` also branches: book mode passes `data.activeBook.bookProgress`, story mode passes `data.totalDistance`. This ensures goal completion logic uses the correct reference distance.

Rationale: minimal change to existing legacy code. One flag check in the distance rendering path covers both display and goals integration.

### Goals include book boundary metadata; UI computes relative distances

The goals API (`GET /api/goals`) always returns all storyline goals with absolute story distances — no `viewMode` parameter needed. When an active book exists, the response also includes `bookMetadata: { bookStartDistance, bookEndDistance }`. The UI computes book-relative distances for display: `goal.distance - bookStartDistance`.

In book view mode, the UI filters goals to the book's range (`goal.distance >= bookStartDistance && goal.distance <= bookEndDistance`). In story view mode, all goals are shown. Both views use the same fetched data — toggling does not re-fetch.

Rationale: single fetch supports both view modes. The book boundary metadata also enables map rendering (showing only the current book's line segment and goals). This avoids extra API calls when toggling views.

### BookSelector receives available books from the storyline list

The `/api/storylines` endpoint (already extended by `storyline-books-core` task 3.1) includes a `books` array per storyline: `[{ bookId, slug, title, startDistance, endDistance }]`. `BookSelector` reads this from the storyline list response, not from the session.

The session's `activeBook` field provides the currently active book and progress. The storyline list provides the full book catalog for the dropdown.

Rationale: the storyline list is already fetched by profile and party management for the storyline selector dropdown. Adding books there is natural — it's the same data they already consume.

### Map milestone cache keys include book and view mode

The map's milestone loading uses cache keys to avoid redundant fetches. In `storyline-books-core`, map milestones already filter by storyline. This change extends the cache keys to include `activeBookId` and `viewMode` so switching between books and view modes correctly invalidates the milestone cache.

Rationale: stale cache data would show wrong-book milestones. Including book context in the key prevents this.

### Friend and fellowship markers use whole-story distance with storyline label

Friend and fellowship markers ignore the viewer's book — they always show the companion's position using whole-story distance. The marker label format becomes `"634 km as Pippin"` (distance + storyline slug). The storyline context helps differentiate companions on different routes.

Rationale: hiding fellow walkers because the viewer is in a different book would make the world feel less alive. The restructuring plan explicitly calls this out as a non-goal to hide markers.

## Risks / Trade-offs

- [Legacy goals.js changes could break the journey page] → Keep changes minimal: goals API always returns all data with `bookMetadata`. Client-side filtering and relative-distance math are isolated additions to the rendering pipeline.
- [Map cache key expansion could cause more cache misses] → Cache invalidation on book switch is intentional — wrong-book data is worse than a brief re-fetch.
- [View mode toggle could confuse users] → Default to whole-story view on first load. Users opt into book view explicitly.

## Migration Plan

1. Add `BookSelector` component to `ProfileIsland` and `PartyManageIsland`.
2. Add view mode toggle to the journey page header.
3. Update goals.js to compute book-relative distances and filter by book range using `bookMetadata`.
4. Update map milestone loading with book-aware cache keys and client-side range filtering.
5. Update friend/fellowship marker labels with storyline context.
6. Add TypeScript types for `ActiveBook` in `client/src/types/session.ts`.
7. Add Vitest coverage.

Rollback: revert to whole-story view (default). Book-aware API fields sit unused but don't break anything.

## Open Questions

None.
