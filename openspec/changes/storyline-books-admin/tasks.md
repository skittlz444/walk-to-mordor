## 1. Book Management in Admin UI

- [ ] 1.1 Extend `AdminStorylinesIsland` to read `books` from the admin storyline detail response (`GET /api/admin/storylines/:id` now returns `{ storyline, goals, books }` after `storyline-books-core` task 3.7). Display books in an ordered list below the goals section with slug, title, start/end distances, and badge name.
- [ ] 1.2 Implement the book create form: inline form with fields for slug, title, description, start_distance, end_distance, optional start_goal_id/end_goal_id via anchor picker, badge_slug, and inline badge metadata fields (name, description, image_slug). Calls the admin book create endpoint and refreshes the book list.
- [ ] 1.3 Implement the book edit form: opens when clicking edit on a book card. Pre-fills all fields with current values. Provides the same anchor pickers and badge metadata fields. Calls the admin book update endpoint and refreshes.
- [ ] 1.4 Implement book reorder controls: up/down arrows or drag handles to change sort order. Calls the admin book update endpoint with the new sort_order.
- [ ] 1.5 Implement book delete with confirmation: a delete action on each book card that prompts for confirmation before calling the admin book delete endpoint.
- [ ] 1.6 Implement milestone-anchor boundary pickers: dropdown menus that list the storyline's existing goals. Selecting a goal pre-fills the adjacent distance field with that goal's distance and stores the goal_id as an anchor reference.

## 2. Coverage Validation Display

- [ ] 2.1 Add a validation summary panel above the book list. After any book mutation (create, edit, delete, reorder), display the coverage validation results returned by the API. Show green checkmarks for valid coverage, red/yellow warnings for gaps, overlaps, or out-of-range milestones with specific error messages and affected distance ranges.
- [ ] 2.2 Make the validation summary collapsible so it doesn't dominate the view during active drafting.

## 3. Badge Metadata

- [ ] 3.1 Add inline badge metadata fields (name, description, image_slug) to the book create/edit forms. These auto-create or update the `achievement_definitions` row linked by the book's `badge_slug`. Reuse the inline badge management pattern established by `AdminEncountersIsland`.

## 4. Audit Logging and Validation

- [ ] 4.1 Ensure admin audit log entries are created by the backend API for all book mutations (create, update, delete, reorder). The audit logging is handled by the API endpoints from `storyline-books-core` — verify this is wired correctly.
- [ ] 4.2 Add Vitest coverage for: book list display, create/edit/reorder/delete forms, anchor picker behavior, coverage validation display (valid, gaps, overlaps), badge metadata fields, and non-admin error states.

## 5. Documentation

- [ ] 5.1 Run `npm run test:client` and fix regressions related to the extended admin island.
- [ ] 5.2 Run `npm run check` and resolve any TypeScript issues.
