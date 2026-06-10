## 1. Book Selector Component

- [ ] 1.1 Create `client/src/components/BookSelector.tsx`: a Preact component that renders a dropdown of available books for a storyline, shows the currently active book, and provides reset/carry mode selection with disabled carry explanations. Accepts props for `books`, `activeBook`, `onSwitch`, and `isLoading`.
- [ ] 1.2 Implement the switch mode display: show "Reset" and "Carry" options. When carry would result in progress >= target book length, show "Carry — Not Available" with a hover tooltip explaining why.

## 2. Profile and Onboarding

- [ ] 2.1 Update `ProfileIsland`'s session data interface to include `activeBook` from the session response. Import `BookSelector`. Fetch available books from `GET /api/storylines` which now includes a `books` array per storyline via `storyline-books-core` task 3.1.
- [ ] 2.2 Render `BookSelector` below the storyline selector in `ProfileIsland`. On switch, call `PUT /api/user/book` with `{ bookId, mode }`. Handle loading, error, and disabled carry states.
- [ ] 2.3 Add starting book selection to the onboarding/registration flow (if a standalone component exists, or inline in `ProfileIsland`). Default to the first book.

## 3. Party Management

- [ ] 3.1 Update `PartyManageIsland` to include `activeBook` from the party's session data. Fetch available books for the party's storyline.
- [ ] 3.2 Render `BookSelector` in the party management controls (visible to leaders only). On switch, call `PUT /api/party/:id/book` with `{ bookId, mode }`.

## 4. Journey Page: View Mode and Distance

- [ ] 4.1 Add a view mode toggle to the journey page. Mount a small `BookViewToggle` component (vanilla JS or Preact island) on the journey page that switches between "Whole Story" and "Current Book". Follow the same pattern as `PartySelector`: Preact signal persisted via localStorage. Default to `'story'`.
- [ ] 4.2 Persist view mode changes: set `window._bookViewMode` to `'book'` or `'story'`. The `PartySelector` already demonstrates localStorage persistence with reactive signals — follow this pattern.
- [ ] 4.3 Update `fetchAndUpdateTotalDistance` in `public/js/progress.js` to store `window._activeBook = data.activeBook` alongside `window._personalDistance`. When updating `#total-distance-value`, check `window._bookViewMode`: if `'book'`, display `data.activeBook.bookProgress`; if `'story'`, display `data.totalDistance`. Also pass the correct distance (`bookProgress` vs `totalDistance`) to `renderGoals()`.

## 5. Goals Integration

- [ ] 5.1 In `public/js/goals.js`, store the book metadata from the goals response (`bookMetadata: { bookStartDistance, bookEndDistance }`). In book view mode, filter goals to those within `[bookStartDistance, bookEndDistance]` and display distances as `goal.distance - bookStartDistance`. In story view mode, display all goals with absolute distances. Both views use the same fetched data — toggling does not re-fetch.
- [ ] 5.2 Render book start and end markers in the goals list when in book view (visual boundary indicators).

## 6. Map: Milestones and Social Markers

- [ ] 6.1 Update map milestone loading to include `activeBookId` and `viewMode` in the milestone cache key. When in book view, filter waypoints client-side to only those within `[bookMetadata.bookStartDistance, bookMetadata.bookEndDistance]`. The goals API returns all milestones with absolute distances plus `bookMetadata` — filtering happens client-side in the map rendering code.
- [ ] 6.2 Verify friend and fellowship markers are globally visible: no filtering by the viewer's book. The markers already use whole-story distance — confirm this behavior is unchanged.
- [ ] 6.3 Update friend and fellowship marker labels to include storyline context. Change the label format from `"634 km"` to `"634 km as Pippin"` (append the storyline slug or short title). Read the storyline context from the friend/fellowship position data.

## 7. TypeScript Types

- [ ] 7.1 Add `ActiveBook` interface to `client/src/types/session.ts`: `{ bookId: number; slug: string; title: string; bookProgress: number; bookLength: number; badgeSlug: string | null }`.
- [ ] 7.2 Extend `SessionResponse` in `client/src/types/session.ts` with `activeBook?: ActiveBook` as a sibling of `activeStoryline`.

## 8. Validation

- [ ] 8.1 Add Vitest coverage for `BookSelector`: renders book list, shows active book, calls onSwitch with correct bookId and mode, shows disabled carry with explanation.
- [ ] 8.2 Add Vitest coverage for `ProfileIsland` book display: renders active book, switches books with reset, switches with carry, handles disabled carry.
- [ ] 8.3 Add Vitest coverage for `PartyManageIsland` book display and leader switching.
- [ ] 8.4 Add Vitest coverage for view mode toggle: reads from localStorage, persists to localStorage, defaults to story on first visit.
- [ ] 8.5 Run `npm run test:client` and fix regressions related to updated islands and components.
- [ ] 8.6 Run `npm run check` and resolve any TypeScript issues related to the new `ActiveBook` type and book-aware components.
