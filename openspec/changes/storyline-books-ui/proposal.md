## Why

`storyline-books-core` provides backend book infrastructure — APIs return book context, switching endpoints work, and badges award — but users can't see or interact with books. This change adds the user-facing UI across all surfaces: onboarding, profile, party management, journey, and map. Users can see their current book, switch books with reset or carry, filter milestones, and view book-relative progress.

## What Changes

- Add starting book selection to the new-user onboarding flow alongside storyline selection.
- Update `ProfileIsland` to display the active book, offer book switch controls with reset/carry actions, and show disabled carry explanations.
- Update `PartyManageIsland` leader controls to display the fellowship's active book and offer book switching with the same reset/carry semantics.
- Add a current-book vs whole-story view mode toggle on the journey page, persisted using the same mechanism as the current personal/fellowship view selection.
- Update the journey total-distance display to show either whole-story distance or current-book progress based on view mode.
- Update legacy goals rendering in `public/js/goals.js` to pass `viewMode=book` to `/api/goals` when current-book view is active, and switch back to book-relative distance labels.
- Update map milestone loading to filter waypoints to the active book in current-book view, with distinct cache keys per (storyline, book, view mode).
- Keep friend and fellowship map markers globally visible regardless of the viewer's current book, with labels showing whole-story distance plus storyline context.
- Update friend and fellowship marker labels to include storyline context (e.g., "634 km as Pippin").

## Capabilities

### New Capabilities
- `storyline-books-ui`: Book selection in onboarding, book display and switching on profile and party management, current-book vs whole-story view mode with persistence, book-aware journey and goals display, map milestone filtering per book, and globally visible social markers with storyline context.

### Modified Capabilities
- None.

## Impact

- Frontend: new `BookSelector` component, updates to `ProfileIsland` and `PartyManageIsland`, view mode toggle on the journey page, map milestone filtering in Konva layers, and `public/js/goals.js` updates for book-aware goals.
- No new API endpoints — all endpoints are provided by `storyline-books-core`. This change only adds the UI layer that calls them.
- No new D1 tables or migrations.
- CSS: minor additions to profile, party management, and journey page styles for book controls.
- Tests: Vitest coverage for book selector, profile book switching, party leader switching, view mode persistence, and map filtering.
