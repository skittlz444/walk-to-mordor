# Story 4.3: Goal Management - List View

Status: ready-for-dev

## Story

As an **administrator**,
I want **a paginated, searchable list of all goals/milestones in the admin portal**,
so that **I can browse, find, and navigate to specific goals for content management without needing direct database access**.

## Acceptance Criteria

### AC1: Protected `/admin/goals` page renders goal list
- Given an authenticated admin user (with `is_admin = 1`)
- When they navigate to `GET /admin/goals`
- Then the server renders the admin goals list page via `renderLayout()`
- And the page includes the `AdminGoalsListIsland` Preact island mount point
- And the page uses the existing dark fantasy theme (CSS variables from `main.css`)
- And the admin sidebar navigation shows "Goals" as the active/highlighted link

### AC2: Goals list displays all goals with key columns
- Given the admin goals list page is loaded
- When the `AdminGoalsListIsland` hydrates and fetches `GET /api/admin/goals`
- Then a table/list displays all goals (171+) with columns:
  - **ID** (integer primary key)
  - **Title** (milestone name)
  - **Distance** (km threshold, formatted to 1 decimal)
  - **Has Image** (boolean indicator: checkmark icon if `image_id` is non-null/non-empty, X/dash if null/empty)
- And the default sort order is by distance ascending (matching the journey order)

### AC3: Paginated API endpoint returns goals
- Given an authenticated admin user
- When they call `GET /api/admin/goals`
- Then the response is `200 OK` with JSON:
  ```json
  {
    "goals": [
      { "id": 1, "title": "Bag End", "distance": 0, "image_id": "bag-end", "has_image": true, "description": "...", "special": null },
      ...
    ],
    "total": 195,
    "page": 1,
    "pageSize": 25,
    "totalPages": 8
  }
  ```
- And pagination query params are supported: `?page=1&pageSize=25`
- And `pageSize` defaults to 25, max 100
- And `page` defaults to 1

### AC4: Search/filter by title
- Given the admin goals list
- When the user types into a search input field
- Then the list filters to show only goals whose title contains the search text (case-insensitive)
- And the search is performed server-side via query parameter: `GET /api/admin/goals?search=rivendell`
- And the API uses `WHERE title LIKE ?` with `%term%` pattern (parameterized, not string-concatenated)
- And the search input has a debounce (300ms) to prevent excessive API calls
- And pagination resets to page 1 when search term changes
- And an empty search returns all goals (no filter)

### AC5: Sort by distance ascending/descending
- Given the admin goals list
- When the user clicks the "Distance" column header
- Then the list toggles between ascending and descending distance order
- And a visual sort indicator (arrow icon) shows the current sort direction
- And sort is performed server-side via query parameter: `GET /api/admin/goals?sort=distance&order=asc`
- And the default sort is `distance ASC`

### AC6: Click row navigates to goal detail/edit page
- Given the admin goals list with goal rows displayed
- When the admin clicks on a goal row
- Then the browser navigates to `/admin/goals/:id` (the edit page from Story 4.4)
- And the entire row is clickable (not just the title)
- And the row has hover styling to indicate interactivity

### AC7: Non-admin users see 403 on goals list page
- Given an authenticated user with `is_admin = 0`
- When they navigate to `GET /admin/goals`
- Then they receive a 403 Forbidden response

### AC8: Non-admin users see 403 on goals API
- Given an authenticated user with `is_admin = 0`
- When they call `GET /api/admin/goals`
- Then the response is 403 Forbidden with `{"error": "Admin access required"}`

### AC9: Unauthenticated users see 401
- Given a request without a valid Bearer token
- When they request `GET /admin/goals` or `GET /api/admin/goals`
- Then the response is 401 Unauthorized

### AC10: Breadcrumb navigation
- Given the admin goals list page
- When rendered
- Then the breadcrumb shows: `Admin > Goals`
- And "Admin" is a clickable link to `/admin`

### AC11: Loading and empty states
- Given the admin goals list page
- When data is being fetched
- Then a loading skeleton/spinner is displayed
- And if the search returns no results, show "No goals match your search" message
- And if the API returns an error, show an error message with retry option

## Tasks / Subtasks

- [ ] **Task 1: Create admin goals API handler** (AC: #3, #4, #5, #8, #9)
  - [ ] Add `handleAdminGoalsList(request, env)` function in `src/admin-handlers.ts`
  - [ ] Parse query params: `page` (default 1), `pageSize` (default 25, max 100), `search` (optional), `sort` (default 'distance'), `order` (default 'asc')
  - [ ] Build parameterized SQL query with LIKE for search (use `?` binding, never string concatenation)
  - [ ] Execute count query for total, then paginated data query
  - [ ] Compute `has_image` field: `image_id IS NOT NULL AND image_id != ''`
  - [ ] Return JSON with `goals`, `total`, `page`, `pageSize`, `totalPages`

- [ ] **Task 2: Wire `/api/admin/goals` route in `src/index.ts`** (AC: #3, #8, #9)
  - [ ] Add `GET /api/admin/goals` route inside the `/api/admin/*` guard block (established by Story 4.1)
  - [ ] Import `handleAdminGoalsList` from `src/admin-handlers.ts`
  - [ ] Add `'/api/admin/goals'` → `['GET']` to `getAllowedMethods()`

- [ ] **Task 3: Create `renderAdminGoalsPage.ts`** (AC: #1, #10)
  - [ ] Create `src/renderAdminGoalsPage.ts`
  - [ ] Use `renderLayout()` with:
    - `title`: `'Walk to Mordor - Admin Goals'`
    - `stylesheets`: `['/css/admin.css']`
    - `headerContent`: Admin breadcrumb (`Admin > Goals`)
    - `mainContent`: Admin nav sidebar + `<div data-island="AdminGoalsListIsland"></div>`
  - [ ] Reuse the same admin nav sidebar markup from `renderAdminPage.ts` (Story 4.2) with "Goals" as active link

- [ ] **Task 4: Wire `/admin/goals` page route in `src/index.ts`** (AC: #1, #7, #9)
  - [ ] Add `GET /admin/goals` page route with `validateAdminSession` guard
  - [ ] Import `renderAdminGoalsPage` from `src/renderAdminGoalsPage.ts`
  - [ ] Return rendered HTML response

- [ ] **Task 5: Create `AdminGoalsListIsland` Preact component** (AC: #2, #4, #5, #6, #11)
  - [ ] Create `client/src/islands/AdminGoalsListIsland.tsx`
  - [ ] State: `goals`, `loading`, `error`, `page`, `pageSize`, `totalPages`, `total`, `search`, `sortOrder`
  - [ ] On mount, fetch `GET /api/admin/goals` with Bearer token
  - [ ] Render table with columns: ID, Title, Distance (formatted), Has Image (icon)
  - [ ] Search input with 300ms debounce (resets page to 1)
  - [ ] Distance column header clickable to toggle sort (with arrow indicator)
  - [ ] Pagination controls: Previous/Next buttons, page indicator ("Page X of Y"), disabled at boundaries
  - [ ] Row click navigates to `/admin/goals/${goal.id}`
  - [ ] Loading skeleton while fetching
  - [ ] Error state with retry button
  - [ ] Empty search result state message

- [ ] **Task 6: Register AdminGoalsListIsland in island bundle** (AC: #1)
  - [ ] Import `AdminGoalsListIsland` in `client/src/index.tsx`
  - [ ] Add to `autoHydratedIslands` object
  - [ ] Add to `allIslands` object

- [ ] **Task 7: Backend unit tests (Jest)** (AC: #3, #4, #5, #8, #9)
  - [ ] Test `handleAdminGoalsList` returns paginated goals with correct structure
  - [ ] Test pagination: page=2 returns correct offset
  - [ ] Test search filter: `?search=rivendell` filters by title LIKE
  - [ ] Test sort: `?order=desc` returns distance descending
  - [ ] Test pageSize clamped to max 100
  - [ ] Test `has_image` correctly derived from `image_id`
  - [ ] Test 403 for non-admin (covered by prefix guard, but verify integration)
  - [ ] Test 401 for unauthenticated
  - [ ] Mock D1 following existing patterns in `tests/api/goals-handlers.test.ts`

- [ ] **Task 8: Client unit tests (Vitest)** (AC: #2, #4, #5, #6, #11)
  - [ ] Test `AdminGoalsListIsland` renders loading state
  - [ ] Test renders goal table with correct columns after fetch
  - [ ] Test search input triggers debounced API call
  - [ ] Test sort toggle changes sort indicator and refetches
  - [ ] Test pagination buttons navigate pages
  - [ ] Test row click navigates to edit page
  - [ ] Test empty state message on no search results
  - [ ] Test error state with retry

- [ ] **Task 9: Playwright E2E tests** (AC: #1, #2, #6, #7, #9, #10)
  - [ ] Test admin user can navigate to `/admin/goals` and see goals table
  - [ ] Test non-admin user sees 403 on `/admin/goals`
  - [ ] Test unauthenticated user sees 401 on `/admin/goals`
  - [ ] Test goals table displays correct data
  - [ ] Test search filters goals by title
  - [ ] Test clicking a goal row navigates to `/admin/goals/:id`
  - [ ] Test breadcrumb shows "Admin > Goals" with working Admin link
  - [ ] Test pagination controls work

- [ ] **Task 10: Documentation** (AC: all)
  - [ ] Update `docs/api-reference.md` with `GET /api/admin/goals` endpoint contract (params, response)
  - [ ] Update `docs/architecture.md` route topology with `/admin/goals` page and API
  - [ ] Update `docs/frontend-guide.md` with `AdminGoalsListIsland` component
  - [ ] Update `docs/ui-overview.md` with admin goals list page description

## Dev Notes

### Architecture Context

This story builds on the admin foundation from **Story 4.1** (admin auth) and the admin shell from **Story 4.2** (dashboard, nav, CSS). Both 4.1 AND 4.2 MUST be completed and merged before 4.3 can begin.

**Story 4.1 provides:**
- `validateAdminSession()` in `src/auth-handlers.ts`
- `logAdminAction()` helper in `src/admin-handlers.ts`
- `/api/admin/*` prefix guard in `src/index.ts`
- `is_admin` column on `users` table
- `admin_audit_log` table

**Story 4.2 provides:**
- `src/renderAdminPage.ts` — Admin dashboard shell with SSR layout
- `public/css/admin.css` — Admin-specific styles (nav, cards, breadcrumbs, responsive layout)
- `AdminDashboardIsland` in `client/src/islands/AdminDashboardIsland.tsx` — Reference for admin island patterns
- Admin nav sidebar markup (Dashboard, Goals, Users, Metrics links)
- `handleAdminDashboard` in `src/admin-handlers.ts` — Reference for admin API handler pattern
- `/api/admin/dashboard` route wiring — Reference for route wiring pattern
- Admin link in `DrawerIsland` — Conditional on `isAdmin` session flag

### Existing Code Patterns to Follow

**Goals data model** ([Source: docs/data-models.md]):
```
goals table:
  id: INTEGER PRIMARY KEY AUTOINCREMENT
  distance: REAL (km threshold)
  title: TEXT (milestone name)
  description: TEXT (rich narrative)
  special: TEXT (optional special event text)
  image_id: TEXT (slug for WebP assets in public/img/)
```

**Existing goals query** ([Source: src/goals-handlers.ts]):
```typescript
// Current public goals endpoint — fetches ALL goals, no pagination
const { results } = await env.DB.prepare("SELECT * FROM goals ORDER BY distance ASC").all();
```
The admin endpoint MUST NOT reuse `handleGoalsGet` directly—it needs pagination, search, and sorting. But the same table and columns are used.

**SSR rendering pattern** ([Source: src/renderPartyListPage.ts]):
```typescript
export function renderPartyListPage(): string {
  return renderLayout({
    title: 'Walk to Mordor - Fellowships',
    description: '...',
    stylesheets: ['/css/party.css'],
    headerContent: '<h1>Fellowships</h1>',
    mainContent: '<div data-island="PartyListIsland"></div>',
  });
}
```
The admin goals page should follow this exact pattern, reusing `admin.css` (from Story 4.2) and including the admin nav sidebar HTML before the island mount point.

**Admin nav sidebar** (from Story 4.2 `renderAdminPage.ts`):
The admin pages share a sidebar navigation. The Goals page should reuse the same nav markup with "Goals" marked as active. Consider extracting a shared `renderAdminNav(activePage: string)` helper if Story 4.2 hasn't already.

**Island auto-hydration** ([Source: client/src/index.tsx]):
Islands auto-hydrate via `data-island` attribute. Register in both `autoHydratedIslands` and `allIslands`:
```typescript
import { AdminGoalsListIsland } from './islands/AdminGoalsListIsland';
// In autoHydratedIslands:
AdminGoalsListIsland,
// In allIslands:
AdminGoalsListIsland,
```

**Auth headers in islands** ([Source: client/src/islands/PartyListIsland.tsx]):
```typescript
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sessionToken');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}
```
Reuse this pattern (or import from a shared utility if one exists).

**Route wiring** ([Source: src/index.ts]):
Admin API routes go inside the `/api/admin/*` prefix guard block established by Story 4.1. Page routes use `validateAdminSession` inline:
```typescript
// Page route
if (url.pathname === "/admin/goals") {
  const adminValidation = await validateAdminSession(request, env);
  if (!adminValidation.valid) return adminValidation.error;
  return new Response(renderAdminGoalsPage(), {
    headers: { 'content-type': 'text/html' },
  });
}
```

**Method allowlist** ([Source: src/index.ts]):
Add to `getAllowedMethods()`:
```typescript
case '/api/admin/goals':
  return ['GET'];
```

### API Handler Implementation Details

**`handleAdminGoalsList(request, env)`** in `src/admin-handlers.ts`:

```typescript
// Parse query params
const url = new URL(request.url);
const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '25', 10)));
const search = url.searchParams.get('search')?.trim() ?? '';
const order = url.searchParams.get('order') === 'desc' ? 'DESC' : 'ASC';
const offset = (page - 1) * pageSize;

// Build queries
let countSql = 'SELECT COUNT(*) as total FROM goals';
let dataSql = 'SELECT id, title, distance, description, special, image_id FROM goals';
const bindings: string[] = [];

if (search) {
  const whereClause = ' WHERE title LIKE ?';
  countSql += whereClause;
  dataSql += whereClause;
  bindings.push(`%${search}%`);
}

dataSql += ` ORDER BY distance ${order} LIMIT ? OFFSET ?`;
// Bind search param (if any), then LIMIT and OFFSET
```

**Important:** Use parameterized queries with `.bind()` for the LIKE search term. NEVER concatenate user input into SQL strings.

**Sort column is always `distance`** — the only sortable column. Title sort is not needed (goals are conceptually ordered by distance along the route). Adding sort by ID or title would be over-engineering for 171 rows.

### CSS Theming — Use Existing Admin Styles

Admin pages MUST use the CSS from `public/css/admin.css` created by Story 4.2, which builds on the existing CSS variable system ([Source: docs/css-theming.md]):

| Variable | Value | Use For |
|---|---|---|
| `--bg-primary` | `#000000` | Main background |
| `--bg-secondary` | `#1a1a1a` | Table row backgrounds |
| `--bg-dark-alt` | `#2a2a2a` | Table header, hover states |
| `--text-gold` | `#FFD700` | Column headers, active links |
| `--text-primary` | `#ffffff` | Table cell text |
| `--text-secondary` | `#ccc` | Secondary text |
| `--text-muted` | `#999` | Empty state text, pagination info |
| `--accent-blue` | `#007bff` | Clickable row hover accent |
| `--accent-teal` | `#16c79a` | Search focus ring, active states |

Add goals-specific styles to `public/css/admin.css` (extend, do not create a separate file):
- `.admin-goals-table` — Full-width table with themed borders
- `.admin-goals-search` — Search input styling
- `.admin-goals-pagination` — Pagination controls layout
- `.admin-goals-row:hover` — Row hover for clickability affordance
- `.admin-goals-sort-indicator` — Sort arrow icon styling
- `.admin-goals-has-image` — Checkmark/X icon styling

### Testing Patterns

**Backend tests (Jest)** ([Source: tests/api/goals-handlers.test.ts]):
- Mock `env.DB.prepare()` chain: `.bind().all()` for data, `.bind().first()` for count
- Mock `validateAdminSession` to return `{ valid: true, userId: 1, isAdmin: true }` for happy path
- For auth tests: mock to return `{ valid: false, error: new Response('...', { status: 403 }) }`
- Follow test structure from existing `tests/api/goals-handlers.test.ts`

**Client tests (Vitest)** ([Source: client/src/islands/]):
- Use `@testing-library/preact` with `render()` and `screen`
- Mock `fetch` globally for API responses
- Test loading → success and loading → error state transitions
- Follow patterns from existing island test files (e.g., `DistanceModal.test.tsx`, `GoalModal.test.tsx`)

**Playwright E2E** ([Source: tests/ui/]):
- Use `TEST_MOCK_TOKEN_AdminGoals_${uniqueId()}` pattern for test isolation
- Admin test setup must grant `is_admin = 1` via direct DB call after user creation
- No `waitForTimeout` — use `expect().toBeVisible()`, `waitForSelector`, `waitForURL`
- Run with `npm run test:ui` (chromium-only, 3 workers)

### Project Structure Notes

**Files to create:**
- `src/renderAdminGoalsPage.ts` — SSR page renderer for admin goals list
- `client/src/islands/AdminGoalsListIsland.tsx` — Preact island component

**Files to modify:**
- `src/admin-handlers.ts` — Add `handleAdminGoalsList` function
- `src/index.ts` — Add `/admin/goals` page route, `/api/admin/goals` API route, `getAllowedMethods` entry
- `client/src/index.tsx` — Register `AdminGoalsListIsland` in island manifests
- `public/css/admin.css` — Add goals table/search/pagination styles

**Files for reference (do not modify):**
- `src/renderLayout.ts` — SSR shell renderer (`PageConfig` interface)
- `src/auth-handlers.ts` — `validateAdminSession` (from Story 4.1)
- `src/goals-handlers.ts` — Existing public goals handler (reference for table/query structure)
- `src/renderPartyListPage.ts` — Minimal SSR page pattern reference
- `client/src/islands/PartyListIsland.tsx` — Island pattern reference (auth headers, fetch, loading states)
- `public/css/main.css` — CSS variables/theme
- `docs/data-models.md` — Goals table schema

### Dependencies

| Dependency | Status | Impact |
|---|---|---|
| Story 4.1 (Admin Auth) | `ready-for-dev` (NOT YET IMPLEMENTED) | **Hard blocker** — provides `validateAdminSession`, `/api/admin/*` guard, `is_admin` column |
| Story 4.2 (Admin Dashboard) | `ready-for-dev` (NOT YET IMPLEMENTED) | **Hard blocker** — provides admin nav sidebar, `admin.css`, `renderAdminPage.ts`, admin island patterns |
| `renderLayout()` | Exists | Ready to use — follow existing pattern |
| Islands infrastructure | Exists | `client/src/index.tsx` + build pipeline ready |
| D1 `goals` table | Exists | 171+ goals already populated with `id`, `distance`, `title`, `description`, `special`, `image_id` |
| CSS variable system | Exists | Theme variables defined in `main.css` |

### Alignment Notes

- **No R2.** Goals list uses `image_id` to indicate image presence. The actual images live in `public/img/highres/` and `public/img/thumbs/`, committed in the repository. The list view only shows a boolean "has image" indicator.
- **No `sort_order` column.** Goals are ordered by `distance ASC` (the journey order). No separate sort column exists or is needed.
- **`image_id` is a slug** (e.g., `bag-end`, `woody-end`), not a numeric ID. Has Image = `image_id IS NOT NULL AND image_id != ''`.
- **Pagination defaults to 25.** With 171+ goals (195 including intermediary), ~8 pages. Max 100 per page.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 4.3 definition]
- [Source: _bmad-output/implementation-artifacts/4-1-admin-authentication-authorization.md — Previous story (admin auth foundation)]
- [Source: _bmad-output/implementation-artifacts/4-2-admin-dashboard-shell.md — Previous story (admin dashboard, nav, CSS)]
- [Source: docs/data-models.md — Goals table schema]
- [Source: src/goals-handlers.ts — Existing goals query pattern]
- [Source: src/renderLayout.ts — PageConfig interface and SSR pattern]
- [Source: src/renderPartyListPage.ts — Minimal page rendering example]
- [Source: client/src/index.tsx — Island registration pattern]
- [Source: client/src/islands/PartyListIsland.tsx — Island auth/fetch/loading pattern]
- [Source: src/index.ts — Route structure and method allowlist pattern]
- [Source: docs/css-theming.md — CSS variable system]

## Dev Agent Record

### Agent Model Used

<!-- filled by dev agent -->

### Debug Log References

### Completion Notes List

### File List
