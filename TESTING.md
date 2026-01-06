# Testing Documentation

## Overview
This project includes comprehensive testing with code coverage reporting to ensure code quality and reliability. The testing methodology uses specific patterns and conventions to avoid conflicts with real user data and ensure reliable test execution.

## Testing Methodology

### Core Principles
1. **User Isolation** - Each test runs with a unique mock user (`TEST_MOCK_TOKEN_<username>`) to ensure complete data isolation and allow parallel execution.
2. **Complete Database Cleanup** - Data is cleaned up per-user before and after tests.
3. **Realistic Test Data** - Use realistic walking distances (1-50km) instead of large unrealistic numbers.
4. **Popup Interference Prevention** - UI tests include popup cleanup hooks to prevent cross-test interference.
5. **Comprehensive Coverage** - Test both success flows and error conditions extensively.

### Test Data Strategy (Updated 2026)

#### User Isolation Approach
- **Unique Users**: Every test generates a unique username and auth token.
- **Parallel Execution**: Tests can run in parallel without data collisions.
- **Mock Authentication**: Uses a special `TEST_MOCK_TOKEN` prefix to bypass complex auth flows during testing.
- **Security Guard**: The mock authentication logic in `src/auth-handlers.ts` is strictly guarded by the `ALLOW_TEST_AUTH` environment variable. It is **completely disabled** in production environments where this variable is unset.
- **Optimized Hashing**: Test users use a dummy password hash to avoid CPU-intensive PBKDF2 operations during high-concurrency test runs.
- **Development Mode**: Localy development (`npm run dev`) automatically sets `ALLOW_TEST_AUTH:true` to enable running tests.

#### Complete Database Cleanup Approach
- **Per-User Cleanup**: Cleanup is scoped to the specific test user.
- **Pre-Test Cleanup**: Ensures a clean slate for the user before test execution.
- **Post-Test Cleanup**: Removes user data after test completion.

#### Distance Values
- **Realistic Distances**: `1-50 km` - Represents actual walking distances for normal tests
- **Large Distances for Goals**: `100-1000 km` - For tests that need to complete specific goals
- **Decimal Values**: `15.5`, `25.75` - For testing decimal precision handling
- **Edge Values**: `0`, negative numbers, invalid formats for error testing

#### Date Patterns
- **Next Week Dates**: Tests use dates 7-13 days in the future for safety buffer
- **Random Selection**: Each test generates random dates within safe ranges
- **No Historical Data**: Avoids conflicts with any existing data patterns

### Complete Database Cleanup System

#### Cleanup Helper (`tests/helpers/cleanup.js`)
The centralized cleanup system provides complete database clearing for guaranteed test isolation:

1. **Scoped Data Removal** - Deletes events for the specific test user.
2. **Safe API Cleanup** - Uses proper DELETE endpoints with authentication.
3. **Comprehensive Logging** - Reports number of entries removed for verification.
4. **Error Handling** - Continues cleanup even if individual operations fail.

#### Usage in Tests
```javascript
const { cleanupAllTestData } = require('./helpers/cleanup');

// Playwright fixture handles setup and teardown automatically
const test = base.extend({
  authToken: async ({ }, use) => {
    const uniqueId = Math.random().toString(36).substring(7);
    const username = `testuser_${uniqueId}`;
    const token = `TEST_MOCK_TOKEN_${username}`;
    await use(token);
    // Cleanup after test
    await cleanupAllTestData('http://localhost:8787', token);
  },
});

// UI tests use the authToken fixture
test.beforeEach(async ({ page, authToken }) => {
  // Ensure clean state for this user
  await cleanupAllTestData('http://localhost:8787', authToken);
  
  // Set mock session token in browser
  await page.evaluate((token) => {
    localStorage.setItem('sessionToken', token);
  }, authToken);
});
```

## Test Structure

### Test Types
1. **Unit & Integration Tests** - Test individual functions, modules, and API handlers in isolation (90 tests)
2. **UI Tests** - End-to-end browser testing with Playwright (128 tests)
3. **Total Tests** - 218+ tests across all categories

### Cache Version Testing

The cache version tests ensure build script reliability for the automated cache versioning system:

#### Update Cache Version Tests (`updateCacheVersion`)
- **Placeholder Replacement**: Replaces `{{BUILD_TIMESTAMP}}` placeholders with actual timestamps
- **Timestamp Format**: Validates timestamp format (YYYYMMDD-HHMMSS)
- **Consistency**: Ensures both `BUILD_TIMESTAMP` constant and `CACHE_NAME` are updated with same timestamp
- **Command Line**: Tests command-line execution for build process integration
- **Uniqueness**: Verifies unique timestamps on sequential calls

#### Reset Cache Version Tests (`resetCacheVersion`)
- **Development Reset**: Restores development placeholders for clean development state
- **Idempotency**: Tests idempotent behavior (safe to call multiple times)
- **Completeness**: Validates both timestamp and cache name resets
- **Error Handling**: Handles missing patterns gracefully

#### Integration & Error Handling
- **Update/Reset Cycles**: Complete update/reset cycles work correctly
- **File System Errors**: Graceful handling of file system error scenarios
- **Missing Placeholders**: Appropriate warnings when placeholders not found
- **Cache Name Validation**: Ensures cache names follow expected patterns

The cache versioning system ensures each deployment gets a fresh cache by using build-time timestamps in the format: `walk-to-mordor-YYYYMMDD-HHMMSS`

### Test Files

#### Unit & Integration Tests (Jest)
- `tests/auth-handlers.test.ts` - Authentication logic
- `tests/auth-utils.test.ts` - Auth utilities
- `tests/goals-handlers.test.ts` - Goals API handlers
- `tests/progress-handlers.test.ts` - Progress API handlers
- `tests/index.test.ts` - Main worker logic
- `tests/renderHtml.test.ts` - HTML rendering
- `tests/validators.test.ts` - Validation functions
- `tests/cache-version.test.js` - Cache version management scripts

#### UI Tests (Playwright)
- `tests/ui.success.spec.js` - Success flows (36 tests)
- `tests/ui.edge-cases.spec.js` - Edge cases and advanced features (92 tests)

#### Helper Files
- `tests/helpers/cleanup.js` - Centralized test data cleanup utility
- `tests/helpers/test-auth.js` - Authentication helper for tests

## Code Coverage

### Coverage Configuration
- **Target**: 80% coverage threshold for statements, branches, functions, and lines
- **Current Achievement**: 100% coverage for testable modules
- **Excluded Files**: `src/index.ts` (covered by integration tests in different environment)

### Coverage Reports
- **Console**: Summary displayed after test runs
- **HTML**: Detailed interactive report at `coverage/index.html`
- **LCOV**: Machine-readable format at `coverage/lcov.info`
- **JSON**: Raw coverage data at `coverage/coverage-final.json`

## Running Tests

### All Tests
```bash
npm test                    # Runs unit tests (90)
npm run test:ui             # UI tests - All browser scenarios
```

### Category-Specific Tests
```bash
npm test                   # Unit tests only (90 tests) - Fast feedback
npm run test:ui            # UI tests - All browser scenarios
```

### Flow-Based Testing (Development Workflow)
```bash
npm run test:quick         # Fast feedback - Success flows only
```

### Granular Test Execution
```bash
npm run test:ui:success    # UI success flows
npm run test:ui:edge-cases # UI edge cases
```

### Development Tools
```bash
npm run test:watch         # Watch mode for unit tests
npm run test:coverage      # All tests with coverage reporting
npm run test:ui:headed     # UI tests with visible browser
```

### UI Tests Only
```bash
npm run test:ui:all        # All UI tests
npm run test:ui:success    # UI success flows
npm run test:ui:edge-cases # UI edge cases
```
Runs end-to-end browser tests with Playwright.

### Coverage Report
```bash
npm run test:coverage
```
Runs all tests with comprehensive coverage reporting and generates HTML reports.

## Test Environment & Data Management

### Database State Management
- **Pre-Test Cleanup**: Each test file runs cleanup before starting to ensure clean state
- **Post-Test Cleanup**: All test data is automatically removed after test completion
- **Pattern-Based Detection**: Cleanup system recognizes test data by patterns rather than manual tracking
- **Comprehensive Coverage**: Catches various test data formats across different test types

### Browser Testing (Playwright)
- **Multi-Browser**: Tests run on Chromium, Firefox, Mobile Chrome, and Mobile Firefox (4 browsers total)
- **Popup Interference Prevention**: beforeEach hooks clear popups to prevent cross-test interference
- **Parallel Execution**: Tests run with 4 workers (reduced from 8 to prevent database conflicts)
- **Realistic Test Data**: Uses 1-50km distances and realistic date generation
- **Screenshot Capture**: Failed tests automatically capture screenshots for debugging

### API Testing Environment
- **Real Environment**: Tests run against actual Cloudflare Workers local development server
- **Database Integration**: Uses real D1 database for authentic testing conditions
- **HTTP Testing**: Full request/response cycle testing with proper status codes and headers

## Test Data Lifecycle

### Data Creation
1. Tests create data using realistic patterns but with distinctive markers
2. All test data includes easily identifiable patterns (large numbers, specific dates)
3. Test data is designed to be completely separate from any potential user data

### Complete Database Clearing
The cleanup system now uses a comprehensive approach:
```javascript
// Complete database cleanup approach
async function cleanupAllTestData() {
  // DELETE all entries from progress table
  // No pattern matching required - complete clearing
  // Logs number of entries removed for verification
  // Handles errors gracefully and continues cleanup
}
```

### Complete Data Removal
1. **Complete Clearing**: System removes ALL entries from database
2. **Safe API Operations**: Uses proper DELETE endpoints with error handling
3. **Comprehensive Logging**: All cleanup actions are logged with entry counts
4. **Error Handling**: Cleanup continues even if individual operations fail
5. **Popup Cleanup**: UI tests also clear popups before each test to prevent interference

## Architecture Decisions

### Module Separation
To enable comprehensive unit testing, validation and utility functions were extracted into separate modules:

- `src/validators.ts` - All validation functions (date, distance, JSON, HTTP methods)
- `src/renderHtml.ts` - HTML rendering function  
- `src/progress-handlers.ts` - Progress data CRUD operations
- `src/goals-handlers.ts` - Goals and total distance calculation
- `src/index.ts` - Main request handler (tested via integration tests)

### Test Organization Strategy
Tests are organized by type and flow rather than by file structure:

**By Test Type:**
- **Unit Tests**: Fast, isolated function testing
- **API Tests**: Integration testing with real HTTP requests
- **UI Tests**: End-to-end browser automation

**By Test Flow:**
- **Success Flows**: Happy path scenarios that should work correctly
- **Error Flows**: Edge cases, validation failures, and error conditions

### Test Environment Architecture
- **Jest**: Unit and API test runner with TypeScript support
- **ts-jest**: TypeScript transpilation for Jest
- **Supertest**: HTTP assertion library for API testing (Note: Currently using direct fetch calls)
- **Playwright**: Browser automation for UI testing
- **Centralized Cleanup**: Custom helper system for test data management

### Complete Database Isolation Strategy
The testing system ensures complete isolation through comprehensive database clearing:

1. **Complete Clearing**: All database entries removed before and after each test run
2. **No Pattern Dependencies**: Eliminates complexity of pattern-matching cleanup systems
3. **Realistic Test Data**: Uses actual walking distances (1-50km) for better test authenticity
4. **Popup Interference Prevention**: UI tests clear popups before each test to prevent cross-test issues
5. **Reduced Parallelism**: Uses 4 workers instead of 8 to prevent database conflicts

### Coverage Strategy
- Unit tests achieve 100% coverage for extracted utility modules
- API tests provide end-to-end validation of the complete request flow
- UI tests ensure frontend functionality works correctly across browsers
- The main handler (`index.ts`) is excluded from unit test coverage as it requires the Cloudflare Workers runtime environment

## Test Quality Standards

### Comprehensive Error Cases
- **Input Validation**: All invalid inputs are tested (malformed dates, negative numbers, missing fields)
- **HTTP Methods**: Invalid methods return proper 405 Method Not Allowed responses
- **JSON Parsing**: Malformed JSON and empty payloads are handled gracefully
- **Database Errors**: Constraint violations and connection issues are tested

### Success Path Validation  
- **CRUD Operations**: Create, Read, Update, Delete operations work correctly
- **Data Persistence**: Data survives round-trip through database
- **Response Formats**: All responses include correct headers and status codes
- **Edge Values**: Boundary conditions like zero values and large numbers work correctly

### UI Interaction Testing
- **Cross-Browser**: Tests run on Chromium, Firefox, and mobile browsers
- **Responsive Design**: UI adapts correctly to different screen sizes
- **User Workflows**: Complete user journeys from opening app to completing tasks
- **Error Handling**: UI displays appropriate messages for API failures

### Browser Compatibility Testing
- **Desktop Browsers**: Chromium (Chrome/Edge), Firefox
- **Mobile Browsers**: Mobile Chrome, Mobile Firefox  
- **Viewport Testing**: Multiple screen sizes and orientations
- **Accessibility**: Basic accessibility features are tested

## Continuous Integration

The test suite is designed to run in CI environments and will fail builds if:
- Any test fails
- Coverage drops below 80% threshold for covered modules
- API tests cannot connect to the test database
- UI tests fail across multiple browsers

### CI Test Execution
```bash
# Full CI pipeline
npm run test:all           # Runs all 236 tests
npm run test:coverage      # Generates coverage reports
```

### Parallel Execution
- **Unit Tests**: Run sequentially (fast execution, shared coverage reporting)
- **API Tests**: Run sequentially (database state management)  
- **UI Tests**: Run in parallel across 4 workers (reduced from 8 to prevent database conflicts)

## Development Workflow

### Recommended Testing Strategy

#### During Active Development
```bash
npm run test:quick         # Fast feedback with core functionality
npm run test:unit          # Quick validation of logic changes
```

#### Before Committing Changes
```bash  
npm test                   # Verify unit tests pass
npm run test:ui            # Verify UI flows work
```

#### Before Releasing
```bash
npm test                   # Complete unit test suite validation
npm run test:coverage      # Verify coverage requirements met
npm run test:ui            # Complete UI test suite validation
```

#### Debugging Specific Issues
```bash
npm run test:ui:edge-cases # Focus on complex UI scenarios
npm run test:ui:headed     # Debug UI tests with visible browser
```

### Test-Driven Development
1. **Write failing test** - Create test for new functionality
2. **Implement minimum code** - Make test pass with simplest solution
3. **Refactor** - Improve code while keeping tests green
4. **Verify** - Run relevant test subset for fast feedback

## Viewing Coverage Reports
After running `npm run test:coverage`, open `coverage/index.html` in a browser to view:
- File-by-file coverage breakdown  
- Line-by-line coverage highlighting
- Uncovered code paths
- Coverage trends and statistics

### Coverage Thresholds
- **Statements**: 80% minimum
- **Branches**: 80% minimum  
- **Functions**: 80% minimum
- **Lines**: 80% minimum

### Current Coverage Achievement
- **validators.ts**: 97.77% coverage (fully tested utility functions)
- **renderHtml.ts**: 100% coverage (complete HTML generation testing)
- **progress-handlers.ts**: 95.23% coverage (CRUD operations)
- **goals-handlers.ts**: 100% coverage (goals and distance calculations)
- **index.ts**: 97.67% coverage (main request handler)

## Troubleshooting

### Common Issues

#### Database Connection Problems
```bash
# Verify database is accessible
npx wrangler d1 execute DB --command "SELECT COUNT(*) FROM progress"
```

#### UI Test Timing Issues
- Tests include automatic retries for timing-sensitive operations
- Use `npm run test:ui:headed` to debug with visible browser
- Check browser console logs in test artifacts

#### Test Data Conflicts
- Cleanup system should prevent conflicts automatically
- Manually clean database if needed: `npm run db:clean` (if script exists)
- Use distinctive test patterns that don't match real user data

#### Coverage Reporting Issues
- Ensure all test types complete successfully
- Check that TypeScript compilation succeeds
- Verify Jest configuration includes all source files
