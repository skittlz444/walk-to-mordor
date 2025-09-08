# GitHub Actions Workflows for PR Testing

This directory contains GitHub Actions workflows that automatically run comprehensive tests on pull requests.

## Workflows Overview

### `pr-tests.yml` - PR Testing Workflow

**Trigger**: Automatically runs on:
- PR creation, updates, and synchronization (targeting any branch)

**Jobs**:
- **Unit Tests & Coverage** - Fast feedback with unit tests and code coverage
- **API Integration Tests** - Tests API endpoints using local Cloudflare Workers dev server
- **UI End-to-End Tests** - Browser testing with Playwright
- **All Tests Complete** - Final validation that all tests passed

**Features**:
- ✅ Runs unit tests first for fast feedback
- ✅ Generates and uploads code coverage reports
- ✅ Sets up local D1 database for testing
- ✅ Runs all 152 tests (65 unit + 27 API + 60 UI)
- ✅ Uploads test artifacts (Playwright reports, coverage)
- ✅ Proper cleanup of background processes
- ✅ Tests run against local development server only (no deployed URL testing)

## Test Coverage

The workflows run all test types as defined in the project:

| Test Type | Count | Description |
|-----------|-------|-------------|
| Unit Tests | 65 | Individual function and module testing |
| API Tests | 27 | Integration testing of API endpoints |
| UI Tests | 60 | End-to-end browser testing with Playwright |
| **Total** | **152** | Complete test suite |

## Requirements Met

✅ **Code Coverage**: Unit tests with coverage reporting  
✅ **API Tests**: Integration tests that run after Cloudflare worker setup  
✅ **UI Tests**: End-to-end browser tests  
✅ **Dependency Ordering**: Tests run in logical sequence  
✅ **Deployment Integration**: Enhanced workflow waits for Cloudflare deployment  

## Configuration

### Environment Variables
- `NODE_VERSION`: Node.js version (default: '22')

### Artifacts Generated
- **Coverage Reports**: HTML and LCOV format coverage reports
- **Playwright Reports**: Visual test reports with screenshots
- **Test Results**: Detailed test execution results

## Usage

### Automatic PR Testing
The workflow (`pr-tests.yml`) runs automatically on:
- Every PR creation, update, or synchronization (regardless of target branch)

No manual intervention required. All tests run against the local development server.

## Troubleshooting

### Common Issues

**API/UI tests fail with connection errors**:
- Check that the dev server started properly
- Verify D1 database setup completed
- Look for port conflicts (8787)

**Coverage reports missing**:
- Ensure `npm run test:coverage:unit` works locally
- Check that Jest is configured properly
- Verify coverage files are generated in `coverage/` directory

### Logs and Debugging
- Check individual job logs in GitHub Actions tab
- Download artifacts for detailed reports
- Use the `tests-complete` job for overall status summary

## Customization

### Adding New Test Types
1. Create new npm script in `package.json`
2. Add corresponding job in workflow
3. Update `tests-complete` job dependencies

### Changing Test Order
Modify the `needs` dependency in job definitions:
```yaml
job-name:
  needs: [prerequisite-job]
```
