# Story 6.2: Friend Request API

Status: done
Issue: #300

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **walker who wants to connect with other users safely**,
I want **authenticated API endpoints for friend discovery, friend requests, and friend relationship management**,
so that **the later Friends UI, fellowship invite flows, and social map features can build on a secure, reusable social API surface instead of inventing ad hoc behavior in each page**.

## Acceptance Criteria

### AC1: Provide the complete friend-request API surface on the Worker router
- Add the Story 6.2 friend endpoints to the Worker route table in `src/index.ts` and to `getAllowedMethods()` so method enforcement matches the actual handlers.
- Implement these routes:
  - `GET /api/friends`
  - `GET /api/friends/pending`
  - `GET /api/friends/search?q=<username>`
  - `GET /api/friends/resolve/:friendCode`
  - `POST /api/friends/request`
  - `POST /api/friends/request/code`
  - `POST /api/friends/:friendshipId/accept`
  - `POST /api/friends/:friendshipId/reject`
  - `DELETE /api/friends/:friendshipId`
- Keep route ordering disciplined so new parameterized friend routes do not accidentally shadow existing or future routes.

### AC2: Enforce authentication, authorization, and relationship ownership correctly
- All friend endpoints except code resolution require a valid session and return `401` when unauthenticated.
- Accept/reject operations only succeed when the current user is the `addressee_id` of the pending friendship.
- Delete operations only succeed when the current user is one of the two users in the friendship record.
- Requests by `friendshipId` reject malformed IDs with the same positive-integer guard pattern already used for party/admin routes.
- All relationship mutations prevent IDOR by checking the current user against the actual row being modified rather than trusting client input.

### AC3: Support discovery and listing endpoints with the exact response contracts from the epic
- `GET /api/friends` returns accepted friends for the current user with `{ id, username, avatar_id, last_progressed }`.
- `GET /api/friends/pending` returns incoming pending requests with `{ id, username, avatar_id, created_at }` and a badge count.
- `GET /api/friends/search?q=<username>` performs a username-prefix search with a minimum length of 3, excludes the current user, limits results to 10, and returns `{ id, username, avatar_id, friendship_status }` where status is `null`, `pending`, or `accepted`.
- `GET /api/friends/resolve/:friendCode` resolves an existing `users.friend_code` to `{ username, avatar_id }` and returns `404` for invalid codes.

### AC4: Handle request creation, acceptance, rejection, and removal safely
- `POST /api/friends/request` accepts `{ user_id: number }` and creates a pending friendship when the target exists and no friendship already exists in either direction.
- `POST /api/friends/request/code` accepts `{ friend_code: string }`, resolves the target user, then reuses the same request-creation rules as the user-id flow.
- Request creation returns `400` for self-friend attempts and for duplicate pending or accepted relationships.
- `POST /api/friends/:friendshipId/accept` transitions a pending request to accepted.
- `POST /api/friends/:friendshipId/reject` deletes the pending friendship row rather than leaving a rejected status behind.
- `DELETE /api/friends/:friendshipId` removes an accepted friendship as a mutual unfriend action.

### AC5: Apply the data and query guardrails required by the current architecture
- Do not create a second reverse-direction friendship row when one already exists; duplicate checks must consider both `(requester_id, addressee_id)` and `(addressee_id, requester_id)`.
- Rate limit outgoing pending requests to a maximum of 20 per requester at any time.
- Avoid an N+1 query pattern for `last_progressed`; compute it in SQL with a grouped progress subquery or equivalent single-query approach.
- Escape username search wildcards consistently with the repository’s existing `LIKE ... ESCAPE '\\'` pattern so prefix search is safe.
- Reuse the shared secure 8-character friend-code conventions created in Story 6.1 instead of introducing a second code format or validator.

### AC6: Preserve current architecture and testing quality bars
- Implement the new logic in a dedicated social-domain handler module instead of mixing friend behavior into unrelated files.
- Keep the Worker monolith structure, D1 prepared statement usage, strict TypeScript approach, and existing JSON response helpers.
- Add backend tests for success, validation failure, auth failure, IDOR failure, duplicate prevention, and rate limiting.
- Extend router tests so every new friend endpoint is actually registered and allowed methods are enforced correctly.
- Do not add UI pages, map rendering, or fellowship-invite endpoints in this story; those belong to later Epic 6 stories.

## Tasks / Subtasks

- [x] **Task 1: Add a dedicated friends handler module** (AC: #1, #2, #3, #4, #5)
  - [x] Create `src/friends-handlers.ts` following the same domain-module pattern as `src/party-handlers.ts`.
  - [x] Export focused handlers for list, pending, search, resolve, request, request-by-code, accept, reject, and delete flows.
  - [x] Use `validateSession`, `createErrorResponse`, and `createSuccessResponse` consistently with existing API handlers.

- [x] **Task 2: Wire friend routes into the Worker router** (AC: #1, #2, #6)
  - [x] Import the new handlers in `src/index.ts`.
  - [x] Add exact route branches for `/api/friends`, `/api/friends/pending`, `/api/friends/search`, `/api/friends/request`, and `/api/friends/request/code`.
  - [x] Add parameterized route handling for `/api/friends/resolve/:friendCode`, `/api/friends/:friendshipId/accept`, `/api/friends/:friendshipId/reject`, and `DELETE /api/friends/:friendshipId`.
  - [x] Update `getAllowedMethods()` for every new exact and parameterized endpoint so method validation does not silently reject valid requests.

- [x] **Task 3: Implement read endpoints with efficient D1 queries** (AC: #2, #3, #5)
  - [x] Build the accepted-friends query so it returns the other user in each accepted friendship plus `avatar_id` and `last_progressed`.
  - [x] Build the pending-incoming query so it returns requester identity plus request timestamp and count.
  - [x] Build the username-prefix search query with a 3-character minimum, wildcard escaping, 10-result limit, and friendship-status decoration.
  - [x] Build the friend-code resolution query against `users.friend_code` using the Story 6.1 code format.

- [x] **Task 4: Implement mutation endpoints with bidirectional duplicate protection** (AC: #2, #4, #5)
  - [x] Implement request creation by `user_id` with self-target rejection, existence checks, duplicate checks in both directions, and the 20-pending-request limit.
  - [x] Implement request creation by `friend_code` by resolving the target and reusing the same validation path as the user-id flow.
  - [x] Implement accept so only the addressee can promote a pending request to accepted.
  - [x] Implement reject so only the addressee can delete a pending request.
  - [x] Implement unfriend so either party can delete an accepted friendship.

- [x] **Task 5: Add backend and router test coverage** (AC: #2, #3, #4, #5, #6)
  - [x] Create `tests/api/friends-handlers.test.ts` for unit-level handler coverage.
  - [x] Extend `tests/api/index.test.ts` so all new routes and methods are asserted.
  - [x] Cover rate-limit failures, reverse-direction duplicate requests, short-search rejection, and malformed `friendshipId` handling.

- [x] **Task 6: Update living API documentation if implementation details shift from the current plan** (AC: #6)
  - [x] Updated `docs/api-reference.md` to align response envelopes with actual implementation (id fields, pending key, resolve auth requirement).
  - [x] Marked unimplemented endpoints (positions, profile) as planned for later stories.

## Dev Notes

### Story Foundation

Story 6.2 is the first real social API layer on top of the schema groundwork from Story 6.1. The epic plan treats it as the backend contract for later Friends UI pages, friend-based fellowship invitations, and social identity features. That makes this story a pivotal integration point: if the API semantics drift here, later Epic 6 stories will either duplicate logic in islands or carry inconsistent social rules across the product.

### Hard Dependency on Story 6.1

Do not start implementation until Story 6.1 is actually implemented, not merely planned. Story 6.2 assumes all of the following exist in the live schema and codebase:

- `friendships` table
- `users.friend_code`
- `users.avatar_id`
- registration and test-auth user creation paths that populate `friend_code`

At story-creation time, the repository does **not** yet contain those schema changes. The Story 6.1 artifact is `ready-for-dev`, and the current docs already describe future social fields/routes that the codebase still lacks.

### Existing Implementation Touchpoints

- `src/index.ts`
  - The Worker router is a manual `if/else` chain.
  - All new endpoints must also be added to `getAllowedMethods()`.
  - Parameterized routes use `matchRoute()` and explicit positive-integer validation before entering handlers.
- `src/auth-handlers.ts`
  - `validateSession()` is the standard session gate for authenticated APIs.
  - `ALLOW_TEST_AUTH=true` mock-user creation currently exists and must remain compatible with Story 6.1 social-schema updates.
- `src/party-handlers.ts`
  - This is the closest implementation template for authenticated D1 handler style, validation patterns, and atomic write behavior.
  - `generateInviteCode()` establishes the secure 8-character alphanumeric code pattern that Story 6.1 should centralize and Story 6.2 should reuse for `friend_code` validation assumptions.
- `src/admin-handlers.ts`
  - Existing `LIKE ... ESCAPE '\\'` search construction is the repo’s safest current wildcard-escaping pattern and should be mirrored for username prefix search.

### Critical Implementation Guardrails

- **Do not trust the future-facing social docs as proof of implementation.** `docs/architecture.md`, `docs/frontend-guide.md`, and related docs already describe `/friends` routes and islands that do not exist in the live codebase yet.
- **Do not implement friend logic inside `src/auth-handlers.ts` or `src/party-handlers.ts`.** Create a dedicated `src/friends-handlers.ts` module.
- **Do not forget `getAllowedMethods()`.** If a friend route is added only to the main router and not to the allowlist helper, valid methods like `DELETE` will fail with `405` before they reach the handler.
- **Do not rely on ordered-pair uniqueness alone.** The `UNIQUE(requester_id, addressee_id)` constraint prevents duplicate rows in the same direction, but it does not prevent a reverse-direction duplicate row; check both directions before inserting.
- **Do not build `GET /api/friends` with one progress query per friend.** Use one SQL query or one grouped subquery to avoid N+1 behavior.
- **Do not allow short or unescaped prefix search.** Enforce `q.length >= 3` before SQL and escape `%` and `_` even though the query is prefix-based.
- **Do not expand into Story 6.3 or UI work.** Fellowship invites, friends pages, avatar picker UI, and map friend positions are out of scope here.

### Architecture Compliance

- Runtime remains a single Cloudflare Worker monolith with manual route dispatch.
- D1 is the source of truth; use prepared statements and existing response helpers.
- Keep new frontend behavior out of this story.
- Respect strict TypeScript and avoid `any` in new code.
- New social logic should live in the backend domain layer first so later islands can stay thin.

### Library / Framework Requirements

- Use the existing Workers runtime APIs and D1 prepared-statement style already used in `src/party-handlers.ts`.
- Reuse Web Crypto-backed code-generation conventions from Story 6.1 for any friend-code assumptions; do not invent a second code format.
- No new third-party library is needed for this story.

### File Structure Requirements

- `src/friends-handlers.ts` — new backend domain module for friend APIs
- `src/index.ts` — route registration and allowed-method updates
- `tests/api/friends-handlers.test.ts` — new unit-level test file
- `tests/api/index.test.ts` — route coverage extension
- `tests/api/user-isolation.test.ts` or equivalent — friend-operation ownership regression tests
- `docs/api-reference.md` — update only if implementation semantics differ from current docs

### Testing Requirements

- Add handler tests for:
  - unauthenticated access
  - malformed `friendshipId`
  - self-friend rejection
  - nonexistent target user
  - duplicate pending request in same direction
  - duplicate pending request in reverse direction
  - accept by wrong user
  - reject by wrong user
  - delete by unrelated user
  - successful list/search/resolve/request/accept/reject/delete flows
  - pending-request rate limit (`>20` outgoing pending requests)
- Add router tests so every new endpoint is actually reachable and method restrictions are correct.
- Keep test scaffolding compatible with `ALLOW_TEST_AUTH` and the Story 6.1 user-schema changes.

### Previous Story Intelligence

Story 6.1 deliberately scoped the social foundation to schema, secure identifiers, and repository-backed avatar assets. It also documented a key reality that remains true for Story 6.2: the codebase currently lacks the friend routes, friend handlers, and avatar components already described in the docs. Treat those docs as target-state architecture, not implemented behavior.

Relevant carry-forward lessons from Story 6.1:

- social docs are ahead of code
- `friend_code` generation/backfill must be centralized and crypto-strong
- test/mock-auth user creation must stay aligned with schema changes
- repository-backed static assets remain the avatar strategy; no R2 or uploads

### Git Intelligence Summary

Recent repository activity is mostly dependency maintenance plus the latest admin-search work. That means this story should align with current project patterns rather than trying to introduce new abstractions:

- recent merges are dependency bumps for Preact and development dependencies
- the most recent feature-oriented commit in the last few entries is admin search work, reinforcing the current pattern of small domain-specific handler changes plus test updates

### Latest Technical Information

Current Cloudflare Workers guidance still aligns with the repository’s existing implementation model for this story:

- D1 prepared statements with `.prepare(...).bind(...)` remain the appropriate query pattern for Worker handlers
- Web Crypto remains the correct runtime primitive for secure random token or code generation

No external platform shift was identified that would require changing the repo’s established Worker + D1 approach for Story 6.2.

### Project Context Reference

Project-level rules still apply here:

- new behavior should fit the single-Worker architecture
- D1 remains the source of truth
- strict TypeScript is expected
- new features should not rewrite unrelated legacy frontend code
- backend and router changes need appropriate tests and documentation alignment

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2: Friend Request API]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6: Friends & Social Identity]
- [Source: _bmad-output/implementation-artifacts/6-1-friends-database-schema-avatar-system.md]
- [Source: _bmad-output/project-context.md]
- [Source: docs/api-reference.md]
- [Source: docs/architecture.md]
- [Source: docs/data-models.md]
- [Source: docs/frontend-guide.md]
- [Source: src/index.ts]
- [Source: src/auth-handlers.ts]
- [Source: src/party-handlers.ts]
- [Source: src/admin-handlers.ts]
- [Source: tests/api/index.test.ts]
- [Source: tests/api/auth-handlers.test.ts]
- [Source: tests/api/party-handlers.test.ts]
- [Source: tests/api/user-isolation.test.ts]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (via Copilot CLI)

### Debug Log References

- Story created from Epic 6 planning artifacts plus direct validation against the live Worker router, auth/session handlers, party handler patterns, and current backend test layout.
- Implementation completed in YOLO mode with zero test failures across 27 suites / 914 tests.

### Completion Notes List

- All 9 friend API endpoints implemented and tested in dedicated `src/friends-handlers.ts` module.
- Router wired with exact and parameterized routes in `src/index.ts`; `getAllowedMethods()` updated for all 9 endpoints.
- Bidirectional duplicate prevention checks both `(requester_id, addressee_id)` and `(addressee_id, requester_id)` orderings.
- Rate limit: max 20 pending outgoing requests, returns 429 when exceeded.
- `last_progressed` computed in single grouped SQL subquery (no N+1).
- Username search uses LIKE ESCAPE '\\' pattern matching `admin-handlers.ts` precedent.
- `friendshipId` routes use strict positive-integer validation matching existing party route pattern.
- `docs/api-reference.md` updated to reflect actual response shapes; future endpoints marked as planned.
- IDOR tests cover: accept/reject by wrong user, unfriend by unrelated user.
- 89 new tests added (65 handler + 24 router).

### Code Review Fixes

- **HIGH** `GET /api/friends` returned `f.id` (friendship ID) instead of `u.id` (friend's user ID). Fixed SQL SELECT in `handleGetFriends` (line 79).
- **MEDIUM** Search query (`GET /api/friends/search`) could return duplicate users due to LEFT JOIN on friendships without DISTINCT. Added `SELECT DISTINCT` in `handleSearchUsers` (line 168).
- **MEDIUM** Race condition in `createFriendRequest`: concurrent requests could bypass check-then-insert duplicate guard. Added catch for `UNIQUE constraint failed` errors, returning 409 instead of 500.
- All 27 test suites pass (914 tests, 0 failures) after fixes.

### File List

- `src/friends-handlers.ts` — new dedicated handler module (9 exported handlers + shared helper)
- `src/index.ts` — route registration (import, 9 route branches, getAllowedMethods updates)
- `tests/api/friends-handlers.test.ts` — 65 handler unit tests
- `tests/api/index.test.ts` — 24 new router/method-enforcement tests
- `docs/api-reference.md` — response shapes corrected to match implementation
- `_bmad-output/implementation-artifacts/6-2-friend-request-api.md` — this story file