# Story 6.3: Fellowship Invite via Friends API

Status: review
Issue: #301

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **walker coordinating a fellowship with trusted friends**,
I want **authenticated API endpoints to invite accepted friends into a fellowship and let invitees accept or reject those invitations**,
so that **fellowship growth can require explicit consent while still reusing the existing party-membership rules instead of fragmenting social join behavior across multiple flows**.

## Acceptance Criteria

### AC1: Add durable fellowship-invite persistence that fits D1 and supports re-invites safely
- Add a new additive migration in `migrations/` using the next available sequence after the Story 6.1 social-schema migration lands.
- Create `fellowship_invites` with:
  - `id` INTEGER PRIMARY KEY AUTOINCREMENT
  - `party_id` INTEGER NOT NULL FK -> `parties.id` ON DELETE CASCADE
  - `inviter_id` INTEGER NOT NULL FK -> `users.id` ON DELETE CASCADE
  - `invitee_id` INTEGER NOT NULL FK -> `users.id` ON DELETE CASCADE
  - `status` TEXT NOT NULL supporting `pending`, `accepted`, and `rejected`
  - `created_at` DATETIME default/current timestamp
- Prevent duplicate **pending** invites for the same `(party_id, invitee_id)` pair while still allowing a later re-invite after rejection.
- Add indexes for invitee-focused badge/list queries and party-focused cleanup queries.
- Do not ship a schema rule that makes rejected rows permanent blockers for future invites.

### AC2: Provide the friend-based fellowship invite creation endpoint on the Worker router
- Add `POST /api/party/:id/invite-friend` to the manual route table in `src/index.ts` and to `getAllowedMethods()`.
- The endpoint accepts `{ user_id: number }`.
- The requester must be authenticated and an **active** party member of `party_id`.
- The target user must:
  - exist
  - not be the inviter
  - have an **accepted** friendship with the inviter in either friendship direction
  - not already be an active member of the party
  - not already have a pending invite to the same party
- Dissolved parties reject invite creation.
- Successful creation returns `201` with the created invite details needed by future UI consumers.

### AC3: Provide the pending fellowship-invite listing endpoint for the current user
- Add `GET /api/user/fellowship-invites` to the Worker router and allowlist.
- The endpoint requires authentication and returns only the current user’s **pending incoming** invites.
- Response contract:
  - `invites: [{ id, party_id, party_name, member_count, total_distance, inviter_username, created_at }]`
  - `count: number`
- `member_count` must use the same active-member semantics as the current party membership queries.
- `total_distance` must use the same party-progress contribution rules already used by the fellowship progress logic rather than inventing a second aggregation model.
- Dissolved parties must not continue surfacing as actionable pending invites.

### AC4: Provide accept and reject endpoints that enforce invite ownership and reuse join behavior
- Add `POST /api/user/fellowship-invites/:inviteId/accept` and `POST /api/user/fellowship-invites/:inviteId/reject` to `src/index.ts` and `getAllowedMethods()`.
- Both endpoints reject malformed `inviteId` values using the same strict positive-integer validation pattern already used for party/admin routes.
- Only the authenticated `invitee_id` of the pending invite can accept or reject it.
- Accepting an invite must reuse the same membership behavior as `POST /api/party/join/:inviteCode`:
  - fresh join creates an active `party_members` row
  - re-join reactivates an existing inactive row
  - `distance_at_join`, `last_viewed_distance`, and status fields follow the current join-party semantics exactly
- Rejecting an invite updates it to `rejected` and removes it from all pending-invite surfaces.
- Accept/reject actions fail cleanly for missing invites, non-pending invites, dissolved parties, or stale invites where the user is already an active member.

### AC5: Preserve current fellowship behavior and lifecycle guarantees
- Existing invite-code join flows remain functional and unchanged; friend invites are an additional join pathway, not a replacement.
- Pending fellowship invites are invalidated when a party is dissolved so users do not keep actionable invites to a dead party.
- Invite creation and invite acceptance must not bypass the current party-member rules or weaken authorization.
- Friendship checks for invite creation must be bidirectional against the accepted friendship state rather than assuming one requester/addressee ordering.
- This story must not add the Friends pages, Fellowships page badges, Drawer UI changes, or map social UI; it only provides backend surfaces those stories depend on.

### AC6: Keep the implementation modular and fully covered by backend/router tests
- Implement fellowship-invite behavior in a dedicated handler module instead of bloating unrelated auth or party files.
- Keep the Worker monolith structure, D1 prepared-statement usage, strict TypeScript style, and existing JSON response helpers.
- Add backend tests for success, validation failures, auth failures, ownership failures, duplicate-pending protection, dissolved-party invalidation, and rejoin-on-accept behavior.
- Extend router tests so every new fellowship-invite endpoint is registered and allowed methods are enforced correctly.
- Update living docs only when the final implementation semantics differ from the current plan.

## Tasks / Subtasks

- [x] **Task 1: Add fellowship-invite persistence** (AC: #1, #5)
  - [x] Add `migrations/0123_create_fellowship_invites.sql` or the next unused sequence after Story 6.1 lands; verify the final number before creation.
  - [x] Create `fellowship_invites` with the required columns, foreign keys, indexes, and a duplicate-pending guard that still allows re-invite after rejection.
  - [x] Keep the migration D1-safe and additive.

- [x] **Task 2: Add a dedicated fellowship-invite handler module** (AC: #2, #3, #4, #5, #6)
  - [x] Create `src/fellowship-invite-handlers.ts` for invite creation, listing, accept, reject, and any focused shared helpers.
  - [x] Reuse `validateSession`, `createErrorResponse`, and `createSuccessResponse` consistently with existing API handlers.
  - [x] Extract any reusable party-join helper only if doing so keeps `handleJoinParty()` and invite acceptance behavior truly identical.

- [x] **Task 3: Wire routes into the Worker router** (AC: #2, #3, #4, #6)
  - [x] Import the new handlers in `src/index.ts`.
  - [x] Add `POST /api/party/:id/invite-friend` with strict `partyId` validation.
  - [x] Add `GET /api/user/fellowship-invites`.
  - [x] Add `POST /api/user/fellowship-invites/:inviteId/accept` and `POST /api/user/fellowship-invites/:inviteId/reject` with strict `inviteId` validation.
  - [x] Update `getAllowedMethods()` for all three route shapes.

- [x] **Task 4: Implement invite creation and pending-list queries** (AC: #2, #3, #5)
  - [x] Verify inviter membership, friendship acceptance, target existence, active-membership absence, and no duplicate pending invite.
  - [x] Create the pending invite row and return the created invite payload.
  - [x] Build the pending-list query so it returns party preview data plus invite count without leaving dissolved-party invites actionable.
  - [x] Reuse existing party-member-count and progress-calculation semantics rather than introducing conflicting totals.

- [x] **Task 5: Implement accept/reject flows with lifecycle consistency** (AC: #4, #5)
  - [x] Accept only pending invites owned by the current user.
  - [x] Reuse current join semantics for fresh joins and re-joins.
  - [x] Mark accepted invites as `accepted` only after membership changes succeed.
  - [x] Reject only pending invites owned by the current user and mark them `rejected`.
  - [x] Invalidate pending invites when party dissolution paths run.

- [x] **Task 6: Add backend and router coverage** (AC: #2, #3, #4, #5, #6)
  - [x] Create `tests/api/fellowship-invite-handlers.test.ts` for unit-level invite coverage.
  - [x] Extend `tests/api/index.test.ts` for new route and method coverage.
  - [x] Extend `tests/api/user-isolation.test.ts` or add a focused social access-control suite for invite ownership/IDOR cases.
  - [x] Cover malformed IDs, non-member invite attempts, non-friend invite attempts, duplicate pending invites, stale invite acceptance, wrong-user accept/reject, dissolved-party invalidation, and rejoin acceptance behavior.

- [x] **Task 7: Align living documentation if needed** (AC: #6)
  - [x] Update `docs/api-reference.md` if response envelopes or failure semantics differ from the current draft.
  - [x] Update `docs/data-models.md` if the final schema strategy for duplicate-pending enforcement differs from the current description.
  - [x] Keep documentation aligned to implemented behavior only.

## Dev Notes

### Story Foundation

Story 6.3 turns the new friendship graph into a constrained fellowship-join pathway. The business value is not just convenience: it introduces consent-driven social joining without removing the existing invite-code flow. That means the implementation has to preserve party-join semantics exactly while adding a second, friendship-gated way to reach them.

### Hard Dependencies

Do not start implementation until these are live in the repository, not merely planned:

- **Story 6.1** for `friendships`, `users.friend_code`, and `users.avatar_id`
- **Story 6.2** for accepted-friend relationship APIs and the repository’s settled social-domain validation patterns
- **Story 3.3** for the current fellowship join behavior that this story must reuse

At story-creation time, Stories 6.1 and 6.2 are both `ready-for-dev`, not implemented. The docs already describe future social routes and tables ahead of the codebase.

### Existing Implementation Touchpoints

- `src/index.ts`
  - The Worker router is a manual `if/else` dispatch chain.
  - Every new route must also be added to `getAllowedMethods()`.
  - Parameterized routes use `matchRoute()` plus strict positive-integer guards before calling handlers.
- `src/party-handlers.ts`
  - `handleJoinParty()` is the source of truth for fresh-join vs re-join behavior.
  - `handleGetUserParties()` already defines the active-member-count query pattern used for fellowship previews.
  - Party dissolution already happens in leave/kick flows by setting `parties.dissolved_at`; Story 6.3 must invalidate pending invites in those same lifecycle paths.
- `src/auth-handlers.ts`
  - `validateSession()` is the standard gate for authenticated API access.
- `docs/data-models.md` and `docs/api-reference.md`
  - These files already describe `fellowship_invites` and invite endpoints, but they are target-state documentation, not implemented proof.

### Critical Implementation Guardrails

- **Do not assume the `fellowship_invites` table already exists.** It is documented ahead of implementation.
- **Do not force friend invites through the invite-code path.** Accepting a friend invite should reuse the same membership rules as invite-code joins, but it should not require generating or exposing an invite code.
- **Do not treat friendships as directional for invite eligibility.** Accepted friendships must be recognized in either requester/addressee orientation.
- **Do not pair retained `rejected` rows with an unconditional `UNIQUE(party_id, invitee_id)` rule.** That combination blocks legitimate re-invites. Use a SQLite-compatible duplicate-pending strategy that preserves the epic behavior.
- **Do not duplicate join logic carelessly.** If shared code is extracted, both invite-code joins and invite acceptance must keep identical `distance_at_join`, `last_viewed_distance`, rejoin, and membership-status behavior.
- **Do not forget dissolution cleanup.** Pending invites to a dissolved party must be invalidated where the party lifecycle actually transitions to dissolved.
- **Do not expand into UI work.** Drawer badges, Fellowships page invite surfaces, and Friend/Profile pages belong to later stories.

### Architecture Compliance

- Runtime remains a single Cloudflare Worker monolith with explicit route dispatch.
- D1 remains the source of truth; use prepared statements and existing response helpers.
- Keep new social invitation behavior in backend domain modules first so later SSR pages and islands can stay thin.
- Respect strict TypeScript and avoid `any` in new code.

### Library / Framework Requirements

- Use the existing Workers runtime APIs and D1 prepared-statement style already used in `src/party-handlers.ts`.
- Keep schema/index strategy SQLite-compatible for Cloudflare D1.
- No new third-party library is required for this story.

### File Structure Requirements

- `migrations/0123_create_fellowship_invites.sql` or the next available migration after Story 6.1 lands
- `src/fellowship-invite-handlers.ts`
- `src/index.ts`
- `tests/api/fellowship-invite-handlers.test.ts`
- `tests/api/index.test.ts`
- `tests/api/user-isolation.test.ts` or a dedicated social access-control suite
- `docs/api-reference.md`
- `docs/data-models.md`

### Testing Requirements

- Add handler tests for:
  - unauthenticated access
  - malformed `partyId` and `inviteId`
  - invite by non-member
  - invite by unrelated/non-friend user
  - invite of nonexistent target user
  - self-invite rejection
  - invite of already active member
  - duplicate pending invite rejection
  - accept by wrong user
  - reject by wrong user
  - accept of dissolved-party invite
  - accept when invitee already rejoined via invite code
  - successful fresh-join acceptance
  - successful re-join acceptance
  - pending-invite invalidation on party dissolution
- Add router tests so every new endpoint is reachable and method restrictions are correct.
- Keep test doubles aligned with the repo’s current module-mocking pattern in `tests/api/index.test.ts`.

### Previous Story Intelligence

Story 6.2 established the main social-backend guardrails that still apply here:

- social docs are ahead of live code
- `getAllowedMethods()` drift is an easy way to ship broken routes
- social-domain logic should live in dedicated handler modules, not be mixed into unrelated auth or party files
- bidirectional relationship checks and strict ownership validation are the most failure-prone parts of the social layer

Story 6.3 should build directly on Story 6.2’s accepted-friend model instead of re-deriving relationship semantics independently inside party code.

### Git Intelligence Summary

Recent repository activity remains consistent with small, domain-focused backend changes plus matching test updates rather than large architectural rewrites:

- latest commits are dependency-maintenance merges and version bumps
- the most recent feature-oriented merge before those is admin-search work, reinforcing the pattern of focused handler changes with accompanying tests

### Latest Technical Information

Current Cloudflare guidance still aligns with the repository’s established implementation model for this story:

- D1 uses SQLite SQL semantics and supports explicit index creation, so the invite-table uniqueness strategy should stay SQLite-compatible
- prepared statements remain the correct query pattern for Worker handlers

No platform change was identified that would justify deviating from the repo’s current Worker + D1 approach.

### Project Context Reference

Project-level rules still apply here:

- keep new behavior within the single Worker architecture
- D1 is the source of truth
- strict TypeScript is expected
- backend changes need test coverage and documentation alignment
- new social APIs should not trigger unrelated frontend rewrites

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.3: Fellowship Invite via Friends API]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6: Friends & Social Identity]
- [Source: _bmad-output/implementation-artifacts/6-2-friend-request-api.md]
- [Source: _bmad-output/implementation-artifacts/6-1-friends-database-schema-avatar-system.md]
- [Source: _bmad-output/project-context.md]
- [Source: docs/api-reference.md]
- [Source: docs/data-models.md]
- [Source: docs/architecture.md]
- [Source: src/index.ts]
- [Source: src/party-handlers.ts]
- [Source: src/auth-handlers.ts]
- [Source: tests/api/index.test.ts]
- [Source: tests/api/party-handlers.test.ts]
- [Source: tests/api/user-isolation.test.ts]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4

### Debug Log References

- Story created from Epic 6 planning artifacts plus direct validation against the live Worker router, current party join/dissolution logic, current route-test structure, and the existing Story 6.1/6.2 implementation artifacts.

### Completion Notes List

- All 7 tasks completed. 28 test suites, 973 tests passing (59 new tests added).
- Overall coverage maintained at ~92.7% statements; fellowship-invite-handlers.ts at 99.1% statement coverage.
- Used partial unique index `CREATE UNIQUE INDEX ... WHERE status = 'pending'` for D1-compatible duplicate-pending prevention that allows re-invites after rejection.
- Join logic in accept handler directly mirrors handleJoinParty's fresh-join and re-join semantics (same SQL, same field resets) rather than extracting a shared helper, to avoid risk of breaking existing tests.
- Dissolution cleanup added to all 3 dissolution paths in party-handlers.ts (handleLeaveParty: leader-no-successor + non-leader-last-member, handleKickMember: no-remaining-members).
- Pending invites listing defensively filters out dissolved parties via `p.dissolved_at IS NULL`.
- total_distance calculation for invite listing uses the same party-progress contribution rules (incremental/cumulative active members + departed kept contributions).
- Docs updated to reflect actual implementation: partial unique index strategy and dissolution invalidation behavior.

#### Code Review Fixes Applied
- **HIGH #1**: Accept handler membership changes and invite status update now use `env.DB.batch()` for atomicity in both fresh-join and re-join paths.
- **HIGH #2**: Pending invite listing now calculates total_distance inline via SQL subqueries (1 query instead of 1+2N), eliminating the N+1 `calculatePartyTotalDistance()` loop. Removed the now-unused `calculatePartyTotalDistance` function, `ActiveMemberDistanceRow` interface.
- **MEDIUM**: Pending invite listing filters out invites where invitee is already an active member via `NOT EXISTS` clause.
- **MEDIUM**: Accept handler UPDATE uses optimistic locking (`WHERE status = 'pending'`) and checks `meta.changes` to detect races, returning 409 on conflict.

### File List

- _bmad-output/implementation-artifacts/6-3-fellowship-invite-via-friends-api.md
- migrations/0123_create_fellowship_invites.sql (NEW)
- src/fellowship-invite-handlers.ts (NEW)
- src/index.ts (MODIFIED — routes + getAllowedMethods)
- src/party-handlers.ts (MODIFIED — dissolution cleanup for pending invites)
- tests/api/fellowship-invite-handlers.test.ts (NEW)
- tests/api/index.test.ts (MODIFIED — router tests for new endpoints)
- tests/api/party-management.test.ts (MODIFIED — updated batch length assertions for dissolution cleanup)
- docs/api-reference.md (MODIFIED — implementation note for Story 6.3)
- docs/data-models.md (MODIFIED — updated duplicate-pending strategy and index descriptions)