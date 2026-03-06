# Frontend Guide

Last updated: 2026-03-06

## Purpose

This guide covers frontend development for the hybrid SSR + islands architecture.

## Current Frontend Shape

- Legacy runtime: `public/js/*.js`
- Islands runtime: `client/src/` (Preact + Signals)
- Shared rendering shell: `src/renderLayout.ts`

Rule of thumb:

- Keep existing legacy flows stable.
- Add new interactive capabilities in `client/src/` islands unless a change is explicitly legacy-only.

## Directory Map

```text
client/src/
  components/        # Reusable TSX components (including map primitives)
  data/              # Static map/waypoint datasets
  islands/           # Mountable page islands
  stores/            # Preact Signals state stores
  types/             # Shared client types
  utils/             # Client utilities and cache helpers
  index.tsx          # Island registry and hydration entry
```

## Build and Run

From repo root:

- `npm run build:client` - one-off client build
- `npm run dev:client` - watch mode rebuilds
- `npm run dev` - full local app (worker + client watch + local D1 migrations)
- `npm run build` - production build (client + service worker cache version update)

## Island Development Workflow

1. Add a new island in `client/src/islands/YourIsland.tsx`.
2. Register it in `client/src/index.tsx`.
3. Add mount point in the corresponding SSR renderer (`data-island="YourIsland"`) or mount it programmatically.
4. Build/run and verify hydration in browser.

## State Guidelines

- Use Signals stores for cross-island state (`client/src/stores/*`).
- Keep server state source-of-truth in API responses.
- Use localStorage only for lightweight UX preferences or client cache hints.

## Testing

- Client unit tests: `npm run test:client`
- Client coverage: `npm run test:client:coverage`
- UI tests (Chromium): `npm run test:ui`
- UI tests (all browsers sequentially): `npm run test:ui:all`

UI testing conventions used in this repo:

- Use explicit waits/assertions (`expect(...).toBeVisible`, `waitForURL`, etc.).
- Avoid `waitForTimeout` except tiny gesture simulation delays.
- Use unique mock-auth tokens per test worker for isolation.

## Interop Notes

`client/src/index.tsx` exposes bridge globals used by legacy scripts:

- `window.preact`
- `window.preactIslands`
- `window.partyStore`

Do not remove these without migrating all dependent legacy code paths.

## Admin Dashboard Island

The `AdminDashboardIsland` component (`client/src/islands/AdminDashboardIsland.tsx`) renders the admin stats dashboard. It fetches `GET /api/admin/dashboard` with a Bearer token and displays four stat cards: Total Users, Total Distance, Active Fellowships, and Total Goals. Supports loading skeleton, error retry, and auto-redirects on 401/403.

## Admin Goals List Island

The `AdminGoalsListIsland` component (`client/src/islands/AdminGoalsListIsland.tsx`) renders the paginated, searchable, sortable goals list table. It fetches `GET /api/admin/goals` with Bearer token. Supports search with debounce, sort-by-distance toggle, pagination, loading skeleton, error retry, and row-click navigation to `/admin/goals/:id`.

## Admin Goal Edit Island

The `AdminGoalEditIsland` component (`client/src/islands/AdminGoalEditIsland.tsx`) renders the goal edit form at `/admin/goals/:id`. It extracts the goal ID from `window.location.pathname`, fetches `GET /api/admin/goals/:id`, and displays an edit form with:

- **Title** (text, required), **Distance** (number, required), **Description** (textarea, required)
- **Special** (text, optional), **Image ID** (text, optional, slug-validated)
- Read-only **ID** and **Has Image** indicator
- **Markdown preview** toggle for description using the `marked` library
- **Image thumbnail** preview when `image_id` is set
- Client-side validation with inline error messages
- **Save** button sends `PUT /api/admin/goals/:id`; success toast auto-dismisses after 3s
- **Back to Goals** link navigates to `/admin/goals`
- Loading, 404, and error states with retry
