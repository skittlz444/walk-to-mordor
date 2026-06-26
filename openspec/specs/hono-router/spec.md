# hono-router Specification

## Purpose
Hono provides structured HTTP routing, method-based dispatch, parameterized path matching, and middleware support for the Cloudflare Workers monolith. Routes are organized by authentication scope so that adding or modifying endpoints follows a consistent, declarative pattern without manual dispatch logic.

## Requirements
### Requirement: Hono-based routing
The system SHALL use Hono for route dispatch in the Cloudflare Workers monolith. Routes SHALL be registered by authentication scope: public routes requiring no authentication, authenticated routes requiring a valid user session, and admin routes requiring an admin-level session. SSR page routes SHALL be registered alongside API endpoints on the same Hono app. Static assets SHALL be served from the Assets binding before requests reach Hono routing.

Hono SHALL handle method validation — each route matches only its registered HTTP method, and unsupported methods receive a 405 response with an Allow header. Parameterized paths SHALL use `:param` syntax with parameters extracted via `c.req.param()`.

#### Scenario: Registered endpoint responds correctly
- **GIVEN** a registered endpoint path with a matching HTTP method
- **WHEN** a request is received
- **THEN** the registered handler executes and returns the expected response

#### Scenario: Unsupported method receives 405
- **GIVEN** a registered endpoint
- **WHEN** a request is made with an HTTP method not registered for that path
- **THEN** the response is 405 with an Allow header listing the supported methods

#### Scenario: Parameterized path extracts path parameters
- **GIVEN** a route registered as `/api/party/:id/progress`
- **WHEN** a request to `/api/party/42/progress` is received
- **THEN** `c.req.param('id')` returns `"42"`

#### Scenario: Static assets are served before Hono routing
- **GIVEN** a request for a static asset that exists
- **WHEN** the request is received
- **THEN** the static asset is returned from the Assets binding without Hono routing

### Requirement: Middleware-based auth guards
The system SHALL use Hono middleware for authentication at the route-group level. Public routes SHALL have no auth middleware. Authenticated routes SHALL use middleware that validates the session token and injects the authenticated user ID into the Hono context. Admin routes SHALL use middleware that validates an admin-level session and injects both user ID and admin user ID.

#### Scenario: Unauthenticated request to authenticated route returns 401
- **GIVEN** a request without a valid session token to an authenticated endpoint
- **WHEN** the request is made
- **THEN** the response is 401

#### Scenario: Non-admin request to admin route returns 403
- **GIVEN** a request from a non-admin user to an admin endpoint
- **WHEN** the request is made
- **THEN** the response is 403

#### Scenario: Authenticated request receives user context
- **GIVEN** a valid authenticated request
- **WHEN** the auth middleware processes it
- **THEN** downstream route handlers can access the authenticated user's ID via `c.get('userId')`

#### Scenario: Admin request receives admin context
- **GIVEN** a valid admin request
- **WHEN** the admin middleware processes it
- **THEN** downstream handlers can access both `c.get('userId')` and `c.get('adminUserId')`

### Requirement: DbClient injection via middleware
The system SHALL use Hono middleware to create a DbClient from the Cloudflare D1 database binding and inject it into the Hono context, making it available to all route handlers.

#### Scenario: DbClient is available in route handlers
- **GIVEN** any API request reaching a route handler
- **WHEN** the handler executes
- **THEN** `c.get('db')` returns a valid DbClient with read and write D1Database instances
