## Why

`src/index.ts` has grown to ~900 lines with a monolithic if/else chain dispatching ~60 API routes plus ~20 SSR page routes. Each new OpenSpec change adds branches, creating ordering bugs (exact match vs parameterized match), merge conflicts, and untestable routing logic. Hono is the most popular framework for Cloudflare Workers, providing built-in routing with method validation, parameterized path matching, middleware for auth guards, and automatic 405 responses — eliminating ~80 lines of manual `getAllowedMethods` code and ~400 lines of if/else dispatch.

## What Changes

- Add `hono` as a dependency (~13 KB gzipped, zero-config with Cloudflare Workers).
- Replace the monolithic if/else chain in `src/index.ts` with Hono route registrations organized by concern: public routes, authenticated routes, admin routes, and SSR page routes.
- Replace the hand-rolled `matchRoute` function with Hono's built-in `:param` path parameters.
- Replace the `getAllowedMethods` function with Hono's built-in method validation (automatic 405 responses with `Allow` header).
- Add Hono middleware for auth guards (`validateSession`, `validateAdminSession`) that inject user context into the request, eliminating repeated inline validation calls.
- Add Hono middleware for `DbClient` injection via `c.set('db', createDbClient(c.env.DB))`, eliminating the shared `const db` variable.
- Preserve the existing `scheduled()` handler, static asset serving, and body parsing logic unchanged — only the route dispatch changes.
- No behavior changes to any handler, API endpoint, or user-facing surface.

## Capabilities

### New Capabilities
- `migrate-to-hono-router`: Hono-based routing for the Cloudflare Workers monolith, replacing the monolithic if/else chain with structured route registrations, middleware-based auth guards, built-in method validation, and parameterized path matching.

### Modified Capabilities
- None.

## Impact

- `package.json`: add `hono` dependency.
- `src/index.ts`: reduced from ~900 to ~200 lines. Imports, static asset serving, scheduled handler, and handler imports are preserved. The if/else chain and `getAllowedMethods`/`matchRoute` functions are replaced with Hono app configuration.
- All handler files (`src/*-handlers.ts`): unchanged. Handlers keep their existing signatures; thin wrapper functions adapt them to Hono's `(c: Context) => Response` signature.
- All render files (`src/render*.ts`): unchanged.
- No D1 schema changes, no frontend changes, no test changes beyond Jest route dispatch tests that need updating to test via Hono test utilities instead of direct handler calls.
- Tests: update Jest tests that mock `fetch` to use Hono's `app.request()` test helper instead; add coverage for middleware behavior and route registration.
- Documentation: update `docs/architecture.md` with the new routing architecture.
