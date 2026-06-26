## Context

`src/index.ts` is ~900 lines. The fetch handler uses an if/else chain to dispatch routes:

```
if (url.pathname === "/api/register" && method === "POST") { ... }
else if (url.pathname === "/api/login" && method === "POST") { ... }
else if (url.pathname.startsWith("/api/admin/")) { ... }
...
```

The file also contains two utility functions:
- `matchRoute(pathname, pattern)` — manual path parameter extraction (~15 lines)
- `getAllowedMethods(pathname)` — method validation switch statement (~80 lines)

The handler pattern varies:
- Public routes: direct calls `handleRegister(request, db, body, env)`
- Authenticated routes: inline `validateSession` then call handler
- Admin routes: inline `validateAdminSession` then call handler with adminUserId
- Parameterized routes: use `matchRoute()` to extract params from the URL

Hono (https://hono.dev) is the leading web framework for Cloudflare Workers. It provides:
- Method-based routing: `app.get('/path', handler)`
- Parameterized paths: `app.get('/api/party/:id/progress', handler)`
- Middleware: `app.use('*', middleware)` for cross-cutting concerns
- Built-in 405 responses with `Allow` header
- `c.req.param('id')` for path parameters
- `c.env` for Worker bindings
- `app.request()` for testing

## Goals / Non-Goals

**Goals:**
- Replace the if/else chain with structured Hono route registrations.
- Eliminate `matchRoute()` and `getAllowedMethods()`.
- Add middleware for `DbClient` injection and auth guards.
- Preserve exact behavior of all existing endpoints (no semantic changes).
- Reduce `src/index.ts` from ~900 to ~200 lines.
- Make route registration intuitive for future OpenSpec changes.

**Non-Goals:**
- No handler refactoring. Handlers keep their existing signatures.
- No changes to the `scheduled()` handler.
- No changes to static asset serving logic.
- No changes to body parsing logic (Hono parses bodies, but existing handlers may have custom validation).
- No migration to Hono's `c.json()` helpers — keep existing `new Response(JSON.stringify(...))` patterns for now.

## Decisions

### Big-bang migration in one change

Replace all routes in a single commit rather than incrementally. Every route in the if/else chain maps directly to a Hono route registration. The migration is mechanical — ~60 route registrations + thin handler wrappers.

Rationale: an incremental migration would require maintaining two routing systems simultaneously, doubling the complexity. The mapping is 1:1 and testable — complete replacement is lower risk than dual-routing.

### Thin wrapper pattern for existing handlers

Existing handlers have mixed signatures (`handleSessionValidation(request, db, allowTestAuth?)`, `handleProgressPost(request, db, body, allowTestAuth?)`, `handleAdminGoalUpdate(request, db, goalId, body, adminUserId)`). Rather than refactoring all 60 handlers, add thin wrapper functions:

```
// Public route
app.post('/api/register', (c) => {
  return handleRegister(c.req.raw, c.get('db'), await c.req.json(), c.env)
})

// Authenticated route (auth middleware sets c.get('userId'))
app.get('/api/total-distance', (c) => {
  return calculateUserStorylineDistance(c.get('db'), c.get('userId'))
    .then(d => new Response(JSON.stringify(d), { headers: { 'content-type': 'application/json' } }))
})

// Admin parameterized route
app.put('/api/admin/goals/:id', (c) => {
  const goalId = Number(c.req.param('id'))
  return handleAdminGoalUpdate(c.req.raw, c.get('db'), goalId, await c.req.json(), c.get('adminUserId'))
})
```

Rationale: avoids touching 15 handler files and ~60 handler functions. The wrappers are 2-5 lines each and live in `src/index.ts`.

### Auth middleware sets context

```
const authMiddleware = createMiddleware(async (c, next) => {
  const db = c.get('db')
  const result = await validateSession(c.req.raw, db, c.env.ALLOW_TEST_AUTH)
  if (!result.valid) return result.error
  c.set('userId', result.userId)
  return next()
})

const adminMiddleware = createMiddleware(async (c, next) => {
  const db = c.get('db')
  const result = await validateAdminSession(c.req.raw, db, c.env.ALLOW_TEST_AUTH)
  if (!result.valid) return result.error
  c.set('userId', result.userId)
  c.set('adminUserId', result.userId)
  return next()
})
```

Rationale: eliminates ~20 inline `validateSession`/`validateAdminSession` calls. Each route group gets the appropriate middleware applied once via `router.use('*', middleware)`.

### Route organization by auth scope

Routes are grouped into three Hono sub-apps:

```
const publicRoutes = new Hono()     // No auth required
const authenticatedRoutes = new Hono()  // validateSession
const adminRoutes = new Hono()      // validateAdminSession

// Auth middleware applied to route groups
authenticatedRoutes.use('*', authMiddleware)
adminRoutes.use('*', adminMiddleware)

// Mount sub-apps
app.route('/', publicRoutes)
app.route('/', authenticatedRoutes)
app.route('/', adminRoutes)
```

Rationale: auth middleware is applied once per group, not per-route. Adding new routes to the correct group automatically gets the right auth guard. This is the pattern Hono's documentation recommends.

### SSR page routes render inline with `c.html()`

Hono's `c.html()` provides proper content-type headers. Page routes become:
```
app.get('/admin', (c) => c.html(renderAdminPage()))
app.get('/journey', (c) => c.html(renderHtml()))
app.get('/profile', (c) => c.html(renderProfilePage()))
```

Rationale: simpler than the current `new Response(renderHtml(), { headers: {...} })` pattern. Hono handles the content-type header.

### Static assets served before Hono

The existing pattern of checking static assets first is preserved:
```
async fetch(request, env, ctx) {
  if (request.method === 'GET' || request.method === 'HEAD') {
    const assetResponse = await env.ASSETS.fetch(request)
    if (assetResponse.status !== 404) return assetResponse
  }
  return app.fetch(request, env, ctx)
}
```

Rationale: matches the existing behavior exactly. Hono only processes requests that don't match a static asset.

### Keep body parsing in Hono handlers, not global middleware

Hono handlers that need a body call `await c.req.json()` individually rather than having a global body parsing middleware. This follows the existing pattern where only POST/PUT/DELETE endpoints parse the body, and parsing errors are handled by each handler's existing validation logic.

Rationale: avoids changing handler validation behavior. Some handlers have custom body validation with specific error messages that a global middleware would complicate.

## Risks / Trade-offs

- [~60 route wrappers in src/index.ts could make the file long again] → Group wrappers by domain with clear section comments. The wrappers are 2-5 lines each and self-documenting. Future changes can extract route groups to separate files.
- [Hono dependency adds ~13 KB to the bundle] → Hono is tree-shakeable and designed for Workers. The bundle increase is offset by removing ~80 lines of custom routing code.
- [Jest tests that mock fetch may need adapting] → Hono provides `app.request()` for testing. Update test helpers to use Hono's test utilities instead of raw fetch mocking. This is mechanical work.
- [Body parsing timing] → Hono's `c.req.json()` is async and must be called per-route. The existing code parses the body once at the top of fetch and passes it to handlers. The wrapper pattern adapts this — each wrapper calls `c.req.json()` only if the handler needs a body. Routes that don't need bodies (most GET requests) never parse.

## Migration Plan

1. `npm install hono`
2. Create Hono app in `src/index.ts` with `DbClient` middleware.
3. Register SSR page routes.
4. Register public API routes (auth endpoints, public event endpoints).
5. Create authenticated route group with auth middleware. Register all authenticated routes.
6. Create admin route group with admin middleware. Register all admin routes.
7. Replace the fetch handler body to route through Hono.
8. Remove `matchRoute()` and `getAllowedMethods()`.
9. Remove the if/else chain.
10. Update Jest tests that mock `fetch` to use `app.request()`.
11. Run full test suite and fix regressions.
12. Update docs.

Rollback: revert `src/index.ts` to the previous version. Remove `hono` from `package.json`. No data migration.

## Open Questions

None.
