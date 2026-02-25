# Story 3.3: Invite & Join Fellowship API

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a User,
I want to invite friends to my Fellowship and join existing Fellowships using an invite code,
so that I can share my walking journey and progress with others.

## Acceptance Criteria

1. Create a `GET /api/party/join/:inviteCode` endpoint to preview a party before joining (return name, member count, and current distance).
2. Create a `POST /api/party/join/:inviteCode` endpoint to join a party via its invite code.
3. On join: Insert the user into the `party_members` table and record `distance_at_join` equal to the user's current total distance.
4. Create a `POST /api/party/:id/invite` endpoint to generate a new invite link (leader only).
5. Validate: Prevent a user from joining a party they are already a member of (or joining their own party twice).
6. Return a 404 Not Found error for invalid invite codes.
7. Security: Verify implicit opt-in (joining is the consent action).
8. Security: Validate Invite Code integrity (prevent enumeration/brute-force). Ensure any code checks use secure/constant-time comparisons or appropriately rate-limit guessing.

## Tasks / Subtasks

- [ ] Task 1: API Route Setup (AC: 1, 2, 4)
  - [ ] Add `GET /api/party/join/:inviteCode` route to the Cloudflare Worker router in `src/index.ts`.
  - [ ] Add `POST /api/party/join/:inviteCode` route to the Cloudflare Worker router in `src/index.ts`.
  - [ ] Add `POST /api/party/:id/invite` route to the Cloudflare Worker router in `src/index.ts`.
  - [ ] Implement authentication checks for the POST routes (and GET if required by privacy policy).
- [ ] Task 2: Join Logic & Validation (AC: 2, 3, 5, 6, 7, 8)
  - [ ] For `GET` preview, query the `parties` and `party_members` table to return the name, member count, and current calculated distance. Return 404 if not found.
  - [ ] For `POST` join, validate the invite code exists (return 404 if not).
  - [ ] Prevent duplicate joins using a database query or unique constraint catch.
  - [ ] Retrieve user's current total distance and insert into `party_members` with `distance_at_join`.
- [ ] Task 3: Invite Generation Logic (AC: 4)
  - [ ] For `POST` invite generation, verify the current user is the leader of the specified party.
  - [ ] Generate a new cryptographically secure invite code and update the `parties` table.

## Dev Notes

- **Architecture Details**: 
  - The database schema was established in Story 3.1. Ensure queries use the `parties` and `party_members` tables.
  - The API for creating a fellowship is in Story 3.2, which probably created `src/party-handlers.ts`. Keep new routes there.
  - Note: Rate-limiting may need to be considered if deployed, but within the worker, rely on basic integrity checks.
- **Invite Code Security**: Use `crypto.getRandomValues()` or similar to ensure the invite code is not predictable or enumerable, just like in Story 3.2.
- **Authentication**: Utilize the existing authentication flow (JWT/Session) built into `auth-utils.ts` and ensure the current user ID is properly extracted.

### Project Structure Notes

- Add the route logic to the server-side Worker, inside `src/party-handlers.ts`, and wire up the route definitions inside `src/index.ts`.
- Stay consistent with error handling mechanisms from existing handlers.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3: Invite & Join Fellowship API]
- [Source: docs/architecture.md#ADR-004: Fellowship Data Model Direction]
- [Source: docs/data-models.md]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
