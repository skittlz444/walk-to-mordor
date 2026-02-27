# Story 3.2: Create Fellowship API

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want to create the API endpoint for creating a new Fellowship with the current user as the leader, including party settings configuration,
so that users can form parties with customized distance calculation and leave behavior settings, establishing the foundation for multiplayer features.

## Acceptance Criteria

1. Create a `POST /api/party` endpoint to create a new party.
2. Accept a JSON request body with `{ name: string, distance_mode?: 'cumulative' | 'incremental', leave_distance_behavior?: 'keep' | 'remove' }`. Validate that `name` is required and has a max length of 50 characters.
3. `distance_mode` defaults to 'incremental' if not provided. Must be 'cumulative' or 'incremental' if provided.
4. `distance_mode` is immutable after party creation and cannot be changed by `PUT /api/party/:id/settings`.
5. `leave_distance_behavior` defaults to 'keep' if not provided. Must be 'keep' or 'remove' if provided.
6. Generate a unique, cryptographically secure/non-enumerable 8-character alphanumeric invite code.
7. Set the creator as the leader in the `party_members` table and record `distance_at_join` equal to the user's current total distance, and `last_viewed_distance` = 0.
8. Return the newly created party details, including the generated invite code and configured settings (`distance_mode`, `leave_distance_behavior`).
9. Return a 401 Unauthorized status if the request is not authenticated.
10. Users can create multiple parties — no restriction on the number of parties a user can lead.

## Tasks / Subtasks

- [ ] Task 1: API Route Setup (AC: 1, 8)
  - [ ] Add `POST /api/party` route to the Cloudflare Worker router in `src/index.ts`.
  - [ ] Implement authentication middleware/check to ensure a 401 is returned if unauthenticated.
- [ ] Task 2: Input Validation & Invite Code Generation (AC: 2, 3, 5, 6)
  - [ ] Validate request body for `name` (required, <= 50 chars). Add validators to `src/validators.ts` if needed.
  - [ ] Validate `distance_mode` is 'cumulative' or 'incremental' if provided, default to 'incremental'.
  - [ ] Validate `leave_distance_behavior` is 'keep' or 'remove' if provided, default to 'keep'.
  - [ ] Create a utility for cryptographically secure 8-character invite code generation (e.g., using `crypto.getRandomValues`).
- [ ] Task 3: Database Insertion (AC: 6, 7)
  - [ ] Retrieve the user's current total distance (from progress aggregate or pre-calculated fields) for `distance_at_join`.
  - [ ] Insert the new party into the `parties` table with `distance_mode` and `leave_distance_behavior` settings.
  - [ ] Insert the user as the leader into the `party_members` table with `last_viewed_distance` = 0. Using SQLite transactions is recommended to ensure consistency.
- [ ] Task 4: Response Handling (AC: 8)
  - [ ] Return the party details (id, name, invite_code, distance_mode, leave_distance_behavior) as JSON.

## Dev Notes

- **Architecture Details**: 
  - The database schema was established in Story 3.1. Ensure queries use the newly created `parties` and `party_members` tables.
  - Transactions should be used for the DB inserts (create party and create party_members entry) if supported by the D1 client.
- **Party Settings**: `distance_mode` and `leave_distance_behavior` are party-level settings configured at creation time by the leader. These settings govern how progress is calculated (Story 3.4) and what happens when members leave/are kicked (Story 3.5).
- **Distance Mode Immutability**: `distance_mode` is intentionally creation-only. Story 3.5 settings updates should not allow changes to this field.
- **Invite Code Security**: Use `crypto.getRandomValues()` or similar to ensure the invite code is not predictable or enumerable.
- **Authentication**: Utilize the existing authentication flow (JWT/Session) built into `auth-utils.ts` and ensure the current user ID is properly extracted.
- **Multi-party**: Users can create multiple parties. No unique constraint prevents a user from being a leader of many parties.

### Project Structure Notes

- Add the route logic to the server-side Worker. Likely place it inside a new `src/party-handlers.ts` file, and wire up the route definitions inside `src/index.ts`.
- Stay consistent with error handling mechanisms from existing handlers.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2: Create Fellowship API]
- [Source: docs/architecture.md#ADR-004: Fellowship Data Model Direction]
- [Source: docs/data-models.md]

### change-impact

Requirements expanded from original spec:
- Request body now includes optional `distance_mode` and `leave_distance_behavior` settings
- `distance_mode` is immutable after creation (settings API cannot modify it)
- Response includes party settings in addition to basic details
- `last_viewed_distance` initialized to 0 on party_members insert
- Multi-party creation explicitly supported (no limit)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
