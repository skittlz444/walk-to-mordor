# Project Summary: Walk to Mordor

## Overview

Walk to Mordor is a Cloudflare Workers web app for tracking walking distance against Middle-earth milestones.

The current product surface includes:

- Account flows: register, login, email confirmation, password reset.
- Personal progress flows: daily logging, edits/deletes, calendar history, total distance, milestone unlocking.
- Map flows: interactive map view with a dedicated `/map` page.
- Fellowship flows: party creation, join via invite code, progress/activity tracking, leadership and settings management.

## Runtime and Delivery Model

- Runtime: single Worker monolith (`src/index.ts`) with server-rendered HTML responses.
- Database: Cloudflare D1 SQLite (`DB` binding).
- Static assets: Workers Assets binding from `public/` (`ASSETS` binding).
- Frontend strategy: legacy vanilla modules in `public/js/` plus Preact islands in `client/src/`.
- Rendering approach: SSR shell + island hydration + vanilla orchestration.

## Canonical Routes

- App entry: `/` (redirect logic based on auth + `defaultViewMap` preference).
- Main app: `/journey`.
- Map: `/map`.
- Auth pages: `/login`, `/password-reset`, `/reset-password`.
- Fellowship pages: `/party`, `/party/:id`, `/party/:id/manage`, `/party/join/:inviteCode`.

Note: legacy `/wtm` aliases are deprecated and should not be reintroduced.

## Key Directories

- `src/`: Worker routing, API handlers, SSR renderers.
- `client/src/`: Preact islands, map components, stores, typed utilities.
- `public/`: static CSS/JS/assets and service worker.
- `migrations/`: D1 schema and content migrations.
- `tests/`: backend and Playwright UI suites.
- `docs/`: living project documentation.

## Tooling and Test Stack

- Language: TypeScript (strict mode on root + client configs).
- Build/deploy: `wrangler` + Vite (`npm run build`, `npm run deploy`).
- Unit/integration tests: Jest (`npm test`, `npm run test:coverage`).
- Client tests: Vitest (`npm run test:client`, `npm run test:client:coverage`).
- UI tests: Playwright (`npm run test:ui`, `npm run test:ui:all`).
