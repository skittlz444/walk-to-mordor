# GitHub Actions Workflows

This directory contains GitHub Actions workflows that automatically run on pull requests.

## Workflows Overview

All test workflows run **in parallel** on every PR, providing fast, targeted feedback.

### `test-backend.yml` — Backend Tests

- **Suite**: Jest unit tests (`npm run test:coverage`)
- **Coverage**: Posts sticky PR comment (`coverage-backend` header)
- **Results**: Publishes `Backend Tests` check via junit XML

### `test-client.yml` — Client Tests

- **Suite**: Vitest client tests (`npm run test:client:coverage`)
- **Coverage**: Posts sticky PR comment (`coverage-client` header)
- **Results**: Publishes `Client Tests` check via junit XML

### `test-e2e.yml` — E2E Tests

- **Suite**: Playwright browser tests (`npm run test:ui` / `test:ui:all`)
- **Setup**: Builds client, installs Playwright browsers, seeds local D1
- **Browser logic**: All browsers on PRs targeting `main`, chromium-only otherwise
- **Results**: Publishes `E2E Tests` check via junit XML
- **Artifacts**: Uploads `playwright-report/` (30-day retention)

### `test-legacy.yml` — Legacy UI Tests

- **Suite**: Jest legacy coverage (`npm run test:legacy:coverage`)
- **Coverage**: Posts sticky PR comment (`coverage-legacy` header)
- **Note**: Runs with `continue-on-error: true` (non-blocking / advisory)

### `lint.yml` — ESLint

- **Suite**: ESLint flat config (`npm run lint`)
- **Scope**: Lints `src/`, `client/src/`, `public/js/`, `tests/`

## Configuration

### Environment Variables
- `NODE_VERSION`: Node.js version (default: `'22'`)

### Permissions
All workflows use:
```yaml
permissions:
  contents: read
  checks: write
  pull-requests: write
```

### Artifacts Generated
- **Coverage Reports**: Per-suite coverage summaries (uploaded as artifacts)
- **Playwright Reports**: Visual test reports with screenshots (E2E only)
- **Test Results**: junit XML published as GitHub checks

## Scripts

| Workflow | Coverage Script |
|----------|----------------|
| Backend, Client, Legacy | `.github/scripts/generate-single-coverage-comment.js --suite <name>` |

## Troubleshooting

### Common Issues

**E2E tests fail with connection errors**:
- Check that `build:client` completed successfully
- Verify D1 database seed completed (`seedLocalD1`)
- Look for port conflicts (8787)

**Coverage comment missing**:
- Ensure the corresponding `test:*:coverage` script works locally
- Check that coverage files are generated in the expected paths

### Logs and Debugging
- Each workflow appears as a separate check — click the failing one for targeted logs
- Download artifacts for detailed reports (coverage, Playwright traces)
