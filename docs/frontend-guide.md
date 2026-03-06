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
