# Story 8.2: D1 Read Replica Wrapper

Status: done

## Story

As a developer,
I want all database reads to go through a `db.read` wrapper and all writes through a `db.write` wrapper,
so that we can enable D1 read replicas in the future by changing one function without modifying every handler.

## Acceptance Criteria

1. **Given** all current database queries use `env.DB.prepare(...)` directly
   **When** a `createDbClient(env.DB)` utility is created in `src/db.ts`
   **Then** it returns an object with `.read` (for SELECT) and `.write` (for INSERT/UPDATE/DELETE) methods — both D1Database interfaces, both delegating to `env.DB` today (identical behavior)

2. **Given** `createDbClient` is available
   **When** `src/index.ts` handles a request
   **Then** `const db = createDbClient(env.DB)` is called **once** at the top of the fetch handler and `db` is passed to all handler functions

3. **Given** handler files are migrated
   **When** any handler needs a SELECT query
   **Then** it uses `db.read.prepare(...)` instead of `env.DB.prepare(...)`

4. **Given** handler files are migrated
   **When** any handler needs an INSERT/UPDATE/DELETE query
   **Then** it uses `db.write.prepare(...)` instead of `env.DB.prepare(...)`

5. **Given** handler files are migrated
   **When** any handler calls `env.DB.batch([...])`
   **Then** it uses `db.write.batch([...])` instead (batches that include writes must go to primary)

6. **Given** all 7 handler files are migrated:
   - `auth-handlers.ts` (37 prepare, 0 batch)
   - `progress-handlers.ts` (8 prepare, 3 batch)
   - `goals-handlers.ts` (2 prepare, 0 batch)
   - `party-handlers.ts` (57 prepare, 4 batch)
   - `friends-handlers.ts` (21 prepare, 0 batch)
   - `fellowship-invite-handlers.ts` (17 prepare, 2 batch)
   - `admin-handlers.ts` (34 prepare, 1 batch)
   **When** all existing backend (Jest) and client (Vitest) tests run
   **Then** all pass with zero behavior change

7. **Given** the `createDbClient` utility exists
   **When** unit tests for `src/db.ts` are written
   **Then** they verify `.read` and `.write` both delegate to the same D1Database instance and cover >90%

8. **Given** the migration is complete
   **When** documentation is reviewed
   **Then** `docs/architecture.md` documents the read/write separation pattern in the Database Layer section

## Tasks / Subtasks

- [ ] Task 1: Create `src/db.ts` — DbClient type and factory (AC: #1, #7)
  - [ ] 1.1 Define `DbClient` interface with `read: D1Database` and `write: D1Database`
  - [ ] 1.2 Implement `createDbClient(db: D1Database): DbClient` — returns `{ read: db, write: db }`
  - [ ] 1.3 Write `tests/api/db.test.ts` — verify both `.read` and `.write` delegate to the same instance, verify `prepare`, `batch`, `exec`, `dump` passthrough
- [ ] Task 2: Wire `createDbClient` into `src/index.ts` request handler (AC: #2)
  - [ ] 2.1 Import `createDbClient` and `DbClient` at top of `index.ts`
  - [ ] 2.2 At top of `fetch()` handler (after assets check), add `const db = createDbClient(env.DB)`
  - [ ] 2.3 Update all handler call sites to pass `db` instead of `env` (or `db` alongside needed env properties)
  - [ ] 2.4 For `handleAdminImageInventory` — pass `env.ASSETS` as a separate parameter alongside `db`
  - [ ] 2.5 For render functions that need `env` for non-DB bindings — keep passing `env` where needed
- [ ] Task 3: Migrate `auth-handlers.ts` (AC: #3, #4, #6)
  - [ ] 3.1 Change all 12 function signatures from `env: any` → `db: DbClient`
  - [ ] 3.2 Replace all 37 `env.DB.prepare(...)` with `db.read.prepare(...)` or `db.write.prepare(...)` per query type
  - [ ] 3.3 Update `validateSession(request, env)` → `validateSession(request, db)` — **CRITICAL: this is imported by ALL other handler files**
  - [ ] 3.4 Update `tests/api/auth-handlers.test.ts` mock setup and all assertions
- [ ] Task 4: Migrate `progress-handlers.ts` (AC: #3, #4, #5, #6)
  - [ ] 4.1 Change all 5 function signatures to use `db: DbClient`
  - [ ] 4.2 Replace 8 `env.DB.prepare(...)` with `db.read.prepare(...)` or `db.write.prepare(...)`
  - [ ] 4.3 Replace 3 `env.DB.batch(...)` with `db.write.batch(...)`
  - [ ] 4.4 Fix `syncPartyProgressLog` — change `env: { DB: D1Database }` → `db: DbClient`
  - [ ] 4.5 Update `tests/api/progress-handlers.test.ts` mock setup and assertions
- [ ] Task 5: Migrate `goals-handlers.ts` (AC: #3, #6)
  - [ ] 5.1 Change 2 function signatures to use `db: DbClient`
  - [ ] 5.2 Replace 2 `env.DB.prepare(...)` with `db.read.prepare(...)`
  - [ ] 5.3 Update `calculateTotalDistance(env, userId)` → `calculateTotalDistance(db, userId)` — **CRITICAL: exported and imported by party-handlers, fellowship-invite-handlers, friends-handlers, and index.ts**
  - [ ] 5.4 Update `tests/api/goals-handlers.test.ts`
- [ ] Task 6: Migrate `party-handlers.ts` (AC: #3, #4, #5, #6)
  - [ ] 6.1 Change all 12 function signatures from `env: { DB: D1Database }` → `db: DbClient`
  - [ ] 6.2 Replace 57 `env.DB.prepare(...)` with `db.read.prepare(...)` or `db.write.prepare(...)`
  - [ ] 6.3 Replace 4 `env.DB.batch(...)` with `db.write.batch(...)`
  - [ ] 6.4 Update `tests/api/party-handlers.test.ts`, `party-management.test.ts`, `party-progress.test.ts`
- [ ] Task 7: Migrate `friends-handlers.ts` (AC: #3, #4, #6)
  - [ ] 7.1 Change all 11 function signatures from `env: { DB: D1Database }` → `db: DbClient`
  - [ ] 7.2 Replace 21 `env.DB.prepare(...)` with `db.read.prepare(...)` or `db.write.prepare(...)`
  - [ ] 7.3 Update `tests/api/friends-handlers.test.ts`
- [ ] Task 8: Migrate `fellowship-invite-handlers.ts` (AC: #3, #4, #5, #6)
  - [ ] 8.1 Change all 4 function signatures from `env: { DB: D1Database }` → `db: DbClient`
  - [ ] 8.2 Replace 17 `env.DB.prepare(...)` with `db.read.prepare(...)` or `db.write.prepare(...)`
  - [ ] 8.3 Replace 2 `env.DB.batch(...)` with `db.write.batch(...)`
  - [ ] 8.4 Update `tests/api/fellowship-invite-handlers.test.ts`
- [ ] Task 9: Migrate `admin-handlers.ts` (AC: #3, #4, #5, #6)
  - [ ] 9.1 Change all 14 function signatures from `env: { DB: D1Database }` → `db: DbClient`
  - [ ] 9.2 Replace 34 `env.DB.prepare(...)` with `db.read.prepare(...)` or `db.write.prepare(...)`
  - [ ] 9.3 Replace 1 `env.DB.batch(...)` with `db.write.batch(...)`
  - [ ] 9.4 `handleAdminImageInventory` — needs `assets: Fetcher` as a separate parameter (only handler requiring `ASSETS` binding)
  - [ ] 9.5 Update `tests/api/admin-handlers.test.ts`, `admin-goal-create.test.ts`, `admin-goal-edit.test.ts`, `admin-image-inventory.test.ts`
- [ ] Task 10: Update remaining test files that mock `env.DB` (AC: #6)
  - [ ] 10.1 `tests/api/index.test.ts` — update router integration tests
  - [ ] 10.2 `tests/api/user-isolation.test.ts` — update isolation tests
  - [ ] 10.3 `tests/api/party-pages.test.ts` — update page rendering tests
  - [ ] 10.4 `tests/api/renderAdminPage.test.ts`, `renderAdminGoalsPage.test.ts`, `renderAdminGoalEditPage.test.ts`, `renderAdminGoalAddPage.test.ts` — update admin page render tests
  - [ ] 10.5 Any other test files that construct `mockEnv.DB`
- [ ] Task 11: Update docs (AC: #8)
  - [ ] 11.1 Add "Read/Write Separation" subsection to `docs/architecture.md` in the Database Layer section
  - [ ] 11.2 Document the `createDbClient` pattern, the `DbClient` interface, and migration path for future D1 read replicas
- [ ] Task 12: Full regression test run (AC: #6)
  - [ ] 12.1 `npx jest --no-cache` — all 28 backend suites pass (1026 tests)
  - [ ] 12.2 `cd client && npx vitest run` — all 35 client suites pass (523 tests)

## Dev Notes

### Problem Statement

All 176 `env.DB.prepare(...)` calls across 7 handler files directly access the D1 binding. When Cloudflare ships D1 read replicas, migrating 176+ call sites is error-prone and expensive. A thin `read`/`write` wrapper today means only ONE function changes when replicas arrive.

### Architecture Approach — Pure Refactor, Zero Behavior Change

```typescript
// src/db.ts
export interface DbClient {
  readonly read: D1Database;
  readonly write: D1Database;
}

export function createDbClient(db: D1Database): DbClient {
  return { read: db, write: db };
}
```

Both `.read` and `.write` return the same `D1Database` instance today. When D1 read replicas ship, only this function changes:
```typescript
// Future — NOT part of this story
export function createDbClient(primary: D1Database, replica?: D1Database): DbClient {
  return { read: replica ?? primary, write: primary };
}
```

### Call Site Pattern

```typescript
// src/index.ts — once per request
const db = createDbClient(env.DB);

// Pass to handlers
return handleGoalsGet(request, db);
return handleCreateParty(request, db, partyId);
return handleAdminImageInventory(request, db, env.ASSETS); // needs ASSETS too

// Inside handlers
const goals = await db.read.prepare('SELECT * FROM goals ORDER BY distance_miles').all();
await db.write.prepare('INSERT INTO progress ...').bind(userId, date, distance).run();
await db.write.batch([stmt1, stmt2, stmt3]); // atomic writes
```

### Query Classification Guide

Use this reference to correctly classify every `env.DB.prepare()` call:

**READ (db.read):**
- `SELECT` queries — all pure reads
- `validateSession()` — reads session table
- `calculateTotalDistance()` — reads progress table
- Any `prepare().bind().first()` or `.all()` that returns data without modifying rows

**WRITE (db.write):**
- `INSERT INTO` — row creation
- `UPDATE ... SET` — row modification
- `DELETE FROM` — row removal
- `db.write.batch([...])` — all atomic multi-statement operations (always involve writes)

**Edge cases to watch:**
- `handleProgressPost` in `progress-handlers.ts` does a `SELECT` to check for existing entry, then `INSERT` or `UPDATE`. The SELECT should use `db.read`, the INSERT/UPDATE should use `db.write`.
- `syncPartyProgressLog` builds dynamic arrays of `.prepare()` statements then calls `.batch()` — ALL statements AND the batch call go through `db.write`.
- `handleAdminMetricsSummary` fires 4 parallel `SELECT` queries via `Promise.all` — all use `db.read`.
- Functions that mix reads and writes within the same function body (common pattern): use `db.read` for SELECTs and `db.write` for mutations. Both are the same object today, so no correctness risk.

### Handler Signature Migration Guide

**Current patterns (2 variants):**
```typescript
// Variant A — loosely typed (auth-handlers, progress-handlers public fns, goals-handlers)
export async function handleRegister(request: Request, env: any, body: any): Promise<Response>

// Variant B — structurally typed (party, friends, fellowship-invite, admin handlers)
export async function handleCreateParty(request: Request, env: { DB: D1Database }, body: any): Promise<Response>
```

**Target pattern — all handlers:**
```typescript
import { DbClient } from './db';

// Standard handler
export async function handleGoalsGet(request: Request, db: DbClient): Promise<Response>

// Handler with body
export async function handleRegister(request: Request, db: DbClient, body: any): Promise<Response>

// Handler with route params
export async function handleCreateParty(request: Request, db: DbClient, partyId: string): Promise<Response>

// Special: needs ASSETS binding too
export async function handleAdminImageInventory(request: Request, db: DbClient, assets: Fetcher): Promise<Response>
```

### Critical Cross-File Dependencies

Two shared utility functions are imported across multiple handler files. These MUST be migrated first (or simultaneously) to avoid compilation errors:

1. **`validateSession(request, env)` → `validateSession(request, db)`**
   - Defined in: `src/auth-handlers.ts`
   - Imported by: `progress-handlers.ts`, `party-handlers.ts`, `friends-handlers.ts`, `fellowship-invite-handlers.ts`, `admin-handlers.ts`, `index.ts`
   - Impact: ALL consumer files must update their calls from `validateSession(request, env)` to `validateSession(request, db)`

2. **`calculateTotalDistance(env, userId)` → `calculateTotalDistance(db, userId)`**
   - Defined in: `src/goals-handlers.ts`
   - Imported by: `party-handlers.ts`, `fellowship-invite-handlers.ts`, `friends-handlers.ts`, `index.ts`
   - Impact: ALL consumer files must update their calls

**Recommended migration order:** Start with `db.ts` and `index.ts`, then `auth-handlers.ts` (for `validateSession`), then `goals-handlers.ts` (for `calculateTotalDistance`), then remaining handlers in any order.

### Test Migration Strategy

**Impact:** All 27 backend test files in `tests/api/` mock `mockEnv.DB.prepare`. Every test file needs updating.

**Old mock setup:**
```typescript
const mockEnv = { DB: { prepare: jest.fn(), batch: jest.fn() } };
const response = await handleGoalsGet(mockRequest, mockEnv);
expect(mockEnv.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
```

**New mock setup:**
```typescript
import { DbClient } from '../../src/db';

const mockDB = { prepare: jest.fn(), batch: jest.fn() } as unknown as D1Database;
const mockDb: DbClient = { read: mockDB, write: mockDB };
const response = await handleGoalsGet(mockRequest, mockDb);
expect(mockDB.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
```

**Key insight:** Since both `.read` and `.write` point to the same mock D1Database object, existing test assertion logic barely changes — only the mock construction and handler call signatures change. Tests do NOT need to distinguish between read/write mocks (both are the same object today).

**For tests that mock `validateSession`:**
```typescript
// No change needed — these tests mock the entire module
jest.mock('../../src/auth-handlers');
(validateSession as jest.Mock).mockResolvedValue({ valid: true, userId: 1 });
```

**For `index.test.ts`:**
This file tests the router and calls handlers via the Worker `fetch()`. It creates a full `mockEnv`. The mock needs to either:
- Mock `createDbClient` to return a mock `DbClient`, OR
- Keep `mockEnv.DB` and let `createDbClient` naturally wrap it (preferred — tests the real factory)

### Typing Improvement Opportunity

Currently `auth-handlers.ts`, `progress-handlers.ts`, and `goals-handlers.ts` use `env: any`. The migration to `db: DbClient` **eliminates all `any` env typing** — a strict mode improvement that aligns with project coding standards.

### Files Created

| File | Purpose |
|---|---|
| `src/db.ts` | `DbClient` interface + `createDbClient()` factory |
| `tests/api/db.test.ts` | Unit tests for the wrapper |

### Files Modified

| File | Change Type |
|---|---|
| `src/index.ts` | Create `db` once per request, pass to all handlers |
| `src/auth-handlers.ts` | Signatures + 37 prepare calls + `validateSession` |
| `src/progress-handlers.ts` | Signatures + 8 prepare + 3 batch calls |
| `src/goals-handlers.ts` | Signatures + 2 prepare + `calculateTotalDistance` |
| `src/party-handlers.ts` | Signatures + 57 prepare + 4 batch calls |
| `src/friends-handlers.ts` | Signatures + 21 prepare calls |
| `src/fellowship-invite-handlers.ts` | Signatures + 17 prepare + 2 batch calls |
| `src/admin-handlers.ts` | Signatures + 34 prepare + 1 batch calls + ASSETS param |
| `tests/api/auth-handlers.test.ts` | Mock setup + assertions |
| `tests/api/progress-handlers.test.ts` | Mock setup + assertions |
| `tests/api/goals-handlers.test.ts` | Mock setup + assertions |
| `tests/api/party-handlers.test.ts` | Mock setup + assertions |
| `tests/api/party-management.test.ts` | Mock setup + assertions |
| `tests/api/party-progress.test.ts` | Mock setup + assertions |
| `tests/api/friends-handlers.test.ts` | Mock setup + assertions |
| `tests/api/fellowship-invite-handlers.test.ts` | Mock setup + assertions |
| `tests/api/admin-handlers.test.ts` | Mock setup + assertions |
| `tests/api/admin-goal-create.test.ts` | Mock setup + assertions |
| `tests/api/admin-goal-edit.test.ts` | Mock setup + assertions |
| `tests/api/admin-image-inventory.test.ts` | Mock setup + ASSETS param |
| `tests/api/index.test.ts` | Router tests — `createDbClient` integration |
| `tests/api/user-isolation.test.ts` | Mock setup |
| `tests/api/party-pages.test.ts` | Mock setup |
| `tests/api/renderAdminPage.test.ts` | Mock setup |
| `tests/api/renderAdminGoalsPage.test.ts` | Mock setup |
| `tests/api/renderAdminGoalEditPage.test.ts` | Mock setup |
| `tests/api/renderAdminGoalAddPage.test.ts` | Mock setup |
| `docs/architecture.md` | Add read/write separation pattern documentation |

### What NOT to Change

- No database migrations — this is a code-only refactor
- No new D1 bindings in `wrangler.json` — wrapper uses existing `env.DB`
- No client-side changes — `client/` is untouched
- No `public/js/` changes — legacy JS doesn't interact with D1
- No API contract changes — request/response shapes identical
- No Vitest changes expected — client tests don't mock `env.DB`
- Service Worker (`public/sw.js`) — not affected

### Previous Story Intelligence (8-1)

Story 8-1 (Unified Preact Signal Global Store) is a client-only refactor with no backend changes. It establishes no patterns relevant to this story. However, note:
- Stories 8-1 and 8-2 have **zero overlap** — 8-1 is client signals, 8-2 is backend DB wrapper
- They can be implemented in parallel without conflict
- Story 8-3 (Service Worker SWR) depends on neither being complete first

### Git Intelligence

Recent commits are documentation/BMAD updates and minor fellowship UI fixes. No backend handler changes in the recent commit history. The codebase is stable for this refactor.

### Project Structure Notes

- New `src/db.ts` aligns with existing `src/` pattern for backend modules
- New `tests/api/db.test.ts` follows existing convention of one test file per source module
- No structural conflicts with any in-progress work

### References

- [Source: _bmad-output/planning-artifacts/epics-phases-4-15.md — Epic 8, Story 8.2]
- [Source: docs/architecture.md — Database Layer section]
- [Source: docs/architecture.md — Route → Handler Map]
- [Source: src/index.ts — Worker fetch handler and route dispatch]
- [Source: src/auth-handlers.ts — validateSession shared utility]
- [Source: src/goals-handlers.ts — calculateTotalDistance shared utility]
- [Source: src/party-handlers.ts — batch() usage patterns]
- [Source: src/progress-handlers.ts — syncPartyProgressLog batch pattern]
- [Source: src/admin-handlers.ts — handleAdminImageInventory ASSETS requirement]
- [Source: worker-configuration.d.ts — Env interface with DB: D1Database binding]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
