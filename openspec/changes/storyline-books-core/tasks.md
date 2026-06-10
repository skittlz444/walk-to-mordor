## 1. Schema, Seed Data, and Migration

- [ ] 1.1 Add D1 migration for `storyline_books` with columns for storyline_id (FK), slug, title, description, sort_order, start_distance, end_distance, optional start_goal_id and end_goal_id, badge_slug, and timestamps, plus indexes on storyline_id and sort_order.
- [ ] 1.2 Add D1 migration for user active book state: `user_active_book` with columns for user_id, storyline_id, book_id, and timestamps, plus a `UNIQUE(user_id, storyline_id)` constraint.
- [ ] 1.3 Add D1 migration for party active book state: `party_active_book` with columns for party_id, storyline_id, book_id, and timestamps, plus a `UNIQUE(party_id, storyline_id)` constraint.
- [ ] 1.4 Add D1 migration for `personal_book_attempts` with columns for user_id, book_id, storyline_id, status (active/completed/superseded), start_story_distance, start_book_progress, completed_at, award_idempotency_key, and timestamps, plus indexes for attempt-scoped lookups.
- [ ] 1.5 Add D1 migration for `fellowship_book_attempts` with columns for party_id, book_id, storyline_id, status (active/completed/superseded), start_story_distance, start_book_progress, completed_at, award_idempotency_key, and timestamps, plus indexes for attempt-scoped lookups.
- [ ] 1.6 Add D1 migration for `fellowship_book_contributions` with columns for attempt_id (FK), user_id, has_contributed (integer, 0 or 1), and a `UNIQUE(attempt_id, user_id)` constraint plus an index on attempt_id. The `has_contributed` flag is set to 1 when a member's party progress log entry is created or updated during an active fellowship book attempt.
- [ ] 1.7 Seed six book splits and badge definitions for the Frodo/Sam storyline via migration, including achievement definition rows in `achievement_definitions` with slugs like `book-fotr-1-complete`, etc.
- [ ] 1.8 Seed six book splits and badge definitions for the Pippin storyline based on Pippin's position at each Lord of the Rings book ending.
- [ ] 1.9 Add fallback full-journey book records and badge definitions for any other public active storyline, or keep incomplete storylines admin-only until valid splits exist.
- [ ] 1.10 Implement one-time user backfill: compute current story distance for each existing user, determine the active book via next-book-at-boundary semantics, insert a `user_active_book` row, award completed personal book achievements for books whose end is before the user's current story distance, and create active attempts for the current incomplete book. New users going forward default to the first book of their storyline (matching how `active_storyline_id` defaults to Frodo/Sam).
- [ ] 1.11 Implement one-time fellowship backfill: infer active book from fellowship story distance, award completed fellowship book achievements to current active members where contribution history can be determined safely.
- [ ] 1.12 Add Jest coverage for seeded boundaries, shared endpoint milestones, active-book inference, and idempotent backfill.

## 2. Book Domain Services

- [ ] 2.1 Create strict TypeScript interfaces in `src/book-utils.ts` for `StorylineBook`, `UserActiveBook`, `PartyActiveBook`, `PersonalBookAttempt`, `FellowshipBookAttempt`, `FellowshipBookContribution`, `BookSwitchOption`, and API response shapes.
- [ ] 2.2 Implement book progress math: `clamp(storyDistance - book.startDistance, 0, book.length)`, relative milestone distance calculation, and book length.
- [ ] 2.3 Implement `getActiveBookContext(db, userId)`: loads user's storyline context and story distance, queries active storyline's books ordered by sort_order, finds the book where `storyDistance >= start_distance AND storyDistance < end_distance` (or the final book if beyond all ends), and returns `{ bookId, slug, title, bookProgress, bookLength, badgeSlug }`. For new users without a `user_active_book` row, defaults to the storyline's first book.
- [ ] 2.4 Implement `updateActiveBookOnProgress(db, userId, newStoryDistance)`: after a walk mutation, checks if the story distance has crossed the active book's end boundary. If so, updates `user_active_book` to the next book. If the user is at or beyond the final book, keeps the final book active.
- [ ] 2.5 Implement public storyline book coverage validation: detect gaps (uncovered distance ranges), overlaps beyond shared endpoints, out-of-range milestones, and books outside the storyline's distance range.
- [ ] 2.6 Implement admin-only draft validation: report coverage problems without blocking saves or activation on admin-only storylines.
- [ ] 2.7 Implement user book switch planning: compute available books, determine allowed modes (reset/carry), disable carry when carried progress >= target book length, and return explanatory states.
- [ ] 2.8 Implement party book switch planning: leader-controlled reset/carry with same rules as personal switch planning.
- [ ] 2.9 Implement personal book attempt creation, superseding (mark prior active attempts superseded on switch), completion detection (story distance >= book.end_distance triggers award), and award via `awardAchievement` from shared infra. Also update `user_active_book` on boundary crossing.
- [ ] 2.10 Implement fellowship book attempt creation, superseding, contribution tracking (set `has_contributed = 1` for any member whose party progress log entry is created or updated during an active fellowship book attempt), completion detection, and contributor badge awards via shared infra for members with `has_contributed = 1`.
- [ ] 2.11 Add Jest coverage for distance math, boundary inference, active book updates on progress, coverage validation (gaps, overlaps, out-of-range), reset/carry planning, exact-length carry disablement, attempt idempotency, and badge awards.

## 3. Worker APIs and Routing

- [ ] 3.1 Extend `toStorylineResponse` and the storyline list endpoint so active storylines include ordered public book metadata: `books: [{ bookId, slug, title, startDistance, endDistance }]`.
- [ ] 3.2 Extend `/api/session` response with a new top-level `activeBook` field: `{ bookId, slug, title, bookProgress, bookLength, badgeSlug }`. Resolve via `getActiveBookContext(db, userId)` called in `handleSessionValidation` alongside the existing `resolveUserStoryline` call. The field is a sibling of `activeStoryline`, not nested inside it.
- [ ] 3.3 Extend `/api/total-distance` response by calling `getActiveBookContext` in `calculateUserStorylineDistance`. Add `activeBook` field with `{ bookId, title, bookProgress, bookLength }` to the response shape alongside existing `totalDistance`, `rawTotalDistance`, and `activeStoryline`.
- [ ] 3.4 Extend `/api/goals` to include `bookMetadata: { bookStartDistance, bookEndDistance }` in the response when the user has an active book. All goals continue to be returned with absolute story distances — the UI computes book-relative display and range filtering client-side. No `viewMode` parameter needed.
- [ ] 3.5 Add authenticated user book switch endpoint: `PUT /api/user/book` with body `{ bookId, mode: 'reset' | 'carry' }`. Creates a new attempt, sets active book, and returns the new book state. Rejects disabled carry modes with a clear error.
- [ ] 3.6 Add leader-only fellowship book switch endpoint: `PUT /api/party/:id/book` with body `{ bookId, mode: 'reset' | 'carry' }`. Same rules as personal switch.
- [ ] 3.7 Add admin storyline book CRUD APIs: extend `GET /api/admin/storylines/:id` to include `books` array in the response (`{ storyline, goals, books }`). Add `POST /api/admin/storylines/:id/books`, `PUT /api/admin/storylines/:id/books/:bookId`, `DELETE /api/admin/storylines/:id/books/:bookId`, and `PUT /api/admin/storylines/:id/books/reorder` for create, update, delete, and reorder. Enforce public activation coverage validation when updating storyline active/admin-only state.
- [ ] 3.8 Wire book routes and allowed-method metadata through `src/index.ts` without disturbing existing route behavior.
- [ ] 3.9 Add Jest handler and route coverage for auth, non-admin rejection, book-aware session/total-distance/goals responses, switching modes (reset/carry/disabled carry), admin book CRUD, coverage validation, and public activation enforcement.

## 4. Progress and Achievement Integration

- [ ] 4.1 Hook personal book completion detection into progress create, update, and delete flows in `src/progress-handlers.ts`: after the walk mutation, compute the user's new story distance, check if the active book's end distance is crossed. If crossed: mark the attempt completed, call `awardAchievement`, and call `updateActiveBookOnProgress` to advance `user_active_book` to the next book (or stay at the final book).
- [ ] 4.2 Ensure progress edits/deletes never revoke earned book achievements (shared infra handles immutability).
- [ ] 4.3 Ensure progress edits/deletes cannot award a second badge for an already completed attempt (attempt-scoped idempotency key prevents this).
- [ ] 4.4 Hook fellowship book contribution tracking: after `syncPartyProgressLog` completes in the progress handler, check if the member's party has an active fellowship book attempt. If so, set `has_contributed = 1` in `fellowship_book_contributions` for that member (upsert on `(attempt_id, user_id)`). This runs AFTER `syncPartyProgressLog`, not inside it — keeping the existing function unchanged.
- [ ] 4.5 Hook fellowship book completion detection into party progress updates and book switching flows: when the fellowship's story distance crosses the active book end, complete the attempt and award badges to members with `has_contributed = 1`.
- [ ] 4.6 Ensure departed members keep earned fellowship badges but are excluded from future fellowship book award eligibility (query only current active members for award).
- [ ] 4.7 Add Jest coverage for: personal book crossing detection, repeat reset completion, edit/delete exploit safety (no double award), late joiner eligibility, departed-member exclusion, and immutable awards via shared infra.

## 5. Documentation and Validation

- [ ] 5.1 Update `docs/data-models.md` with storyline book, attempt, contribution, active-book, and achievement invariants.
- [ ] 5.2 Update `docs/api-reference.md` with book-aware session, total-distance, goals, user book switch, party book switch, and admin storyline book endpoint specifications.
- [ ] 5.3 Update `docs/architecture.md` with book progression, attempt idempotency, achievement immutability via shared infra, and migration notes.
- [ ] 5.4 Run `npm test` and fix regressions related to book domain services, handlers, migrations, progress hooks, and achievements.
- [ ] 5.5 Run `npm run check` and resolve TypeScript, build, or Wrangler dry-run issues introduced by book-aware APIs and hooks.
