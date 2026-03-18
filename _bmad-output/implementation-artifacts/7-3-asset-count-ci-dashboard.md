# Story 7.3: Asset Count CI Dashboard

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want **CI to automatically track and enforce the static asset file count budget with clear annotations and a local pre-deploy check**,
so that **we never accidentally exceed Cloudflare Workers Assets limits and deployments stay safe**.

## Acceptance Criteria

### AC1: CI pipeline counts files under `public/` and enforces thresholds

- The existing GitHub Actions workflow (`.github/workflows/pr-tests.yml`) includes a new step that counts all files under `public/` recursively.
- If the count is < 15,000, the check passes with a summary annotation showing the current count and directory breakdown.
- If the count is ≥ 15,000 and < 18,000, the check passes but emits a **warning** annotation: "Asset count approaching limit".
- If the count is ≥ 18,000, the check **fails** with an error annotation.
- The asset count and breakdown by top-level subdirectory (e.g., `img/`, `js/`, `css/`) are visible in the CI output and PR check summary.

### AC2: Reusable asset count script

- A standalone Node.js script (`.github/scripts/check-asset-count.js`) implements the counting and threshold logic.
- The script counts files recursively under a configurable directory (defaults to `public/`).
- The script outputs:
  - Total file count.
  - Breakdown by top-level subdirectory.
  - Status: `pass`, `warn`, or `fail` based on thresholds.
- The script exits with code 0 on pass/warn, code 1 on fail.
- When running in GitHub Actions (detects `GITHUB_STEP_SUMMARY` env var), the script writes a Markdown summary table to `$GITHUB_STEP_SUMMARY` and sets `::warning::` or `::error::` annotations as appropriate.

### AC3: Local pre-deploy verification

- An `npm run check:assets` script is added to root `package.json` that runs the same asset count script locally.
- Developers can run `npm run check:assets` before deploying to verify the asset budget.
- The local output is human-readable terminal output (no GitHub Actions annotations).

### AC4: Tests validate the asset count script logic

- A Jest test file validates the asset count script's core logic:
  - Counting files in a mock directory structure.
  - Correct threshold classification: pass (< 15,000), warn (≥ 15,000 and < 18,000), fail (≥ 18,000).
  - Correct directory breakdown calculation.
  - Correct exit code behavior (0 for pass/warn, 1 for fail).
  - GitHub Actions summary output format when `GITHUB_STEP_SUMMARY` is set.
- Tests achieve >90% coverage of the new script.

### AC5: Documentation

- `docs/asset-workflow.md` updated with a section explaining:
  - The asset count CI check and its thresholds.
  - How to run `npm run check:assets` locally.
  - What to do if the count approaches or exceeds limits (cleanup strategies, image optimization).
- Brief inline comments in the script explaining the threshold values and their origin.

## Tasks / Subtasks

- [x] **Task 1: Create asset count script** (AC: #2)
  - [x] Create `.github/scripts/check-asset-count.js` following the existing pattern set by `.github/scripts/generate-coverage-comment.js`.
  - [x] Implement recursive file counting under a configurable directory (default: `public/`).
  - [x] Implement top-level subdirectory breakdown (e.g., `img: 866`, `js: 11`, `css: 13`).
  - [x] Implement threshold logic: pass (< 15,000), warn (≥ 15,000), fail (≥ 18,000).
  - [x] When `GITHUB_STEP_SUMMARY` env var exists, write Markdown summary table to that file and emit `::warning::` / `::error::` workflow commands.
  - [x] When running locally (no `GITHUB_STEP_SUMMARY`), output a human-readable table to stdout.
  - [x] Exit code 0 for pass/warn, exit code 1 for fail.

- [x] **Task 2: Add CI step to GitHub Actions workflow** (AC: #1)
  - [x] Add a new step "Check Asset Count" to `.github/workflows/pr-tests.yml`.
  - [x] Place it early in the pipeline (after checkout, before test runs) — it's fast and catches budget issues early.
  - [x] Step runs: `node .github/scripts/check-asset-count.js`.
  - [x] The step should NOT use `continue-on-error` — a fail (≥ 18,000) should block the pipeline.

- [x] **Task 3: Add `npm run check:assets` script** (AC: #3)
  - [x] Add `"check:assets": "node .github/scripts/check-asset-count.js"` to root `package.json` scripts.

- [x] **Task 4: Write tests** (AC: #4)
  - [x] Create `tests/api/check-asset-count.test.js` with Jest tests.
  - [x] Test the counting logic with mock directory structures (use `fs` mocking or a temp directory).
  - [x] Test threshold classification: pass, warn, fail.
  - [x] Test directory breakdown calculation.
  - [x] Test exit code behavior (mock `process.exit`).
  - [x] Test GitHub Actions output when `GITHUB_STEP_SUMMARY` is set (mock env var and verify file write).
  - [x] Test local output when `GITHUB_STEP_SUMMARY` is absent.
  - [x] Ensure >90% coverage of the new script.

- [x] **Task 5: Update documentation** (AC: #5)
  - [x] Add "Asset Count CI Check" section to `docs/asset-workflow.md` explaining:
    - Thresholds: 15,000 (warn), 18,000 (fail).
    - CI integration: automatic on every PR.
    - Local check: `npm run check:assets`.
    - Remediation strategies if count is high.
  - [x] Keep `docs/asset-workflow.md` under 500 lines per project doc rules.

## Dev Notes

### Current State

- **Current asset count: 897 files** (well under limits).  
  Breakdown: `img: 866`, `css: 13`, `js: 11`, `icons: 5`, `sw.js: 1`, `manifest.json: 1`.
- **Existing CI**: `.github/workflows/pr-tests.yml` runs on PR events with checkout, build, tests, coverage, and PR comments.
- **Existing CI scripts pattern**: `.github/scripts/generate-coverage-comment.js` — a Node.js script that reads data, builds Markdown, and writes to `coverage-comment.md` for PR commenting. Follow the same CommonJS style (`require()`, `fs`, no external dependencies).
- **No existing asset count check** — this is a new addition.
- **Cloudflare Workers Assets limit**: The 25,000-file soft limit for Workers Assets is the upstream constraint. The 15k/18k thresholds provide early warning before reaching platform limits.

### Architecture Compliance

- **GitHub Actions workflow**: `.github/workflows/pr-tests.yml` — add a step, don't create a separate workflow file. Keep the single-workflow approach.
- **Script location**: `.github/scripts/` — follows existing pattern established by `generate-coverage-comment.js`.
- **Script language**: Node.js (CommonJS) — consistent with `generate-coverage-comment.js`. No external dependencies; use `fs` and `path` only.
- **Root `package.json`** is CommonJS (no `"type": "module"` in root) — scripts use `require()`.
- **Testing**: Jest for backend tests. Test file goes in `tests/api/` alongside other infrastructure tests.

### Key Technical Decisions

1. **Standalone Node.js script** (not a shell one-liner) — enables testability, reusable logic, structured output, and cross-platform compatibility (Windows + Linux CI).
2. **CommonJS format** — matches root project convention and existing `.github/scripts/generate-coverage-comment.js`.
3. **`$GITHUB_STEP_SUMMARY`** — GitHub Actions native job summary mechanism. Writing Markdown to this file creates a summary visible in the PR checks UI without needing a separate comment action.
4. **`::warning::` / `::error::`** — GitHub Actions workflow commands that create annotations visible on the PR. Used alongside the step summary for maximum visibility.
5. **Early in pipeline** — the asset count check is near-instant (counting files) so placing it early gives fast feedback without delaying the pipeline.
6. **No `continue-on-error`** — if assets exceed 18k, the pipeline should fail hard. This is a deployment safety guardrail, not a soft warning.
7. **Thresholds from requirements**: 15,000 (warn per FR_DX_03, NFR_ASSET_01) and 18,000 (fail per FR_DX_03, NFR_ASSET_01).

### Script Implementation Pattern

Follow the pattern from `generate-coverage-comment.js`:

```js
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const WARN_THRESHOLD = 15000;
const FAIL_THRESHOLD = 18000;
const TARGET_DIR = process.argv[2] || 'public';

// Count files recursively
function countFiles(dir) { /* ... */ }

// Get breakdown by top-level subdirectory
function getBreakdown(dir) { /* ... */ }

// Format output (terminal vs GitHub Actions)
const isCI = !!process.env.GITHUB_STEP_SUMMARY;
```

### File Structure (Changes)

```
walk-to-mordor/
  .github/
    scripts/
      check-asset-count.js          ← NEW: asset count + threshold script
    workflows/
      pr-tests.yml                  ← MODIFIED: add "Check Asset Count" step
  package.json                      ← MODIFIED: add check:assets script
  docs/asset-workflow.md             ← MODIFIED: add asset count CI section
  tests/api/
    check-asset-count.test.js       ← NEW: Jest tests for the script
```

### Potential Pitfalls

1. **Don't count `public/js/client/`** — this directory is Vite build output and is `.gitignore`d. It won't exist in CI before `npm run build:client` runs, and its file count varies. The script should count whatever is checked into git (which excludes `public/js/client/`). Since CI runs after checkout, before build, this is naturally handled if the step runs before the build step. If placed after build, the Vite output files get counted too — use placement before build to avoid this, OR explicitly note that the count includes build output.
2. **Windows path handling** — use `path.join()` and `path.sep` for cross-platform compatibility. Don't hardcode `/` separators.
3. **Symlinks** — `fs.readdirSync` + `fs.statSync` with `lstat` to avoid following symlinks. The project doesn't use symlinks, but defensive coding costs nothing.
4. **Empty directories** — only count files, not directories. `stat.isFile()` check.
5. **Git-ignored files in CI** — CI runs after `actions/checkout` which only gets tracked files. Locally, `public/js/client/` exists (Vite output). The local `check:assets` command will include these — document this discrepancy or add an exclusion pattern.
6. **Don't modify the test failure check step** — the existing "Check for test failures" step at the end of the workflow checks specific step outcomes. The new asset count step doesn't use `continue-on-error`, so a failure will naturally stop the pipeline via GitHub Actions' default behavior.

### Previous Story Intelligence

**Story 7.1 (ESLint Configuration)** — ready-for-dev, not yet implemented:
- Adds `eslint.config.js`, `npm run lint` / `npm run lint:fix` scripts.
- Establishes the pattern of adding new utility scripts to `package.json`.
- No functional overlap with this story.

**Story 7.2 (Unified Dev Pipeline)** — ready-for-dev, not yet implemented:
- Improves `npm run dev` with `concurrently` flags.
- Establishes the pattern of documenting DX improvements in `docs/frontend-guide.md`.
- No functional overlap with this story.

**Both 7.1 and 7.2 modify `package.json`** — when implementing 7.3, be aware that `package.json` may have changed if 7.1 or 7.2 were implemented first. Read the current `package.json` before modifying.

### Git Intelligence

- Recent commits: BMAD 6.2.0 migration, documentation updates, brainstorming artifacts.
- No recent changes to CI workflow, `.github/scripts/`, or asset pipeline.
- The `generate-coverage-comment.js` script has been stable — safe to use as a template reference.

### Testing Strategy

- **Unit tests for script logic**: Mock `fs` operations to test counting, breakdown, and threshold classification without touching the real filesystem.
- **Integration-style test**: Optionally create a temp directory with known file counts and verify the script's output.
- **Exit code testing**: Mock `process.exit` to verify the script emits the correct exit code for each threshold.
- **GitHub Actions output testing**: Set `process.env.GITHUB_STEP_SUMMARY` to a temp file and verify the Markdown content written.
- **No E2E CI testing** — testing that the GitHub Actions workflow step runs correctly is verified by the workflow itself on the PR that implements this story.

### Project Structure Notes

- Alignment with unified project structure: CI scripts in `.github/scripts/`, workflow in `.github/workflows/`, tests in `tests/api/`.
- No conflicts with existing configuration.
- Following the existing CommonJS Node.js script pattern established by `generate-coverage-comment.js`.

### References

- [Source: _bmad-output/planning-artifacts/epics-phases-4-15.md — Story 7.3 spec, ACs, technical notes, FR_DX_03, NFR_ASSET_01]
- [Source: docs/architecture.md — Source tree layout, Assets binding (`wrangler.json → assets.directory: "./public"`), Build & Deploy section]
- [Source: docs/architecture.md#Build & Deploy — Asset Pipeline scripts, testing matrix]
- [Source: .github/workflows/pr-tests.yml — Existing CI pipeline structure, step ordering, test result publishing]
- [Source: .github/scripts/generate-coverage-comment.js — Existing CI script pattern (CommonJS, fs, Markdown output)]
- [Source: package.json — Current scripts, no existing check:assets command]
- [Source: wrangler.json — `assets.directory: "./public"`, ASSETS binding]
- [Source: _bmad-output/project-context.md — TypeScript strict mode, >90% test coverage]
- [Source: _bmad-output/implementation-artifacts/7-1-eslint-configuration-legacy-deprecation-rules.md — Previous story context, package.json script additions]
- [Source: _bmad-output/implementation-artifacts/7-2-unified-vite-wrangler-dev-pipeline.md — Previous story context, package.json modifications]
- [Source: docs/asset-workflow.md — Existing asset workflow documentation (will be updated)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Completion Notes List

- Story 7.3 is the third and final story in Epic 7: Developer Experience & Quality Guardrails (Phase 4).
- Current asset count is 894 files — well under both thresholds. This is a proactive guardrail for future growth (especially map tiles and goal images).
- Script follows existing `.github/scripts/generate-coverage-comment.js` pattern: CommonJS, `fs`/`path` only, no external deps.
- CI step placed after `npm ci` but before `Build Client` — counts only checked-in files (excludes Vite output).
- 29 tests passing with 99% statement, 96.3% branch, 100% function coverage on the new script.
- Full test suite: 29 suites, 1055 tests, 0 failures — no regressions.

### File List

| File | Action | Description |
|------|--------|-------------|
| `.github/scripts/check-asset-count.js` | Created | Asset count script with recursive counting, threshold logic, CI/local output |
| `.github/workflows/pr-tests.yml` | Modified | Added "Check Asset Count" step after checkout, before build |
| `package.json` | Modified | Added `check:assets` npm script |
| `tests/api/check-asset-count.test.js` | Created | 29 Jest tests covering all script functions and integration |
| `docs/asset-workflow.md` | Modified | Added "Asset Count CI Check" section with thresholds, usage, remediation |
| `_bmad-output/implementation-artifacts/7-3-asset-count-ci-dashboard.md` | Modified | Updated status to review, checked off all tasks |
