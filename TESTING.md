# Testing Documentation

## Overview
This project includes comprehensive testing with code coverage reporting to ensure code quality and reliability. The testing methodology uses specific patterns and conventions to avoid conflicts with real user data and ensure reliable test execution.

## Testing Methodology

### Core Principles
1. **Data Isolation** - Use unique, unrealistic test data that's easily distinguishable from real user data
2. **Automatic Cleanup** - All test data is automatically cleaned up after test execution
3. **Conflict Avoidance** - Use specific date patterns and values that won't conflict with actual usage
4. **Comprehensive Coverage** - Test both success flows and error conditions extensively

### Test Data Conventions

#### Date Patterns
- **API Tests**: Use dates in January 2024 (e.g., `2024-01-01`, `2024-01-02`)
- **UI Tests**: Use dates far in the future (e.g., `2025-09-14`) to avoid real data conflicts
- **Edge Cases**: Use invalid dates like `2025-02-30` for negative testing

#### Distance Values
- **Large Unrealistic Numbers**: `777777`, `888888`, `999999` - Easy to spot and unlikely to be real user data
- **Decimal Test Values**: `15.5`, `999999.99` - For testing decimal handling
- **Zero Values**: `0` - For boundary testing
- **Invalid Values**: `-5`, `"abc"`, `null` - For error condition testing

#### Text Patterns
- **Test Event Names**: Use descriptive names like `"Test Event 777777 km"` that clearly indicate test data
- **Repeated Digits**: Values like `888888` are easily recognizable as test data

### Centralized Cleanup System

#### Cleanup Helper (`tests/helpers/cleanup.js`)
The centralized cleanup system automatically detects and removes test data using multiple pattern matching strategies:

1. **UI Test Values** - Detects events with values like `9876543`
2. **Repeated Digits** - Catches patterns like `777777`, `888888`, `999999`
3. **Zero Values** - Removes test events with `0` distance
4. **Decimal Test Values** - Finds decimal numbers like `15.5`, `999999.99`
5. **Large Distances** - Detects unrealistically large values (>100,000)
6. **Specific Test Dates** - Removes events on known test dates

#### Usage in Tests
```javascript
const { cleanupAllTestData } = require('./helpers/cleanup');

beforeAll(async () => {
  await cleanupAllTestData(); // Clean before tests
});

afterAll(async () => {
  await cleanupAllTestData(); // Clean after tests
});
```

## Test Structure

### Test Types
1. **Unit Tests** - Test individual functions and modules in isolation (35 tests)
2. **API Tests** - Test API endpoints with real Cloudflare Workers environment (27 tests)
3. **UI Tests** - End-to-end browser testing with Playwright (60 tests)

### Test Files

#### Unit Tests
- `tests/validators.test.ts` - Validation functions (22 tests)
- `tests/renderHtml.test.ts` - HTML rendering (8 tests)
- `tests/index.test.ts` - Main handler logic (32 tests)

#### API Integration Tests  
- `tests/api.success.test.js` - Success flows and happy path scenarios (8 tests)
- `tests/api.errors.test.js` - Error handling and edge cases (19 tests)

#### UI End-to-End Tests
- `tests/ui.success.spec.js` - Core UI functionality (32 tests)
- `tests/ui.edge-cases.spec.js` - Complex features and edge cases (28 tests)

#### Helper Files
- `tests/helpers/cleanup.js` - Centralized test data cleanup utility

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
npm test                    # Runs unit tests (65) + API tests (27) + UI tests (60) = 152 tests
npm run test:all           # Alternative command for complete test suite
```

### Category-Specific Tests
```bash
npm run test:unit          # Unit tests only (65 tests) - Fast feedback
npm run test:api:all       # API tests only (27 tests) - Both success and error cases
npm run test:ui:all        # UI tests only (60 tests) - All browser scenarios
```

### Flow-Based Testing (Development Workflow)
```bash
npm run test:quick         # Fast feedback - Success flows only
npm run test:success       # All success flows (API + UI)
npm run test:errors        # All error and edge case scenarios
```

### Granular Test Execution
```bash
npm run test:api:success   # API success flows (8 tests)
npm run test:api:errors    # API error handling (19 tests)
npm run test:ui:success    # UI success flows (32 tests)
npm run test:ui:edge-cases # UI edge cases (28 tests)
```

### Development Tools
```bash
npm run test:watch         # Watch mode for unit tests
npm run test:coverage      # All tests with coverage reporting
npm run test:ui:headed     # UI tests with visible browser
```

### UI Tests Only
```bash
npm run test:ui:all        # All UI tests (60 tests)
npm run test:ui:success    # UI success flows (32 tests)
npm run test:ui:edge-cases # UI edge cases (28 tests)
```
Runs end-to-end browser tests with Playwright across multiple browsers and devices.

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
- **Multi-Browser**: Tests run on Chromium, Firefox, and Mobile browsers
- **Retry Logic**: Failed tests are automatically retried to handle timing issues
- **Parallel Execution**: Tests run in parallel for faster feedback
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

### Data Detection
The cleanup system uses multiple strategies to identify test data:
```javascript
// Example patterns that trigger cleanup
const testPatterns = [
  { distance: 9876543, date: '2025-09-14' },  // UI test values
  { distance: 777777, date: '2024-01-01' },   // Repeated digits
  { distance: 0, date: '2024-01-05' },        // Zero values  
  { distance: 15.5, date: '2024-01-03' },     // Decimal test values
  { distance: 999999.99, date: '2024-01-04' } // Large decimal values
];
```

### Data Removal
1. **Automatic Detection**: System scans database for test patterns
2. **Safe Removal**: Only removes data matching specific test patterns
3. **Comprehensive Logging**: All cleanup actions are logged for verification
4. **Error Handling**: Cleanup continues even if individual deletions fail

## Architecture Decisions

### Module Separation
To enable comprehensive unit testing, validation and utility functions were extracted into separate modules:

- `src/validators.ts` - All validation functions (date, distance, JSON, HTTP methods)
- `src/renderHtml.ts` - HTML rendering function  
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

### Data Isolation Strategy
The testing system ensures complete isolation between test data and real user data:

1. **Distinctive Patterns**: Test data uses patterns that are extremely unlikely in real usage
2. **Date Separation**: Test dates are either historical (2024) or far future (2025+)
3. **Value Separation**: Test distances use repeated digits or unrealistically large numbers
4. **Automatic Recognition**: Cleanup system can identify test data without manual tracking

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
npm run test:all           # Runs all 152 tests
npm run test:coverage      # Generates coverage reports
```

### Parallel Execution
- **Unit Tests**: Run sequentially (fast execution, shared coverage reporting)
- **API Tests**: Run sequentially (database state management)  
- **UI Tests**: Run in parallel across 8 workers (faster execution)

## Development Workflow

### Recommended Testing Strategy

#### During Active Development
```bash
npm run test:quick         # Fast feedback with core functionality
npm run test:unit          # Quick validation of logic changes
```

#### Before Committing Changes
```bash  
npm run test:success       # Verify all success flows work
npm run test:api:all       # Ensure API changes don't break functionality
```

#### Before Releasing
```bash
npm run test:all           # Complete test suite validation
npm run test:coverage      # Verify coverage requirements met
```

#### Debugging Specific Issues
```bash
npm run test:api:errors    # Focus on API error handling
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
- **validators.ts**: 100% coverage (fully tested utility functions)
- **renderHtml.ts**: 100% coverage (complete HTML generation testing)
- **index.ts**: Excluded (tested via API integration tests in Workers environment)

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
