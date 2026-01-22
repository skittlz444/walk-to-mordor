---
stepsCompleted: [1]
inputDocuments: []
workflowType: 'technical-spec'
project_name: 'walk-to-mordor'
user_name: 'Hayden'
date: '2026-01-14'
---

# Technical Specification: Client-Side Unit Testing Infrastructure

## 1. Goal & Success Metrics

**Goal:** Establish a robust unit testing infrastructure for the Preact-based "Islands" explicitly using Vitest with a co-located test pattern.

**Success Metrics:**
- [ ] `npm run test:client` executes successfully.
- [ ] Tests use `happy-dom` or `jsdom` to simulate browser environment.
- [ ] Test coverage reports are generated for `client/src/`.
- [ ] CI workflow runs client tests and reports results.

## 2. Technical Solution

### 2.1 Dependencies
We will install the following dev dependencies:
- `vitest`: The test runner.
- `happy-dom`: A lighter-weight alternative to jsdom (faster for CI).
- `@testing-library/preact`: Utilities for rendering and interacting with Preact components.
- `@vitest/coverage-v8`: Native coverage provider for Vitest.

### 2.2 Configuration

**File:** `vitest.config.ts` (new)
Extends the existing `vite.config.ts` but adds the `test` property:
- Environment: `happy-dom`
- Globals: `true` (optional, makes `describe`, `it` available globally or imports)
- Setup Files: `client/test-setup.ts` (for global mocks if needed)
- Coverage: Include `client/src/**`, exclude `*.d.ts`.

### 2.3 Script Updates
Update `package.json`:
```json
"scripts": {
  "test:client": "vitest run",
  "test:client:watch": "vitest",
  "test:client:coverage": "vitest run --coverage"
}
```

### 2.4 CI Integration
Update `.github/workflows/pr-tests.yml`:
- Add a new `test-client` job or step.
- Ensure coverage reports are merged or reported separately.

## 3. Implementation Plan

### Step 1: Install Dependencies
- Run `npm install -D vitest happy-dom @testing-library/preact @vitest/coverage-v8`

### Step 2: Configure Vitest
- Create `vitest.config.ts` in root (or `client/` if we want isolation, but root is easier for monorepo-like feel).
- *Decision:* We'll place `vitest.config.ts` in `client/` to keep frontend concerns encapsulated since `package.json` scripts can just point there.

### Step 3: Add NPM Scripts
- Update root `package.json` to proxy commands to `client/`.

### Step 4: Add Sample Test
- Add `client/src/islands/HelloWorld.test.tsx` to verify the setup works against the existing `HelloWorld.tsx`.

### Step 5: Update CI
- Modify `pr-tests.yml` to include the execution of these tests.

## 4. Verification
- Run `npm run test:client` -> Pass.
- Run `npm run test:client:coverage` -> Check `coverage/` output.
