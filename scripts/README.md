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