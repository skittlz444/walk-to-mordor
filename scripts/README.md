# Scripts Directory

This directory contains utility scripts for the Walk to Mordor project.

## generate-api-report.js

Generates HTML reports for API tests since Jest doesn't have built-in HTML reporting like Playwright.

### Usage

```bash
npm run test:api:report
```

### Output

Creates `test-results/api-report.html` with a comprehensive HTML report showing:
- Test summary and status
- API Success Flow Tests details
- API Error Handling Tests details  
- Test configuration information

This script is automatically called in the GitHub Actions workflow to generate artifacts for API test reports.

### Features

- Clean, professional HTML styling
- Test status badges (PASS/FAIL)
- Timestamp information
- Responsive design
- Integration with CI/CD pipelines

## generate-test-summary.js

Generates comprehensive test and coverage summaries for GitHub PR comments. This script processes coverage data and test results to create formatted markdown summaries.

### Usage

```bash
npm run test:summary
```

### Environment Variables

- `UNIT_TESTS_RESULT` - Result of unit tests (success/failure/cancelled/skipped)
- `API_TESTS_RESULT` - Result of API tests
- `UI_TESTS_RESULT` - Result of UI tests
- `GITHUB_SERVER_URL` - GitHub server URL
- `GITHUB_REPOSITORY` - Repository name
- `GITHUB_RUN_ID` - Workflow run ID

### Features

- Parses coverage data from `coverage-final.json`
- Calculates overall coverage statistics
- Creates markdown summary with test results
- Includes status emojis and coverage indicators
- Provides links to artifacts and detailed reports
- Used by GitHub Actions to comment on PRs

## GitHub Actions Integration

Both scripts are integrated into the GitHub Actions workflow (`.github/workflows/pr-tests.yml`):

- **API Report**: Called after API tests complete to generate HTML reports
- **Test Summary**: Called in the final job to create comprehensive PR comments

The test summary script provides visibility into test results and coverage directly in GitHub PRs, making it easy for reviewers to see the current state of the codebase.