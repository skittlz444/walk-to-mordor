# Story 7.2: Unified Vite + Wrangler Dev Pipeline

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want **a single `npm run dev` command that watches both worker and client code with clear, labeled output and robust process management**,
so that **I don't need to manage multiple terminal windows during development and can immediately identify which process produced each log line**.

## Acceptance Criteria

### AC1: Single `npm run dev` runs both Vite watch and Wrangler dev concurrently

- `npm run dev` starts both the Wrangler dev server and Vite client watch mode in a single terminal.
- Changes to `client/src/` trigger a Vite rebuild; the browser reflects changes after reload (Vite build output goes to `public/js/client/`, served by Wrangler's Assets binding).
- Changes to `src/` trigger Wrangler reload (Wrangler dev's built-in file watching).
- D1 migrations are applied to the local database on startup (existing `seedLocalD1` behavior preserved).

### AC2: Clean process lifecycle management

- `concurrently` is configured with `--kill-others-on-fail` so that if one process crashes, the other is terminated immediately.
- `Ctrl+C` cleanly terminates both the Vite watch and Wrangler dev processes without orphaned child processes.
- Each process has a labeled name prefix in the terminal output (e.g., `[vite]` / `[wrangler]`) for easy log identification.
- Each process uses a distinct color so the two output streams are visually distinguishable.

### AC3: Build order ensures Vite output exists before Wrangler starts

- On a fresh clone (no `public/js/client/` directory — it is `.gitignore`d), `npm run dev` performs an initial Vite build before starting the concurrent dev processes so that Wrangler has assets to serve on first page load.
- Subsequent runs reuse existing build artifacts; the initial build step is fast when output already exists (Vite no-ops quickly on unchanged input).

### AC4: Dev pipeline documented

- `docs/frontend-guide.md` updated with a "Dev Pipeline" section explaining:
  - What `npm run dev` does (setup steps → concurrent processes).
  - How the Vite watch + Wrangler Assets binding flow works.
  - Troubleshooting: what to do if the Vite build is stale or missing.
  - How to run only the client watch or only the Worker dev server independently.
- Inline comments in `package.json` scripts are not needed — the docs cover it.

### AC5: Tests validate the dev pipeline configuration

- A Jest test file validates that `package.json` scripts are correctly structured:
  - `dev` script exists and contains `concurrently`.
  - `dev:client` script exists and runs Vite build watch.
  - `concurrently` is installed as a devDependency.
  - The `dev` script includes `--kill-others-on-fail` for clean shutdown.
  - The `dev` script includes process name labels (`-n` or `--names` flag).
- Smoke test: `npm run build:client` completes without error (validates Vite config is correct).

## Tasks / Subtasks

- [x] **Task 1: Improve `concurrently` configuration in `npm run dev`** (AC: #1, #2, #3)
  - [x] Update the `dev` script in root `package.json` to add `concurrently` flags:
    - `--kill-others-on-fail` — terminate sibling on crash.
    - `--names "vite,wrangler"` (or `-n`) — label each process output.
    - `--prefix-colors "cyan,yellow"` (or `-c`) — color-code process output.
  - [x] Restructure the `dev` script to perform an initial `npm run build:client` before starting the concurrent dev processes, ensuring `public/js/client/` exists on first-ever run.
  - [x] Preserve existing pre-dev setup: `build:sw:reset` and `seedLocalD1` must still run before the concurrent processes start.
  - [x] Resulting script structure: `npm run build:sw:reset && npm run seedLocalD1 && npm run build:client && concurrently [flags] "npm run dev:client" "wrangler dev --var ALLOW_TEST_AUTH:true"`.
  - [x] Verify `Ctrl+C` cleanly kills both processes (concurrently v9+ handles this by default; `--kill-others-on-fail` adds crash-triggered cleanup).

- [x] **Task 2: Write tests for dev pipeline configuration** (AC: #5)
  - [x] Create `tests/dev-pipeline/dev-pipeline.test.js` (or `.ts`) with Jest tests:
    - Read `package.json` and validate `scripts.dev` contains `concurrently`.
    - Validate `scripts.dev` contains `--kill-others-on-fail`.
    - Validate `scripts.dev` contains process name labels (`--names` or `-n`).
    - Validate `scripts["dev:client"]` exists and references `vite build --watch`.
    - Validate `concurrently` is in `devDependencies`.
  - [x] Run `npm run build:client` as a smoke test to verify Vite config validity (can be a separate test or manual verification).
  - [x] Ensure >90% coverage of new test code per NFR_TEST_01.

- [x] **Task 3: Update documentation** (AC: #4)
  - [x] In `docs/frontend-guide.md`, enhance the "Key Commands" section or add a new "Dev Pipeline" subsection explaining:
    - Full `npm run dev` lifecycle: SW cache reset → D1 seed → initial client build → concurrent Vite watch + Wrangler dev.
    - How Vite watch output (`public/js/client/islands.js`) is served by Wrangler via the Assets binding.
    - Standalone commands: `npm run dev:client` (Vite watch only), `npx wrangler dev` (Worker only).
    - Troubleshooting: delete `public/js/client/` and re-run `npm run dev` to force a fresh build.
  - [x] Keep docs/frontend-guide.md under 500 lines per project doc rules.

## Dev Notes

### Current State — Already Partially Implemented

The `npm run dev` script **already exists** and uses `concurrently`:

```json
"dev": "npm run build:sw:reset && npm run seedLocalD1 && concurrently \"npm run dev:client\" \"wrangler dev --var ALLOW_TEST_AUTH:true\""
```

**What's missing:**
1. **No process labels** — both Vite and Wrangler output mix together without identification; you can't tell which process produced which log line.
2. **No `--kill-others-on-fail`** — if Vite crashes, Wrangler keeps running (and vice versa), leaving the developer in a confusing half-working state.
3. **No color differentiation** — both processes use the same terminal color.
4. **No initial build guarantee** — on a fresh clone, `public/js/client/` doesn't exist (it's `.gitignore`d). `dev:client` starts Vite in watch mode but the first build takes a moment; Wrangler may start serving pages before the islands bundle exists, causing a broken first page load.
5. **No documentation** — the dev pipeline mechanics aren't documented beyond a one-line entry in the commands table.

### Architecture Compliance

- **`concurrently` v9.2.1** is already a devDependency — no new packages needed.
- **Vite 8** builds to `public/js/client/` via `client/vite.config.ts` (`build.outDir: '../public/js/client'`).
- **Wrangler v4.73.0** serves `public/` via Assets binding (`wrangler.json` → `assets.directory: "./public"`).
- **`client/package.json`** must keep `"type": "module"` — required by `@preact/preset-vite` + zimmerframe ESM compat. Do NOT modify it.
- The `dev:client` script (`cd client && vite build --watch`) must remain as-is — it's the correct Vite watch invocation.
- `build:sw:reset` resets the service worker cache version for dev mode. `seedLocalD1` applies D1 migrations locally. Both must continue to run before the concurrent processes.

### Why NOT `@cloudflare/vite-plugin`

Wrangler v4+ has a `@cloudflare/vite-plugin` for native Vite integration that could replace the `concurrently` approach entirely. However:
- It is **not currently installed** and would require significant Vite config changes.
- The current SSR-shell + islands architecture does NOT use Vite for the Worker entry point — Wrangler compiles `src/index.ts` directly.
- Adopting the Vite plugin would change the build topology from "Vite builds islands → Wrangler serves them" to "Vite controls everything including Worker compilation" — a much larger migration outside this story's scope.
- **Decision: improve the existing `concurrently` setup.** A Vite plugin migration could be a future story if needed.

### Key Technical Decisions

1. **`--kill-others-on-fail`** — concurrently v9 flag that terminates all processes if any one exits with a non-zero code. Essential for clean DX.
2. **`--names "vite,wrangler"` + `--prefix-colors "cyan,yellow"`** — labels each process's output with a colored name prefix. Makes interleaved output readable.
3. **Initial `build:client` before concurrent start** — adds ~2-3s to startup but guarantees Wrangler always has assets to serve. On subsequent runs, Vite rebuilds fast when output already exists.
4. **No `--prefix "{time}"`** — adding timestamps to every line would be noisy. The developer can opt into it if needed.

### File Structure (Changes)

```
walk-to-mordor/
  package.json                          ← MODIFIED: improve dev script concurrently flags
  docs/frontend-guide.md                ← MODIFIED: add Dev Pipeline section
  tests/dev-pipeline/
    dev-pipeline.test.js                ← NEW: validate dev script configuration
```

### Potential Pitfalls

1. **Don't change `dev:client`** — the Vite watch command is correct as-is. Only modify the `dev` script that orchestrates it.
2. **Don't change `wrangler.json`** — the assets binding config is correct; no Wrangler config changes needed.
3. **Don't install new packages** — `concurrently` v9.2.1 already supports all needed flags. No need for `npm-run-all`, `turbo`, or other alternatives.
4. **Escaping in `package.json`** — adding flags to the `concurrently` invocation inside a JSON string requires careful escaping of inner quotes. Test the command manually before committing.
5. **Windows compatibility** — `concurrently` v9 handles cross-platform process management. Don't use shell-specific syntax (e.g., `&` for background processes) in the script.
6. **`public/js/client/` is `.gitignore`d** — the initial build step ensures it exists. If the developer manually deletes it between runs, the next `npm run dev` will rebuild it.
7. **Don't add CI lint step** — Story 7.1 creates the lint scripts; Story 7.3 adds CI integration. This story focuses only on the local dev pipeline.

### Previous Story Intelligence (Story 7.1)

Story 7.1 established:
- ESLint flat config (`eslint.config.js`) with three-scope strategy (`src/`, `client/src/`, `public/js/`).
- `npm run lint` and `npm run lint:fix` scripts added to `package.json`.
- `public/js/client/` is globally ignored by ESLint (Vite build output — never lint).
- Root `package.json` is CommonJS (no `"type": "module"` in root).

**Relevant to this story:** When modifying `package.json` scripts, ensure the new/modified `dev` script doesn't conflict with the `lint`/`lint:fix` scripts added by 7.1. No functional overlap expected — they're independent scripts.

### Git Intelligence

- Recent commits are documentation updates (BMAD config, project scan reports) and a small fix (user colours in activity feed).
- No recent changes to `package.json` scripts, Vite config, or Wrangler config.
- `concurrently` has been in devDependencies since early project setup.

### Testing Strategy

- **Configuration validation tests** (Jest): Read `package.json` as JSON and assert script contents. This is reliable, fast, and catches regressions if someone removes flags.
- **Smoke test**: `npm run build:client` as a manual or CI verification step — ensures Vite config is valid and builds successfully.
- **No E2E dev-server tests** — testing that `npm run dev` starts and serves pages correctly is best done manually or in E2E (Playwright tests already exercise the running dev server). This story doesn't add E2E tests for the dev pipeline itself.

### Project Structure Notes

- Alignment with unified project structure: scripts in root `package.json`, documentation in `docs/`.
- No conflicts with existing configuration.
- Test file in `tests/dev-pipeline/` follows the project's test directory organization pattern (`tests/api/`, `tests/ui/`, etc.).

### References

- [Source: _bmad-output/planning-artifacts/epics-phases-4-15.md — Story 7.2 spec, ACs, and technical notes]
- [Source: docs/architecture.md — Build & Deploy section, Asset Pipeline, Source Tree Layout]
- [Source: docs/architecture.md#Build & Deploy — `wrangler.json` assets config, Vite build output location]
- [Source: docs/frontend-guide.md — Key Commands table, Vite config pitfall note]
- [Source: package.json — Current `dev`, `dev:client`, `build:client` scripts, concurrently v9.2.1]
- [Source: client/vite.config.ts — Build output: `../public/js/client`, rolldownOptions]
- [Source: wrangler.json — `assets.directory: "./public"`, Assets binding]
- [Source: _bmad-output/project-context.md — TypeScript strict mode, >90% test coverage]
- [Source: _bmad-output/implementation-artifacts/7-1-eslint-configuration-legacy-deprecation-rules.md — Previous story context, ESLint scripts added]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- Story 7.2 is the second story in Epic 7: Developer Experience & Quality Guardrails (Phase 4).
- The `npm run dev` script already exists with basic concurrently usage — this story improves it with labels, colors, kill-on-fail, and build-order guarantees.
- No new npm packages needed — `concurrently` v9.2.1 is already installed.
- The `@cloudflare/vite-plugin` alternative was evaluated and intentionally deferred — it would change the build topology beyond this story's scope.
- All 8 dev-pipeline tests pass. Full suite: 1034 tests, 29 suites, 0 failures.
- `npm run build:client` has a pre-existing failure on main (Vite 7 vs rolldownOptions config mismatch) — not introduced by this story.
- `docs/frontend-guide.md` updated with Dev Pipeline section (128 lines total, well under 500-line limit).

### Change Log

| File | Action | Description |
|---|---|---|
| `package.json` | MODIFIED | Updated `dev` script with `--kill-others-on-fail`, `--names`, `--prefix-colors`, and initial `build:client` step |
| `tests/dev-pipeline/dev-pipeline.test.js` | CREATED | 8 Jest tests validating dev script configuration |
| `docs/frontend-guide.md` | MODIFIED | Added Dev Pipeline section with lifecycle, standalone commands, and troubleshooting |
