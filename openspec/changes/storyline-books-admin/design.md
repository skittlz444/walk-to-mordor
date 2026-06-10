## Context

`storyline-books-core` provides admin book APIs under `/api/admin/storylines/:id/books` for CRUD, validation, and coverage checks. The admin page at `/admin/storylines` renders `AdminStorylinesIsland` with storyline list, detail, and goal management.

This change extends the storyline detail view to include book management below the goal editor. The existing admin patterns apply: handler files per domain, admin session validation, audit logging via `logAdminAction`, Preact islands registered in `client/src/index.tsx`.

## Goals / Non-Goals

**Goals:**
- Show an ordered list of books for the selected storyline in the admin detail view.
- Provide inline create, edit, reorder, and delete actions for books.
- Let admins pick book boundaries from existing storyline goal milestones.
- Display coverage validation summaries (gaps, overlaps, out-of-range) inline.
- Allow editing of badge metadata per book (name, image slug, description).
- Log all book mutations to `admin_audit_log`.

**Non-Goals:**
- No changes to the storyline list or goal management UI.
- No bulk import/export of book definitions.
- No visual preview of the book layout on the map.

## Decisions

### Books included in the admin storyline detail response

The admin storyline detail endpoint `GET /api/admin/storylines/:id` is extended to include a `books` array alongside the existing `storyline` and `goals` fields. Since this endpoint is already admin-only (guarded by `validateAdminSession`), including books there is appropriate — the admin needs books alongside goals for boundary anchor pickers.

`storyline-books-core` task 3.7 implements this: the detail response becomes `{ storyline, goals, books }` where `books` is an ordered array of book definitions with all fields including badge metadata.

Rationale: the admin is already viewing the storyline detail. Adding books to the response avoids a second HTTP request. Non-admin book listing is separately handled by `GET /api/storylines` (which includes ordered book metadata per storyline for the `BookSelector` dropdown).

### Milestone-anchor boundary pickers using existing goals

Book start/end distance fields have an optional dropdown that lists the storyline's existing goals as anchor references. Selecting a goal pre-fills the distance field with that goal's distance. The anchor reference is stored as an optional `start_goal_id`/`end_goal_id` on the `storyline_books` row.

Rationale: admins think in terms of "Book 1 starts at Hobbiton and ends at Rivendell" — goal names are more meaningful than raw distances. Distances remain the source of truth; anchors are reference metadata.

### Inline coverage validation after each mutation

After creating, editing, or deleting a book, the API returns coverage validation results. The UI displays these as a summary panel above the book list: green checkmarks for valid coverage, yellow/red warnings for gaps, overlaps, or milestone-range issues.

Rationale: admins need immediate feedback on whether their book configuration is valid before activating the storyline. Waiting until activation to see errors would be a poor UX.

### Badge metadata fields per book

Each book's edit form includes badge fields (name, image slug, description). These map to the `achievement_definitions` row referenced by the book's `badge_slug`. The pattern follows the inline badge management established by `personal-challenges-admin` and `community-campaigns-admin`.

### No new tables or endpoints

This change exclusively reads and writes via the admin book APIs provided by `storyline-books-core`. The `AdminStorylinesIsland` calls those endpoints and renders the response data.

## Risks / Trade-offs

- [Boundary distance changes could strand users mid-book] → `storyline-books-core` handles this by recomputing active books from story distance. No badges are revoked.
- [Validation results could be noisy during drafting] → Show validation as a collapsible summary. Red errors only for blocking issues; yellow warnings for advisory issues.

## Migration Plan

1. Extend `AdminStorylinesIsland` to fetch and display books for the selected storyline.
2. Add book CRUD forms, boundary pickers, and validation display.
3. Add badge metadata fields and reorder controls.
4. Add audit logging calls to all mutation actions.
5. Add Vitest coverage.

Rollback: remove the Books section from the island. No API or schema to revert.

## Open Questions

None.
