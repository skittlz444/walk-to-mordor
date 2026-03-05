# Story 3.1: Fellowship Database Schema

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want to create the foundational database tables for the Fellowship (parties) feature with party-level configuration settings,
so that the Walk to Mordor app can support multiplayer features where users create, join, and track combined walking progress across multiple parties with configurable distance calculation and leave behavior.

## Acceptance Criteria

1. Create `parties` table with columns: `id`, `name`, `leader_id` (FK to users), `created_at`, `invite_code` (unique), `distance_mode` (TEXT, default 'incremental'), `leave_distance_behavior` (TEXT, default 'keep'), `dissolved_at` (DATETIME, default NULL).
2. Create `party_members` table with columns: `id`, `party_id` (FK to parties), `user_id` (FK to users), `joined_at`, `distance_at_join` (DECIMAL), `role` (leader/member), `status` (active/left/kicked), `last_viewed_distance` (DECIMAL, default 0), `departed_at` (DATETIME, default NULL), `distance_kept` (BOOLEAN, default NULL — set on departure to record whether member's contribution was kept or removed), `contribution_at_departure` (DECIMAL, default NULL — locked snapshot of member contribution at leave/kick time).
3. Create `party_progress_log` table with columns: `id`, `party_id` (FK to parties), `logged_by_user_id` (FK to users), `distance`, `date` (DATE — correlates with progress table entry), `logged_at` (for activity feed and contribution audit trail).
4. Add relevant database indexes for fast party lookups, member listings, and multi-party user lookups (including index on `party_members(user_id)` for efficiently querying all parties a user belongs to).
5. Create a new migration file in the `migrations/` folder (following the `0XXX_` naming pattern, currently the next available is `0119`).
6. Update `docs/data-models.md` with the new schema and update the Mermaid ER Diagram.

## Tasks / Subtasks

- [x] Task 1: Create Database Migration (AC: 1, 2, 3, 4, 5)
  - [x] Write SQL for `parties` table with `distance_mode`, `leave_distance_behavior`, and `dissolved_at` columns and associated indexes
  - [x] Write SQL for `party_members` table with `status` (active/left/kicked), `last_viewed_distance`, `departed_at`, `distance_kept`, and `contribution_at_departure` columns and associated indexes (including `user_id` index for multi-party lookups)
  - [x] Write SQL for `party_progress_log` table with `date` column and associated indexes
  - [x] Save the file as `migrations/0119_create_fellowship_tables.sql` (Validate current max number)
- [x] Task 2: Document the Schema (AC: 6)
  - [x] Add the tables to the `docs/data-models.md` text breakdown
  - [x] Update the Mermaid ER Diagram in `docs/data-models.md` to reflect the new relationships

## Dev Notes

- **Architecture Details:** This story implements ADR-004 (Fellowship Data Model Direction). We are preserving existing user isolation by maintaining the existing `progress` table as it is without modifying it. All party progress calculations will be done via aggregate queries handling the new tables.
- **`distance_at_join` Field Requirement:** This column in `party_members` is critical. It must store the user's total distance across all time at the exact moment they join a Fellowship. This is required to calculate the "incremental" progress mode later.
- **`distance_mode` Column:** Stored on the `parties` table. Values: 'incremental' (default) or 'cumulative'. Determines how party progress is calculated. In cumulative mode, all-time totals are summed. In incremental mode, only distance since joining is counted. Set at creation and immutable afterward.
- **`leave_distance_behavior` Column:** Stored on the `parties` table. Values: 'keep' (default) or 'remove'. Determines what happens to a member's contributed distance when they leave or are kicked (unless overridden by leader during a kick). Updatable by leader via `PUT /api/party/:id/settings` (Story 3.5).
- **`last_viewed_distance` Column:** Stored on `party_members`. Tracks the party's total distance as of the user's last view. Used to determine if a milestone modal should be shown when the user switches to viewing a different party's distance. Initialized to 0 on join.
- **`departed_at` Column:** Stored on `party_members`. Set when member status changes to 'left' or 'kicked'. NULL for active members.
- **`distance_kept` Column:** Stored on `party_members` (BOOLEAN, default NULL). Set on departure to record whether the member's contributed distance was kept (`true`) or removed (`false`) from the party total. Captures any kick-specific distance override (Story 3.5) so that progress calculations (Story 3.4) don't lose the disposition decision when the party's `leave_distance_behavior` setting changes later. NULL for active members.
- **`contribution_at_departure` Column:** Stored on `party_members` (DECIMAL, default NULL). Computed once at leave/kick time using the party's immutable `distance_mode`, then reused by progress reads for departed members to avoid repeated historical range queries.
- **`dissolved_at` Column:** Stored on `parties`. Set when a party is auto-dissolved (all members departed). Dissolved parties cannot be re-joined. NULL for active parties.
- **`status` Column:** Supports 'active', 'left', and 'kicked'. 'kicked' is distinct from 'left' to distinguish voluntary departure from leader-initiated removal.
- **Re-join:** When a user re-joins a party they previously left/were kicked from, reactivate their existing `party_members` row with fresh `joined_at`, `distance_at_join`, and `last_viewed_distance`, and clear departure fields.
- **Multi-party Support:** No unique constraint on `user_id` alone in `party_members` — a user can join multiple parties. Maintain one row per (party_id, user_id).
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
- `contribution_at_departure` stores locked departed-member contributions for fast reads
- Re-join reactivates the existing membership row (single row per user+party)
- `party_progress_log` serves dual purpose: activity feed + contribution audit trail
- All downstream stories (3.2–3.8) reference these schema changes

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

- ✅ Created `migrations/0119_create_fellowship_tables.sql` with all three Fellowship tables and all required indexes.
- ✅ `parties` table: id, name, leader_id (FK→users), created_at, invite_code (UNIQUE), distance_mode (default 'incremental'), leave_distance_behavior (default 'keep'), dissolved_at (NULL for active).
- ✅ `party_members` table: all columns per AC2 including distance_at_join, role, status (active/left/kicked), last_viewed_distance, departed_at, distance_kept (nullable BOOLEAN/INTEGER), contribution_at_departure (nullable REAL). UNIQUE(party_id, user_id) enforces single-row-per-pair; no unique constraint on user_id alone for multi-party support.
- ✅ `party_progress_log` table: party_id, logged_by_user_id, distance, date (DATE), logged_at — dual-purpose audit trail and activity feed.
- ✅ Indexes created: parties (leader_id, invite_code), party_members (party_id, user_id, status), party_progress_log (party_id, logged_by_user_id, date).
- ✅ `docs/data-models.md` updated with textual breakdown for all three new tables including field descriptions, index lists, and design rationale.
- ✅ Mermaid ER Diagram updated to include parties, party_members, party_progress_log and all relationships to users.
- ✅ All 6 Acceptance Criteria satisfied. No new dependencies required. No regression risk (pure additive schema migration).
- ✅ **[AI-Review] CHECK constraints added** to `distance_mode`, `leave_distance_behavior`, `role`, and `status` columns to enforce enum values at the DB layer and prevent silent data corruption (M1).
- ✅ **[AI-Review] Composite index added**: `idx_party_members_party_id_status ON party_members(party_id, status)` covers the dominant query pattern (active members of a party) as a single range scan (M2).
- ✅ **[AI-Review] UNIQUE constraint added** to `party_progress_log(party_id, logged_by_user_id, date)` to prevent duplicate log entries on API retries, mirroring the `progress` table's own `UNIQUE(date, user_id)` guard (M3).
- ✅ **[AI-Review] Redundant index removed**: `idx_parties_invite_code` dropped — `invite_code TEXT UNIQUE` already creates an implicit unique index in SQLite (L1).
- ✅ **[AI-Review] Leader invariant documented** in `docs/data-models.md` under `party_members` — `role = 'leader'` must stay in sync with `parties.leader_id` via atomic transactions (L2).
- ✅ **[AI-Review] Mermaid type labels corrected**: `float` → `real` in `party_members` and `party_progress_log` ER diagram entities to match SQLite's actual type system (L3).
- ✅ **[AI-Review-2] CHECK constraint added** to `distance_kept` column: `CHECK(distance_kept IS NULL OR distance_kept IN (0, 1))` to enforce boolean semantics and prevent data corruption (M4).
- ✅ **[AI-Review-2] Composite activity feed index**: Replaced `idx_party_progress_log_party_id` with `idx_party_progress_log_party_id_logged_at ON (party_id, logged_at)` for Story 3.8 activity feed queries (M5).
- ✅ **[AI-Review-2] Redundant index removed**: `idx_party_members_party_id` dropped — composite `idx_party_members_party_id_status` already covers `party_id`-only lookups as leftmost column (L1).
- ✅ **[AI-Review-2] Migration header format fixed**: Aligned with existing convention `-- Migration 0119_...` (L2).
- ✅ **[AI-Review-2] Docs fixes**: `leader_id` NOT NULL documented; `idx_parties_invite_code` annotated as implicit; composite index `idx_party_members_party_id_status` documented; `UNIQUE(party_id, logged_by_user_id, date)` documented on `party_progress_log` (M1, M2, M3, L3).

### File List

- migrations/0119_create_fellowship_tables.sql
- docs/data-models.md
