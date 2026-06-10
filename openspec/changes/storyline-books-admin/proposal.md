## Why

`storyline-books-core` provides backend book infrastructure with admin APIs for CRUD, validation, and coverage enforcement. But without admin UI, admins must manage book boundaries and badge metadata through raw migration scripts. This change extends the existing `AdminStorylinesIsland` with inline book management so admins can create, edit, reorder, and validate books directly from the storylines admin page.

## What Changes

- Extend `AdminStorylinesIsland` to load books alongside storyline detail data, displaying ordered book segments with boundary distances and badge metadata.
- Add inline UI for creating, editing, reordering, and deleting storyline books without navigating away from the storyline editor.
- Add milestone-anchor boundary pickers that let admins select book start/end points from the storyline's existing goals, storing distances as the source of truth.
- Add inline coverage validation summaries showing gaps, overlaps, shared endpoint issues, and out-of-range milestones with clear error messages.
- Add admin UI fields for per-book badge metadata: name, image slug, repeatability flag, and description.
- Add admin audit logging for book mutation actions using the existing `admin_audit_log` table.

## Capabilities

### New Capabilities
- `storyline-books-admin`: Admin UI for creating, editing, reordering, and validating storyline books with milestone-anchor boundary pickers, coverage validation summaries, badge metadata fields, and audit logging.

### Modified Capabilities
- None.

## Impact

- Frontend: extend `AdminStorylinesIsland` in `client/src/islands/AdminStorylinesIsland.tsx` with book management forms, validation displays, and boundary pickers.
- No new API endpoints — uses the admin book CRUD APIs already provided by `storyline-books-core`.
- No new D1 tables or migrations — reads and writes `storyline_books` via existing admin endpoints.
- Admin audit: insert rows into `admin_audit_log` on book create, update, delete, and reorder actions.
- CSS: new book management styles within the existing admin CSS patterns.
- Tests: Vitest coverage for admin book forms, validation display, anchor selection, and badge metadata edits.
