## Why

Walk to Mordor's main storylines currently operate as one long route, which makes long journeys harder to reason about and causes milestone clumping where outward and return paths overlap. First-class storyline books let users and fellowship leaders start at meaningful story sections, focus progress on the current book, and earn durable completion badges without changing raw walking history.

## What Changes

- Add first-class books/segments to storylines, with each active public storyline requiring complete, non-overlapping distance coverage from the start of the storyline through its end.
- Let new users choose both storyline and starting book; choosing a later book starts story distance at that book's start, gives 0 km book progress, and does not award skipped prior-book badges.
- Let existing users and fellowship leaders switch books with reset or carry behavior; carry is disabled when current book progress is greater than or equal to the target book length.
- Add personal and fellowship active-book state backed by D1, while remembering the user's current whole-story versus current-book view mode using the same persistence scope as the current personal/fellowship view selection.
- Add current-book view mode for journey and map milestone displays; book view uses book-relative distance and labels shared boundary milestones as 0 km or book length, while whole-story view keeps absolute story distance.
- Keep friend and fellowship map markers visible regardless of the viewer's current book, using whole-story distance plus storyline context in marker labels.
- Award immutable, repeatable personal book achievements when a user crosses an active book end during a distinct book attempt.
- Award immutable, repeatable fellowship book achievements to active members who contributed any distance to the fellowship's current book before the fellowship crossed the book end.
- Backfill existing users once during migration with book achievements for completed books up to their current story position, and infer their active book from current story distance.
- Extend the storylines admin UI and APIs so admins manage book boundaries as milestone anchors while storing distances as the source of truth, including completion badge metadata and validation before public activation.
- Seed real six-book splits for the Frodo/Sam storyline and Pippin's storyline according to the positions reached at each Lord of the Rings book ending.

## Capabilities

### New Capabilities
- `storyline-books`: First-class storyline book definitions, user and fellowship book selection, current-book versus whole-story presentation, admin validation, migration backfill, and repeatable book completion achievements.

### Modified Capabilities
- None.

## Impact

- D1 schema: new storyline book tables, user and party active-book state, book attempt tracking, fellowship book contribution tracking as needed, and achievement linkage for personal and fellowship book completions.
- Worker APIs: extend storyline/session/total-distance/goals/map/fellowship/admin endpoints to include book context, book switching, book view data, and validation errors.
- Frontend: update onboarding/profile/fellowship management, journey goals, map milestone rendering, marker labels, and admin storylines UI using Preact islands where new interactive UI is needed.
- Data migration: seed Frodo/Sam and Pippin book splits, create fallback full-journey books for any other public active storylines unless real splits are supplied, infer active books, and run one-time achievement backfill.
- Tests and docs: add Jest coverage for progression math, switching, migration, achievement idempotency, and admin validation; add Vitest/Playwright coverage for selectors, view mode, map filtering, and admin book management; update API, data model, architecture, and frontend docs.
- Rollback: keep migrations additive where practical; disabling book-aware UI should fall back to whole-story display, while stored raw walking progress remains unchanged.
