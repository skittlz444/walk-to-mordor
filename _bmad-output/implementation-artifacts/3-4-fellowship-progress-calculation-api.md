# Story 3.4: Fellowship Progress Calculation API

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a User who belongs to one or more Fellowships,
I want to view the combined Fellowship progress (including per-member breakdowns), see newly passed milestones when I switch to a party view, and have my daily walk logs automatically reflected in my parties' progress,
so that I can track shared journey progress with friends and celebrate milestones together.

## Acceptance Criteria

1. Create a `GET /api/party/:id/progress` endpoint that returns the combined party progress.
2. The distance calculation mode is read from the party's `distance_mode` column (not a query parameter). The leader sets this at creation; it is immutable.
3. **Cumulative mode:** Sum of all active members' total distances (all-time, from the `progress` table).
4. **Incremental mode:** Sum of (member's current total distance - `distance_at_join`) for each active member (only counts distance since joining).
5. **Handle departed members based on `distance_kept` and `contribution_at_departure`:** If `distance_kept = true`, include the departed member's stored `contribution_at_departure` in the party total. If `distance_kept = false`, exclude them entirely.
6. Return a response containing: `total_distance`, `member_count` (active only), `calculated_position` (the latest milestone whose distance threshold is ≤ total_distance), `distance_mode`, `leave_distance_behavior`.
7. Include a per-member breakdown array: `{ user_id, display_name, contribution, status, color }`.
   - For **active** members in incremental mode: `contribution = current_total - distance_at_join`.
   - For **active** members in cumulative mode: `contribution = current_total`.
   - For **departed** members: use `contribution_at_departure` (pre-computed at leave/kick time).
8. Member `color` is computed deterministically as `user_id % palette_size` (palette_size = 12) for stability across sessions and re-joins.
9. **Walk logging integration (cross-cutting):** When a walk is logged via `POST /api/calendar-progress`, automatically insert a `party_progress_log` entry (with `date` column matching the logged date) for each of the user's active party memberships. When a walk is edited via `PUT /api/calendar-progress`, update corresponding `party_progress_log` entries. When a walk is deleted via `DELETE /api/calendar-progress`, remove corresponding `party_progress_log` entries.
10. Create a `GET /api/party/:id/activity` endpoint that returns the last N entries (default 10) from `party_progress_log` for the given party. Format: `{ user_id, display_name, distance, date, logged_at }`. Only accessible to active party members.
11. **Update `last_viewed_distance`** for the requesting user on each `GET /api/party/:id/progress` call, setting it to the newly computed `total_distance`.
12. **Return `newly_passed_milestones`** — a list of milestones whose distance threshold falls between the user's previous `last_viewed_distance` and the current `total_distance`. This enables the milestone modal on party view switch (FR_PARTY_09, owned by Story 3.6).
13. Cache the progress calculation result for 5 minutes. Invalidate the cache when a new walk is logged by any party member (via the party_progress_log integration).
14. **Security:** Validate that the session user is an active member of the party (IDOR prevention). Return 403 if not a member. Return 401 if not authenticated.
15. **Privacy:** Individual member progress data is only exposed to confirmed active party members.

## Tasks / Subtasks

- [ ] Task 1: Parameterized Route Matching (AC: 1, 10)
  - [ ] **Prerequisite check:** Verify that Story 3.2/3.3 implementation added parameterized route matching to the Worker router in `src/index.ts`. If not, add a simple path-matching utility that supports `:param` segments (e.g., `/api/party/:id/progress`). The current router uses exact `url.pathname ===` matching which cannot handle `/api/party/123/progress`.
  - [ ] Add `GET /api/party/:id/progress` route to `src/index.ts`.
  - [ ] Add `GET /api/party/:id/activity` route to `src/index.ts`.
  - [ ] Both routes require authentication (call `validateSession` first).
  - [ ] Extract the `:id` parameter from the URL path.

- [ ] Task 2: Party Progress Calculation Handler (AC: 1, 2, 3, 4, 5, 6, 7, 8, 14, 15)
  - [ ] Create `handlePartyProgress(request, env, partyId)` in `src/party-handlers.ts`.
  - [ ] Validate session and verify the requesting user is an active member of the party (query `party_members WHERE party_id = ? AND user_id = ? AND status = 'active'`). Return 403 if not a member.
  - [ ] Query the party's `distance_mode` and `leave_distance_behavior` from the `parties` table. Return 404 if party not found or dissolved (`dissolved_at IS NOT NULL`).
  - [ ] **Calculate active member contributions:**
    - For each active member (`party_members WHERE party_id = ? AND status = 'active'`), query their total distance from `progress` table: `SELECT COALESCE(SUM(distance), 0) as total FROM progress WHERE user_id = ?`.
    - Also join on the `users` table to get `username` for `display_name`.
    - In **incremental** mode: `contribution = total_distance - distance_at_join` (floor at 0).
    - In **cumulative** mode: `contribution = total_distance`.
  - [ ] **Calculate departed member contributions:**
    - Query `party_members WHERE party_id = ? AND status IN ('left', 'kicked') AND distance_kept = 1`.
    - For each: include `contribution_at_departure` in the total. Exclude members with `distance_kept = 0`.
  - [ ] Sum all contributions for `total_distance`.
  - [ ] Compute `member_count` = count of active members.
  - [ ] Assign member `color` = `user_id % 12` (deterministic 12-color palette index).
  - [ ] **Calculate milestone position:** Query `SELECT * FROM goals WHERE distance <= ? ORDER BY distance DESC LIMIT 1` using computed `total_distance` to find the latest reached milestone.
  - [ ] Return the full response JSON (schema defined in Dev Notes).

- [ ] Task 3: Milestone Notification & last_viewed_distance Update (AC: 11, 12)
  - [ ] Before computing new total, read the requesting user's current `last_viewed_distance` from `party_members`.
  - [ ] After computing the new `total_distance`, query milestones between old and new: `SELECT id, title, distance FROM goals WHERE distance > ? AND distance <= ? ORDER BY distance ASC` (where `?` = old `last_viewed_distance` and `?` = new `total_distance`).
  - [ ] Update `party_members SET last_viewed_distance = ? WHERE party_id = ? AND user_id = ?` to the new `total_distance`.
  - [ ] Include `newly_passed_milestones` array in the response.

- [ ] Task 4: Walk Logging → party_progress_log Integration (AC: 9)
  - [ ] **Modify `handleProgressPost`** in `src/progress-handlers.ts`:
    - After successful INSERT into `progress`, query `party_members WHERE user_id = ? AND status = 'active'` to get all active party memberships.
    - For each active membership, INSERT into `party_progress_log` (party_id, logged_by_user_id, distance, date, logged_at).
    - Log errors but do NOT fail the walk logging response if party_progress_log insert fails (graceful degradation — the walk is the primary operation).
  - [ ] **Modify `handleProgressPut`** in `src/progress-handlers.ts`:
    - After successful UPDATE of `progress`, update corresponding `party_progress_log` entries: `UPDATE party_progress_log SET distance = ? WHERE logged_by_user_id = ? AND date = ?`.
    - Note: This updates entries across ALL of the user's parties for that date.
  - [ ] **Modify `handleProgressDelete`** in `src/progress-handlers.ts`:
    - After successful DELETE from `progress`, delete corresponding `party_progress_log` entries: `DELETE FROM party_progress_log WHERE logged_by_user_id = ? AND date = ?`.
  - [ ] **Import concerns:** `progress-handlers.ts` currently has no dependency on party tables. Add the necessary D1 queries. Keep the cross-cutting logic minimal and isolated (e.g., a helper function `syncPartyProgressLog(env, userId, date, distance, operation)` that is called from each handler).

- [ ] Task 5: Activity Feed Endpoint (AC: 10, 14, 15)
  - [ ] Create `handlePartyActivity(request, env, partyId)` in `src/party-handlers.ts`.
  - [ ] Validate session and verify the requesting user is an active member of the party. Return 403 if not.
  - [ ] Query: `SELECT ppl.logged_by_user_id as user_id, u.username as display_name, ppl.distance, ppl.date, ppl.logged_at FROM party_progress_log ppl JOIN users u ON ppl.logged_by_user_id = u.id WHERE ppl.party_id = ? ORDER BY ppl.logged_at DESC LIMIT 10`.
  - [ ] Return JSON array of activity entries.

- [ ] Task 6: Caching (AC: 13)
  - [ ] Implement a simple in-memory cache or KV-based cache keyed by `party:{partyId}:progress` with a 5-minute TTL.
  - [ ] **Note on Cloudflare Workers caching:** Workers are stateless — in-memory caches only last for the lifetime of a single worker instance. Consider using the Cache API (`caches.default`) for cross-request caching, or accept that "caching" in this context reduces redundant DB calls within a single request lifecycle. For V1, a Cache API approach is recommended.
  - [ ] Invalidate the cache for a party when a walk is logged/updated/deleted by any member (in the `syncPartyProgressLog` helper, call a `invalidatePartyProgressCache(env, partyId)` function).
  - [ ] If caching is too complex for V1, document it as a follow-up optimization and proceed without it.

- [ ] Task 7: Testing (AC: all)
  - [ ] Unit tests for progress calculation logic (both modes, with and without departed members).
  - [ ] Unit tests for `syncPartyProgressLog` helper (POST/PUT/DELETE scenarios).
  - [ ] Unit tests for activity feed endpoint.
  - [ ] Unit tests for milestone notification logic (`newly_passed_milestones`).
  - [ ] Unit tests for member color assignment determinism.
  - [ ] Integration tests for IDOR prevention (non-member access returns 403).
  - [ ] Tests follow existing patterns in `tests/` directory using Jest.
  - [ ] Maintain >90% coverage for new code.

## Dev Notes

### Architecture & Code Patterns

- **Handler location:** All new party API handlers go in `src/party-handlers.ts` (created by Story 3.2).
- **Route wiring:** Add routes in `src/index.ts`. The current router uses exact string matching (`url.pathname === "/api/..."`). Stories 3.2 and 3.3 should have introduced parameterized route matching for `/api/party/:id/...` patterns. **If they haven't**, you must add a simple URL-pattern matcher before this story's routes can work. A minimal approach: extract path segments and match against a pattern like `/api/party/{id}/progress`.
- **Authentication pattern:** Use `validateSession(request, env)` from `src/auth-handlers.ts`. Returns `{ valid: boolean, userId?: number, error?: Response }`.
- **Response format:** Direct JSON. Success: `{ total_distance, member_count, ... }`. Error: `{ error: "message" }` with appropriate HTTP status.
- **TypeScript strict mode:** No `any`. Define interfaces for all D1 result types.
- **D1 query approach:** Use `env.DB.prepare(sql).bind(...args).all()` for SELECT queries, `.run()` for INSERT/UPDATE/DELETE. D1 batch for transactions: `env.DB.batch([stmt1, stmt2, ...])`.

### Database Schema Reference (Story 3.1)

```sql
-- parties table
-- id, name, leader_id, created_at, invite_code, distance_mode, leave_distance_behavior, dissolved_at

-- party_members table
-- id, party_id, user_id, joined_at, distance_at_join, role, status, last_viewed_distance, departed_at, distance_kept, contribution_at_departure

-- party_progress_log table
-- id, party_id, logged_by_user_id, distance, date, logged_at

-- progress table (existing)
-- id, date, distance, user_id (UNIQUE(date, user_id))
```

### Response Schema: GET /api/party/:id/progress

```typescript
interface PartyProgressResponse {
  total_distance: number;
  member_count: number;           // Active members only
  calculated_position: {          // Latest milestone reached by party
    id: number;
    title: string;
    distance: number;
  } | null;
  distance_mode: 'cumulative' | 'incremental';
  leave_distance_behavior: 'keep' | 'remove';
  members: Array<{
    user_id: number;
    display_name: string;
    contribution: number;
    status: 'active' | 'left' | 'kicked';
    color: number;                // Index into 12-color palette (user_id % 12)
  }>;
  newly_passed_milestones: Array<{
    id: number;
    title: string;
    distance: number;
  }>;
}
```

### Response Schema: GET /api/party/:id/activity

```typescript
interface PartyActivityResponse {
  activities: Array<{
    user_id: number;
    display_name: string;
    distance: number;
    date: string;                 // YYYY-MM-DD
    logged_at: string;            // ISO datetime
  }>;
}
```

### Cross-Cutting Walk Logging Integration

This is the **only Epic 3 change to existing code**. The three `handleProgress*` functions in `src/progress-handlers.ts` must be extended to write to `party_progress_log`:

```typescript
// Suggested helper function to add in progress-handlers.ts (or a shared utility)
async function syncPartyProgressLog(
  env: Env,
  userId: number,
  date: string,
  distance: number,
  operation: 'insert' | 'update' | 'delete'
): Promise<void> {
  try {
    // Get all active party memberships for user
    const { results: memberships } = await env.DB.prepare(
      'SELECT party_id FROM party_members WHERE user_id = ? AND status = ?'
    ).bind(userId, 'active').all();

    if (!memberships || memberships.length === 0) return;

    const now = new Date().toISOString();

    if (operation === 'insert') {
      const stmts = memberships.map((m: { party_id: number }) =>
        env.DB.prepare(
          'INSERT INTO party_progress_log (party_id, logged_by_user_id, distance, date, logged_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(m.party_id, userId, distance, date, now)
      );
      await env.DB.batch(stmts);
    } else if (operation === 'update') {
      // Update across all parties for this user+date
      await env.DB.prepare(
        'UPDATE party_progress_log SET distance = ? WHERE logged_by_user_id = ? AND date = ?'
      ).bind(distance, userId, date).run();
    } else if (operation === 'delete') {
      await env.DB.prepare(
        'DELETE FROM party_progress_log WHERE logged_by_user_id = ? AND date = ?'
      ).bind(userId, date).run();
    }
  } catch (error) {
    // Log but do NOT fail the primary walk operation
    console.error('Error syncing party_progress_log:', error);
  }
}
```

**Critical:** The walk POST/PUT/DELETE must remain the primary operation. If `syncPartyProgressLog` fails, the walk operation should still succeed. Wrap in try/catch with error logging.

### Previous Story Learnings (Stories 3.1, 3.2, 3.3)

- **Story 3.1:** Established the database schema. The migration file should be at `migrations/0119_create_fellowship_tables.sql`. Tables: `parties`, `party_members`, `party_progress_log`.
- **Story 3.2:** Created `POST /api/party` endpoint. Likely established `src/party-handlers.ts` as the handler file. Used `crypto.getRandomValues()` for invite code generation. Set up D1 batch transactions for atomic party + member creation.
- **Story 3.3:** Created join, preview, invite regeneration, and user parties endpoints. Established re-join pattern (reactivate existing membership row). Added `GET /api/user/parties` endpoint. Preview endpoint is public (no auth required); all other endpoints require auth.
- **Router pattern:** Stories 3.2/3.3 required parameterized routing (e.g., `/api/party/:id/invite`, `/api/party/join/:inviteCode`). Check what pattern was implemented and reuse it.

### Parameterized Routing Guidance

The current `src/index.ts` router uses exact string matching. For this story's endpoints (`/api/party/:id/progress`, `/api/party/:id/activity`), you need parameterized matching. Check if Story 3.2/3.3 added a helper function. If not, a minimal approach:

```typescript
// Simple path matcher
function matchPath(pathname: string, pattern: string): Record<string, string> | null {
  const patternParts = pattern.split('/');
  const pathParts = pathname.split('/');
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}
```

### Member Color Palette

The 12-color maximum distinctness palette for per-member map segments (used by Story 3.6). This story computes `color = user_id % 12` and returns the index. The actual RGB/hex values are a frontend concern. Document the index scheme:

| Index | Suggested Color | Usage |
|-------|----------------|-------|
| 0 | `#e6194b` (Red) | Member segment |
| 1 | `#3cb44b` (Green) | Member segment |
| 2 | `#ffe119` (Yellow) | Member segment |
| 3 | `#4363d8` (Blue) | Member segment |
| 4 | `#f58231` (Orange) | Member segment |
| 5 | `#911eb4` (Purple) | Member segment |
| 6 | `#42d4f4` (Cyan) | Member segment |
| 7 | `#f032e6` (Magenta) | Member segment |
| 8 | `#bfef45` (Lime) | Member segment |
| 9 | `#fabed4` (Pink) | Member segment |
| 10 | `#469990` (Teal) | Member segment |
| 11 | `#dcbeff` (Lavender) | Member segment |

### Caching Strategy Notes

Cloudflare Workers are stateless — no persistent in-memory cache between requests. Options:
1. **Cache API (`caches.default`):** Stores responses in Cloudflare's edge cache. Best fit for this use case. Key: `https://cache.internal/party/${partyId}/progress`. Set `Cache-Control: max-age=300` (5 min).
2. **KV:** Low latency key-value store, but adds a binding dependency. Overkill for this.
3. **No cache (V1):** Accept fresh DB queries on each request. D1 is co-located with the worker, so latency is minimal. Optimize later if needed.

**Recommendation for V1:** Implement Cache API caching if straightforward; otherwise skip and document as optimization follow-up.

### Goals Table Reference

The `goals` table stores 171+ milestones. Key columns: `id`, `distance` (REAL, km threshold), `title` (TEXT). Used for `calculated_position` (latest milestone ≤ total distance) and `newly_passed_milestones` (milestones between old and new distance).

### Security Checklist

- [ ] All endpoints validate session via `validateSession()` — return 401 if invalid
- [ ] Party membership check: query `party_members WHERE party_id = ? AND user_id = ? AND status = 'active'` — return 403 if not a member
- [ ] Party existence check: query `parties WHERE id = ?` — return 404 if not found
- [ ] Dissolved party check: if `dissolved_at IS NOT NULL` — return 404 (or 410 Gone)
- [ ] No user data leaks to non-members
- [ ] party_progress_log entries only visible to active party members

### Project Structure Notes

- **New code:** `src/party-handlers.ts` (add `handlePartyProgress`, `handlePartyActivity`)
- **Modified code:** `src/progress-handlers.ts` (add `syncPartyProgressLog` calls to POST/PUT/DELETE handlers)
- **Modified code:** `src/index.ts` (add two new GET routes)
- **New tests:** `tests/party-progress.test.ts` (or extend existing party test file if one exists)
- **Alignment:** Follows existing `src/*-handlers.ts` pattern for backend handlers

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4: Fellowship Progress Calculation API]
- [Source: docs/architecture.md#ADR-004: Fellowship Data Model Direction]
- [Source: docs/data-models.md]
- [Source: docs/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/implementation-artifacts/3-1-fellowship-database-schema.md]
- [Source: _bmad-output/implementation-artifacts/3-2-create-fellowship-api.md]
- [Source: _bmad-output/implementation-artifacts/3-3-invite-join-fellowship-api.md]
- [Source: src/progress-handlers.ts] — existing walk logging handlers to modify
- [Source: src/index.ts] — Worker router to extend

### change-impact

Requirements expanded from original epics spec:
- Departed member contributions now use locked `contribution_at_departure` snapshots (computed at leave/kick), eliminating perpetual date-range calculations in the progress hot path
- Re-join complexity reduced by using one membership row per user+party
- Walk logging → `party_progress_log` integration is explicit cross-cutting concern (modifies existing `progress-handlers.ts`)
- Activity feed API endpoint (`GET /api/party/:id/activity`) included in this story
- Member color assignment is deterministic by `user_id % 12`
- `last_viewed_distance` updated on each progress API call
- `newly_passed_milestones` computed and returned for Story 3.6 milestone modal

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
