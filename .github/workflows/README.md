# GitHub Actions Workflows for PR Testing

This directory contains GitHub Actions workflows that automatically run comprehensive tests on pull requests.

## Workflows Overview

### 1. `pr-tests.yml` - Main PR Testing Workflow

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

### 2. `pr-tests-deployed.yml` - Deployed URL Testing

**Trigger**: Manual trigger or repository dispatch event

**Purpose**: Tests API and UI against a deployed Cloudflare Workers URL

**Use Cases**:
- Testing against staging/preview deployments
- Post-deployment validation
- Manual testing against specific deployed versions

### 3. `pr-tests-enhanced.yml` - Advanced Deployment Detection

**Trigger**: Automatically runs on:
- PR creation, updates, and synchronization (targeting any branch)  
- Deployment status events

**Features**:
- ✅ Automatic detection of Cloudflare deployments
- ✅ Waits for deployment completion before running integration tests
- ✅ Falls back gracefully if no deployment is found
- ✅ Tests against both local dev server AND deployed URL

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
- `NODE_VERSION`: Node.js version (default: '18')

### Secrets (if using deployed testing)
- `CLOUDFLARE_API_TOKEN`: For accessing Cloudflare APIs during testing

### Artifacts Generated
- **Coverage Reports**: HTML and LCOV format coverage reports
- **Playwright Reports**: Visual test reports with screenshots
- **Test Results**: Detailed test execution results

## Usage

### Automatic PR Testing
The main workflows (`pr-tests.yml` and `pr-tests-enhanced.yml`) run automatically on:
- Every PR creation, update, or synchronization (regardless of target branch)

No manual intervention required.

### Manual Deployed Testing
To test against a specific deployed URL:

```bash
# Via GitHub CLI
gh workflow run pr-tests-deployed.yml -f deployment_url=https://your-app.pages.dev

# Via GitHub API
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/owner/repo/actions/workflows/pr-tests-deployed.yml/dispatches \
  -d '{"ref":"main","inputs":{"deployment_url":"https://your-app.pages.dev"}}'
```

### Integration with Cloudflare Pages
For automatic deployment detection, ensure your Cloudflare Pages integration:
1. Creates deployment statuses
2. Uses standard naming conventions (includes "cloudflare" or "pages")
3. Sets proper target URLs in deployment statuses

## Troubleshooting

### Common Issues

**API/UI tests fail with connection errors**:
- Check that the dev server started properly
- Verify D1 database setup completed
- Look for port conflicts (8787)

**Deployment detection fails**:
- Verify Cloudflare integration is properly configured
- Check that deployment creates proper GitHub statuses
- Review the deployment detection logic in the enhanced workflow

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

### Custom Deployment Detection
Modify the deployment detection script in `pr-tests-enhanced.yml` to match your specific deployment setup.
