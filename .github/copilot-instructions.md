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

### Testing Strategy (90+ Total Tests)
**CRITICAL**: All tests run quickly - NEVER CANCEL test commands

#### Fast Feedback Loop (Active Development)
- `npm run test:unit` -- Unit tests (90 tests) in 3 seconds
- `npm run test:quick` -- Success flows only (~40 tests) in 4 seconds

#### Comprehensive Validation (Pre-Commit)
- `npm run test:api:all` -- All API tests (28 tests) in 2 seconds **REQUIRES DEV SERVER RUNNING**
- `npm run test:coverage` -- Unit tests only with coverage (90 tests) in 5 seconds
- **Coverage Target**: 96%+ coverage maintained automatically
- **NOTE**: API tests require `npm run dev` in separate terminal or use `npm run test:unit` for coverage-only validation

#### UI Testing (Requires Playwright Browsers)
- `npx playwright install chromium` -- install browser (may fail due to network)
- `npm run test:ui:success` -- UI happy path tests **REQUIRES DEV SERVER RUNNING**
- `npm run test:ui:edge-cases` -- UI edge cases **REQUIRES DEV SERVER RUNNING**
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
# Test API endpoints (no authentication required)
curl http://localhost:8787/wtm/api/goals
curl http://localhost:8787/wtm/api/calendar-progress
curl -X POST -H "Content-Type: application/json" \
  -d '{"start":"2024-12-01","title":"5.5"}' \
  http://localhost:8787/wtm/api/calendar-progress
curl http://localhost:8787/wtm/api/total-distance
```

#### UI Testing  
- Navigate to http://localhost:8787/wtm/ in browser
- Application loads immediately without login
- Verify total distance displays correctly (e.g., "45.65 km")
- Test calendar interactions if making UI changes
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
- **Schema**: Tables include `progress` (date, distance) and `goals` (id, distance, title, special, description)
- **No Authentication**: Application is single-user with immediate access

### Cache Management
- **Development**: Use `npm run build:sw:reset` to set placeholder cache names
- **Production**: Use `npm run build` to set timestamped cache names (format: walk-to-mordor-YYYYMMDD-HHMMSS)
- **Service Worker**: Located at `public/wtm/sw.js` with automated versioning

### Code Structure Navigation
- **Main Handler**: `src/index.ts` - primary request router and API logic
- **Validators**: `src/validators.ts` - input validation and error handling 
- **HTML Renderer**: `src/renderHtml.ts` - generates main application page
- **Progress Handlers**: `src/progress-handlers.ts` - progress CRUD operations
- **Goals Handlers**: `src/goals-handlers.ts` - milestone goals and total distance calculation
- **Static Assets**: `public/wtm/` - CSS, JS, icons, manifest for PWA
- **Database Migrations**: `migrations/` - SQL schema evolution
- **Tests**: `tests/` - comprehensive test suite organized by type

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
- `GET /wtm/api/calendar-progress` - retrieve progress entries
- `POST /wtm/api/calendar-progress` - create new progress entry
- `PUT /wtm/api/calendar-progress` - update existing progress entry
- `DELETE /wtm/api/calendar-progress` - remove progress entry
- `GET /wtm/api/goals` - retrieve milestone goals data
- `GET /wtm/api/total-distance` - get total distance
- Root path serves the main HTML application

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