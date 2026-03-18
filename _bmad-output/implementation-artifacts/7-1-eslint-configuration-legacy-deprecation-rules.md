# Story 7.1: ESLint Configuration & Legacy Deprecation Rules

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want **automated linting that enforces code quality and prevents new legacy JS**,
so that **code consistency improves and future work stays in the Preact island architecture**.

## Acceptance Criteria

### AC1: ESLint flat config installed and configured

- ESLint v9+ installed with flat config (`eslint.config.js` in project root).
- `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` installed as devDependencies.
- Configuration targets three directory scopes: `src/`, `client/src/`, and `public/js/`.
- `public/js/client/**` (Vite build output) is globally ignored — it must never be linted.
- Other generated/non-source directories are globally ignored: `node_modules/`, `coverage/`, `dist/`, `playwright-report/`, `test-results/`, `_bmad*/`, `raw_assets/`, `screenshots/`.

### AC2: Strict TypeScript-ESLint rules for `src/` and `client/src/`

- `src/` and `client/src/` enforce strict TypeScript-ESLint rules including at minimum:
  - `@typescript-eslint/no-explicit-any` (error) — aligns with project's "no `any`" rule.
  - `@typescript-eslint/consistent-type-imports` (warn) — promotes clean import patterns.
  - `@typescript-eslint/no-unused-vars` (error, with `_` prefix ignore pattern for intentionally unused params) — complements client `tsconfig.json` `noUnusedLocals`/`noUnusedParameters`.
  - `@typescript-eslint/explicit-function-return-type` (off or warn) — not required but encouraged.
- Rules that duplicate TypeScript compiler checks (already handled by `strict: true` in both `tsconfig.json` files) should be turned off to avoid double-reporting.
- Existing code in `src/` and `client/src/` must pass lint without errors (fix any violations discovered, or add targeted inline `eslint-disable` comments with justification for genuine exceptions).

### AC3: Legacy JS deprecation warnings for `public/js/`

- Files in `public/js/*.js` (the 9 legacy vanilla JS files: `main.js`, `goals.js`, `calendar.js`, `progress.js`, `validators.js`, `password-reset.js`, `profile.js`, `reset-cache-version.js`, `update-cache-version.js`) are linted with relaxed rules.
- A custom `no-restricted-syntax` rule or equivalent mechanism flags any new or modified file in `public/js/` with a deprecation warning: `"Legacy JS: New code should be added to client/src/ (Preact islands). Do not expand legacy modules."`.
- Existing lint violations in legacy JS files do **not** fail the lint run — use `eslint-disable` file-level comments, a baseline ignore mechanism, or relaxed rule severity (warn instead of error) for legacy-specific rules.
- The deprecation warning fires as a **warning** (not error) so CI can still pass while flagging the concern.

### AC4: `npm run lint` and `npm run lint:fix` scripts

- `npm run lint` added to root `package.json` — runs ESLint across all configured scopes.
- `npm run lint:fix` added to root `package.json` — runs ESLint with `--fix` for auto-fixable rules.
- `npm run lint` exits with code 0 on the current codebase (no errors; warnings are allowed).

### AC5: ESLint configuration documented

- Brief documentation added to project root (either in `eslint.config.js` comments or a short section in `docs/frontend-guide.md`) explaining:
  - The three-scope strategy (`src/`, `client/src/`, `public/js/`).
  - Why `public/js/client/` is excluded (Vite build output).
  - The legacy deprecation intent and how to suppress false positives.
  - How to run lint (`npm run lint`, `npm run lint:fix`).

## Tasks / Subtasks

- [x] **Task 1: Install ESLint packages** (AC: #1)
  - [x] Install `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `globals` as devDependencies in root `package.json`.
  - [x] Verify versions: ESLint v10.0.3, `@typescript-eslint/*` v8.57.1, globals v17.4.0.
  - [x] Do NOT install `eslint-plugin-deprecation` (it's sunsetting in favor of `@typescript-eslint/no-deprecated`).

- [x] **Task 2: Create `eslint.config.mjs` flat config** (AC: #1, #2, #3)
  - [x] Create `eslint.config.mjs` in project root using ESLint flat config array format (ESM).
  - [x] Add global ignores for: `node_modules/`, `public/js/client/`, `coverage/`, `dist/`, `playwright-report/`, `test-results/`, `_bmad*/`, `raw_assets/`, `screenshots/`, `client/test-results/`.
  - [x] Configure `src/**/*.ts` scope with TypeScript parser and strict rules.
  - [x] Configure `client/src/**/*.{ts,tsx}` scope with TypeScript parser, strict rules, and JSX support.
  - [x] Configure `public/js/*.js` scope with relaxed rules and deprecation warning.
  - [x] Include `globals.browser` for `public/js/` files (they use `window`, `document`, `fetch`, etc.).
  - [x] Include `globals.serviceworker` for `public/sw.js`.

- [x] **Task 3: Configure TypeScript-ESLint strict rules** (AC: #2)
  - [x] Enable `@typescript-eslint/no-explicit-any` as error.
  - [x] Enable `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: "^_"`, `varsIgnorePattern: "^_"`, `caughtErrorsIgnorePattern: "^_"` as error.
  - [x] Enable `@typescript-eslint/consistent-type-imports` as warn.
  - [x] Disable base `no-unused-vars` to avoid conflict with TypeScript-ESLint version.
  - [x] Test against `src/` — added file-level eslint-disable for auth-handlers.ts/progress-handlers.ts; inline disables with justification for remaining any usages; fixed unused imports.
  - [x] Test against `client/src/` — fixed unused vars (prefixed with _), removed unused destructured `container` vars, added eslint-disable for test bridge globals.

- [x] **Task 4: Configure legacy JS deprecation** (AC: #3)
  - [x] For `public/js/*.js` files, added `no-restricted-syntax` rule on `Program` node selector that surfaces deprecation warning.
  - [x] Same rule applied to `public/sw.js` service worker.
  - [x] Existing legacy code doesn't produce errors (only warnings).
  - [x] Verified: `npm run lint` exits with code 0.

- [x] **Task 5: Add npm scripts** (AC: #4)
  - [x] Add `"lint": "eslint ."` to root `package.json` scripts.
  - [x] Add `"lint:fix": "eslint . --fix"` to root `package.json` scripts.
  - [x] Run `npm run lint` and verified it passes (exit code 0) on current codebase.

- [x] **Task 6: Write tests for ESLint configuration** (AC: #1, #2, #3, #4)
  - [x] Created `tests/lint/eslint-config.test.js` with 16 tests validating:
    - Config loads without errors.
    - TypeScript files in `src/` are matched by the strict rule set.
    - TypeScript/TSX files in `client/src/` are matched by the strict rule set.
    - JS files in `public/js/` are matched by the relaxed rule set with deprecation warning.
    - `public/js/client/` files are excluded from all rule sets.
    - Service worker globals configured for `public/sw.js`.
    - `npm run lint` exits with 0 errors on current codebase.
  - [x] All 16 tests pass. Uses subprocess `eslint --print-config` approach to avoid ESM/CJS interop issues.

- [x] **Task 7: Document ESLint setup** (AC: #5)
  - [x] Add a "Linting" section to `docs/frontend-guide.md` with:
    - Three-scope explanation.
    - `public/js/client/` exclusion rationale.
    - Legacy deprecation intent.
    - Commands: `npm run lint`, `npm run lint:fix`.
  - [x] Added inline comments in `eslint.config.mjs` explaining design decisions.

## Dev Notes

### Current State — Zero ESLint

- **No ESLint configuration, packages, or scripts exist.** This is a greenfield installation.
- The only static analysis is `tsc` via `npm run check` (`tsc && wrangler deploy --dry-run`).
- `.gitignore` already includes `.eslintcache` (from template), so caching will work out of the box.

### Architecture Compliance

- **TypeScript strict mode** is already enabled in both `tsconfig.json` (root) and `client/tsconfig.json`. ESLint rules should complement, not duplicate, the compiler's type checks.
- **Client tsconfig** has additional strictness: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`. The `@typescript-eslint/no-unused-vars` rule overlaps with `noUnusedLocals`/`noUnusedParameters` — consider turning off the ESLint version for `client/src/` if double-reporting is annoying, or align them.
- **Flat config is mandatory.** ESLint v9+ deprecates `.eslintrc.*` format. Use `eslint.config.js` (not `.mjs` — the root project is CommonJS; check `package.json` for `"type"` field). Root `package.json` does NOT have `"type": "module"`, so `eslint.config.js` will be CommonJS by default. If ESM is preferred, use `eslint.config.mjs`.
- **`client/package.json`** has `"type": "module"` (required for `@preact/preset-vite` + zimmerframe ESM compat). The ESLint config lives in the root, not in `client/`, so this doesn't affect config loading.

### File Structure Guidance

```
walk-to-mordor/
  eslint.config.js          ← NEW: flat config file (project root)
  package.json              ← MODIFIED: add lint/lint:fix scripts + devDependencies
  docs/frontend-guide.md    ← MODIFIED: add Linting section
  src/                      ← LINTED: strict TypeScript rules
  client/src/               ← LINTED: strict TypeScript + JSX rules
  public/js/                ← LINTED: relaxed rules + deprecation warning
  public/js/client/         ← EXCLUDED: Vite build output (never lint)
```

### Key Technical Decisions

1. **ESLint v9 flat config format** — uses `eslint.config.js` with exported array of config objects. No `.eslintrc.*` files.
2. **`@typescript-eslint` v8+** — compatible with flat config. Use `tseslint.config()` helper or manual config objects.
3. **`globals` package** — provides `globals.browser`, `globals.node`, `globals.serviceworker` for environment-specific global declarations.
4. **No `eslint-plugin-deprecation`** — that plugin is sunsetting. The deprecation warning for `public/js/` should be implemented via `no-restricted-syntax` on `Program` node, a custom local rule, or file-level banner comments.
5. **Legacy JS: warn, not error** — `public/js/` files should produce warnings only (not errors) so `npm run lint` exits 0. The goal is awareness, not blockage.
6. **`public/sw.js`** (service worker) — decide whether to include in lint scope. It's a standalone service worker file using `self`, `caches`, etc. If included, use `globals.serviceworker`.

### Legacy JS Files (Deprecation Targets)

| File | Purpose | Notes |
|---|---|---|
| `main.js` | App bootstrap, session init, drawer nav | Sets `body.authenticated`, `window.userPreferences` |
| `goals.js` | Goal cards, locking, preference bridge | Reads `window.userPreferences.showFutureGoalsUnlocked` |
| `calendar.js` | Calendar UI | Walk history display |
| `progress.js` | Walk logging | CRUD for daily distance |
| `validators.js` | Form validation | Mirrored in `src/validators.ts` — must stay in sync |
| `password-reset.js` | Password reset form | Standalone page logic |
| `profile.js` | Legacy profile (defunct) | Was removed from `renderLayout.ts` — file still on disk |
| `reset-cache-version.js` | Build utility | Not shipped as runtime code |
| `update-cache-version.js` | Build utility | Not shipped as runtime code |

### Testing Strategy

- **Programmatic config validation** is the most robust approach: load the ESLint config via its Node API (`ESLint` class or `loadConfigFile`) and assert that file patterns match expected rule sets.
- **Smoke test alternative**: run `npx eslint --print-config src/index.ts` and `npx eslint --print-config public/js/main.js` to verify different rule sets are applied.
- **CI integration**: `npm run lint` as a CI step (not part of this story — Story 7.2 or 7.3 may add it to the pipeline).

### Potential Pitfalls

1. **`public/js/client/` must be ignored** — this is Vite's build output (`islands.js`, `islands.css`, chunks). If accidentally linted, it will produce hundreds of errors on generated code.
2. **Don't fix legacy JS** — the story explicitly says "do not fix existing lint errors in legacy JS." Only add the deprecation warning mechanism.
3. **Root `package.json` is CommonJS** — no `"type": "module"` in root. If using `eslint.config.js` (not `.mjs`), the file must use `module.exports` or `require()`. Alternatively, use `eslint.config.mjs` for ESM syntax.
4. **TypeScript parser config** — `@typescript-eslint/parser` needs `project: true` or a `tsconfig.json` path for type-aware rules. If only using syntax-based rules (no type-checked rules), `project` can be omitted for faster linting.
5. **Existing `any` usage** — search `src/` and `client/src/` for `any` before enabling `no-explicit-any`. TypeScript `strict: true` doesn't forbid explicit `any` — only `noImplicitAny` is included in strict. There may be explicit `any` types that need fixing or disabling.

### Project Structure Notes

- Alignment with unified project structure: ESLint config in project root (standard location). Scripts in root `package.json` (standard location).
- No conflicts with existing configuration. No `.eslintrc` files to migrate.
- `client/` has its own `tsconfig.json` with stricter settings — ESLint TypeScript parser should reference the appropriate tsconfig per scope (`./tsconfig.json` for `src/`, `./client/tsconfig.json` for `client/src/`).

### References

- [Source: _bmad-output/planning-artifacts/epics-phases-4-15.md — Story 7.1 spec with AC and technical notes]
- [Source: docs/architecture.md — Source tree layout, build pipeline, testing matrix]
- [Source: docs/architecture.md#Key Architectural Patterns — Islands Architecture, SSR + Preact hydration]
- [Source: docs/frontend-guide.md — Legacy JS Interop section listing legacy modules]
- [Source: docs/prd.md — Phase 4 DX: "ESLint setup + legacy JS deprecation linter flagging new code in public/js/"]
- [Source: _bmad-output/project-context.md — TypeScript strict mode, no any, >90% test coverage]
- [Source: package.json — Current scripts (no lint), devDependencies (no ESLint packages)]
- [Source: tsconfig.json — Root: strict mode, targets src/js/css]
- [Source: client/tsconfig.json — Stricter: noUnusedLocals, noUnusedParameters, jsxImportSource: preact]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- Story 7.1 is the first story in Epic 7: Developer Experience & Quality Guardrails (Phase 4).
- Epic 7 has no dependencies on other epics — fully independent.
- This is a greenfield ESLint installation — no existing config, packages, or scripts to migrate.
- The story scope is configuration only — no application code changes beyond potential inline `eslint-disable` comments for justified exceptions.
- Used `eslint.config.mjs` (ESM) since root `package.json` has no `"type": "module"`.
- Installed ESLint v10.0.3, @typescript-eslint v8.57.1, globals v17.4.0.
- `npm run lint` exits with code 0: 0 errors, 13 warnings (9 legacy deprecation warnings via `no-restricted-syntax` on `public/js/*.js` + 4 `@typescript-eslint/consistent-type-imports` warnings in `src/`).
- All 1042 existing tests pass with no regressions. 16 new ESLint config tests added.
- File-level `eslint-disable` comments added to `auth-handlers.ts` and `progress-handlers.ts` (heavy `any` usage — needs dedicated typing story).
- Unused imports removed from `src/index.ts` and `src/progress-handlers.ts` as safe cleanup.

### File List

- `eslint.config.mjs` — NEW (ESM flat config with three scopes)
- `package.json` — MODIFIED (scripts: lint, lint:fix + devDependencies: eslint, @typescript-eslint/*, globals)
- `docs/frontend-guide.md` — MODIFIED (added Linting section + lint commands in Key Commands table)
- `tests/lint/eslint-config.test.js` — NEW (16 tests validating config scopes, rules, ignores)
- `src/auth-handlers.ts` — MODIFIED (file-level eslint-disable for no-explicit-any)
- `src/progress-handlers.ts` — MODIFIED (file-level eslint-disable for no-explicit-any, removed unused imports)
- `src/index.ts` — MODIFIED (removed unused imports, inline eslint-disable for any)
- `src/email-utils.ts` — MODIFIED (inline eslint-disable for catch error any)
- `src/goals-handlers.ts` — MODIFIED (inline eslint-disable for env any, catch error to unknown)
- `src/map-handlers.ts` — MODIFIED (inline eslint-disable, prefixed unused params with _)
- `src/validators.ts` — MODIFIED (inline eslint-disable for any, prefixed unused catch var)
- `client/src/components/map/UserMarker.ts` — MODIFIED (prefixed unused var with _)
- `client/src/data/waypoints.test.ts` — MODIFIED (prefixed unused const with _)
- `client/src/islands/AuthForms.tsx` — MODIFIED (renamed unused catch err to _err)
- `client/src/islands/FriendAddIsland.test.tsx` — MODIFIED (removed unused container destructuring)
- `client/src/islands/FriendsListIsland.test.tsx` — MODIFIED (prefixed unused var, eslint-disable for test any, removed unused container)
- `client/src/islands/ProfileIsland.test.tsx` — MODIFIED (eslint-disable for bridge global any casts)
- `client/src/utils/map-popup-utils.ts` — MODIFIED (prefixed unused var with _)
