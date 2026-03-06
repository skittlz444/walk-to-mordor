# Source Tree Analysis

Last updated: 2026-03-06

## High-Level Tree

```text
walk-to-mordor/
  src/                  # Worker entry, route dispatch, API handlers, SSR renderers
  client/               # Preact islands app (Vite + Vitest)
    src/
      islands/
      components/
      stores/
      data/
      utils/
      types/
  public/               # Static assets served by Workers Assets binding
    css/
    js/
    img/
    icons/
  migrations/           # D1 SQL migrations (schema + goal/image updates)
  tests/                # Jest + Playwright suites
    ui/
  scripts/              # Build and asset pipeline helpers
  docs/                 # Living project documentation
```

## Critical Folders

### `src/`

Core backend and routing layer.

- `index.ts`: request router and method guards
- `auth-handlers.ts`: auth/session/preferences/password/email flows
- `progress-handlers.ts`: progress CRUD
- `goals-handlers.ts`: goals and distance calculations
- `party-handlers.ts`: fellowship domain API
- `render*.ts`: SSR page rendering

### `client/src/`

Preact island stack.

- `islands/`: page and programmatic islands
- `components/map/`: Konva map rendering primitives
- `stores/`: Signals state for map and party data
- `data/`: waypoints/path data used by map views

### `public/`

Worker-served static layer.

- `js/`: legacy browser modules and cache tooling scripts
- `css/`: global and feature styles
- `img/highres` + `img/thumbs`: image assets keyed by DB `goals.image_id`

### `migrations/`

Chronological D1 migration history.

- Core schema and auth migrations
- Goal text/image updates
- Fellowship tables (`0119_create_fellowship_tables.sql`)

### `tests/`

- Unit/integration: Jest suites for server modules
- UI/E2E: Playwright specs under `tests/ui/`

## Entry Points and Integration Paths

- Worker entry: `src/index.ts`
- Island hydration entry: `client/src/index.tsx`
- Main journey render path: `src/renderHtml.ts`
- Map render path: `src/map-handlers.ts`
- Fellowship page renders: `src/renderParty*Page.ts`

Integration boundaries:

- SSR provides mount points and script/style includes.
- Legacy JS and islands interoperate via exposed globals and shared API contracts.
- D1 is the central persistence layer for all features.
