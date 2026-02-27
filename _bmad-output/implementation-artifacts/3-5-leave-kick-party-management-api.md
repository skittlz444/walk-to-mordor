# Story 3.5: Leave, Kick & Party Management API

Status: ready-for-dev

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

- [ ] Task 1: API Route Setup (AC: 1, 6, 10, 11)
  - [ ] Add `POST /api/party/:id/leave` route to `src/index.ts`.
  - [ ] Add `POST /api/party/:id/kick/:userId` route to `src/index.ts`.
  - [ ] Add `PUT /api/party/:id/settings` route to `src/index.ts`.
  - [ ] Add `POST /api/party/:id/transfer-leadership` route to `src/index.ts`.
  - [ ] Implement authentication checks for all routes.
- [ ] Task 2: Leave Party Logic (AC: 1, 2, 3, 4, 5, 12)
  - [ ] Create `handleLeaveParty` in `src/party-handlers.ts`.
  - [ ] Validate user is an active member.
  - [ ] Calculate `contribution_at_departure` based on party's `distance_mode`.
  - [ ] Update `party_members` with 'left' status, `departed_at`, `distance_kept`, and `contribution_at_departure`.
  - [ ] Handle leader departure (transfer to oldest active member or dissolve).
  - [ ] Implement auto-dissolve logic using D1 batch transaction.
- [ ] Task 3: Kick Member Logic (AC: 6, 7, 8, 9, 12)
  - [ ] Create `handleKickMember` in `src/party-handlers.ts`.
  - [ ] Validate requesting user is the leader and target user is an active member.
  - [ ] Calculate `contribution_at_departure`.
  - [ ] Apply `removeDistance` override if provided, otherwise use party default.
  - [ ] Update `party_members` with 'kicked' status, `departed_at`, `distance_kept`, and `contribution_at_departure`.
  - [ ] Implement auto-dissolve logic if the last active member is kicked.
- [ ] Task 4: Update Settings Logic (AC: 10, 12)
  - [ ] Create `handleUpdatePartySettings` in `src/party-handlers.ts`.
  - [ ] Validate requesting user is the leader.
  - [ ] Validate request body (`name`, `leave_distance_behavior`).
  - [ ] Update `parties` table. Ensure `distance_mode` is not updated.
- [ ] Task 5: Transfer Leadership Logic (AC: 11, 12)
  - [ ] Create `handleTransferLeadership` in `src/party-handlers.ts`.
  - [ ] Validate requesting user is the leader and `new_leader_id` is an active member.
  - [ ] Update `party_members` roles and `parties.leader_id` using a transaction.

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
