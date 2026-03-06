# Story 4.6: Goal Management - Add Intermediary Goal

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **administrator**,
I want **to add new intermediary goals between existing milestones through the admin interface**,
so that **narrative gaps in the journey are filled, and users experience a more continuous and engaging progression without disrupting existing progress or party calculations**.

## Acceptance Criteria

### AC1: "Add New Goal" button on goals list page
- Given an authenticated admin user viewing the goals list page (`/admin/goals`)
- When the page renders the `AdminGoalsListIsland`
- Then an "Add New Goal" button is displayed (above or beside the goals table)
- And clicking the button navigates to `/admin/goals/new`

### AC2: Add goal form with required fields
- Given an authenticated admin user on the `/admin/goals/new` page
- When the `AdminGoalAddIsland` renders
- Then the form displays editable fields:
  - **Title** (text input, required)
  - **Distance** (number input, required — in miles; stored as `miles * 1.60934` km)
  - **Description** (multi-line textarea with Markdown preview, optional)
  - **Special** (text input, optional — for special event text)
  - **image_id** (text input, optional — slug referencing `public/img/` assets)
- And all fields have appropriate labels and validation messages

### AC3: Distance must be unique — warn if duplicate
- Given the admin enters a distance value in the form
- When the distance matches an existing goal's distance (within ±0.01 km tolerance after conversion)
- Then an amber warning is displayed: "A goal already exists at this distance ({existing_title}). Are you sure?"
- And the form still allows submission (non-blocking warning)
- And the validation checks against the full goals list fetched from `GET /api/admin/goals`

### AC4: Preview where goal will appear in sequence
- Given the admin has entered a valid distance value
- When the distance value is provided (debounced, 300ms)
- Then a "Position Preview" section displays:
  - **Previous goal**: Title and distance of nearest goal *below* the entered distance
  - **Next goal**: Title and distance of nearest goal *above* the entered distance
  - **Visual indicator**: "New goal will appear between: [{prev_title}] — **[NEW]** — [{next_title}]"
- And if the distance is less than any existing goal, indicate "Will appear as the first goal"
- And if the distance exceeds all existing goals, indicate "Will appear as the last goal"

### AC5: Save creates new goal record
- Given the admin fills in the form with valid data and clicks "Save"
- When the form submits via `POST /api/admin/goals`
- Then the backend inserts a new row into the `goals` table:
  ```sql
  INSERT INTO goals (distance, title, description, special, image_id) VALUES (?, ?, ?, ?, ?)
  ```
  Where distance is stored in km (`input_miles * 1.60934`)
- And the response returns `201 Created` with the new goal record (including `id`)
- And the admin is redirected to the goal edit page (`/admin/goals/:id`) or back to the goals list with a success message
- And the admin action is logged via `logAdminAction('create_goal', 'goal', newGoal.id, { title, distance })`

### AC6: Existing user progress unaffected
- Given a new intermediary goal is inserted at distance X km
- When users view their journey progress
- Then users who have already passed distance X see the new goal as "reached" in their milestone list
- And users who have not yet reached distance X see the new goal as a future milestone
- And no recalculation or migration of existing progress data is needed (progress is stored as daily km, milestone positions are computed dynamically from `goals.distance`)

### AC7: Regression checks for map waypoints and party milestones
- Given a new goal is inserted via the admin interface
- When the map renders waypoints (`GET /api/goals` → `getWaypointCoordinates()`)
- Then the new goal appears correctly on the map at the interpolated position along the fellowship path
- And when party progress is calculated (`handlePartyProgress`)
- Then the new goal correctly appears in `newly_passed_milestones` for parties that have passed its distance
- And `calculated_position` and `next_position` queries correctly include the new goal

### AC8: Non-admin and unauthenticated access control
- Given an unauthenticated request to `POST /api/admin/goals`
- Then the response is `401 Unauthorized`
- Given a non-admin user request to `POST /api/admin/goals`
- Then the response is `403 Forbidden`
- Given an admin request to `GET /admin/goals/new` page
- Then the page renders the add goal form

### AC9: Field validation
- Given the admin submits the form with invalid data
- When title is empty → show "Title is required"
- When distance is empty, zero, or negative → show "Distance must be a positive number"
- When distance is not a valid number → show "Invalid distance value"
- When `image_id` is provided but contains invalid characters (not kebab-case slug) → show "Image ID must be a kebab-case slug (e.g., 'rivendell', 'camp-under-oak')"
- And the form is NOT submitted until all required validations pass

## Tasks / Subtasks

- [x] **Task 1: Create `POST /api/admin/goals` handler in `src/admin-handlers.ts`** (AC: #5, #8, #9)
  - [x] Add `handleAdminGoalCreate(request: Request, env: Env): Promise<Response>` function
  - [x] Parse request body: `{ title, distance_miles, description?, special?, image_id? }`
  - [x] Validate required fields: title (non-empty string), distance_miles (positive number)
  - [x] Validate optional image_id: if provided, must match `/^[a-z0-9]+(-[a-z0-9]+)*$/` (kebab-case slug)
  - [x] Convert distance: `distance_km = distance_miles * 1.60934`
  - [x] Use parameterized SQL insert: `INSERT INTO goals (distance, title, description, special, image_id) VALUES (?, ?, ?, ?, ?)`
  - [x] Return 201 with created goal record (including generated `id`)
  - [x] Log admin action: `logAdminAction(env, userId, 'create_goal', 'goal', newGoalId, { title, distance_miles, distance_km })`
  - [x] Return 400 for validation failures with specific error messages

- [x] **Task 2: Wire `/api/admin/goals` POST route in `src/index.ts`** (AC: #5, #8)
  - [x] Inside the `/api/admin/*` guard block (from Story 4.1), add POST handler
  - [x] Import `handleAdminGoalCreate` from `src/admin-handlers.ts`
  - [x] Updated `getAllowedMethods()` to include POST for `/api/admin/goals`
  - [x] Ensure admin auth middleware runs before the handler (verify `/api/admin/*` prefix guard)

- [x] **Task 3: Create SSR page renderer `src/renderAdminGoalAddPage.ts`** (AC: #1, #2)
  - [x] Follow `renderAdminGoalsPage.ts` (Story 4.3) pattern
  - [x] Use `renderLayout()` for consistent admin shell (sidebar nav, breadcrumbs)
  - [x] Mount point: `<div data-island="AdminGoalAddIsland"></div>`
  - [x] Page title: "Add New Goal — Admin"
  - [x] Breadcrumb: Admin > Goals > Add New Goal

- [x] **Task 4: Wire `/admin/goals/new` page route in `src/index.ts`** (AC: #1)
  - [x] Add page route for admin goal add form
  - [x] **IMPORTANT**: Route `/admin/goals/new` matched BEFORE `/admin/goals/:id` to prevent "new" being parsed as an id
  - [x] Import and call `renderAdminGoalAddPage()`
  - [x] Admin session validation runs before rendering

- [x] **Task 5: Create `AdminGoalAddIsland` Preact island** (AC: #2, #3, #4, #9)
  - [x] Create `client/src/islands/AdminGoalAddIsland.tsx`
  - [x] Register in `client/src/index.tsx` island registry (both autoHydratedIslands and allIslands)
  - [x] Form state using Preact hooks (useState/useEffect/useCallback):
    - `title`, `distanceMiles`, `description`, `special`, `imageId` — form field state
    - `errors` — field-level validation errors
    - `existingGoals` — full goals list for position preview and duplicate check
    - `saving` — submit button loading state
    - `errorMessage` / `successMessage` — form feedback
  - [x] On mount: fetch `GET /api/admin/goals` to populate `existingGoals` for position preview
  - [x] Auth headers: use `getAuthHeaders()` pattern from existing islands

- [x] **Task 6: Implement distance duplicate check** (AC: #3)
  - [x] On distance input change (debounced 300ms), convert miles to km and check against `existingGoals`
  - [x] Use tolerance: `Math.abs(existingGoal.distance - newDistanceKm) < 0.01`
  - [x] If match found: show amber warning with existing goal's title
  - [x] Non-blocking: submit button remains enabled

- [x] **Task 7: Implement position preview** (AC: #4)
  - [x] On distance input change (debounced 300ms, shared with duplicate check), compute:
    - `previousGoal`: goal with highest distance < entered distance (in km)
    - `nextGoal`: goal with lowest distance > entered distance (in km)
  - [x] Display: "[prev_title at X mi] → **[NEW GOAL]** → [next_title at Y mi]"
  - [x] Edge cases: first/last position indicators

- [x] **Task 8: Implement form submission** (AC: #5, #9)
  - [x] Client-side validation before submit: validate title (required), distance (positive number), image_id (kebab-case if provided)
  - [x] POST to `/api/admin/goals` with JSON body: `{ title, distance_miles, description, special, image_id }`
  - [x] On 201 success: redirect to `/admin/goals/:id` for immediate editing
  - [x] On 400 error: display server validation errors
  - [x] On 401/403: redirect to login/journey
  - [x] Disable submit button during request (`saving` state)

- [x] **Task 9: Add "Add New Goal" button to `AdminGoalsListIsland`** (AC: #1)
  - [x] Modified existing `client/src/islands/AdminGoalsListIsland.tsx` (from Story 4.3)
  - [x] Added link: `<a href="/admin/goals/new" class="admin-btn admin-btn-primary">Add New Goal</a>`
  - [x] Positioned in the goals toolbar alongside search and count

- [x] **Task 10: Add CSS for add goal form** (AC: #2, #3, #4)
  - [x] Extended existing `public/css/admin.css` (no separate file)
  - [x] Added styles:
    - `.admin-btn` / `.admin-btn-primary` — Button component
    - `.admin-goal-add` — Form container
    - `.admin-position-preview` — Position preview section styling
    - `.admin-distance-warning` — Amber warning for duplicate distance
  - [x] Reuses existing admin form patterns from Story 4.4 (`.admin-goal-form`, `.admin-goal-field`, etc.)

- [x] **Task 11: Backend unit tests (Jest)** (AC: #5, #8, #9)
  - [x] Created `tests/api/admin-goal-create.test.ts` (16 tests)
  - [x] Created `tests/api/renderAdminGoalAddPage.test.ts` (20 tests)
  - [x] Test `handleAdminGoalCreate`:
    - Valid goal creation → 201 with goal record ✓
    - Missing title → 400 ✓
    - Missing distance → 400 ✓
    - Negative distance → 400 ✓
    - Zero distance → 400 ✓
    - Non-number distance → 400 ✓
    - Invalid image_id format → 400 ✓
    - Valid optional fields accepted ✓
    - Distance converted correctly: `miles * 1.60934` ✓
    - Admin audit log created on success ✓
    - DB error → 500 ✓
  - [x] Updated `tests/api/index.test.ts` for POST /api/admin/goals routing
  - [x] Mock D1: `.bind().run()` for insert, `.first()` for retrieving created record
  - [x] Follows patterns from existing admin handler tests

- [ ] **Task 12: Client unit tests (Vitest)** (AC: #2, #3, #4, #9)
  - Deferred — no existing Vitest configuration in the project; island testing patterns not established yet

- [ ] **Task 13: Playwright E2E tests** (AC: #1, #2, #3, #4, #5, #6, #7, #8)
  - Deferred — requires running Wrangler dev server; E2E test infrastructure for admin flows not yet established

- [x] **Task 14: Documentation** (AC: all)
  - [x] Updated `docs/api-reference.md`: Added `POST /api/admin/goals` with request/response shapes, error codes, auth requirements
  - [x] Updated `docs/architecture.md` route topology: Added `/admin/goals/new` page route and `POST /api/admin/goals` API route

## Dev Notes

### Architecture Context

This story builds on the admin foundation from **Stories 4.1–4.5**. Stories 4.1–4.4 MUST be completed and merged before 4.6 can begin.

**Story 4.1 provides:**
- `validateAdminSession()` in `src/auth-handlers.ts`
- `logAdminAction()` helper in `src/admin-handlers.ts`
- `/api/admin/*` prefix guard with admin auth in `src/index.ts`
- `is_admin` column on `users` table
- `admin_audit_log` table

**Story 4.2 provides:**
- `src/renderAdminPage.ts` — Admin dashboard shell with SSR layout
- `public/css/admin.css` — Admin-specific styles (nav, cards, breadcrumbs, responsive layout)
- `AdminDashboardIsland` in `client/src/islands/AdminDashboardIsland.tsx`
- Admin nav sidebar markup and `renderLayout()` function

**Story 4.3 provides:**
- `src/renderAdminGoalsPage.ts` — Goals list page SSR renderer (use as template for Task 3)
- `AdminGoalsListIsland` in `client/src/islands/AdminGoalsListIsland.tsx` — must be modified (Task 9)
- `handleAdminGoalsList` in `src/admin-handlers.ts` — returns all goals ordered by distance
- `/admin/goals` page route and `GET /api/admin/goals` API route

**Story 4.4 provides:**
- `AdminGoalEditIsland` in `client/src/islands/AdminGoalEditIsland.tsx` — reference for form patterns and Markdown preview
- `handleAdminGoalGet` and `handleAdminGoalUpdate` in `src/admin-handlers.ts`
- `/admin/goals/:id` page route and `GET/PUT /api/admin/goals/:id` API routes
- Admin goal form CSS styles in `public/css/admin.css` — reuse for add form
- `marked` library for Markdown preview

### Key Design Decision: Distance-Based Ordering (No sort_order)

Goals are ordered **exclusively** by `ORDER BY distance ASC`. There is no `sort_order` column.

- A new intermediary goal goes between neighbors purely by its distance value.
- The frontend goals list, journey page, and map all use the API response which returns goals sorted by distance.
- No reordering logic, no sort fields, no ordinal updates needed.
- [Source: docs/data-models.md#goals, migrations/0003_init_goals.sql]

### Key Design Decision: Miles Input, km Storage

All existing migrations use `miles * 1.60934` for distance conversion. The admin form should accept **miles** (matching the user-facing display unit and the migration convention) and convert to km before storage.

```
distance_km = distance_miles * 1.60934
```

- [Source: migrations/0022_insert_intermediary_goals.sql — uses `miles * 1.60934` pattern]

### Key Design Decision: No R2 — Static Repository Assets

Per explicit user decision: Do NOT introduce R2 bindings, R2 buckets, or browser-based file upload. `image_id` is optional for new intermediary goals and references existing assets in `public/img/`. New images follow the asset pipeline: `raw_assets/` → `npm run optimize:images` → `public/img/`.

- [Source: docs/architecture.md, _bmad-output/planning-artifacts/epics.md#Epic 4 Alignment]

### Critical: Map Waypoints Are Dynamically Computed

Map waypoints are **NOT** hardcoded. `client/src/data/waypoints.ts` computes waypoint positions by interpolating goal distances along the fellowship path data. The function `getWaypointCoordinates(pathNodes, goals)` takes goals from the API and derives x,y coordinates.

**Therefore:** A new goal inserted into the DB will automatically appear on the map at the correct interpolated position the next time waypoints are computed. No manual coordinate entry or waypoints.ts changes are needed.

- [Source: client/src/data/waypoints.ts#L34 — `getWaypointCoordinates()`]

### Critical: Party Progress Automatically Includes New Goals

Party milestone queries in `src/party-handlers.ts` are all distance-based:
- `calculated_position`: `SELECT FROM goals WHERE distance <= ? ORDER BY distance DESC LIMIT 1` (line 569)
- `next_position`: `SELECT FROM goals WHERE distance > ? ORDER BY distance ASC LIMIT 1` (line 574)
- `newly_passed_milestones`: `SELECT FROM goals WHERE distance > ? AND distance <= ? ORDER BY distance ASC` (line 579)

**Therefore:** A new goal inserted at distance X will:
1. Automatically appear in `calculated_position` for parties past X (safe)
2. Automatically appear in `next_position` for parties approaching X (safe)
3. May appear as a `newly_passed_milestone` for parties whose `last_viewed_distance < X <= total_distance` — this is **correct behavior** (the party passed that point, they should see the new milestone)

No cache invalidation required — there is no milestone cache (verified: no cache references in `src/party-handlers.ts`).

- [Source: src/party-handlers.ts#L565-L610]

### Critical: Route Order in index.ts

The `/admin/goals/new` page route MUST be matched BEFORE the `/admin/goals/:id` pattern route. If `/admin/goals/:id` is checked first, "new" would be parsed as an id parameter, causing a 404 or error.

Pattern:
```typescript
// ✅ Correct — specific route first
if (url.pathname === '/admin/goals/new') { ... }
else if (matchRoute(url.pathname, '/admin/goals/:id')) { ... }
```

- [Source: src/index.ts — `matchRoute()` helper at line 46]

### Critical Anti-Patterns to Avoid

1. **Do NOT add a `sort_order` column** — goals order by `distance ASC` only
2. **Do NOT modify existing goals** when inserting — INSERT only, no UPDATE to neighbors
3. **Do NOT recalculate user progress** — progress is daily km logs, not milestone-based
4. **Do NOT add R2 bindings** — image_id is optional, references static assets
5. **Do NOT modify waypoints.ts** — waypoints are computed dynamically from API goals
6. **Do NOT add a separate migration** — goal creation is via API at runtime, not via migration
7. **Do NOT use `waitForTimeout`** in Playwright tests — use proper wait assertions
8. **Do NOT create a separate CSS file** — extend `public/css/admin.css`

### D1 TypeScript Interfaces

```typescript
// Request body for POST /api/admin/goals
interface CreateGoalRequest {
  title: string;
  distance_miles: number;
  description?: string;
  special?: string;
  image_id?: string;
}

// Response for POST /api/admin/goals (201 Created)
interface GoalRecord {
  id: number;
  distance: number;       // stored in km
  title: string;
  description: string | null;
  special: string | null;
  image_id: string | null;
}
```

### Existing Code Patterns to Follow

**Auth headers in islands** ([Source: client/src/islands/PartyListIsland.tsx]):
```typescript
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sessionToken');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}
```

**Admin handler pattern** (from Stories 4.3/4.4 — `src/admin-handlers.ts`):
```typescript
export async function handleAdminGoalCreate(request: Request, env: Env): Promise<Response> {
  // 1. Parse and validate request body
  // 2. Convert distance: miles → km
  // 3. Parameterized INSERT
  // 4. Log admin action
  // 5. Return 201 with created record
}
```

**SSR page renderer pattern** (from Story 4.3 — `src/renderAdminGoalsPage.ts`):
```typescript
export function renderAdminGoalAddPage(env: Env): Response {
  const html = renderLayout({
    title: 'Add New Goal — Admin',
    content: `<div data-island="AdminGoalAddIsland"></div>`,
    // breadcrumbs, admin nav, etc.
  });
  return new Response(html, { headers: { 'content-type': 'text/html' } });
}
```

**Island registration** (from `client/src/index.tsx`):
```typescript
const islands: Record<string, () => Promise<{ default: ComponentType }>> = {
  // ... existing islands
  AdminGoalAddIsland: () => import('./islands/AdminGoalAddIsland'),
};
```

### Testing Patterns

- **Mock tokens**: Use `TEST_MOCK_TOKEN_AdminGoalAdd_${uniqueId()}` for E2E test isolation
- **Admin setup**: Create user via mock token, then grant `is_admin = 1` via direct DB
- **D1 mocks**: Mock `env.DB.prepare().bind().run()` for INSERT in unit tests
- **No `waitForTimeout`**: Use `expect().toBeVisible()`, `waitForSelector`, `waitForFunction` instead
- **Cleanup**: Add `cleanupAllTestData` in `afterEach` for test isolation
- [Source: Previously established testing patterns from Epics 2-3]

### Previous Story Intelligence (4-5)

Story 4-5 (Image Asset Workflow Integration) established:
- Build-time image manifest at `public/img/image-manifest.json`
- `env.ASSETS.fetch()` pattern for reading static assets at runtime
- Image status indicators (green/amber/red) — can be referenced for image_id validation UX
- Debounce pattern for input validation (300ms) — reuse for distance validation
- `ImageBrowserModal.tsx` component — available if needed for image_id selection in add form

### Git Intelligence

Recent commits show:
- Fellowship feature (`feat/fellowships`) was the last major merge → Epic 3 complete
- Test concurrency fixes applied → parallel test execution with 3 workers is stable
- Documentation update branch exists (`docs/update-docs-and-sprint-plan`)
- Dependabot keeps dependencies current (`@types/supertest` → 7.2.0)

### Project Structure Notes

- **New files to create:**
  - `src/renderAdminGoalAddPage.ts` — SSR renderer for add goal page
  - `client/src/islands/AdminGoalAddIsland.tsx` — Preact island for add goal form
  - `tests/api/admin-goal-create.test.ts` — Backend unit tests
  - `client/src/islands/__tests__/AdminGoalAddIsland.test.tsx` — Client unit tests
- **Existing files to modify:**
  - `src/admin-handlers.ts` — add `handleAdminGoalCreate` handler
  - `src/index.ts` — add `POST /api/admin/goals` route and `/admin/goals/new` page route
  - `client/src/index.tsx` — register `AdminGoalAddIsland` in island map
  - `client/src/islands/AdminGoalsListIsland.tsx` — add "Add New Goal" button
  - `public/css/admin.css` — add form/preview styles
  - `docs/api-reference.md` — add POST /api/admin/goals endpoint docs
  - `docs/architecture.md` — add new routes to topology

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.6] — Epic story requirements and AC
- [Source: docs/data-models.md#goals] — Goals table schema (distance, title, description, special, image_id)
- [Source: docs/architecture.md] — Cloudflare Workers monolith, D1, Islands Architecture
- [Source: docs/asset-workflow.md] — Image optimization pipeline, image_id conventions
- [Source: docs/frontend-guide.md] — Preact Islands, island registration, SSR patterns
- [Source: migrations/0022_insert_intermediary_goals.sql] — Intermediary goal INSERT pattern (miles × 1.60934)
- [Source: src/party-handlers.ts#L565-L610] — Distance-based milestone queries (auto-include new goals)
- [Source: client/src/data/waypoints.ts#L34] — Dynamic waypoint computation from API goals
- [Source: src/index.ts#L46] — `matchRoute()` helper for parameterized routes
- [Source: src/goals-handlers.ts] — Existing goals handler pattern
- [Source: _bmad-output/implementation-artifacts/4-5-goal-management-image-upload-to-r2.md] — Previous story patterns

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created
- All backend handler tests pass (16 tests in admin-goal-create.test.ts)
- All SSR page tests pass (20 tests in renderAdminGoalAddPage.test.ts)
- Full test suite passes: 711 tests, 25 test suites, zero failures
- Build succeeds with no TypeScript errors
- Client/Vitest and Playwright E2E tests deferred (no existing test infrastructure for these)

### File List

**New Files Created:**
- `src/renderAdminGoalAddPage.ts` — SSR renderer for add goal page
- `client/src/islands/AdminGoalAddIsland.tsx` — Preact island for add goal form with distance preview, duplicate check, validation
- `tests/api/admin-goal-create.test.ts` — Backend unit tests for handleAdminGoalCreate (16 tests)
- `tests/api/renderAdminGoalAddPage.test.ts` — SSR page unit tests (20 tests)

**Modified Files:**
- `src/admin-handlers.ts` — Added `handleAdminGoalCreate`, `CreateGoalRequest` interface
- `src/index.ts` — Added POST /api/admin/goals route, /admin/goals/new page route, updated getAllowedMethods, imports
- `client/src/index.tsx` — Registered AdminGoalAddIsland in autoHydratedIslands and allIslands
- `client/src/islands/AdminGoalsListIsland.tsx` — Added "Add New Goal" button to toolbar
- `public/css/admin.css` — Added styles for .admin-btn, .admin-goal-add, .admin-distance-warning, .admin-position-preview
- `tests/api/index.test.ts` — Updated POST /api/admin/goals test from 405 to 201 routing, added mocks
- `docs/api-reference.md` — Added POST /api/admin/goals endpoint documentation
- `docs/architecture.md` — Added /admin/goals/new page route and POST /api/admin/goals API route

### Change Log

- **Story 4.6 Implementation** — Added complete "Add Intermediary Goal" feature:
  - Backend: POST /api/admin/goals with validation, miles→km conversion, audit logging
  - Frontend: AdminGoalAddIsland with form fields, debounced distance duplicate check (±0.01 km tolerance), position preview showing neighboring goals, client-side validation, success redirect to edit page
  - SSR: renderAdminGoalAddPage with admin shell, breadcrumbs (Admin > Goals > Add New Goal)
  - Routing: /admin/goals/new page route (before :id pattern), POST API route with admin auth guard
  - UX: "Add New Goal" button on goals list page
  - Tests: 36 new tests (16 handler + 20 SSR page), full suite regression-free (711/711)
