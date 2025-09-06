# Testing Documentation

## Overview
This project includes comprehensive testing with code coverage reporting to ensure code quality and reliability.

## Test Structure

### Test Types
1. **Unit Tests** - Test individual functions and modules in isolation
2. **Integration Tests** - Test API endpoints with a real Cloudflare Workers environment  
3. **UI Tests** - End-to-end browser testing with Playwright

### Test Files
- `tests/validators.test.ts` - Unit tests for validation functions (22 tests)
- `tests/renderHtml.test.ts` - Unit tests for HTML rendering (8 tests) 
- `tests/api.test.js` - Integration tests for API endpoints (27 tests)
- `tests/ui.spec.js` - UI tests with Playwright (excluded from Jest)

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
npm test
```
Runs both unit tests (with coverage) and integration tests (without coverage) in sequence.

### Unit Tests Only
```bash
npm run test:unit
```
Runs unit tests for extracted modules with code coverage reporting.

### Integration Tests Only  
```bash
npm run test:api
```
Runs API integration tests without coverage (since they test through HTTP calls).

### UI Tests Only
```bash
npm run test:ui
```
Runs end-to-end browser tests with Playwright.

### Coverage Report
```bash
npm run test:coverage
```
Runs all tests with comprehensive coverage reporting and generates HTML reports.

## Architecture Decisions

### Module Separation
To enable comprehensive unit testing, validation and utility functions were extracted into separate modules:

- `src/validators.ts` - All validation functions (date, distance, JSON, HTTP methods)
- `src/renderHtml.ts` - HTML rendering function  
- `src/index.ts` - Main request handler (tested via integration tests)

### Test Environment
- **Jest**: Unit and integration test runner with TypeScript support
- **ts-jest**: TypeScript transpilation for Jest
- **Supertest**: HTTP assertion library for API testing
- **Playwright**: Browser automation for UI testing

### Coverage Strategy
- Unit tests achieve 100% coverage for extracted utility modules
- Integration tests provide end-to-end validation of the complete request flow
- UI tests ensure frontend functionality works correctly
- The main handler (`index.ts`) is excluded from unit test coverage as it requires the Cloudflare Workers runtime environment

## Test Quality
- **Comprehensive Error Cases**: Tests cover all error conditions and edge cases
- **Valid Input Validation**: Tests verify proper handling of valid inputs
- **Boundary Testing**: Tests include boundary values and limits
- **Response Validation**: Tests verify correct HTTP status codes and response structures

## Continuous Integration
The test suite is designed to run in CI environments and will fail builds if:
- Any test fails
- Coverage drops below 80% threshold for covered modules
- Integration tests cannot connect to the test database

## Viewing Coverage Reports
After running `npm run test:coverage`, open `coverage/index.html` in a browser to view:
- File-by-file coverage breakdown
- Line-by-line coverage highlighting
- Uncovered code paths
- Coverage trends and statistics
