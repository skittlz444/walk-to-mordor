# Story 3.2: Create Fellowship API

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want to create the API endpoint for creating a new Fellowship with the current user as the leader,
so that users can form parties and establish the foundation for multiplayer features.

## Acceptance Criteria

1. Create a `POST /api/party` endpoint to create a new party.
2. Accept a JSON request body with `{ name: string }`. Validate that `name` is required and has a max length of 50 characters.
3. Generate a unique, cryptographically secure/non-enumerable 8-character alphanumeric invite code.
4. Set the creator as the leader in the `party_members` table and record `distance_at_join` equal to the user's current total distance.
5. Return the newly created party details, including the generated invite code.
6. Return a 401 Unauthorized status if the request is not authenticated.

## Tasks / Subtasks

- [ ] Task 1: API Route Setup (AC: 1, 6)
  - [ ] Add `POST /api/party` route to the Cloudflare Worker router in `src/index.ts`.
  - [ ] Implement authentication middleware/check to ensure a 401 is returned if unauthenticated.
- [ ] Task 2: Input Validation & Invite Code Generation (AC: 2, 3)
  - [ ] Validate request body for `name` (required, <= 50 chars). Add validators to `src/validators.ts` if needed.
  - [ ] Create a utility for cryptographically secure 8-character invite code generation (e.g., using `crypto.getRandomValues`).
- [ ] Task 3: Database Insertion (AC: 4)
  - [ ] Retrieve the user's current total distance (from progress aggregate or pre-calculated fields) for `distance_at_join`.
  - [ ] Insert the new party into the `parties` table.
  - [ ] Insert the user as the leader into the `party_members` table. Using SQLite transactions is recommended to ensure consistency.
- [ ] Task 4: Response Handling (AC: 5)
  - [ ] Return the party details (id, name, invite_code) as JSON.

## Dev Notes

- **Architecture Details**: 
  - The database schema was established in Story 3.1. Ensure queries use the newly created `parties` and `party_members` tables.
  - Transactions should be used for the DB inserts (create party and create party_members entry) if supported by the D1 client.
- **Invite Code Security**: Use `crypto.getRandomValues()` or similar to ensure the invite code is not predictable or enumerable.
- **Authentication**: Utilize the existing authentication flow (JWT/Session) built into `auth-utils.ts` and ensure the current user ID is properly extracted.

### Project Structure Notes

- Add the route logic to the server-side Worker. Likely place it inside a new `src/party-handlers.ts` file, and wire up the route definitions inside `src/index.ts`.
- Stay consistent with error handling mechanisms from existing handlers.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2: Create Fellowship API]
- [Source: docs/architecture.md#ADR-004: Fellowship Data Model Direction]
- [Source: docs/data-models.md]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
