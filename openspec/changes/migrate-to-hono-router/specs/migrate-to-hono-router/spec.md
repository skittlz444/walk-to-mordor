## ADDED Requirements

### Requirement: Hono-based routing
The system SHALL use Hono for route dispatch in the Cloudflare Workers monolith, SHALL replace the monolithic if/else chain with structured route registrations organized by auth scope, and SHALL preserve the exact behavior of all existing API endpoints, SSR page routes, and the static asset serving path.

#### Scenario: API endpoint routes respond identically after migration
- **GIVEN** any existing API endpoint path and method
- **WHEN** a request is made after the Hono migration
- **THEN** the response status, headers, and body match the pre-migration behavior exactly

#### Scenario: SSR page routes respond identically after migration
- **GIVEN** any existing page route (/journey, /admin, /map, /profile, etc.)
- **WHEN** a request is made after the Hono migration
- **THEN** the HTML response matches the pre-migration behavior exactly

#### Scenario: Static assets are served before Hono routing
- **GIVEN** a request for a static asset that exists
- **WHEN** the request is made
- **THEN** the static asset is returned from the Assets binding without Hono processing

### Requirement: Middleware-based auth guards
The system SHALL use Hono middleware for session validation and admin session validation, SHALL apply middleware at the route group level rather than per-route, SHALL inject user context into the Hono context, and SHALL return 401/403 responses for unauthenticated/unauthorized requests identically to pre-migration behavior.

#### Scenario: Authenticated route rejects unauthenticated request
- **GIVEN** a request without a valid session token to an authenticated endpoint
- **WHEN** the request is made
- **THEN** the auth middleware returns a 401 response identically to pre-migration behavior

#### Scenario: Admin route rejects non-admin user
- **GIVEN** a request from a non-admin user to an admin endpoint
- **WHEN** the request is made
- **THEN** the admin middleware returns a 403 response identically to pre-migration behavior

#### Scenario: Auth middleware injects user context
- **GIVEN** a valid authenticated request
- **WHEN** the auth middleware processes it
- **THEN** `c.get('userId')` is set and available to downstream route handlers

### Requirement: Built-in method validation
The system SHALL rely on Hono's built-in method validation rather than the hand-rolled `getAllowedMethods` function, SHALL return automatic 405 responses with `Allow` headers for unsupported methods, and SHALL produce the same method validation behavior as pre-migration.

#### Scenario: Unsupported method returns 405 with Allow header
- **GIVEN** a GET endpoint receiving a POST request
- **WHEN** the request is made
- **THEN** Hono returns a 405 response with the correct `Allow` header

### Requirement: Parameterized path matching
The system SHALL use Hono's built-in `:param` path parameter extraction rather than the hand-rolled `matchRoute` function, SHALL support the same parameterized route patterns, and SHALL extract path parameters identically.

#### Scenario: Parameterized route extracts path parameters correctly
- **GIVEN** a request to `/api/party/42/progress`
- **WHEN** the route `/api/party/:id/progress` matches
- **THEN** `c.req.param('id')` returns `"42"`

#### Scenario: Parameterized admin route extracts path parameters correctly
- **GIVEN** a request to `/api/admin/goals/15`
- **WHEN** the route `/api/admin/goals/:id` matches
- **THEN** `c.req.param('id')` returns `"15"`

### Requirement: DbClient injection via middleware
The system SHALL use Hono middleware to create a `DbClient` and inject it into the Hono context, SHALL make it available to all route handlers via `c.get('db')`, and SHALL preserve the existing read/write D1 pattern.

#### Scenario: DbClient is available in route handlers
- **GIVEN** any API request
- **WHEN** the route handler executes
- **THEN** `c.get('db')` returns a valid `DbClient` with `read` and `write` D1Database instances
