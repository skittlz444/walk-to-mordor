# Story 3.5: Leave, Kick & Party Management API

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a User,
I want to be able to leave a Fellowship, and as a Leader, I want to manage my Fellowship (kick members, update settings, transfer leadership),
so that I have control over my party memberships and leaders can maintain their parties effectively.

## Acceptance Criteria

1. Create a `POST /api/party/:id/leave` endpoint for members to leave a party.
2. On leave: Set member status to 'left', `departed_at` = current timestamp, and `distance_kept` based on the party's `leave_distance_behavior` setting.
3. On leave: Compute and store `contribution_at_departure` once (based on party `distance_mode`) for future progress reads.
4. If the leader leaves: transfer leadership to the oldest active member, or dissolve the party if no active members remain.
5. Auto-dissolve: If no active members remain after departure, set `parties.dissolved_at` = current timestamp. Use a D1 batch transaction to prevent race conditions.
6. Create a `POST /api/party/:id/kick/:userId` endpoint for leaders to kick a member.
7. On kick: Set kicked member's status to 'kicked' and `departed_at` = current timestamp.
8. On kick: Compute and store `contribution_at_departure` once before applying keep/remove disposition.
9. On kick: Accept optional `removeDistance` boolean in request body to override the party's `leave_distance_behavior` setting. Set `distance_kept` accordingly.
10. Create a `PUT /api/party/:id/settings` endpoint to update party settings (leader only). Accept optional `{ name?: string, leave_distance_behavior?: 'keep' | 'remove' }`. `distance_mode` is immutable.
11. Create a `POST /api/party/:id/transfer-leadership` endpoint to transfer leadership to another active member (leader only). Accept `{ new_leader_id: number }`.
12. Validate: User must be an active member of the party for all actions. Leader actions require leader role. Return appropriate HTTP status codes (400, 401, 403, 404).

## Tasks / Subtasks

- [x] Task 1: API Route Setup (AC: 1, 6, 10, 11)
  - [x] Add `POST /api/party/:id/leave` route to `src/index.ts`.
  - [x] Add `POST /api/party/:id/kick/:userId` route to `src/index.ts`.
  - [x] Add `PUT /api/party/:id/settings` route to `src/index.ts`.
  - [x] Add `POST /api/party/:id/transfer-leadership` route to `src/index.ts`.
  - [x] Implement authentication checks for all routes.
- [x] Task 2: Leave Party Logic (AC: 1, 2, 3, 4, 5, 12)
  - [x] Create `handleLeaveParty` in `src/party-handlers.ts`.
  - [x] Validate user is an active member.
  - [x] Calculate `contribution_at_departure` based on party's `distance_mode`.
  - [x] Update `party_members` with 'left' status, `departed_at`, `distance_kept`, and `contribution_at_departure`.
  - [x] Handle leader departure (transfer to oldest active member or dissolve).
  - [x] Implement auto-dissolve logic using D1 batch transaction.
- [x] Task 3: Kick Member Logic (AC: 6, 7, 8, 9, 12)
  - [x] Create `handleKickMember` in `src/party-handlers.ts`.
  - [x] Validate requesting user is the leader and target user is an active member.
  - [x] Calculate `contribution_at_departure`.
  - [x] Apply `removeDistance` override if provided, otherwise use party default.
  - [x] Update `party_members` with 'kicked' status, `departed_at`, `distance_kept`, and `contribution_at_departure`.
  - [x] Implement auto-dissolve logic if the last active member is kicked.
- [x] Task 4: Update Settings Logic (AC: 10, 12)
  - [x] Create `handleUpdatePartySettings` in `src/party-handlers.ts`.
  - [x] Validate requesting user is the leader.
  - [x] Validate request body (`name`, `leave_distance_behavior`).
  - [x] Update `parties` table. Ensure `distance_mode` is not updated.
- [x] Task 5: Transfer Leadership Logic (AC: 11, 12)
  - [x] Create `handleTransferLeadership` in `src/party-handlers.ts`.
  - [x] Validate requesting user is the leader and `new_leader_id` is an active member.
  - [x] Update `party_members` roles and `parties.leader_id` using a transaction.

## Dev Notes

- **Architecture Details**: 
  - The database schema was established in Story 3.1. Ensure queries use the `parties` and `party_members` tables.
  - The API for creating a fellowship is in Story 3.2, which created `src/party-handlers.ts`. Keep new routes there.
- **Distance Calculation**: When calculating `contribution_at_departure`, use the same logic as in Story 3.4 (incremental vs cumulative).
- **Auto-dissolve**: When a party is dissolved, set `parties.dissolved_at` to the current timestamp. This acts as a soft delete.
- **Transactions**: Use D1 batch transactions (`env.DB.batch()`) for operations that involve multiple table updates (e.g., leaving as a leader, transferring leadership) to ensure data consistency.
- **Authentication**: Utilize the existing authentication flow (JWT/Session) built into `auth-utils.ts` and ensure the current user ID is properly extracted.

### Project Structure Notes

- Add the route logic to the server-side Worker, inside `src/party-handlers.ts`, and wire up the route definitions inside `src/index.ts`.
- Stay consistent with error handling mechanisms from existing handlers.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.5: Leave, Kick & Party Management API]
- [Source: docs/architecture.md#ADR-004: Fellowship Data Model Direction]
- [Source: docs/data-models.md]

### change-impact

Requirements expanded from original spec:
- Added settings update API (FR_PARTY_10), leadership transfer (FR_PARTY_11), auto-dissolution (FR_PARTY_12).
- `departed_at`, `distance_kept`, and `contribution_at_departure` are set on leave/kick.
- Party settings updates now support rename + leave behavior only; `distance_mode` is immutable.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (GitHub Copilot Coding Agent)

### Debug Log References

### Completion Notes List

- Implemented all 4 handlers: `handleLeaveParty`, `handleKickMember`, `handleUpdatePartySettings`, `handleTransferLeadership`
- Added `computeContribution` helper shared by leave/kick for departure contribution snapshots
- All endpoints use D1 batch transactions for multi-table operations
- Comprehensive validation: auth, active membership, leader role, dissolved state, input format
- 47 handler tests + 13 routing tests (60 new tests total, 406 passing across 14 suites)

### File List

**Modified Files:**
- `src/party-handlers.ts` — added `computeContribution`, `handleLeaveParty`, `handleKickMember`, `handleUpdatePartySettings`, `handleTransferLeadership`
- `src/index.ts` — added routes for 4 new endpoints, updated imports, updated `getAllowedMethods`
- `tests/api/index.test.ts` — added 13 routing tests for new endpoints

**New Files:**
- `tests/api/party-management.test.ts` — 47 unit tests for Story 3.5

### Adversarial Review Findings

**Reviewer:** Claude Sonnet 4 (GitHub Copilot Coding Agent) — 2026-02-28

**AC Validation (all 12 ACs checked):**

| AC | Status | Evidence |
|----|--------|----------|
| AC 1 | ✅ PASS | `POST /api/party/:id/leave` routed in index.ts:195-207, handled by `handleLeaveParty` in party-handlers.ts:616-700. |
| AC 2 | ✅ PASS | Member status set to 'left', `departed_at = CURRENT_TIMESTAMP`, `distance_kept` based on `party.leave_distance_behavior` (party-handlers.ts:653-657). |
| AC 3 | ✅ PASS | `computeContribution` called at party-handlers.ts:646. Incremental: `max(0, total - distance_at_join)`. Cumulative: `total`. Same logic as Story 3.4. |
| AC 4 | ✅ PASS | Leader departure at party-handlers.ts:660-679. Finds oldest active member via `ORDER BY joined_at ASC LIMIT 1`. Transfers role + `parties.leader_id`. If none found, dissolves. |
| AC 5 | ✅ PASS | Auto-dissolve uses `env.DB.batch(stmts)` at party-handlers.ts:693. Batch includes member update + dissolve statement for atomicity. Non-leader path also checks remaining count (party-handlers.ts:682-690). |
| AC 6 | ✅ PASS | `POST /api/party/:id/kick/:userId` routed in index.ts:209-229, handled by `handleKickMember` in party-handlers.ts:709-793. |
| AC 7 | ✅ PASS | Kicked member status set to 'kicked', `departed_at = CURRENT_TIMESTAMP` (party-handlers.ts:770-773). |
| AC 8 | ✅ PASS | `computeContribution` called at party-handlers.ts:755 before applying disposition. Stored in batch update (party-handlers.ts:772). |
| AC 9 | ✅ PASS | `removeDistance` boolean parsed from body (party-handlers.ts:758-764). `true` → `distance_kept = 0`, `false` → `distance_kept = 1`, absent → party default. |
| AC 10 | ✅ PASS | `PUT /api/party/:id/settings` routed in index.ts:231-243, handled by `handleUpdatePartySettings` in party-handlers.ts:801-892. Validates name (string, max 50, non-empty), leave_distance_behavior ('keep'/'remove'). Rejects distance_mode at party-handlers.ts:832-834. |
| AC 11 | ✅ PASS | `POST /api/party/:id/transfer-leadership` routed in index.ts:245-257, handled by `handleTransferLeadership` in party-handlers.ts:899-967. Validates new_leader_id is integer > 0, not self, active member. Uses `env.DB.batch` for atomic role swap. |
| AC 12 | ✅ PASS | `handleLeaveParty`: auth via `validateSession` (line 617), active membership check (line 637-643), 403 for non-members. `handleKickMember`: auth (line 716), leader check via `party.leader_id` (line 736-738), target active check (line 746-752), 400 self-kick, 404 non-member. `handleUpdatePartySettings`: auth (line 807), leader check (line 825), 404/400/403. `handleTransferLeadership`: auth (line 905), leader check (line 923), target active check (line 938-944), 400/404. |

**Issues Found:**

1. **MEDIUM — FIXED**: `handleTransferLeadership` used non-null assertion `currentLeaderMembership!.id` (party-handlers.ts:953). If the membership row were missing due to database inconsistency, this would throw an unhandled runtime error instead of a graceful 500. **Fix:** Added explicit null check returning 500 error before batch execution.
2. **LOW**: `handleUpdatePartySettings` and `handleTransferLeadership` verify leadership via `party.leader_id !== userId` but don't independently verify the user's membership status is 'active'. While currently safe (leaders are always active members — enforced by creation, leave, and transfer flows), this is a defense-in-depth gap. If database state became inconsistent, a "leader" with `status = 'kicked'` could still update settings. Acceptable for V1 — all mutation paths maintain consistency.
3. **LOW**: `handleKickMember` remaining-count check (party-handlers.ts:776-778) runs before the batch executes, creating a theoretical TOCTOU (time-of-check-time-of-use) window. Between the count query and batch execution, another member could leave. D1 batch provides atomicity for its own statements but doesn't prevent concurrent operations from interleaving. Acceptable for V1 — dissolution is a soft operation that can be corrected.
4. **LOW**: `handleLeaveParty` and `handleKickMember` share identical auto-dissolve logic (check remaining count → conditionally add dissolve statement). Could be extracted into a helper function. Current duplication is small (~8 lines). No change needed — acceptable verbosity for clarity.
5. **LOW**: `computeContribution` calls `calculateTotalDistance` which itself does a `SELECT * FROM progress` (goals-handlers.ts:29). For parties with many members being kicked in sequence, this could be N+1-ish. Acceptable for V1 — kick is a rare, leader-only operation.
6. **LOW**: Response from `handleLeaveParty` returns `{ message: 'You have left the party' }` (200). Could return 204 No Content for a delete-like operation. 200 with message body is consistent with other handlers in the codebase. No change needed.

**Review Decision: APPROVED** — 1 MEDIUM issue fixed (non-null assertion → explicit null check). 5 LOW issues documented (no fixes required). All 12 ACs validated.

## Change Log

- **2026-02-28 (Initial Implementation):** Implemented `handleLeaveParty`, `handleKickMember`, `handleUpdatePartySettings`, `handleTransferLeadership`, `computeContribution`. Added 4 routes in index.ts, 60 tests. All 406 tests pass.
- **2026-02-28 (Adversarial Review):** Fixed non-null assertion in `handleTransferLeadership` — added explicit null check for `currentLeaderMembership` before batch execution. All 406 tests pass.
