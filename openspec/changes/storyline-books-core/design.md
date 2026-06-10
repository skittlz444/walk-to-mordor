## Context

Walk to Mordor currently stores raw walking history independently from presentation state. Users and fellowships choose an active storyline, and displayed storyline distance is derived from raw distance plus a storyline distance offset. Storyline goals are mapped by absolute storyline distance.

This change adds first-class books to that model without changing the canonical walking ledger. Books are route segments within a storyline. A user's story distance remains the absolute displayed position; current-book progress is derived from the active book's start distance.

The `shared-achievement-infrastructure` change provides the `achievement_definitions` and `user_achievement_instances` tables plus `awardAchievement()`. This change creates book badge definitions via seed migration and awards them through the shared service. No UI changes are in scope — those follow in `storyline-books-ui` and `storyline-books-admin`.

The existing codebase has `src/storyline-utils.ts` (resolveUserStoryline, toStorylineResponse, etc.) and `src/storyline-handlers.ts` (switch endpoints, list). These are the primary files this change extends.

## Goals / Non-Goals

**Goals:**
- Model storyline books as first-class D1 data with stored distance boundaries and optional milestone anchor references.
- Preserve raw walking progress as the source of truth and derive book progress from story distance and book boundaries.
- Support starting a new personal journey at any book without awarding skipped prior-book achievements.
- Support personal and fellowship book switching with reset and carry modes, including disabling carry when carried progress exceeds the target book length.
- Store active personal and fellowship book state in D1.
- Award immutable, repeatable personal and fellowship book completion achievements through attempt-scoped idempotency via the shared achievement infrastructure.
- Backfill existing users once for completed book achievements and infer active books from current story distance.
- Enforce complete, gap-free, non-overlapping book coverage before a storyline becomes publicly active.
- Extend existing API responses with book context without breaking whole-story behavior.

**Non-Goals:**
- No UI changes (onboarding, profile, party management, journey, map — all in `storyline-books-ui`).
- No admin book management UI (in `storyline-books-admin`).
- No changes to raw progress entry storage beyond hooks needed to derive book completions.
- No revocation of achievements after progress edits, deletions, or book boundary edits.
- No hiding of friend or fellowship map markers based on the viewer's current book.

## Decisions

### Store books as first-class storyline segment rows

Add a `storyline_books` table keyed to `storylines`, with slug/title metadata, `start_distance`, `end_distance`, optional start/end goal anchor references, and `badge_slug` for achievement linkage. Distances are the source of truth; milestone anchors are admin affordances.

Rationale: books need validation, switching, relative display, migration, and achievements. Treating them as goal tags would make gap detection, overlap detection, and active-book inference fragile.

### Use absolute story distance plus derived book progress

Keep the existing displayed story distance: `storyDistance = max(0, rawDistance + storylineDistanceOffset)`. For an active book, derive `bookProgress = clamp(storyDistance - book.startDistance, 0, book.endDistance - book.startDistance)`.

In current-book view, total distance and milestone distances are relative to `book.startDistance`. In whole-story view, they remain absolute story distances. APIs return both values so UI can choose.

### Treat shared boundaries as inclusive for display but next-book for active state

A milestone at the end of one book and start of the next appears in both books. Active-book inference selects the next book when story distance exactly equals a shared boundary; the final book remains active at or beyond its start.

### Model repeatable completion with book attempts

`personal_book_attempts` and `fellowship_book_attempts` track each book engagement. Each attempt records the book, starting story distance, starting book progress, status, and completion state. A badge is awarded at most once per attempt when story distance crosses the book end.

Progress edits that move distance below and above the boundary don't create another achievement for the same attempt. A reset/switch creates a new attempt and can earn the same badge again after a later completion.

Rationale: attempt-scoped idempotency allows intentional repeat completions while preventing edit/delete loops from farming badges.

### Use separate personal and fellowship achievement sources

Personal book badges go to the user whose story distance crosses the active book end. Fellowship book badges go to active members who contributed any distance to that fellowship's book attempt before completion. Departed members keep earned badges but aren't eligible for future ones.

### Persist active books server-side with explicit updates

Store active personal book and active fellowship book in D1 via `user_active_book` and `party_active_book` tables. The active book is:
- **Set initially**: for new users, defaults to the first book of their storyline (matching how `active_storyline_id` defaults to Frodo/Sam via `DEFAULT_STORYLINE_SLUG`). For existing users, set during migration based on current story distance (same next-book-at-boundary semantics).
- **Updated on boundary crossing**: when a user's story distance crosses a book's end distance during progress reconciliation, `user_active_book` is updated to the next book (or stays at the final book). This keeps the active book in sync with actual progress.
- **Updated on explicit switch**: when a user or fellowship leader calls the book switch endpoint, `user_active_book` is updated to the chosen book.

The active book is authoritative — it's not lazily inferred on each read. This keeps it consistent with how `active_storyline_id` already works.

Rationale: explicit storage avoids inference divergence across reads. The table always reflects the user's current book, updated deterministically on progress changes and explicit switches.

### Book context in API responses as a top-level field

The session response gains a new `activeBook` field alongside `activeStoryline`: `{ bookId, slug, title, bookProgress, bookLength, badgeSlug }`. The book context is resolved by `getActiveBookContext(db, userId)` in `src/book-utils.ts`, called in `handleSessionValidation` alongside `resolveUserStoryline`.

`calculateUserStorylineDistance` (used by `/api/total-distance`) also resolves the active book and returns book context fields: `{ ..., activeBook: { bookId, title, bookProgress, bookLength } }`.

Rationale: the book is a peer of the storyline, not a property of it. A top-level field keeps the response shape clean and avoids nesting changes that would break existing consumers.

### `/api/goals` returns book boundary metadata alongside absolute distances

The goals endpoint always returns all storyline goals with their absolute story distances — no `viewMode` parameter is needed. When the user has an active book, the response includes `bookMetadata: { bookStartDistance, bookEndDistance }` alongside the goals array. The UI computes book-relative distances and filters to the book's range client-side.

Rationale: a single API call supports both story and book views. Toggling between views doesn't require a re-fetch. The book boundary metadata also enables map rendering (showing only the current book's line segment and goals) without a separate API call.

### `/api/storylines` includes ordered book metadata per storyline

The storyline list response includes a `books` array per storyline: `[{ bookId, slug, title, startDistance, endDistance }]`. This provides the data `BookSelector` needs for its dropdown without an additional API call.

### Fellowship book contributions tracked as a boolean

`fellowship_book_contributions` stores `has_contributed` (boolean/integer) rather than tracking exact distance amounts. The badge eligibility rule is binary: any member who contributed any distance to the fellowship's book attempt before completion is eligible. The exact amount doesn't matter — only the fact of contribution.

The contribution flag is set when a member's party progress log entry is created or updated (during `syncPartyProgressLog`), if the current story distance places the fellowship in an active book attempt. It's set once per member per attempt and never unset.

Rationale: contribution tracking for badge eligibility is a binary gate. Storing exact distances would add ledger complexity without providing value beyond what `party_progress_log` already captures.

### Enforce public storyline book coverage at activation time

Admin-only storylines may have missing, overlapping, or incomplete book ranges during drafting. A storyline cannot become publicly active unless books cover the full distance with no gaps or overlaps (shared endpoints excepted).

### Seed real six-book splits for Frodo/Sam and Pippin

Migrations seed Frodo/Sam and Pippin with six Lord of the Rings book splits. Any other public active storyline gets a single fallback full-journey book until real splits are authored.

### Book badge definitions created via seed migration

Book completion achievement definitions are inserted into the shared `achievement_definitions` table via seed migration. The `badge_slug` on `storyline_books` references these definitions. Award calls use `awardAchievement(db, userId, book.badge_slug, idempotency_key, context)`.

## Risks / Trade-offs

- [Boundary mistakes could misplace users or award incorrect badges] → Seed data via reviewed migrations, add validation tests, expose admin coverage errors before public activation.
- [Attempt tracking complexity around edits and resets] → Centralize completion checks in a small domain service with unique award keys per attempt.
- [Backfill could award unexpected badges] → Run a one-time deterministic migration, record backfill source metadata.
- [Admin boundary edits after launch could surprise users] → Preserve raw/story distance and earned badges, recalculate active book predictably, avoid awarding badges during boundary recalculation.

## Migration Plan

1. Add D1 tables for `storyline_books`, active personal/party book state, personal/fellowship book attempts, and fellowship book contribution tracking.
2. Seed six-book splits for Frodo/Sam and Pippin, including badge definitions.
3. Add fallback full-journey books for other public storylines.
4. Backfill existing users: infer active books, award completed book badges once, create current active attempts.
5. Backfill existing fellowships similarly.
6. Add book domain services and API handlers with route dispatch.
7. Add progress hooks for personal and fellowship book completion.
8. Update docs and add tests.

Rollback: keep migrations additive. If book APIs are disabled, default to whole-story display. Earned achievements are never revoked.

## Open Questions

None.
