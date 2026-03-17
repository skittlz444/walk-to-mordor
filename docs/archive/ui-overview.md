---
name: ui-overview
description: SSR shell, island hydration, component inventory, and legacy JS interop rules.
---

# UI Overview

Last updated: 2026-03-17

## Rendering Pattern

The UI uses SSR shells from the Worker plus client-side island hydration. This is intentionally **not an SPA** — route handling remains server-driven.

- SSR page composition: `src/renderLayout.ts` and page renderers in `src/render*.ts`
- Shared island bundle: `/js/client/islands.js`
- Shared legacy runtime scripts (on non-public pages): `/js/profile.js`, `/js/main.js`

## Island Hydration

Islands are registered in `client/src/index.tsx`. There are two hydration modes:

### Auto-hydrated Islands

Any `<div data-island="IslandName">` is automatically discovered and hydrated on page load. Props are passed via a `data-props` JSON attribute. Most page-level islands use this pattern.

### Programmatic Islands

Legacy vanilla JS modules can mount islands into specific DOM containers at runtime. Used for modals and inline components that vanilla code controls (e.g., `DistanceModal`, `GoalModal`, `NextGoalCard`).

```js
window.__islands.render('DistanceModal', containerEl, { ...props });
```

### Creating a New Island

1. Create the component in `client/src/islands/`.
2. Register it in `client/src/index.tsx` in the appropriate registry (auto or programmatic).
3. Add a `<div data-island="YourIsland">` in the SSR page renderer, or use `window.__islands.render()` from vanilla JS.
4. Use Preact Signals for state; create a store in `client/src/stores/` if shared state is needed.

## Page Shell → Island Mapping

Each `src/render*.ts` file produces an SSR shell that mounts one or more islands. Scan `src/render*.ts` and `client/src/islands/` for the full list.

Key patterns:

- `/journey` (`src/renderHtml.ts`) — mixes vanilla JS modules with programmatic islands
- `/map` (`src/map-handlers.ts`) — auto-hydrates `MapIsland`
- Fellowship pages — `src/renderParty*.ts`, each auto-hydrating a `Party*Island`
- Friends pages — `src/renderFriend*.ts`, each auto-hydrating a `Friend*Island`
- Admin pages — `src/renderAdmin*.ts`, each auto-hydrating an `Admin*Island`; all use `/css/admin.css`

## Legacy JS Interop

Legacy vanilla JS modules live in `public/js/`. **Do not rewrite these without explicit permission.**

Key modules: `main.js` (bootstrap), `profile.js` (preferences/avatar), `calendar.js`/`progress.js` (CRUD), `goals.js` (goal list), `validators.js` (shared validation).

### Bridge Globals

Islands expose bridge globals on `window` for vanilla JS interop:

- `window.__islands.render(name, container, props)` — programmatic island mounting
- `window.partyStore` — fellowship state (from `client/src/stores/partyStore.ts`)

Prefer signals and stores over adding new bridge globals.

## State Management

- **New code**: Preact Signals stores in `client/src/stores/` (e.g., `mapStore.ts`, `partyStore.ts`)
- **Legacy code**: Module-scoped state and browser storage
- Bridge globals allow gradual interoperability between the two systems.

## Styling

- Global: `public/css/main.css`; feature-specific CSS alongside (e.g., `party.css`, `map.css`, `auth.css`)
- Theme variables and conventions → `docs/css-theming.md`
- Each SSR page renderer declares which CSS files to include via `renderLayout` config.

## Navigation

- `DrawerIsland` provides nav links: Journey, Map, Fellowships, Friends
- Fellowships and Friends nav links show badge counts for pending invites/requests
- Home route (`/`) performs auth-aware redirect based on session preferences
- **Route precedence**: Static routes before dynamic to avoid collisions — `/party/join/:inviteCode` before `/party/:id`; `/friends/add/:friendCode` before `/friends/:id`
