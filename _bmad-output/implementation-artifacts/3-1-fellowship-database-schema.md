# Story 3.1: Fellowship Database Schema

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want to create the foundational database tables for the Fellowship (parties) feature,
so that the Walk to Mordor app can support multiplayer features where users create, join, and track combined walking progress.

## Acceptance Criteria

1. Create `parties` table with columns: `id`, `name`, `leader_id` (FK to users), `created_at`, `invite_code` (unique).
2. Create `party_members` table with columns: `id`, `party_id` (FK to parties), `user_id` (FK to users), `joined_at`, `distance_at_join` (DECIMAL), `role` (leader/member), `status` (active/left).
3. Create `party_progress_log` table with columns: `id`, `party_id` (FK to parties), `logged_by_user_id` (FK to users), `distance`, `logged_at` (for activity feed purposes).
4. Add relevant database indexes for fast party lookups and member listings.
5. Create a new migration file in the `migrations/` folder (following the `0XXX_` naming pattern, currently the next available is `0119`).
6. Update `docs/data-models.md` with the new schema and update the Mermaid ER Diagram.

## Tasks / Subtasks

- [ ] Task 1: Create Database Migration (AC: 1, 2, 3, 4, 5)
  - [ ] Write SQL for `parties` table and associated indexes
  - [ ] Write SQL for `party_members` table and associated indexes
  - [ ] Write SQL for `party_progress_log` table and associated indexes
  - [ ] Save the file as `migrations/0119_create_fellowship_tables.sql` (Validate current max number)
- [ ] Task 2: Document the Schema (AC: 6)
  - [ ] Add the tables to the `docs/data-models.md` text breakdown
  - [ ] Update the Mermaid ER Diagram in `docs/data-models.md` to reflect the new relationships

## Dev Notes

- **Architecture Details:** This story implements ADR-004 (Fellowship Data Model Direction). We are preserving existing user isolation by maintaining the existing `progress` table as it is without modifying it. All party progress calculations will be done via aggregate queries handling the new tables.
- **`distance_at_join` Field Requirement:** This column in `party_members` is critical. It must store the user's total distance across all time at the exact moment they join a Fellowship. This is required to calculate the "incremental" progress mode later.
- **Naming Conventions:** Follow D1 SQLite conventions currently used (lowercase, plural table names, snake_case columns).
- **Security & Privacy:** Implicit opt-in for privacy (joining is consent). 

### Project Structure Notes

- Migrations must go exactly in the `migrations/` folder.
- Follow `docs/data-models.md` diagram and syntax styles closely.
- Only DB code is needed for this story; API routes come in the next story (3.2).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1: Fellowship Database Schema (Issue #169)]
- [Source: docs/architecture.md#ADR-004: Fellowship Data Model Direction]
- [Source: docs/data-models.md]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
