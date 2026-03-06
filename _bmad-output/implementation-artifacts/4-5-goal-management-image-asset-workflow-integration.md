# Story 4.5: Goal Management - Image Asset Workflow Integration

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- NOTE: Despite the legacy story key containing "R2", R2 is explicitly OUT OF SCOPE.
     This story uses repository-backed static assets (public/img/) + Workers Assets binding. -->

## Story

As an **administrator**,
I want **to view, validate, and assign image assets for goals through the admin interface, with guided documentation for the image preparation pipeline**,
so that **I can confidently manage milestone imagery using the existing repository asset workflow, ensuring every goal has correct, optimized images without direct database or filesystem guesswork**.

## Acceptance Criteria

### AC1: Image preview and status display on goal edit page
- Given an authenticated admin user viewing the goal edit page (`/admin/goals/:id`)
- When the `AdminGoalEditIsland` renders the image section
- Then the page displays:
  - **Current `image_id`** value (text, from goal record)
  - **Thumbnail preview**: If `image_id` is non-null, render `<img src="/img/thumbs/<image_id>-thumb.webp">` with fallback on error
  - **High-res preview link**: A "View Full Size" link/button that opens `/img/highres/<image_id>.webp` in a new tab
  - **Image status indicator**: Green checkmark if both highres and thumb files load successfully; red X with "Missing" label if either fails to load (use `onerror` event)
- And if `image_id` is `null` or empty, show "No image assigned" with a placeholder icon

### AC2: Image ID validation against existing assets
- Given the admin enters or changes the `image_id` field on the goal edit form
- When the admin types a slug value (debounced, 300ms)
- Then the client-side performs a live validation:
  - Attempt to load `/img/thumbs/<image_id>-thumb.webp` via a `<img>` element or `fetch` HEAD request
  - If the thumbnail loads: show green indicator "Image found" with thumbnail preview
  - If the thumbnail fails to load: show amber warning "Image not found — ensure assets exist in `public/img/highres/` and `public/img/thumbs/` before deploying"
- And the form still allows saving even if the image is not yet deployed (warn, don't block) since assets may be added in a follow-up commit
- And an empty `image_id` clears the preview and shows "No image assigned"

### AC3: Image asset inventory API endpoint
- Given an authenticated admin user
- When they call `GET /api/admin/images`
- Then the response is `200 OK` with JSON:
  ```json
  {
    "images": [
      {
        "image_id": "rivendell",
        "has_highres": true,
        "has_thumb": true
      },
      {
        "image_id": "woody-end",
        "has_highres": true,
        "has_thumb": true
      }
    ],
    "total": 192,
    "orphaned": ["old-unused-image"],
    "missing": [
      { "goal_id": 42, "title": "Some Goal", "image_id": "missing-slug" }
    ]
  }
  ```
  Where:
  - `images`: All unique `image_id` slugs from the goals table that have matching files deployed
  - `total`: Count of image pairs (highres + thumb) found on disk
  - `orphaned`: Slugs that exist as files but are not referenced by any goal's `image_id`
  - `missing`: Goals whose `image_id` references files that do not exist on disk
- And the endpoint cross-references the goals table `image_id` values against the deployed file manifest
- **Implementation note**: Since Workers cannot do filesystem reads at runtime, this endpoint must use a **build-time generated manifest** (see Task 2)

### AC4: Build-time image manifest generation
- Given the developer runs `npm run build` or `npm run build:manifest`
- When the build script executes
- Then a JSON manifest is generated at `public/img/image-manifest.json` containing:
  ```json
  {
    "generated": "2026-03-06T12:00:00Z",
    "images": ["amon-din-due-west", "amon-hen", "barrow-wights-capture", "..."],
    "count": 192
  }
  ```
  Where `images` is an array of base slugs derived from `public/img/highres/*.webp` filenames (strip `.webp` extension)
- And the manifest is served as a static asset via Workers Assets binding
- And the manifest is regenerated whenever `npm run optimize:images` completes
- And the manifest file is committed to the repository (not gitignored)

### AC5: Image browse/select from available assets
- Given the admin is editing a goal and clicks "Browse Images" next to the `image_id` field
- When the image browser modal/drawer opens
- Then it fetches the image manifest (`/img/image-manifest.json`) and displays a grid/list of available image slugs with thumbnail previews
- And the admin can search/filter by slug name
- And clicking an image slug sets the `image_id` field value and closes the browser
- And the browser shows which images are already assigned to other goals (via the goals list data)

### AC6: Guided workflow documentation panel
- Given the admin is viewing the image section of the goal edit page
- When they click a "How to add images" help link/expandable section
- Then an inline help panel displays the operational workflow:
  1. Place source image in `raw_assets/` directory
  2. Run `npm run optimize:images` to generate WebP variants
  3. Commit the new files in `public/img/highres/` and `public/img/thumbs/`
  4. Run `npm run build:manifest` to update the image manifest (or `npm run build` which includes it)
  5. Deploy via `npm run deploy`
  6. Return to admin and assign the `image_id` slug to the goal
- And the help text is static HTML (no API call needed)

### AC7: Operator feedback for missing/mismatched images
- Given the admin views a goal with an `image_id` that doesn't match deployed assets
- When the image fails to load (404 on thumbnail or highres)
- Then the UI shows a clear warning: "Image files not found for slug '{image_id}'. Follow the image asset workflow to add images."
- And the warning links to the inline help (AC6)
- And the admin can still save the goal with the unresolved `image_id` (non-blocking)

### AC8: Non-admin and unauthenticated access control
- Given an unauthenticated request to `GET /api/admin/images`
- Then the response is `401 Unauthorized`
- Given a non-admin user request to `GET /api/admin/images`
- Then the response is `403 Forbidden`

### AC9: Documentation update
- Given the story is complete
- When documentation is updated
- Then `docs/asset-workflow.md` is updated with admin UI workflow steps
- And `docs/api-reference.md` includes `GET /api/admin/images` endpoint documentation
- And `docs/architecture.md` route topology includes the new API route

## Tasks / Subtasks

- [ ] **Task 1: Create build-time image manifest generator script** (AC: #4)
  - [ ] Create `scripts/generate-image-manifest.js`
  - [ ] Scan `public/img/highres/*.webp` for all image files
  - [ ] Extract base slugs: strip `.webp` extension from filenames
  - [ ] Write JSON to `public/img/image-manifest.json` with `generated` (ISO timestamp), `images` (sorted slug array), `count`
  - [ ] Add `npm run build:manifest` script to `package.json`: `node scripts/generate-image-manifest.js`
  - [ ] Hook into existing `npm run build` script (append `&& npm run build:manifest`)
  - [ ] Hook into `npm run optimize:images` script (append manifest generation after optimization completes)
  - [ ] Commit the generated `public/img/image-manifest.json` to the repository

- [ ] **Task 2: Create admin image inventory API handler** (AC: #3, #8)
  - [ ] Add `handleAdminImageInventory(request: Request, env: Env)` in `src/admin-handlers.ts`
  - [ ] Fetch the image manifest: `const manifestResponse = await env.ASSETS.fetch(new Request('https://placeholder/img/image-manifest.json'));` — use the Workers Assets binding to read the manifest
  - [ ] Parse manifest JSON to get list of available image slugs
  - [ ] Query all goals with non-null `image_id`: `SELECT id, title, image_id FROM goals WHERE image_id IS NOT NULL`
  - [ ] Cross-reference:
    - `images`: goal `image_id` values that exist in the manifest
    - `orphaned`: manifest slugs not referenced by any goal
    - `missing`: goals with `image_id` not found in manifest
  - [ ] Return JSON response
  - [ ] Handle manifest fetch failure gracefully (return 503 with message if manifest not found)

- [ ] **Task 3: Wire `/api/admin/images` route in `src/index.ts`** (AC: #3, #8)
  - [ ] Inside the `/api/admin/*` guard block (from Story 4.1), add:
    ```typescript
    if (url.pathname === '/api/admin/images' && method === 'GET') {
      return handleAdminImageInventory(request, env);
    }
    ```
  - [ ] Import `handleAdminImageInventory` from `src/admin-handlers.ts`
  - [ ] Add to `getAllowedMethods()`: `if (pathname === '/api/admin/images') return ['GET'];`

- [ ] **Task 4: Enhance `AdminGoalEditIsland` image section** (AC: #1, #2, #7)
  - [ ] **IMPORTANT**: This extends the `AdminGoalEditIsland` created in Story 4.4 — do NOT create a new island
  - [ ] Add image preview section below the `image_id` text input:
    - Thumbnail `<img>` with `onerror` fallback to placeholder
    - "View Full Size" link opening highres in new tab
    - Image status indicator (green check / red X / amber warning)
  - [ ] Add debounced (300ms) live validation on `image_id` input changes:
    - On change, attempt to load `/img/thumbs/<value>-thumb.webp`
    - Use `Image()` constructor or `fetch` with `HEAD` method
    - Update status indicator based on load success/failure
  - [ ] Handle empty `image_id`: show "No image assigned" placeholder
  - [ ] Handle load failure: show amber warning with workflow guidance link
  - [ ] Use Preact Signals: `imageStatus` signal (`'loading' | 'found' | 'missing' | 'none'`)

- [ ] **Task 5: Create image browser modal/drawer component** (AC: #5)
  - [ ] Create `client/src/components/admin/ImageBrowserModal.tsx` (component, not island)
  - [ ] "Browse Images" button next to `image_id` field in `AdminGoalEditIsland`
  - [ ] On open, fetch `/img/image-manifest.json` for available slugs
  - [ ] Also fetch `/api/admin/goals` (or use passed-in goal list data) to know which slugs are already assigned
  - [ ] Render a grid of thumbnail previews: `<img src="/img/thumbs/<slug>-thumb.webp">`
  - [ ] Each tile shows: slug name, thumbnail, "In use by: <goal title>" (if assigned to another goal)
  - [ ] Search/filter input at top: filter slugs by substring match
  - [ ] Click a tile to select → sets `image_id` signal value, closes modal
  - [ ] Close via X button, ESC key, or backdrop click
  - [ ] Style with existing admin CSS patterns (dark theme modal)
  - [ ] Handle large image counts: virtual scrolling not needed for ~192 images, simple CSS grid with overflow scroll

- [ ] **Task 6: Add inline help panel for image workflow** (AC: #6)
  - [ ] Add collapsible "How to add images" section in `AdminGoalEditIsland`, below the image preview area
  - [ ] Static HTML content — no API call needed
  - [ ] Content:
    1. Place source image in `raw_assets/` directory
    2. Run `npm run optimize:images` to generate WebP variants
    3. Commit new files in `public/img/highres/` and `public/img/thumbs/`
    4. Run `npm run build` (regenerates image manifest)
    5. Deploy via `npm run deploy`
    6. Return to admin and assign the `image_id` slug
  - [ ] Use `<details>` / `<summary>` HTML pattern for collapsible panel OR a signal-driven toggle
  - [ ] Style consistently with admin theme

- [ ] **Task 7: Add image-related CSS to admin.css** (AC: #1, #2, #5, #7)
  - [ ] Add styles to `public/css/admin.css` (do NOT create a separate file):
    - `.admin-image-section` — Image preview section layout
    - `.admin-image-preview` — Thumbnail/highres preview container
    - `.admin-image-status` — Status indicator (green/amber/red)
    - `.admin-image-status.found` — Green indicator
    - `.admin-image-status.missing` — Amber/red indicator
    - `.admin-image-status.none` — Grey/muted for no assignment
    - `.admin-image-browser` — Modal/drawer overlay
    - `.admin-image-grid` — Grid layout for image browser thumbnails
    - `.admin-image-tile` — Individual tile in grid (thumbnail + label)
    - `.admin-image-tile.selected` — Highlighted selected tile
    - `.admin-image-tile.in-use` — Dimmed/badged for already-assigned images
    - `.admin-image-help` — Inline help panel styling
    - `.admin-image-warning` — Warning message styling (amber)
  - [ ] Follow existing admin.css patterns from Stories 4.2/4.3/4.4

- [ ] **Task 8: Backend unit tests (Jest)** (AC: #3, #8)
  - [ ] Test `handleAdminImageInventory` returns correct inventory structure
  - [ ] Test cross-referencing: goals with matching image assets → `images` list
  - [ ] Test orphaned detection: manifest slugs not in any goal → `orphaned` list
  - [ ] Test missing detection: goal `image_id` not in manifest → `missing` list
  - [ ] Test 403 for non-admin (covered by prefix guard, verify integration)
  - [ ] Test 401 for unauthenticated
  - [ ] Test manifest not found → 503 response
  - [ ] Mock `env.ASSETS.fetch()` for manifest retrieval
  - [ ] Mock D1: `.bind().all()` for goals query
  - [ ] Follow existing patterns in `tests/api/goals-handlers.test.ts`

- [ ] **Task 9: Client unit tests (Vitest)** (AC: #1, #2, #5, #7)
  - [ ] Test image preview renders thumbnail when `image_id` is set
  - [ ] Test image preview shows "No image assigned" when `image_id` is null
  - [ ] Test image status shows green check when thumbnail loads successfully
  - [ ] Test image status shows amber warning when thumbnail fails to load
  - [ ] Test debounced validation fires after 300ms of input inactivity
  - [ ] Test "Browse Images" button opens modal
  - [ ] Test image browser grid renders slugs from manifest
  - [ ] Test image browser search filters slugs
  - [ ] Test clicking a tile sets `image_id` and closes modal
  - [ ] Test inline help panel toggles open/closed
  - [ ] Test warning message displays when `image_id` doesn't match deployed assets
  - [ ] Mock `fetch` for manifest and image loads

- [ ] **Task 10: Playwright E2E tests** (AC: #1, #2, #5, #7, #8)
  - [ ] Test admin can see image preview on goal edit page with valid `image_id`
  - [ ] Test image status indicator shows correctly for assigned images
  - [ ] Test changing `image_id` triggers live validation and updates preview
  - [ ] Test "Browse Images" opens modal with image grid
  - [ ] Test searching in image browser filters results
  - [ ] Test selecting an image from browser sets the `image_id` field
  - [ ] Test inline help section is collapsible
  - [ ] Test non-admin user sees 403 on `/api/admin/images`
  - [ ] Test `GET /api/admin/images` returns correct inventory data
  - [ ] Use `TEST_MOCK_TOKEN_AdminImage_${uniqueId()}` pattern for test isolation
  - [ ] Admin test setup: create user via mock token, grant `is_admin = 1` via direct DB

- [ ] **Task 11: Build script integration test** (AC: #4)
  - [ ] Test `scripts/generate-image-manifest.js` generates valid JSON manifest
  - [ ] Test manifest contains expected slug count (matches `public/img/highres/` file count)
  - [ ] Test manifest slugs are sorted alphabetically
  - [ ] Test manifest handles empty directory gracefully

- [ ] **Task 12: Documentation** (AC: #9)
  - [ ] Update `docs/asset-workflow.md`:
    - Add "Admin UI Workflow" section describing the web-based image management flow
    - Document the image manifest generation and its role
    - Reference the `npm run build:manifest` command
  - [ ] Update `docs/api-reference.md`:
    - Add `GET /api/admin/images` — response shape, error codes, auth requirements
  - [ ] Update `docs/architecture.md` route topology:
    - Add `GET /api/admin/images` to admin API routes section

## Dev Notes

### Architecture Context

This story builds on the admin foundation from **Stories 4.1–4.4**. All four MUST be completed and merged before 4.5 can begin.

**Story 4.1 provides:**
- `validateAdminSession()` in `src/auth-handlers.ts`
- `logAdminAction()` helper in `src/admin-handlers.ts`
- `/api/admin/*` prefix guard in `src/index.ts`
- `is_admin` column on `users` table
- `admin_audit_log` table

**Story 4.2 provides:**
- `src/renderAdminPage.ts` — Admin dashboard shell with SSR layout
- `public/css/admin.css` — Admin-specific styles (nav, cards, breadcrumbs, responsive layout)
- `AdminDashboardIsland` in `client/src/islands/AdminDashboardIsland.tsx`
- Admin nav sidebar markup

**Story 4.3 provides:**
- `src/renderAdminGoalsPage.ts` — Goals list page SSR renderer
- `AdminGoalsListIsland` in `client/src/islands/AdminGoalsListIsland.tsx`
- `handleAdminGoalsList` in `src/admin-handlers.ts`
- `/admin/goals` page route and `/api/admin/goals` API route

**Story 4.4 provides:**
- `AdminGoalEditIsland` in `client/src/islands/AdminGoalEditIsland.tsx` — **This story EXTENDS this island**
- `handleAdminGoalGet` and `handleAdminGoalUpdate` in `src/admin-handlers.ts`
- `/admin/goals/:id` page route and `/api/admin/goals/:id` API routes (GET, PUT)
- Image ID text input with slug format validation
- Basic image preview (thumbnail display if `image_id` is set)
- `marked` library for Markdown preview
- Admin goal form CSS styles in `public/css/admin.css`

### Key Design Decision: No R2

Per explicit user decision and architecture constraint ([Source: docs/architecture.md#Architectural Constraints]):
- **DO NOT** introduce R2 bindings, R2 buckets, or browser-based file upload
- Images are managed through the repository asset pipeline: `raw_assets/` → `npm run optimize:images` → `public/img/`
- The admin UI provides **visibility and validation**, not upload capability
- Image files are committed to git and deployed via Workers Assets binding

### Critical Anti-Patterns to Avoid

1. **Do NOT add R2 bindings** to `wrangler.json` or `worker-configuration.d.ts`
2. **Do NOT create file upload endpoints** — images are committed to the repo, not uploaded at runtime
3. **Do NOT create a separate admin image page** — extend the existing goal edit page from Story 4.4
4. **Do NOT use filesystem APIs at runtime** — Workers cannot read `public/img/` at runtime; use the build-time manifest
5. **Do NOT duplicate the optimize-images script logic** — the existing `scripts/optimize-images.js` is the canonical pipeline
6. **Do NOT make image validation blocking** — warn but allow saving with unresolved `image_id` since assets may be deployed later

### Workers Assets Binding Pattern

The Workers runtime serves static files via `env.ASSETS.fetch()`. To read the image manifest at runtime:
```typescript
// Fetch manifest from Workers Assets binding
const manifestUrl = new URL('/img/image-manifest.json', request.url);
const manifestResponse = await env.ASSETS.fetch(new Request(manifestUrl.toString()));
if (!manifestResponse.ok) {
  return createErrorResponse('Image manifest not available', 503);
}
const manifest = await manifestResponse.json() as ImageManifest;
```
[Source: docs/architecture.md — Assets served via Workers Assets binding]

### Existing Image Asset Conventions

- **192 image pairs** currently exist in `public/img/highres/` and `public/img/thumbs/`
- Naming: mix of numeric IDs (e.g., `0.webp`, `1.webp`) and slugs (e.g., `rivendell.webp`, `woody-end.webp`)
- Thumbnails use `-thumb` suffix: `<slug>-thumb.webp`
- High-res: `<slug>.webp`
- `image_id` in goals table stores the slug (no extension, no suffix)
- [Source: docs/asset-workflow.md, public/img/]

### D1 TypeScript Interface

```typescript
interface GoalImageRow {
  id: number;
  title: string;
  image_id: string | null;
}

interface ImageManifest {
  generated: string;
  images: string[];
  count: number;
}

interface ImageInventoryResponse {
  images: Array<{ image_id: string; has_highres: boolean; has_thumb: boolean }>;
  total: number;
  orphaned: string[];
  missing: Array<{ goal_id: number; title: string; image_id: string }>;
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

**Admin handler pattern** (from Story 4.3/4.4 — `src/admin-handlers.ts`):
```typescript
export async function handleAdminImageInventory(request: Request, env: Env): Promise<Response> {
  // 1. Fetch manifest via Assets binding
  // 2. Query goals for image_id references
  // 3. Cross-reference and return inventory
}
```

**Island signal pattern** ([Source: client/src/islands/AdminGoalEditIsland.tsx from Story 4.4]):
```typescript
const imageStatus = signal<'loading' | 'found' | 'missing' | 'none'>('none');
```

**Debounce pattern for input validation:**
```typescript
let debounceTimer: ReturnType<typeof setTimeout>;
function onImageIdChange(value: string) {
  clearTimeout(debounceTimer);
  if (!value) { imageStatus.value = 'none'; return; }
  imageStatus.value = 'loading';
  debounceTimer = setTimeout(() => validateImageExists(value), 300);
}
```

### Testing Patterns

- **Mock tokens**: Use `TEST_MOCK_TOKEN_AdminImage_${uniqueId()}` for E2E test isolation
- **Admin setup**: Create user via mock token, then grant `is_admin = 1` via direct DB
- **Assets mock**: Mock `env.ASSETS.fetch()` in unit tests for manifest retrieval
- **No `waitForTimeout`**: Use `expect().toBeVisible()`, `waitForSelector`, `waitForFunction` instead
- [Source: Previously established testing patterns from Epic 3]

### Project Structure Notes

- All new admin components extend existing files from Stories 4.1–4.4
- New files:
  - `scripts/generate-image-manifest.js` — build-time manifest generator
  - `public/img/image-manifest.json` — generated manifest (committed)
  - `client/src/components/admin/ImageBrowserModal.tsx` — reusable modal component
- Modified files:
  - `src/admin-handlers.ts` — add `handleAdminImageInventory`
  - `src/index.ts` — add `/api/admin/images` route
  - `client/src/islands/AdminGoalEditIsland.tsx` — extend with image section
  - `public/css/admin.css` — add image-related styles
  - `package.json` — add `build:manifest` script, hook into `build` and `optimize:images`
  - `docs/asset-workflow.md`, `docs/api-reference.md`, `docs/architecture.md` — documentation updates

### References

- [Source: docs/asset-workflow.md] — Complete image optimization pipeline documentation
- [Source: docs/data-models.md#goals] — `goals.image_id` column definition
- [Source: docs/architecture.md#Architectural Constraints] — Static asset pipeline, no R2
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.5] — Epic story requirements and AC
- [Source: _bmad-output/implementation-artifacts/4-4-goal-management-edit-goal.md] — Previous story patterns and admin infrastructure
- [Source: scripts/optimize-images.js] — Image optimization script (sharp-based)
- [Source: public/img/] — 192 existing image pairs (highres + thumbs)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

### File List
