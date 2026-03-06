# Story 4.1: Admin Authentication & Authorization

Status: ready-for-dev

## Story

As an **administrator**,
I want **secure role-based access to admin-only routes and API endpoints**,
so that **only authorized users can manage application content and view system data, while all admin actions are tracked for accountability**.

## Acceptance Criteria

### AC1: is_admin column on users table
- Given a D1 database with the existing `users` table
- When migration `0120_add_admin_column.sql` is applied
- Then users table has an `is_admin` INTEGER column with NOT NULL DEFAULT 0
- And all existing users remain non-admin (is_admin = 0)

### AC2: Admin middleware validates admin status
- Given a request to any `/api/admin/*` or `/admin*` route
- When the request is authenticated (valid session) but `is_admin = 0`
- Then the API returns 403 Forbidden with message "Admin access required"
- And when `is_admin = 1`, the request proceeds to the handler

### AC3: Admin session validation function
- Given the existing `validateSession(request, env)` pattern
- When a new `validateAdminSession(request, env)` function is called
- Then it first validates the session (reusing `validateSession` internally)
- And then checks `is_admin = 1` for the authenticated `userId`
- And returns `{ valid: true; userId: number; isAdmin: true }` on success
- And returns `{ valid: false; error: Response }` with 401 for unauthenticated or 403 for non-admin

### AC4: Admin routes return 403 for non-admin users
- Given a user with `is_admin = 0` and a valid session
- When they request `GET /admin` (page) or any `/api/admin/*` endpoint
- Then the response is 403 Forbidden
- And no admin content is leaked in the response body

### AC5: Admin routes return 401 for unauthenticated users
- Given a request without a valid Bearer token
- When they request any admin route
- Then the response is 401 Unauthorized

### AC6: Admin audit logging
- Given an admin user performing any admin action via `/api/admin/*`
- When the action completes (success or failure)
- Then an `admin_audit_log` entry is recorded with: admin_user_id, action, target_type, target_id (nullable), details (JSON), timestamp, ip_address, success (boolean)
- And audit log entries are append-only (never deleted by the application)

### AC7: Admin status not self-assignable
- There is no API endpoint to grant or revoke admin status
- Admin status can only be set via direct D1 database access (migration or manual SQL)
- The initial admin user is documented as a manual DB operation

### AC8: Test mock token support for admin
- Given the test auth system (`ALLOW_TEST_AUTH=true`, `TEST_MOCK_TOKEN_*`)
- When a test token like `TEST_MOCK_TOKEN_AdminUser` is used
- Then the mock auth flow creates the user as non-admin by default
- And a separate test utility or direct DB setup must grant `is_admin = 1` for admin test scenarios

### AC9: Session endpoint includes admin flag
- Given an authenticated admin user calling `GET /api/session`
- When `handleSessionValidation` returns the session response
- Then the response includes `isAdmin: true` (or `isAdmin: false` for regular users)
- And this flag is available for client-side conditional rendering (e.g., showing admin nav link)

## Tasks / Subtasks

- [ ] **Task 1: Database migration** (AC: #1)
  - [ ] Create `migrations/0120_add_admin_column.sql` with `ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`
  - [ ] Create `migrations/0121_create_admin_audit_log.sql` with the audit log table schema
  - [ ] Update `docs/data-models.md` with new column and new table

- [ ] **Task 2: Create `validateAdminSession` function** (AC: #2, #3, #4, #5)
  - [ ] Add `validateAdminSession` to `src/auth-handlers.ts`
  - [ ] Internally calls existing `validateSession` first
  - [ ] On valid session, queries `SELECT is_admin FROM users WHERE id = ?`
  - [ ] Returns 403 if `is_admin !== 1`
  - [ ] Returns `{ valid: true, userId, isAdmin: true }` on success

- [ ] **Task 3: Create admin audit log helper** (AC: #6)
  - [ ] Create `src/admin-handlers.ts` with `logAdminAction(env, { adminUserId, action, targetType, targetId, details, ipAddress, success })` helper
  - [ ] Insert audit entries into `admin_audit_log` table
  - [ ] This helper will be called by all future admin API handlers (Stories 4.2–4.6)

- [ ] **Task 4: Wire admin routes in `src/index.ts`** (AC: #2, #4, #5)
  - [ ] Add `/admin` page route using `validateAdminSession` before rendering
  - [ ] Add `/api/admin/*` route prefix guard using `validateAdminSession`
  - [ ] Add admin routes to `getAllowedMethods()` mapping
  - [ ] Create placeholder `renderAdminPage()` in `src/renderAdminPage.ts` that returns a basic admin shell via `renderLayout()`
  - [ ] Redirect non-admin authenticated users to `/journey` (or return 403 for API routes)

- [ ] **Task 5: Update handleSessionValidation to include isAdmin** (AC: #9)
  - [ ] Add `is_admin` to the SELECT queries in `handleSessionValidation`
  - [ ] Include `isAdmin: boolean` in the response payload
  - [ ] Update test mock auth path to also return `isAdmin` (default false)

- [ ] **Task 6: Backend unit tests** (AC: #1–#9)
  - [ ] Test `validateAdminSession` returns 401 for unauthenticated requests
  - [ ] Test `validateAdminSession` returns 403 for authenticated non-admin users
  - [ ] Test `validateAdminSession` returns success for admin users
  - [ ] Test `handleSessionValidation` includes `isAdmin` field
  - [ ] Test admin audit log insert helper
  - [ ] Test `/admin` page route returns 403 for non-admin
  - [ ] Test `/api/admin/*` routes return 403 for non-admin
  - [ ] Create test utility for setting up admin users in test context

- [ ] **Task 7: Playwright E2E tests** (AC: #4, #5)
  - [ ] Test that navigating to `/admin` as non-admin shows 403/redirect
  - [ ] Test that `/admin` as admin user renders the admin shell page

- [ ] **Task 8: Documentation** (AC: #7)
  - [ ] Update `docs/data-models.md` with `is_admin` column and `admin_audit_log` table
  - [ ] Update `docs/architecture.md` route topology with admin routes
  - [ ] Document how to grant admin access (manual SQL in D1 console)

## Dev Notes

### Architecture Context

This story establishes the **admin foundation** that all subsequent Epic 4 stories (4.2–4.6) will build upon. It must be minimal but rock-solid — no admin functionality should ever be accessible to non-admin users.

**Key architectural decisions:**
- **No new auth mechanism.** Admin auth piggybacks on the existing Bearer token session system. The only addition is a DB-level `is_admin` flag check.
- **No self-service admin grants.** Admin status is deliberately out-of-band (direct DB access only). This is appropriate for a single-developer project.
- **Audit logging from day one.** While not strictly needed for a solo project, audit logging is a best practice for admin actions and trivial to add now.

### Existing Code Patterns to Follow

**Auth pattern — `validateSession` (src/auth-handlers.ts:328):**
```typescript
export async function validateSession(request: Request, env: any): Promise<
  | { valid: true; userId: number }
  | { valid: false; error: Response }
>
```
The new `validateAdminSession` MUST follow this exact discriminated union pattern. It should extend it:
```typescript
export async function validateAdminSession(request: Request, env: any): Promise<
  | { valid: true; userId: number; isAdmin: true }
  | { valid: false; error: Response }
>
```

**Route protection pattern (src/index.ts):**
Protected routes call `validateSession` inline:
```typescript
const sessionValidation = await validateSession(request, env);
if (!sessionValidation.valid) return sessionValidation.error;
```
Admin routes should use the same pattern but with `validateAdminSession`:
```typescript
const adminValidation = await validateAdminSession(request, env);
if (!adminValidation.valid) return adminValidation.error;
```

**SSR rendering pattern (src/renderLayout.ts):**
Admin pages use the established `renderLayout()` function. The placeholder admin page should follow the same pattern as `src/renderHtml.ts`, `src/map-handlers.ts`, or party pages (e.g., `src/party-pages.ts`).

**Handler file organization:**
Admin handlers go in `src/admin-handlers.ts` (new file), following the pattern of `src/auth-handlers.ts`, `src/party-handlers.ts`, etc.

### Database Schema Details

**Migration 0120 — `is_admin` column:**
```sql
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
```

**Migration 0121 — `admin_audit_log` table:**
```sql
CREATE TABLE admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  details TEXT,
  ip_address TEXT,
  success INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES users(id)
);
CREATE INDEX idx_admin_audit_admin_user ON admin_audit_log(admin_user_id);
CREATE INDEX idx_admin_audit_created ON admin_audit_log(created_at);
```

**Note on `details` column:** Store as JSON string (e.g., `JSON.stringify({ field: 'title', old: 'X', new: 'Y' })`). D1 has no native JSON type; TEXT is correct.

### Session Validation Update

`handleSessionValidation` (src/auth-handlers.ts:230) currently returns:
```json
{ "userId": 1, "username": "sam", "email": "...", "showFutureGoalsUnlocked": true, "defaultViewMap": false, "expiresAt": "..." }
```
After this story, it should also include:
```json
{ "isAdmin": false }
```

This means updating **two** SELECT queries in `handleSessionValidation`:
1. Production path (line ~303): Add `u.is_admin` to the JOIN query
2. Test mock path (line ~252): Add `is_admin` to the test user SELECT

And the mock user creation INSERT (line ~263) needs no change since `is_admin` defaults to 0.

### Test Mock Token Strategy

The existing test auth system creates users with `is_admin = 0` by default. For admin tests:

**Option A (recommended):** After mock token creates the user, execute a direct DB update to set `is_admin = 1`:
```typescript
// In test setup
await page.evaluate(async () => {
  const response = await fetch('/api/session', { headers: { 'Authorization': 'Bearer TEST_MOCK_TOKEN_AdminTestUser' } });
  // User now exists in DB
});
// Then admin flag must be set via test API or beforeEach SQL hook
```

**Option B:** Create a test-only endpoint (guarded by `ALLOW_TEST_AUTH`) to set admin status. This is cleaner for E2E tests but adds a test-only API surface.

The dev agent should choose the approach that aligns best with existing test patterns. Review how fellowship tests set up test data in `tests/ui/fellowship-functional.spec.js`.

### Route Topology Addition

Add to `src/index.ts` route handling:

**Page routes:**
- `GET /admin` → admin dashboard shell (Story 4.2 will flesh out content)

**API routes (prefix guard):**
- `GET/POST/PUT/DELETE /api/admin/*` → all require `validateAdminSession`

**`getAllowedMethods()` additions:**
- `/admin` → `['GET']`
- `/api/admin/dashboard` → `['GET']` (placeholder for Story 4.2)
- Future: `/api/admin/goals` → `['GET']`, `/api/admin/goals/:id` → `['GET', 'PUT']`, etc.

### Security Considerations

1. **IDOR Prevention:** Admin validation checks the actual DB `is_admin` flag per-request, not a cached client-side claim.
2. **No privilege escalation path:** No API endpoint can set `is_admin`. Only direct D1 SQL.
3. **Timing attacks:** The 403 response for non-admin should not leak whether the route exists. Return the same error shape for both "route not found" and "not admin" within admin namespace.
4. **Audit IP extraction:** Use `request.headers.get('CF-Connecting-IP')` for Cloudflare Workers.
5. **Content leak prevention:** Admin page SSR must NOT render any admin content before auth check. Return 403 before any rendering.

### Cross-Story Impact

- **Story 4.2 (Admin Dashboard Shell):** Depends on this story's `/admin` route, `validateAdminSession`, `renderAdminPage`, and `admin-handlers.ts` file.
- **Stories 4.3–4.6 (Goal Management):** All admin API endpoints will use `validateAdminSession` and `logAdminAction` from this story.
- **No impact on existing user-facing features.** The `is_admin` column defaults to 0 and existing queries don't reference it.

### What NOT to Build

- Do NOT build the admin dashboard UI content (that's Story 4.2)
- Do NOT build any goal management endpoints (Stories 4.3–4.6)
- The `/admin` page should be a minimal shell with a "Dashboard coming soon" message
- Do NOT add admin navigation links to the `DrawerIsland` yet (Story 4.2 will do this conditionally based on `isAdmin` from session)

### Project Structure Notes

- **New files:**
  - `migrations/0120_add_admin_column.sql`
  - `migrations/0121_create_admin_audit_log.sql`
  - `src/admin-handlers.ts` (audit log helper, future admin handlers)
  - `src/renderAdminPage.ts` (admin page SSR — minimal placeholder)
  - `tests/api/admin-handlers.test.ts` (unit tests for admin auth/audit)
  - `tests/ui/admin.spec.js` (Playwright E2E for admin routes)

- **Modified files:**
  - `src/auth-handlers.ts` (add `validateAdminSession`, update `handleSessionValidation` SELECT queries)
  - `src/index.ts` (add admin route handling, update `getAllowedMethods`)
  - `docs/data-models.md` (document `is_admin` column and `admin_audit_log` table)
  - `docs/architecture.md` (update route topology with admin routes)
  - `worker-configuration.d.ts` (if admin-specific env bindings are needed — unlikely for this story)

### References

- [Source: docs/architecture.md — Route Topology, Authentication Model]
- [Source: docs/data-models.md — users table schema]
- [Source: _bmad-output/planning-artifacts/epics.md — Epic 4 stories and alignment decision]
- [Source: _bmad-output/implementation-artifacts/epic-4-architecture-alignment-2026-03-06.md — Pre-epic alignment analysis]
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-03-06.md — Learnings on planning discipline]
- [Source: src/auth-handlers.ts:328 — validateSession pattern]
- [Source: src/auth-handlers.ts:230 — handleSessionValidation query structure]
- [Source: src/index.ts:392 — getAllowedMethods pattern]
- [Source: src/renderLayout.ts — SSR shell pattern]

### Epic 3 Retrospective Learnings Applied

From the Epic 3 retro:
1. **Planning artifact alignment** — This story explicitly aligns with the Epic 4 architecture analysis (2026-03-06) to avoid plan/schema drift.
2. **Architecture visibility** — Detailed guardrails provided above to prevent cross-cutting auth mistakes.
3. **Clear scope boundaries** — "What NOT to Build" section prevents scope creep into Stories 4.2+.

## Dev Agent Record

### Agent Model Used


### Debug Log References


### Completion Notes List


### Change Log

| Date | Summary |
|------|---------|

### File List

