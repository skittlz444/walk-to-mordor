# Walk to Mordor - Cloudflare Workers Application

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Bootstrap and Build (Required Setup)
- `npm install` -- installs dependencies in 30 seconds
- `npx wrangler d1 migrations apply DB --local` -- sets up local D1 database in 3 seconds  
- `npm run check` -- TypeScript compilation and deploy dry-run in 2 seconds
- `npm run build` -- updates service worker cache version in <1 second
- **NEVER CANCEL**: All commands complete quickly (under 30 seconds each)

### Development Server
- ALWAYS run bootstrap steps first
- `npm run dev` -- starts local development server on http://localhost:8787
  - Automatically runs `npm run build:sw:reset` to use development cache placeholders
  - Automatically seeds local D1 database
  - **TIMING**: Server startup takes 10-15 seconds, NEVER CANCEL
  - **VALIDATION**: Test server with `curl -f http://localhost:8787/wtm/` 
  - **UI ACCESS**: Full application available at http://localhost:8787/wtm/

### Testing Strategy (330+ Total Tests)
**CRITICAL**: All tests run quickly - NEVER CANCEL test commands

#### Fast Feedback Loop (Active Development)
- `npm run test:unit` -- Unit tests (112 tests) in 3 seconds
- `npm run test:quick` -- Success flows only (60 tests) in 4 seconds

#### Comprehensive Validation (Pre-Commit)
- `npm run test:api:all` -- All API tests (45 tests) in 2 seconds **REQUIRES DEV SERVER RUNNING**
- `npm run test:coverage` -- Unit tests only with coverage (112 tests) in 5 seconds
- **Coverage Target**: 96%+ coverage maintained automatically
- **NOTE**: API tests require `npm run dev` in separate terminal or use `npm run test:unit` for coverage-only validation

#### UI Testing (Requires Playwright Browsers)
- `npx playwright install chromium` -- install browser (may fail due to network)
- `npm run test:ui:success` -- UI happy path tests (64 tests) **REQUIRES DEV SERVER RUNNING**
- `npm run test:ui:edge-cases` -- UI edge cases (64 tests) **REQUIRES DEV SERVER RUNNING**
- `npm run test:ui:auth` -- Authentication UI tests (48 tests) **REQUIRES DEV SERVER RUNNING**
- `npm run test:ui:headed` -- Debug UI tests with visible browser **REQUIRES DEV SERVER RUNNING**
- **NOTE**: UI tests require `npm run dev` in separate terminal, same as API tests

### Build and Deploy Commands  
- `npm run build` -- updates cache version for deployment in <1 second
- `npm run deploy` -- builds and deploys to Cloudflare Workers
- `npm run cf-typegen` -- generates TypeScript types in 4 seconds
- `npm run build:sw:reset` -- resets cache to development placeholder in <1 second

## Validation

### Manual Testing Scenarios
ALWAYS manually validate changes via these scenarios:

#### API Testing (with dev server running)
```bash
# Test API endpoints (requires authentication)
# First register a user and get session
curl -X POST -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}' \
  http://localhost:8787/wtm/api/auth/register

# Then use session cookie for protected endpoints
curl -H "Cookie: session=SESSION_ID" http://localhost:8787/wtm/api/goals
curl -H "Cookie: session=SESSION_ID" http://localhost:8787/wtm/api/calendar-progress
curl -X POST -H "Content-Type: application/json" -H "Cookie: session=SESSION_ID" \
  -d '{"start":"2024-12-01","title":"5.5"}' \
  http://localhost:8787/wtm/api/calendar-progress
```

#### UI Testing  
- Navigate to http://localhost:8787/wtm/ in browser
- If not authenticated, you'll see login/register page
- Register or login to access main application
- Verify total distance displays correctly (e.g., "45.65 km")
- Test calendar interactions if making UI changes
- Test authentication flow (login, logout, registration)
- Take screenshot to document UI state

### Pre-Commit Validation
ALWAYS run before committing:
- `npm run test:coverage` -- validates unit tests with coverage (no server required)
- `npm run check` -- validates TypeScript and Wrangler config
- For API/UI validation: start dev server (`npm run dev`) then run `npm run test:api:all` and `npm run test:ui:all` in separate terminal
- Manual API and UI validation as described above

## Common Tasks

### Database Management
- **Local Setup**: `npx wrangler d1 migrations apply DB --local` 
- **Remote Setup**: `npx wrangler d1 migrations apply DB --remote`
- **Database Location**: Local SQLite files in `.wrangler/state/v3/d1/`
- **Schema**: Tables include `users` (username, password_hash, salt), `sessions` (session management), `progress` (date, distance, user_id) and `goals` (id, distance, title, special, description)
- **Authentication**: User registration, login, logout with secure password hashing
- **Data Isolation**: Each user's progress data is completely isolated

### Cache Management
- **Development**: Use `npm run build:sw:reset` to set placeholder cache names
- **Production**: Use `npm run build` to set timestamped cache names (format: walk-to-mordor-YYYYMMDD-HHMMSS)
- **Service Worker**: Located at `public/wtm/sw.js` with automated versioning

### Code Structure Navigation
- **Main Handler**: `src/index.ts` - primary request router and API logic
- **Authentication**: `src/auth-handlers.ts` - user registration, login, logout handlers
- **Auth Utilities**: `src/auth-utils.ts` - password hashing, session management, validation
- **Validators**: `src/validators.ts` - input validation and error handling 
- **HTML Renderer**: `src/renderHtml.ts` - generates main application and auth pages
- **Progress Handlers**: `src/progress-handlers.ts` - user progress CRUD operations
- **Goals Handlers**: `src/goals-handlers.ts` - milestone goals and total distance calculation
- **Static Assets**: `public/wtm/` - CSS, JS, icons, manifest for PWA
- **Database Migrations**: `migrations/` - SQL schema evolution including user authentication
- **Tests**: `tests/` - comprehensive test suite organized by type with authentication coverage

## Repository Context

### Technology Stack
- **Runtime**: Cloudflare Workers (serverless edge computing)
- **Database**: Cloudflare D1 (SQLite-based serverless SQL)
- **Frontend**: Static HTML/CSS/JavaScript with PWA features
- **Testing**: Jest (unit), Supertest (API integration), Playwright (UI E2E)
- **Build**: Node.js scripts with Wrangler CLI for deployment

### Configuration Files
- `wrangler.json` - Cloudflare Workers configuration with D1 bindings
- `package.json` - comprehensive npm scripts for all workflows
- `jest.config.json` - test configuration with 80% coverage threshold
- `playwright.config.js` - E2E test configuration with multi-browser support
- `tsconfig.json` - TypeScript compilation settings

### API Endpoints
- `POST /wtm/api/auth/register` - user registration with username and password
- `POST /wtm/api/auth/login` - user login and session creation
- `POST /wtm/api/auth/logout` - user logout and session destruction
- `GET /wtm/api/auth/me` - get current authenticated user information
- `GET /wtm/api/calendar-progress` - retrieve user's progress entries (authenticated)
- `POST /wtm/api/calendar-progress` - create new progress entry (authenticated)
- `PUT /wtm/api/calendar-progress` - update existing progress entry (authenticated)
- `DELETE /wtm/api/calendar-progress` - remove progress entry (authenticated)
- `GET /wtm/api/goals` - retrieve milestone goals data (authenticated)
- `GET /wtm/api/total-distance` - get user's total distance (authenticated)
- Root path serves the main HTML application or auth page based on authentication status

### GitHub Actions CI/CD
- **PR Workflow**: `.github/workflows/pr-tests.yml` runs full test suite
- **Unit Tests**: Fast feedback with coverage reporting
- **API Tests**: Integration testing with local D1 database  
- **UI Tests**: Cross-browser E2E validation with Playwright
- **Artifacts**: Coverage reports, test results, and HTML reports uploaded

## Troubleshooting

### Common Issues
- **Playwright Install Fails**: Network issues common - focus on unit/API tests for validation
- **Dev Server Port Conflicts**: Wrangler uses port 8787 by default
- **Database Connection**: Ensure local migrations applied before starting dev server
- **TypeScript Errors**: Run `npm run cf-typegen` to regenerate Cloudflare types

### Performance Notes  
- **Fast Test Feedback**: Unit tests (3s), API tests (2s), coverage (5s)
- **Build Speed**: All build commands complete in under 5 seconds
- **Development Server**: Starts in 10-15 seconds with full database setup
- **Network Dependencies**: Only Playwright browser downloads are slow/unreliable

## Key Development Patterns

### Error Handling
- All API endpoints include comprehensive validation
- Database operations wrapped in try-catch with specific error responses
- HTTP status codes follow REST conventions (200, 201, 400, 404, 405, 409, 500)

### Test Organization
- **Unit Tests**: Fast, isolated function testing in `tests/*.test.ts`
- **API Tests**: Integration tests in `tests/api.*.test.js` with real HTTP requests
- **UI Tests**: E2E browser tests in `tests/ui.*.spec.js` with Playwright
- **Test Data**: Automatic cleanup with distinctive patterns to avoid real data conflicts

### Cache Strategy
- Service worker cache names include build timestamps for fresh deployments
- Development uses placeholder names, production uses timestamped names
- Automated cache version management prevents deployment cache conflicts

Always run build, test, and manual validation steps to ensure changes work correctly in the Cloudflare Workers environment.