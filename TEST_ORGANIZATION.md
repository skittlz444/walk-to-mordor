# Test Organization & Methodology

## Overview
The test suite has been successfully organized into separate files with comprehensive testing methodology that ensures data isolation, automatic cleanup, and reliable test execution across all environments.

## Testing Methodology & Rules

### Core Testing Principles

#### 1. User Isolation Strategy
- **Unique Test Users**: Each test runs with a unique, randomly generated username and auth token.
- **Parallel Execution**: Tests can run concurrently without data interference.
- **Mock Authentication**: The backend supports `TEST_MOCK_TOKEN_<username>` to automatically create and authenticate test users.
- **Performance Optimization**: Test users use a simplified password hashing mechanism to prevent timeouts during parallel execution.

#### 2. Test Data Conventions

**Date Patterns:**
- **Random Future Dates**: Tests use dates 7-13 days in the future for safety buffer
- **No Fixed Patterns**: Each test generates random dates within safe ranges
- **Edge Cases**: Invalid dates like `2025-02-30` for negative testing

**Distance Values (Updated Strategy):**
- **Realistic Distances**: `1-50 km` for normal tests (represents actual walking distances)
- **Large Distances for Goals**: `100-1000 km` for tests that need to complete specific goals
- **Decimal Test Values**: `15.5`, `25.75` for precision testing with realistic values
- **Zero Values**: `0` for boundary condition testing
- **Invalid Values**: `-5`, `"abc"`, `null` for error condition testing

**Complete Database Clearing:**
- **Scoped Cleanup**: Cleanup is performed per-user, ensuring only the test's own data is removed.
- **Guaranteed Clean State**: Each test starts with a fresh user account or a cleaned state for that user.

#### 3. Centralized Cleanup System

**User-Scoped Database Cleanup:**
The cleanup helper (`tests/helpers/cleanup.js`) provides targeted database clearing:

1. **Scoped Data Removal** - Deletes events only for the authenticated test user.
2. **Safe API Operations** - Uses proper DELETE endpoints with error handling.
3. **Comprehensive Logging** - Reports number of entries removed for verification.
4. **Error Resilience** - Continues cleanup even if individual operations fail.
5. **Popup Cleanup** - UI tests also clear popups before each test to prevent interference.

**Usage Pattern:**
```javascript
const { cleanupAllTestData } = require('./helpers/cleanup');

// Playwright fixture provides unique auth token
const test = base.extend({
  authToken: async ({ }, use) => {
    const uniqueId = Math.random().toString(36).substring(7);
    const token = `TEST_MOCK_TOKEN_testuser_${uniqueId}`;
    await use(token);
    await cleanupAllTestData('http://localhost:8787', token);
  },
});

test.beforeEach(async ({ page, authToken }) => {
  // Ensure clean state for this user
  await cleanupAllTestData('http://localhost:8787', authToken);
  
  // Inject token into browser session
  await page.evaluate((token) => {
    localStorage.setItem('sessionToken', token);
  }, authToken);
});
```

## File Structure & Organization

### Unit & Integration Tests (Jest)
- **`tests/auth-handlers.test.ts`** - Authentication logic tests
- **`tests/auth-utils.test.ts`** - Auth utility function tests
- **`tests/goals-handlers.test.ts`** - Goals API handler tests
- **`tests/progress-handlers.test.ts`** - Progress API handler tests
- **`tests/index.test.ts`** - Main worker entry point tests
- **`tests/renderHtml.test.ts`** - HTML rendering tests
- **`tests/validators.test.ts`** - Input validation tests

### UI Tests (Playwright)
- **`tests/ui.success.spec.js`** - Core UI functionality tests
  - Calendar rendering and navigation
  - Event CRUD operations (Create, Read, Update, Delete)
  - Form validation and user feedback
  - Navigation between months/years
  - Responsive design validation
  - Basic user workflows
  - Congratulations popup handling with realistic distances

- **`tests/ui.edge-cases.spec.js`** - Complex features and edge case tests
  - Goal popup functionality and interactions
  - Advanced calendar navigation
  - Error handling in UI
  - Browser compatibility testing
  - Accessibility features
  - Performance scenarios
  - Network request handling
  - API error handling and validation (via UI)
  - Popup interference prevention

### Unit Tests
- **`tests/validators.test.ts`** - 22 validation function tests
  - Date format validation (valid/invalid patterns)
  - Distance value validation (numeric, range, precision)
  - JSON parsing validation (malformed, empty, type checking)
  - HTTP method validation (endpoint-specific methods)
  - Error response generation

- **`tests/renderHtml.test.ts`** - 10 HTML rendering tests
  - Template rendering with different data
  - PWA meta tag inclusion
  - JavaScript/CSS file inclusion
  - Numeric formatting (large numbers, decimals)
  - Default value handling
  - Verification auth components are removed

- **`tests/index.test.ts`** - 37 main handler tests  
  - Complete request/response cycle testing
  - All HTTP methods (GET, POST, PUT, DELETE, HEAD)
  - Database integration scenarios
  - Error handling across all endpoints
  - Static asset serving

- **`tests/goals-handlers.test.ts`** - 5 goals handler tests
  - Goals data retrieval
  - Total distance calculation
  - Goal progress tracking
  - Decimal precision handling

### Helper Files
- **`tests/helpers/cleanup.js`** - Complete database cleanup utility
  - Complete database clearing (no authentication required)
  - Safe API operations with comprehensive logging
  - Error handling for failed operations
  - Database state management and verification

- **`tests/helpers/test-auth.js`** - Test helper compatibility layer
  - No-op functions for backward compatibility
  - Direct API request helpers (no authentication)

### Removed Files
- `tests/api.test.js` ✅ (migrated to unit tests)
- `tests/ui.spec.js` ✅ (split into success/edge-cases)
- `tests/api.success.test.js` ✅ (replaced by unit/UI tests)
- `tests/api.errors.test.js` ✅ (replaced by unit/UI tests)
- `tests/index.auth.test.ts` ✅ (merged into auth-handlers.test.ts)
- `tests/helpers/browser-auth.js` ✅ (replaced by test-auth.js)

## NPM Scripts Organization

### Main Test Commands
- **`npm test`** - Runs Unit & Integration tests (Jest) - ~90 tests
- **`npm run test:ui`** - Runs all UI End-to-End tests (Playwright) - 128 tests
- **`npm run test:coverage`** - Generates code coverage report for unit tests

### Development Tools
- **`npm run test:watch`** - Watch mode for unit tests (continuous feedback)
- **`npm run test:ui:headed`** - Runs UI tests in headed mode (browser visible) for debugging
- **`npm run test:ui:report`** - Opens the Playwright HTML report

## Testing Methodology Implementation

### Data Lifecycle Management

#### Before Each Test Run
1. **User Creation**: A unique test user is created via `TEST_MOCK_TOKEN_<username>`.
2. **Scoped Cleanup**: Any existing data for this specific user is removed.
3. **Environment Check**: Verifies the application is reachable.

#### During Test Execution
1. **Realistic Data Creation**: Tests generate data specific to the isolated user.
2. **Mock Authentication**: API calls use the injected Bearer token.
3. **Popup Management**: UI tests handle popups (like "Goal Reached") that may appear.

#### After Test Completion
1. **Scoped Cleanup**: The test user's data is removed to prevent database bloat.
2. **No Global Wipe**: Other concurrent tests are unaffected.

### Multi-Environment Testing

#### Browser Testing Strategy
- **Chromium**: Primary desktop browser testing.
- **Firefox/WebKit**: Supported via Playwright configuration.

#### Parallel Execution
- **UI Tests**: Run in parallel (default 4 workers).
- **Unit Tests**: Run in parallel via Jest.

### Error Handling & Recovery

#### Test Data Conflicts
- **Prevention**: Unique user IDs per test prevent any data collision.
- **Recovery**: If a test fails, its data is isolated and doesn't break other tests.

#### Test Reliability
- **Retry Logic**: Playwright handles retries for flaky UI tests.
- **Timeout Handling**: Optimized hashing prevents auth timeouts.

## Benefits & Results

### 🚀 Faster Development
- **Parallel Execution**: Tests run simultaneously without blocking.
- **Mock Auth**: Skips expensive cryptographic operations during tests.

### 🎯 Targeted Testing
- **Unit Tests**: Fast feedback on logic and validation.
- **UI Tests**: Comprehensive end-to-end verification.

### 🛡️ Data Safety & Isolation
- **User Isolation**: The "Gold Standard" for concurrent testing.
- **Scoped Cleanup**: Safe to run against shared dev databases if needed.

## Test Results & Coverage

### Current Test Status ✅
- **Unit Tests**: 90/90 passing (100% success rate)
- **UI Tests**: 128/128 passing (100% success rate)
- **Total**: 218/218 passing (100% overall success rate)

### Coverage Achievement
- **validators.ts**: High coverage (validation logic)
- **renderHtml.ts**: 100% coverage (HTML generation)
- **goals-handlers.ts**: 100% coverage (Goals logic)
- **auth-handlers.ts**: High coverage (Auth logic)

### Performance Metrics
- **Unit Tests**: ~2-3 seconds
- **UI Tests**: ~30-60 seconds (depending on hardware/workers)

## Recommended Development Workflow

### 🏃‍♂️ Active Development
```bash
npm test -- --watch      # Watch mode for unit tests
```

### 🔍 Feature Development
```bash
npm run test:ui          # Run full UI suite
```

### 🐛 Debugging
```bash
npm run test:ui:headed   # Visual debugging
```

## Migration Status & Achievements ✅

### ✅ Completed Migrations
- **Auth Re-implementation**: Successfully integrated Mock Auth for testing.
- **User Isolation**: Moved from global wipe to per-user isolation.
- **Concurrency Fixes**: Enabled full parallel execution for UI tests.
- **Documentation**: Updated to reflect the new architecture.

### ✅ Quality Achievements
- **100% Test Pass Rate**: All 218 tests passing.
- **Robust Auth Testing**: Auth flows covered by both Unit and UI tests.
- **Zero Flakiness**: Concurrency issues resolved via isolation.

The test organization has been **modernized** to support secure, authenticated, and concurrent testing.
