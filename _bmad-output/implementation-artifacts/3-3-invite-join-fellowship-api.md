# Story 3.3: Invite & Join Fellowship API

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a User,
I want to invite friends to my Fellowship, join existing Fellowships using an invite code, and see which parties I belong to,
so that I can share my walking journey and progress with others across multiple parties.

## Acceptance Criteria

1. Create a `GET /api/party/join/:inviteCode` endpoint to preview a party before joining (return name, member count, current distance, `distance_mode`, `leave_distance_behavior`).
2. Create a `POST /api/party/join/:inviteCode` endpoint to join a party via its invite code.
3. On join: Insert the user into the `party_members` table and record `distance_at_join` equal to the user's current total distance, `last_viewed_distance` = 0, and `departed_at` = NULL.
4. **Re-join:** If user previously left/was kicked from the party, reactivate the existing `party_members` record (set status to `active`, refresh `joined_at` + `distance_at_join`, reset `last_viewed_distance` to 0, and clear departure fields). Return 400 if party is dissolved (`dissolved_at` is not NULL).
5. Create a `POST /api/party/:id/invite` endpoint to generate a new invite code (leader only). Regeneration must invalidate the previous invite code immediately. Response must include the new invite code **and** the full shareable invite URL (format: `{request.origin}/party/join/{inviteCode}`) so the UI can display a copyable/shareable link.
6. **Create a `GET /api/user/parties` endpoint** to return the list of all parties the user is an active member of (id, name, role, distance_mode, leave_distance_behavior, active_member_count). Exclude dissolved parties by default. Accept optional `?include_dissolved=true` query parameter to also return dissolved parties (with `dissolved_at` field) for the Fellowships list page history section.
7. Validate: Prevent a user from joining a party they already have an active membership in (no duplicate active memberships).
8. Allow users to join multiple different parties — no single-party restriction.
9. Return a 404 Not Found error for invalid invite codes.
10. Security: Verify implicit opt-in (joining is the consent action).
11. Security: Validate Invite Code integrity (prevent enumeration/brute-force). Ensure any code checks use secure/constant-time comparisons or appropriately rate-limit guessing.

## Tasks / Subtasks

- [ ] Task 1: API Route Setup (AC: 1, 2, 5, 6)
  - [ ] Add `GET /api/party/join/:inviteCode` route to the Cloudflare Worker router in `src/index.ts`.
  - [ ] Add `POST /api/party/join/:inviteCode` route to the Cloudflare Worker router in `src/index.ts`.
  - [ ] Add `POST /api/party/:id/invite` route to the Cloudflare Worker router in `src/index.ts`.
  - [ ] Add `GET /api/user/parties` route to the Cloudflare Worker router in `src/index.ts`.
  - [ ] Implement authentication checks for all POST routes and `GET /api/user/parties`; keep `GET /api/party/join/:inviteCode` public (preview-only, no user-specific data) to support the deep-link invite flow where non-authenticated users need to see the party preview before logging in.
- [ ] Task 2: Join Logic & Validation (AC: 2, 3, 4, 7, 8, 9, 10, 11)
  - [ ] For `GET` preview, query the `parties` and `party_members` table to return the name, member count, current calculated distance, `distance_mode`, and `leave_distance_behavior`. Return 404 if not found. Return 400 if party is dissolved.
  - [ ] For `POST` join, validate the invite code exists (return 404 if not).
  - [ ] Prevent duplicate active joins — check for existing active membership in the same party.
  - [ ] **Re-join:** If user has a previous 'left' or 'kicked' record for this party, reactivate that existing `party_members` record and reset join/departure fields for a fresh membership baseline.
  - [ ] Allow the user to have active memberships in multiple different parties simultaneously.
  - [ ] Retrieve user's current total distance and insert into `party_members` with `distance_at_join`, `last_viewed_distance` = 0, and `departed_at` = NULL.
- [ ] Task 3: Invite Generation Logic (AC: 5)
  - [ ] For `POST` invite generation, verify the current user is the leader of the specified party.
  - [ ] Generate a new cryptographically secure invite code and update the `parties` table, invalidating the previous code.
- [ ] Task 4: User Parties Endpoint (AC: 6)
  - [ ] Query `party_members` and `parties` tables to return all parties where user has status = 'active' and party is not dissolved (by default).
  - [ ] Accept optional `?include_dissolved=true` query parameter. When true, also return parties where user has a membership record AND party is dissolved (with `dissolved_at` field).
  - [ ] Return: id, name, role, distance_mode, leave_distance_behavior, active_member_count, dissolved_at (if applicable) for each party.

## Dev Notes

- **Architecture Details**: 
  - The database schema was established in Story 3.1. Ensure queries use the `parties` and `party_members` tables.
  - The API for creating a fellowship is in Story 3.2, which probably created `src/party-handlers.ts`. Keep new routes there.
  - Note: Rate-limiting may need to be considered if deployed, but within the worker, rely on basic integrity checks.
- **Multi-party Support**: Users can join multiple parties. The only uniqueness constraint is one active membership per party per user. Querying `party_members WHERE user_id = ? AND status = 'active'` returns all parties a user belongs to.
- **Re-join Mechanism**: When a user re-joins a party they previously left/were kicked from, reactivate the existing `party_members` record and refresh the join baseline fields. Keep one membership row per (party_id, user_id).
- **Dissolved Party Check**: On join attempts, verify the party's `dissolved_at` is NULL. Return 400 with appropriate message if the party has been dissolved.
- **`GET /api/user/parties` Endpoint**: This endpoint is used by Story 3.6 (Journey & Map Party Selector) to populate the party dropdown. It should only return parties where the user has an active membership AND the party is not dissolved.
- **Preview Response**: Include `distance_mode` and `leave_distance_behavior` in the preview response so users understand the party's rules before joining.
- **Preview Endpoint Authentication**: The `GET /api/party/join/:inviteCode` preview endpoint should work for **both authenticated and non-authenticated users** — it returns party name, member count, and settings. This is needed for the deep-link invite flow (Story 3.7) where non-authenticated users land on `/party/join/:inviteCode` and need to see the party preview before logging in. The `POST` join endpoint still requires authentication.
- **Invite URL Format**: The `POST /api/party/:id/invite` response should include both the raw `inviteCode` and the full `inviteUrl` (format: `{request.url.origin}/party/join/{inviteCode}`). The UI uses `inviteUrl` for the "Copy Link" and "Share" buttons on the detail page (Story 3.7).
- **Invite Code Security**: Use `crypto.getRandomValues()` or similar to ensure the invite code is not predictable or enumerable, just like in Story 3.2.
- **Authentication**: Utilize the existing authentication flow (JWT/Session) built into `auth-utils.ts` and ensure the current user ID is properly extracted.

### Project Structure Notes

- Add the route logic to the server-side Worker, inside `src/party-handlers.ts`, and wire up the route definitions inside `src/index.ts`.
- Stay consistent with error handling mechanisms from existing handlers.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3: Invite & Join Fellowship API]
- [Source: docs/architecture.md#ADR-004: Fellowship Data Model Direction]
- [Source: docs/data-models.md]

### change-impact

Requirements expanded from original spec:
- Preview response now includes `distance_mode` and `leave_distance_behavior` party settings
- Multi-party join explicitly allowed — users can have active memberships in multiple different parties
- `last_viewed_distance` initialized to 0 on join; `departed_at` initialized to NULL
- **Re-join reactivates existing membership record** — no duplicate rows per user+party
- **`GET /api/user/parties` endpoint added** — returns all active party memberships for the user
- Dissolved party check added on join (return 400 if dissolved)
- **Preview endpoint works without authentication** — needed for deep-link invite flow where non-authenticated users see the party preview before logging in
- **Invite response includes full URL** — `POST /api/party/:id/invite` returns both `inviteCode` and `inviteUrl` (format: `{origin}/party/join/{inviteCode}`) for the share/copy UI
- **Invite regeneration invalidates previous code immediately** — no invite expiry model required

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
