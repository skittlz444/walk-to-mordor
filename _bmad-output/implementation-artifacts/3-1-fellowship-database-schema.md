# Story 3.1: Fellowship Database Schema

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want to create the foundational database tables for the Fellowship (parties) feature with party-level configuration settings,
so that the Walk to Mordor app can support multiplayer features where users create, join, and track combined walking progress across multiple parties with configurable distance calculation and leave behavior.

## Acceptance Criteria

1. Create `parties` table with columns: `id`, `name`, `leader_id` (FK to users), `created_at`, `invite_code` (unique), `distance_mode` (TEXT, default 'incremental'), `leave_distance_behavior` (TEXT, default 'keep'), `dissolved_at` (DATETIME, default NULL).
2. Create `party_members` table with columns: `id`, `party_id` (FK to parties), `user_id` (FK to users), `joined_at`, `distance_at_join` (DECIMAL), `role` (leader/member), `status` (active/left/kicked), `last_viewed_distance` (DECIMAL, default 0), `departed_at` (DATETIME, default NULL), `distance_kept` (BOOLEAN, default NULL — set on departure to record whether member's contribution was kept or removed).
3. Create `party_progress_log` table with columns: `id`, `party_id` (FK to parties), `logged_by_user_id` (FK to users), `distance`, `date` (DATE — correlates with progress table entry), `logged_at` (for activity feed and contribution audit trail).
4. Add relevant database indexes for fast party lookups, member listings, and multi-party user lookups (including index on `party_members(user_id)` for efficiently querying all parties a user belongs to).
5. Create a new migration file in the `migrations/` folder (following the `0XXX_` naming pattern, currently the next available is `0119`).
6. Update `docs/data-models.md` with the new schema and update the Mermaid ER Diagram.

## Tasks / Subtasks

- [ ] Task 1: Create Database Migration (AC: 1, 2, 3, 4, 5)
  - [ ] Write SQL for `parties` table with `distance_mode`, `leave_distance_behavior`, and `dissolved_at` columns and associated indexes
  - [ ] Write SQL for `party_members` table with `status` (active/left/kicked), `last_viewed_distance`, `departed_at`, and `distance_kept` columns and associated indexes (including `user_id` index for multi-party lookups)
  - [ ] Write SQL for `party_progress_log` table with `date` column and associated indexes
  - [ ] Save the file as `migrations/0119_create_fellowship_tables.sql` (Validate current max number)
- [ ] Task 2: Document the Schema (AC: 6)
  - [ ] Add the tables to the `docs/data-models.md` text breakdown
  - [ ] Update the Mermaid ER Diagram in `docs/data-models.md` to reflect the new relationships

## Dev Notes

- **Architecture Details:** This story implements ADR-004 (Fellowship Data Model Direction). We are preserving existing user isolation by maintaining the existing `progress` table as it is without modifying it. All party progress calculations will be done via aggregate queries handling the new tables.
- **`distance_at_join` Field Requirement:** This column in `party_members` is critical. It must store the user's total distance across all time at the exact moment they join a Fellowship. This is required to calculate the "incremental" progress mode later.
- **`distance_mode` Column:** Stored on the `parties` table. Values: 'incremental' (default) or 'cumulative'. Determines how party progress is calculated. In cumulative mode, all-time totals are summed. In incremental mode, only distance since joining is counted. Updatable by leader via `PUT /api/party/:id/settings` (Story 3.5).
- **`leave_distance_behavior` Column:** Stored on the `parties` table. Values: 'keep' (default) or 'remove'. Determines what happens to a member's contributed distance when they leave or are kicked (unless overridden by leader during a kick). Updatable by leader via `PUT /api/party/:id/settings` (Story 3.5).
- **`last_viewed_distance` Column:** Stored on `party_members`. Tracks the party's total distance as of the user's last view. Used to determine if a milestone modal should be shown when the user switches to viewing a different party's distance. Initialized to 0 on join.
- **`departed_at` Column:** Stored on `party_members`. Set when member status changes to 'left' or 'kicked'. Used with `distance_at_join` to calculate departed member contributions from the `progress` table without needing a separate `distance_at_departure` column. NULL for active members.
- **`distance_kept` Column:** Stored on `party_members` (BOOLEAN, default NULL). Set on departure to record whether the member's contributed distance was kept (`true`) or removed (`false`) from the party total. Captures any kick-specific distance override (Story 3.5) so that progress calculations (Story 3.4) don't lose the disposition decision when the party's `leave_distance_behavior` setting changes later. NULL for active members.
- **`dissolved_at` Column:** Stored on `parties`. Set when a party is auto-dissolved (all members departed). Dissolved parties cannot be re-joined. NULL for active parties.
- **`status` Column:** Supports 'active', 'left', and 'kicked'. 'kicked' is distinct from 'left' to distinguish voluntary departure from leader-initiated removal.
- **Re-join:** When a user re-joins a party they previously left/were kicked from, a **new** `party_members` record is created with fresh `distance_at_join`, `departed_at` = NULL, and `last_viewed_distance` = 0. The old record is preserved with `departed_at` set for contribution history. Multiple records per (party_id, user_id) are expected.
- **Multi-party Support:** No unique constraint on `user_id` alone in `party_members` — a user can join multiple parties. Uniqueness for active memberships is enforced at the application level (one active record per party per user).
- **`party_progress_log` as Audit Trail:** This table serves dual purpose: activity feed display AND contribution audit trail. When a user logs a walk, entries should be created in this table for each active party they belong to (cross-cutting concern specified in Story 3.4).
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

### change-impact

Requirements expanded from original spec:
- `parties` table: added `distance_mode` (TEXT, default 'incremental'), `leave_distance_behavior` (TEXT, default 'keep'), and `dissolved_at` (DATETIME, default NULL) columns
- `party_members` table: added `last_viewed_distance` (DECIMAL, default 0), `departed_at` (DATETIME, default NULL), and `distance_kept` (BOOLEAN, default NULL) columns; `status` now supports 'kicked' in addition to 'active'/'left'
- `party_progress_log` table: added `date` (DATE) column for correlation with progress table entries
- Multi-party index on `party_members(user_id)` required for efficient multi-party membership queries
- Re-join creates new records (old records preserved for contribution history)
- `party_progress_log` serves dual purpose: activity feed + contribution audit trail
- All downstream stories (3.2–3.9) reference these schema changes

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
