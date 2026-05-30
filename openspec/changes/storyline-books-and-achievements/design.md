## Context

Walk to Mordor currently stores raw walking history independently from presentation state. Users and fellowships choose an active storyline, and displayed storyline distance is derived from raw distance plus a storyline distance offset. Storyline goals are mapped by absolute storyline distance, while journey and map surfaces fetch active storyline goals and compare them against the displayed storyline distance.

This change adds first-class books to that model without changing the canonical walking ledger. Books are route segments within a storyline. A user's or fellowship's story distance remains the absolute displayed position on the active storyline; current-book progress is derived from the active book's start distance. The change also introduces repeatable book completion achievements and admin book management inside the existing storylines management surface.

The active `events-and-challenges` OpenSpec change also defines append-only achievements. Book achievements are a separate product capability, but implementation should avoid a parallel badge display system. If the generic achievement infrastructure from that change lands first, this change should reuse it; if this change lands first, it should implement compatible achievement definitions and earned instances that events can reuse later.

## Goals / Non-Goals

**Goals:**

- Model storyline books as first-class D1 data with stored distance boundaries and optional milestone anchor references for admin editing.
- Preserve raw walking progress as the source of truth and derive story distance, book progress, and displayed distances from offsets and book boundaries.
- Support starting a new personal journey at any book without awarding skipped prior-book achievements.
- Support personal and fellowship book switching with reset and carry modes, including disabling carry when the carried book progress is greater than or equal to the target book length.
- Store active personal and fellowship book state in D1.
- Remember current-book versus whole-story view with the same persistence scope as the current personal/fellowship view selection; active book state remains server-backed.
- Filter journey/map milestones in current-book view while keeping friend and fellowship markers globally visible.
- Award immutable, repeatable personal and fellowship book completion achievements through attempt-scoped idempotency.
- Backfill existing users once for completed book achievements and infer active books from current story distance.
- Enforce complete, gap-free, non-overlapping book coverage before a storyline becomes publicly active.

**Non-Goals:**

- No changes to raw progress entry storage beyond hooks needed to derive book completions.
- No revocation of achievements after progress edits, deletions, membership changes, or book boundary edits.
- No automatic award of skipped prior-book achievements when a new user starts at a later book.
- No hiding of friend or fellowship map markers based on the viewer's current book.
- No replacement of distance-bracket event eligibility with books; events may use exact brackets that align with or subdivide books.

## Decisions

### Store books as first-class storyline segment rows

Add a `storyline_books` model keyed to `storylines`, with ordered slug/title metadata, `start_distance`, `end_distance`, optional start/end goal anchor references, and badge metadata or achievement definition linkage. Distances are the source of truth; milestone anchors are admin affordances for selecting and explaining boundaries.

Rationale: books need validation, switching behavior, relative display, migration, and achievements. Treating them as goal tags would make gap detection, overlap detection, and active-book inference fragile.

Alternative considered: infer books from marked goals. This is simpler to seed but makes boundary validation and admin editing too implicit.

### Use absolute story distance plus derived book progress

Keep the existing displayed story distance concept: `storyDistance = max(0, rawDistance + storylineDistanceOffset)`. For an active book, derive `bookProgress = clamp(storyDistance - book.startDistance, 0, book.endDistance - book.startDistance)`.

In current-book view, total distance and milestone distances are presented relative to `book.startDistance`. In whole-story view, total distance and milestone distances remain absolute story distances.

Rationale: this keeps existing raw progress and storyline offset behavior intact while making book mode a presentation and switching layer.

Alternative considered: store separate per-book progress totals. That would duplicate progress accounting and make resets, edits, and storyline switches harder to reason about.

### Treat shared boundaries as inclusive for display but next-book for active state

A milestone at the end of one book and the start of the next appears in both books. Goal filtering for book view includes both endpoints. Active-book inference chooses the next book when story distance exactly equals a shared boundary; the final book remains active at or beyond its start when no later book exists.

Rationale: shared story moments such as Rivendell naturally close one book and open the next. Display should honor both contexts, while active progress should move the user forward at the exact boundary.

Alternative considered: make end boundaries exclusive for display. That avoids duplicate milestones but makes boundary milestones disappear from one of the two relevant books.

### Model repeatable completion with book attempts

Create personal and fellowship book attempt records whenever a user or leader explicitly starts, resets, carries into, or switches to a book. Each attempt records the scope, book, starting story distance/book progress, status, and completion award state. A completion achievement is awarded at most once per attempt when the relevant story distance crosses the book end.

Progress edits that move distance below and above the boundary again do not create another achievement for the same attempt. A new reset or switch creates a new attempt and can earn the same book badge again after a later completion.

Rationale: attempt-scoped idempotency allows intentional repeat completions while preventing distance edit/delete/re-add loops from farming badges.

Alternative considered: award whenever distance crosses the boundary. This supports repeats but is vulnerable to repeated edits around the threshold.

### Use separate personal and fellowship achievement sources

Personal book completion badges are awarded to the user whose personal story distance crosses the active book end. Fellowship book completion badges are awarded when the fellowship's story distance crosses the active book end, but only to active fellowship members who contributed any distance to that fellowship book attempt before completion.

Departed members keep previously earned badges but are not eligible for future fellowship badges after departure. Late joiners are eligible if they become active members and contribute any distance to the book before the fellowship completes it. Leader resets create a new fellowship attempt and do not award badges by themselves.

Rationale: personal and fellowship achievements represent different accomplishments. Contributor eligibility prevents passive fellowship members from receiving a book badge without participating.

Alternative considered: award fellowship completion to every active member regardless of contribution. This is simpler but weaker as an achievement signal.

### Persist active books server-side and view mode at the existing view-selection scope

Store active personal book and active fellowship book in D1, alongside or near active storyline state. Persist the user's current-book versus whole-story view mode using the same mechanism currently used for remembering whether the user is viewing personal progress or a fellowship view. If that existing selection is browser-local, use browser-local storage for book/story view mode; if it is D1-backed, make book/story view mode D1-backed too.

Rationale: active book affects progression and achievements and must be consistent across devices. View mode is a presentation preference and should match the app's existing view-selection behavior.

Alternative considered: store all view state in D1. This is consistent cross-device but may over-persist a transient UI preference.

### Keep friend and fellowship markers globally visible

Map markers for friends and fellowships ignore the viewer's current-book filter. Marker labels use whole-story distance plus storyline context, for example `634 km as Pippin`.

Rationale: the current-book filter exists to reduce milestone clumping, not to hide social context. Seeing companions elsewhere in the world is part of the map's social value.

Alternative considered: filter markers to the current book. This would reduce visual noise but make the world feel less alive.

### Enforce public storyline book coverage at activation time

Admin-only storylines may have missing, overlapping, or incomplete book ranges while they are being drafted. A storyline cannot become publicly active unless books cover the full storyline distance with no gaps or overlaps, except shared endpoint boundaries. Milestones may sit outside books only while the storyline remains admin-only.

Rationale: admins need drafting flexibility, but regular users should never encounter undefined book state.

Alternative considered: allow public storylines without book coverage and fall back to whole-story mode. This would preserve old behavior but undermine the new book model's guarantees.

### Recompute active books from story distance after boundary changes

When admins reorder or adjust book distances, existing users and fellowships keep their raw progress, story distance, and earned achievements. Their active book is recalculated from their current story distance under the new boundaries. Active attempts may be replaced or marked superseded without awarding or revoking achievements.

Rationale: admin boundary edits should not strand users on invalid books or revoke earned badges.

Alternative considered: freeze each user's book boundary snapshot. This preserves historical semantics but makes admin corrections and UI support much more complex.

### Seed real six-book splits for Frodo/Sam and Pippin

Migrations seed Frodo/Sam and Pippin with six Lord of the Rings book splits. Pippin's book boundaries are based on his location/progress at each book ending rather than Frodo/Sam's route position. Any other public active storyline must receive either real validated book splits or a temporary single full-journey book before public activation.

Rationale: the feature is only useful if the main shipped routes have meaningful segment data immediately.

Alternative considered: seed only Frodo/Sam and force Pippin into a full-journey fallback. That would make Pippin inconsistent with the new product model.

## Risks / Trade-offs

- Boundary mistakes could misplace users or award incorrect badges -> Seed book data through reviewed migrations, add validation tests, and expose admin coverage errors before public activation.
- Attempt tracking can become complex around edits and resets -> Centralize completion checks in a small domain service and make award insertion unique per attempt.
- Achievement infrastructure may overlap with the events-and-challenges change -> Use one append-only achievement definition/instance model and coordinate migration/table naming before implementation.
- Current-book filtering could break map cache correctness -> Include storyline id, active book id, and view mode in any book-aware milestone cache key while leaving social marker caches independent.
- Backfill could award unexpected badges to existing users -> Run a one-time deterministic migration, record backfill source metadata, and announce that prior completed books are being recognized once.
- Admin book boundary edits after launch could surprise active users -> Preserve raw/story distance and earned badges, recalculate active book predictably, and avoid awarding badges during boundary-only recalculation.

## Migration Plan

1. Add D1 tables/columns for storyline books, active personal/fellowship book state, book attempts, fellowship book contribution tracking, and book achievement source linkage.
2. Seed six-book splits for Frodo/Sam and Pippin, including shared boundary milestones and badge metadata.
3. Add fallback full-journey book data for any other public active storyline, or keep incomplete routes admin-only until resolved.
4. Backfill existing users from their current displayed story distance: award each completed book badge once, infer active book using next-book-at-boundary semantics, and create current active attempts without awarding for the current incomplete book.
5. Backfill existing active fellowships similarly from fellowship story distance, awarding fellowship book badges once to current active members with qualifying contribution history when that can be determined safely.
6. Deploy API and frontend changes behind book-aware responses that preserve whole-story behavior when no current-book view is selected.
7. Enable admin book management and validation before allowing public storyline activation or public updates that would violate coverage rules.
8. Update docs and run backend, client, and focused Playwright validation.

Rollback strategy: retain raw walking history and existing storyline offsets. If book UI or handlers are disabled, default users and fellowships to whole-story display. Additive book and achievement records can remain in D1 for repair or re-enable; earned achievements are not revoked by rollback.

## Open Questions

None currently.
