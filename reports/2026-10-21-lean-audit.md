# Lean review — walk-to-mordor (full audit)

**Mode:** `audit` (report-only; no code written)
**Repo:** `/run/media/skittlz/LinuxStorageSSD/github/walk-to-mordor`
**Base:** `main` = `d38e8e2` (fast-forwarded from `origin/main` before the audit; 12 upstream commits pulled)
**Worktree audited:** `/run/media/skittlz/LinuxStorageSSD/github/walk-to-mordor.worktrees/idea-sorting-and-repo-cleanup` (`5052b98`)
**Date:** 2026-10-21

## Verdict

`audit`, **20 findings (1 must / 13 should / 6 nice)**. Nothing was written except this report. No cleanup applied.

The dominant debt is not application code — it is **three parallel agent-instruction installs** (`.agent`, `.agents`, `_bmad`, plus a fourth `openspec-*`/`opsx-*` pair in `.github/skills`) that already disagree with each other, and **one fully built feature (`achievement-utils`) with schema and 484 lines of tests but no production caller**. The repo's typecheck gate is red at `HEAD`, and CI never runs it.

## Coverage

| Directory | Scanned | Findings | Notes |
|---|---|---|---|
| `.agent/` | yes | S2 | 217 files / 1.26 MB; byte-identical duplicate of 44 `.agents` skills; zero inbound refs |
| `.agents/` | yes | S4 | 238 files / 1.33 MB; live install referenced by `.github/agents/*.agent.md` |
| `.claude/` | yes | — | 2 commands; both targets (`_bmad/core/tasks/*.xml`) exist |
| `.github/` | yes | S3, N4 | skills triplication, stale `TESTING.md` pointer |
| `.vscode/` | yes | N2, N4 | dead `run-mcp.sh`, pinned workflow that does not exist |
| `_bmad/` | duplicate scan only | S4 | vendored BMAD; `scripts/`, `custom/`, `_config/`, `core/tasks` are live |
| `_bmad-output/` | yes | — | 89 files / 22.5k lines of planning artifacts (intentional) |
| `client/` | yes | S6, N3 | 55 islands; empty second lockfile |
| `coverage/`, `dist/`, `playwright-report/`, `test-results/` | excluded | — | ignored / build output |
| `docs/` | yes | N5 | stale scan report; archive is intentional |
| `migrations/` | yes | S1 | duplicate `0052`–`0057` prefixes are legitimate A/B image pairs |
| `node_modules/` | excluded | — | vendored dependencies |
| `openspec/` | yes | — | 11 open changes, 0/263 tasks done (operational) |
| `public/` | yes | S10, N1, N2 | 239 MB, incl. 45 MB build-only map sources |
| `raw_assets/` | excluded | — | ignored local scratch |
| `screenshots/` | yes | N1 | 2 of 7 files unreferenced |
| `scripts/` | yes | N2 | one-off converters still tracked |
| `src/` | yes | M1, S1, S5, S6, S7, S11, S12, S13 | app worker |
| `tests/` | yes | S8, N6 | 75 files; dead helpers and duplicate suites |
| `.playwright-mcp/`, `.venv/`, `.wrangler/` | excluded | — | ignored local state |
| worktree `idea-sorting-and-repo-cleanup` | yes | — | 12 commits behind; 2 doc files added; no code debt |

## Findings

### [M1] Repo typecheck gate is red at HEAD and no CI job runs it
**What this is:** `tsc` fails on four `Env` typing errors; `.github/workflows/lint.yml` only runs ESLint, so nothing catches them.
**Problem:** `npx tsc --noEmit` exits 2 at both `34ae53d` and `d38e8e2` with `src/auth-handlers.ts(120,53)`, `(741,7)`, `(946,53)` (`Env` has no properties in common with `EmailEnv`) and `src/index.ts(476,100)` (`Property 'RESEND_API_KEY' does not exist on type 'Env'`). `npm run check` (`package.json:58`) is therefore unusable, and `.github/workflows/lint.yml:31` never runs it. Strict mode is nominal: a PR can merge with type errors.
**Fix:** add a hand-written `src/env.d.ts` merging `interface Env { RESEND_API_KEY?: string }` (do **not** put the secret in `wrangler.json` `vars`), and add an `npx tsc --noEmit` step to `.github/workflows/lint.yml` after `npm ci`.
**If we skip it:** `npm run check` stays broken, every future type regression lands silently, and the `wrangler deploy --dry-run` half of `check` is never exercised in CI.

### [S1] `src/achievement-utils.ts` — a complete feature with schema and tests, but zero production callers
**What this is:** 307-line achievement engine (`awardAchievement`, `getUserAchievements`, `getUserAchievementSummary`, definitions/summary types) plus two tables and a 484-line test file.
**Problem:** no handler, route, or component references it: `grep -rn "achievement" src/index.ts src/*-handlers.ts client/src` returns nothing, and all four exported functions have zero callers outside `tests/api/achievement-utils.test.ts`. The DB tables exist via `migrations/0142_create_achievement_definitions.sql` and `0143_create_user_achievement_instances.sql`; the test suite reports 100% coverage of unreachable code, which inflates the global coverage number that CI enforces.
**Fix:** decide the owner and the outcome — either wire it into a route/handler (the spec at `openspec/specs/shared-achievement-infrastructure/spec.md` describes intended behaviour) or delete `src/achievement-utils.ts`, its test, and add a drop migration. Do not leave it half-shipped.
**If we skip it:** dead surface grows, coverage reports lie, and the next contributor assumes achievements already work.

### [S2] `.agent/` — dead byte-identical copy of the skill tree (1.26 MB, 217 files)
**What this is:** a second skill installation under the singular `.agent/`, left over from the pre-`.agents` convention.
**Problem:** `diff -rq .agent .agents` reports only eight "Only in" entries and **zero differing files** — the 44 shared skill directories are identical. `grep -rn "\.agent/"` outside the tree returns nothing; the live consumers are `.github/agents/*.agent.md`, which load `.agents/skills/...`. `.agent/rules/rules.md` is the only unique file and duplicates `.github/copilot-instructions.md` content (stack list, testing rules, docs rules).
**Fix:** delete `.agent/skills/` (44 dirs); fold anything still wanted from `.agent/rules/rules.md` into `.github/copilot-instructions.md`. Confirm first that no local IDE profile points at `.agent/skills`.
**If we skip it:** two trees drift, agents load whichever path their tool prefers, and 1.26 MB of duplicate instruction text is reviewed and cached on every checkout.

### [S3] `.github/skills` — `openspec-*` and `opsx-*` are two generations of the same 25 skills
**What this is:** 13 `openspec-*` skills and 12 `opsx-*` skills covering the same procedures (propose, apply, archive, explore, new, continue, sync, verify, onboard, bulk-archive).
**Problem:** the bodies are near-identical but already different — `diff` of `openspec-propose` vs `opsx-propose` bodies is 11 lines, `openspec-apply-change` vs `opsx-apply` is 13 lines. Commit `02ebc9a` ("migrate opsx prompts to skills") added the second set on top of the CLI-generated first set (`openspec-propose/SKILL.md:2` has `generatedBy: "1.6.0"`). Both are tracked and invocable; `openspec-*` files still tell the reader to run `/opsx:*`.
**Fix:** keep the set the current OpenSpec CLI emits and delete the other, or generate the `opsx-*` shims from `openspec-*` at install time instead of committing both.
**If we skip it:** every OpenSpec workflow change must be made twice, and the two copies will keep diverging.

### [S4] `_bmad/core/skills` — third copy of 11 BMAD skills, already drifted (217 KB)
**What this is:** the BMAD installer's skill directory, retained alongside the live `.agents/skills` install.
**Problem:** all 11 names exist in `.agents/skills` with different content — `diff` counts 49 changed lines for `bmad-help` and 45 for `bmad-index-docs` — and nothing references `_bmad/core/skills` (`grep -rn "_bmad/core/skills"` is empty). The rest of `_bmad` **is** live: `.claude/commands/bmad/core/tasks/shard-doc.md:7` loads `_bmad/core/tasks/shard-doc.xml`, and `.agents/skills/bmad-*/SKILL.md` loads `_bmad/scripts/`, `_bmad/custom/`, and `_bmad/bmm/config.yaml`.
**Fix:** delete `_bmad/core/skills/` and refresh `_bmad/_config/skill-manifest.csv`; keep `_bmad/scripts`, `_bmad/custom`, `_bmad/_config`, `_bmad/core/tasks`.
**If we skip it:** agents that resolve `{project-root}/_bmad/core/skills` get older instructions than agents that resolve `.agents/skills` for the same skill name.

### [S5] `worker-configuration.d.ts` — tracked generated file is out of date
**What this is:** 551 KB Wrangler type dump committed to the repo.
**Problem:** `npx wrangler types --check` prints `Types at worker-configuration.d.ts are out of date. Run wrangler types to regenerate.` Regenerating produces a 1,515-line diff (1,279 insertions / 236 deletions); the header still says `workerd@1.20260721.1` while the current runtime is `1.20261012.1` (`worker-configuration.d.ts:2`). Generated types and `wrangler.json` can therefore disagree without anyone noticing.
**Fix:** regenerate in its own commit, and add `npx wrangler types --check` to `.github/workflows/lint.yml` next to `npm run check:assets`.
**If we skip it:** binding changes keep landing without type coverage, and the file grows a larger and larger one-off diff.

### [S6] Seven `renderAdmin*Page.ts` shells duplicated with four differences each
**What this is:** `renderAdminPage`, `renderAdminGoalAddPage`, `renderAdminGoalEditPage`, `renderAdminGoalsPage`, `renderAdminMetricsPage`, `renderAdminStorylinesPage`, `renderAdminUsersPage` — 464 lines total, 2.4 KB each.
**Problem:** each file repeats the same header, sidebar `<nav>`, and layout call; diffing any pair yields only the function name, title, description, and which link carries `admin-nav__link--active` (`src/renderAdminPage.ts:3-66`). Adding a nav item or fixing an `aria-current` attribute requires seven edits; `src/renderAdminGoalAddPage.ts:3` and `src/renderAdminGoalEditPage.ts:3` already duplicate ~55 lines verbatim.
**Fix:** extract `renderAdminShell({ title, description, activeNav, mainContent })` and reduce each page to its content block. Collapse the seven mirrored tests into one table-driven test at the same time.
**If we skip it:** the admin chrome drifts page by page, and every shell change is a seven-file review.

### [S7] Client and server validation rules are two hand-synced copies
**What this is:** `src/validators.ts` and `public/js/validators.js` both define `VALIDATION_CONSTANTS` (MIN_YEAR, MAX_YEAR, MAX_DISTANCE_VALUE) and the date/distance checks.
**Problem:** the files explicitly ask humans to keep them in sync (`src/validators.ts:1` "keep in sync with client-side validators.js"; `public/js/validators.js:3` the mirror comment). The implementations already differ in style and will drift on the next rule change: a limit updated in one file only means the client submits values the server rejects (or vice versa) with no test that compares them.
**Fix:** generate `public/js/validators.js` from the TS constants at build time, or move the constants to a shared JSON/ES module both sides import.
**If we skip it:** validation limits change silently on one side; the failure mode is a user-facing rejection with no obvious cause.

### [S8] Dead test-auth helpers keep `supertest` alive
**What this is:** `tests/ui/helpers/test-auth.js` (supertest-based auth wrapper) and `tests/ui/helpers/mock-auth.ts` (a second mock-auth implementation).
**Problem:** neither is imported anywhere — `grep -rn "test-auth\|mock-auth"` matches only docs/archive and `_bmad-output` history. Live test auth is `ALLOW_TEST_AUTH` (`src/index.ts:161`). Because `test-auth.js:5` requires `supertest`, removing the helper also removes `supertest` and `@types/supertest` (`package.json:36,49`); with the helper gone, both dependencies have zero references.
**Fix:** delete both helpers and the two dependencies in the same batch, after confirming via `npm ls supertest` that no other file requires it.
**If we skip it:** two authentication bypass paths exist in the tree; one is unmaintained and untested, and a future reader may treat it as live.

### [S9] Unused/contradictory tooling declarations: `pnpm`, `jest-environment-miniflare`, Node version
**What this is:** `pnpm` is installed as a devDependency (`package.json:47`), `jest-environment-miniflare` is installed but never selected (`package.json:45`), and the README contradicts the engine constraint.
**Problem:** there is no `pnpm-lock.yaml`; CI runs `npm ci` (`.github/workflows/lint.yml:28`); `README.md:73` still recommends pnpm, so a contributor following it produces an unreproducible install. `README.md:72` says "Node.js 20+" while `package.json:6` requires `>=22.0.0`. Both Jest configs set `"testEnvironment": "node"`, so `jest-environment-miniflare` is dead weight.
**Fix:** drop the `pnpm` devDependency and the README recommendation (or add a `pnpm-lock.yaml` and switch CI), drop `jest-environment-miniflare`, and change `README.md:72` to "Node.js 22+".
**If we skip it:** `npm ci` keeps installing a package manager as a dependency, and onboarding follows instructions the project does not support.

### [S10] 45 MB of build-only map sources are tracked despite a "local-only" policy
**What this is:** `public/img/map/8K_Middle_Earth_by_Kerem_Yurtseven.webp` (24,235,814 B) and `public/img/map/ctd58g7fsmyf1.webp` (20,892,410 B).
**Problem:** `.gitignore:197-198` labels these exact sources "Local-only high-res map sources" but only ignores the `.png`/`.jpeg` variants, so the `.webp` versions were committed. The 8K file has zero references anywhere (`grep -rn "8K_Middle"` matches only the `.gitignore` line). `ctd58g7fsmyf1.webp` is referenced only by `scripts/tile-map-image.js:8` and `public/img/map/tiles/metadata.json:2`; the runtime loads the already-committed tiles under `public/img/map/tiles/`.
**Fix:** `git rm --cached` both `.webp` sources, extend `.gitignore` to `/public/img/map/*.webp` (the goal images live elsewhere), and keep the files locally for re-tiling. If they must stay shared, move them to LFS.
**If we skip it:** every clone pays 45 MB for files that only a manual tiling run needs, and the policy comment stays false.

### [S11] `src/admin-handlers.ts` — 1,605-line module holding users, metrics, goals, storylines, and images
**What this is:** 24 exported handlers plus helpers in one file.
**Problem:** the file mixes five admin domains: users `:158-542`, metrics `:542-710`, goals `:710-1118`, storylines `:1118-1488`, image inventory `:1488-1585`. Any admin change edits a 57 KB file and reruns `tests/api/admin-handlers.test.ts` (3,955 lines). The expected seams are already visible as comment-free function clusters.
**Fix:** split into `admin-users-handlers.ts`, `admin-metrics-handlers.ts`, `admin-goals-handlers.ts`, `admin-storylines-handlers.ts`; keep `src/admin-handlers.ts` as a re-export barrel so `index.ts` and the test imports do not move in the same batch.
**If we skip it:** review cost and merge-conflict surface keep growing with every admin feature.

### [S12] `safeJsonParse` and `isValidMethod` are production-dead, test-only helpers
**What this is:** two exports in `src/validators.ts` (`:47` and `:68`) with no production caller.
**Problem:** `grep -rn` across `src/` finds zero uses of either; only `tests/api/validators.test.ts:144-160` exercises `isValidMethod`. Hono owns method routing now, so the hardcoded path/method table in `isValidMethod` describes checks that do not happen; `tests/api/validators.test.ts:5` imports both and asserts behaviour no request path reaches.
**Fix:** delete both functions and their test blocks (they are `@scaffold`-like behaviour for a removed router), or wire them into the request path if the check is still wanted.
**If we skip it:** the suite reports coverage for validation logic that cannot run, which hides missing real validation.

### [S13] `canReadFriendEntry` — dead authorization helper, 0 calls, 0 coverage
**What this is:** a 17-line friend-journal access rule (`src/journal-helpers.ts:404`) that checks friendship, preview preference, and goal reach.
**Problem:** zero callers (`grep -rn "canReadFriendEntry"` matches only the definition) and Istanbul reports `FNDA:0`. The live rule is implemented inline in `src/journal-handlers.ts:105-137` via `getAcceptedFriendIds` + `computeJournalPermissions`. Leaving a plausible-looking auth helper in the module invites the assumption that it gates reads.
**Fix:** delete it; the live rules are already covered by the journal handler tests.
**If we skip it:** a future change may "fix" this helper thinking it is the gate, while the real gate stays elsewhere.

### [N1] Two unreferenced screenshots (1.87 MB)
**What this is:** `screenshots/login-view.png` (26 KB) and `screenshots/map-overview.png` (1.84 MB).
**Problem:** `README.md` references only `map-hero.png`, `journey-view.png`, `goal-modal-view.png`, `fellowships-view.png`, and `friends-view.png`; the other two are in no doc or page.
**Fix:** delete them, or add them where they belong; compress `map-overview.png` if kept.
**If we skip it:** the repo carries 1.87 MB of stale UI captures that no longer match the product.

### [N2] One-off scripts and dead helper exports left in the tree
**What this is:** `scripts/convert-map-images.js` (PNG/JPEG→WebP one-off), `public/img/rename_script.sh` and `public/img/rename_script_fixed.sh` (unquoted-array bug and its fixed twin), `.vscode/run-mcp.sh` (no refs; `.vscode/mcp.json` has an empty `servers` map), `tests/api/generate-reports.js` (no refs), and three unused exports in `tests/ui/helpers/common.js:301,304,309` (`seedAuthenticatedSession`, `waitForTotalDistanceLoaded`, `waitForIsland`).
**Problem:** none has an inbound reference. The two rename scripts sit side by side with no indication which one works; the broken one is the obvious filename. `generate-reports.js` is a 300-line CLI nothing invokes.
**Fix:** delete all of them, or move one-off migration tools into a dated `scripts/one-off/` with a header saying so.
**If we skip it:** contributors keep guessing which script is current, and dead helpers get imported into new specs by autocomplete.

### [N3] `client/package-lock.json` is an empty lockfile
**What this is:** a tracked lockfile containing `{"name": "client", "packages": {}}`; `client/package.json` only sets `"type": "module"`.
**Problem:** `npm ci` inside `client/` cannot work against this lock, and tooling that auto-detects the nearest lockfile may pick it instead of the root one. It records no dependency graph.
**Fix:** delete `client/package-lock.json`; if client-local dependencies are ever added, generate a real lock then.
**If we skip it:** false signal that `client/` is an independently installable package.

### [N4] Stale pointers in editor settings and Copilot instructions
**What this is:** `.vscode/settings.json:3` pins `.github/workflows/pr-tests.yml`, which does not exist; `.github/copilot-instructions.md:26` tells agents to update `TESTING.md`, which exists only at `docs/archive/TESTING.md`.
**Problem:** following either instruction sends a contributor or agent to a missing file; the pinned-workflow setting silently does nothing.
**Fix:** point the setting at `.github/workflows/test-backend.yml` (or remove the pin) and change the instruction to `docs/` (the archive is explicitly historical).
**If we skip it:** new agents imitate a broken documentation convention.

### [N5] `docs/project-scan-report.json` — stale version inventory
**What this is:** a March 2026 project scan artifact (`docs/project-scan-report.json:34`).
**Problem:** it declares TypeScript 5.9.3, wrangler 4.73.0, Preact 10.29.0, Jest 30.3.0, Vitest 4.0.17, Playwright 1.58.2, pnpm 10.31.0. The repo actually has TypeScript 6.0.3, wrangler 4.151.0, Preact 11.0.1, Vitest 5.0.5, pnpm 12.14.0. It is not linked from `docs/index.md`, so it only misleads agents that find it by filename.
**Fix:** delete it (the live docs supersede it) or regenerate and link it from `docs/index.md`.
**If we skip it:** agents read a version inventory that is a year of dependency bumps out of date.

### [N6] Duplicate E2E and renderer tests
**What this is:** `tests/ui/fellowship-comprehensive.spec.js` (1,147 lines, 30 tests) and `tests/ui/fellowship-functional.spec.js` (358 lines, 17 tests) cover the same list/detail/invite/leave/manage flows; the seven `tests/api/renderAdmin*Page.test.ts` files assert the same shell structure.
**Problem:** jscpd finds four cross-file clones between the fellowship specs; the functional spec's cases are a subset of the comprehensive one. The render tests repeat the same five "valid HTML / title / css / body class / header" assertions seven times with one string changed (`tests/api/renderAdminGoalAddPage.test.ts:10-31` vs `renderAdminGoalEditPage.test.ts:10-31`).
**Fix:** keep one behavioural E2E per flow and delete the overlapping cases; after `renderAdminShell` lands, replace the seven files with one table-driven test.
**If we skip it:** two suites fail together on every UI regression, tripling triage time.

## Operational

These are owner/ops decisions, not code findings, and do not consume the 20-finding budget.

1. **Worktree `idea-sorting-and-repo-cleanup` is stale.** It is at `5052b98`, 12 commits behind `main`, clean, with 3 commits that add only `openspec/changes/profile-badge-display/plan.md` and `badge-image-prompts.md`. Its `node_modules` is from 2026-10-08. Rebase onto current `main` before continuing; nothing in it needs cleanup.
2. **Local install was refreshed during the audit.** The merged lockfile bumped dependencies (wrangler 4.139 → 4.151); `npm ci` was run so the baseline reflects the merged tree. No tracked file changed.
3. **Ignored clutter at repo root.** `test-results.log` (176 KB), `dist/` (Nov 2025 build), `coverage/`, `playwright-report/`, `test-results/`, `.playwright-mcp/` — all ignored; safe to delete, none tracked.
4. **`.dev.vars` holds VAPID keys.** Verified never committed (`git log -- .dev.vars` empty) and ignored at `.gitignore:206`. Keep it that way; rotate if the file was ever shared.
5. **11 open OpenSpec changes, 0 of 263 tasks complete.** `openspec/changes/*` includes planned-but-unstarted work (community campaigns, field guide, personal challenges, storyline books, profile badge). Decide which are still wanted and archive the rest; the worktree branch is one of them.
6. **Migrations `0052`–`0057` share numbers in pairs.** This is intentional (two image updates per number) and D1 orders by full filename, so no action — noted so it is not "fixed" later.
7. **`docs/archive/` (15 files, 2,177 lines).** Intentional per `docs/AGENTS.md:6`; not debt.
8. **`_bmad-output/` (89 files, 22.5k lines).** Intentional planning output; not debt.

## Deferred inventory

Candidates below the ranked 20, with reason for not ranking:

| Candidate | Location | Why deferred |
|---|---|---|
| Dual island registry | `client/src/index.tsx:34,61` | Two maps (auto-hydrated vs programmatic) serve different callers; merging needs a product call |
| Oversized test files | `tests/api/admin-handlers.test.ts` (3,955), `auth-handlers.test.ts` (2,174) | Test-hygiene scope; not production code |
| jscpd same-file clones (39 in auth tests, 15 in admin tests) | `tests/api/*.test.ts` | Repeated fixture blocks; test-hygiene |
| `resize-webp.js` knip hit | `.github/skills/goal-image-generation/resources/resize-webp.js` | Documented manual step at `SKILL.md:228` — false positive |
| `optimize-avatars.js` knip hit | `scripts/optimize-avatars.js` | Documented manual pipeline at `docs/asset-workflow.md:26` |
| Islands/public JS flagged unused | `client/src/islands/*`, `public/js/*.js` | Loaded dynamically via `data-island` (`src/map-handlers.ts:15`) and `<script src>` (`src/renderHtml.ts:21-24`) — false positives |
| `sendEmail`, `GOAL_CONTENT_TYPES`, `areAcceptedFriends`, `getGoalStorylineDistance`, `DEFAULT_STORYLINE_SLUG` | `src/email-utils.ts:52`, `src/goal-content-helpers.ts:8`, `src/journal-helpers.ts:125`, `:163`, `src/storyline-utils.ts:3` | Knip reports exports unused externally but they are used inside their modules |
| `@preact/preset-vite` knip hit | `client/vite.config.ts:2` | Used by the client Vite build; knip does not parse the nested config |
| 11 unstarted OpenSpec changes | `openspec/changes/*` | Planning artifacts, see Operational #5 |
| `docs/archive/*` | 15 files | Intentional archive |
| `_bmad-output/*` | 89 files | Intentional planning output |
| `public/img/one-ring.png` | 16 KB | Referenced through the `one-ring` avatar slug (`src/avatar-slugs.ts:55`) |
| Test-only assertion of `eslint` config | `tests/lint/eslint-config.test.js` | Structural test of tooling, not product behaviour; test-hygiene |

## Not checked

- `node_modules/` — vendored third-party packages (441 entries); content not reviewed.
- `.agent/skills/`, `.agents/skills/`, `.github/skills/` inner content beyond duplicate/drift comparison — vendored BMAD, caveman, and OpenSpec packs.
- `_bmad/` internals beyond duplicate detection — vendored framework. `scripts/`, `custom/`, `_config/`, and `core/tasks` are live; `core/skills` is the finding above.
- `public/img/**` binary content — data, not code; only reachability and duplicate hashes were checked (no byte-identical duplicates found).
- `worker-configuration.d.ts` body — generated by Wrangler; only freshness was checked.
- `public/js/client/`, `dist/`, `coverage/`, `playwright-report/`, `test-results/`, `.playwright-mcp/`, `.venv/`, `.wrangler/`, `raw_assets/` — ignored build output or local state.
- SQL migration semantics and live D1 state — DB behaviour is out of scope.
- Playwright E2E execution — requires browser install and local D1 seeding; CI covers it.

## Measured

| Gate | Command | Result |
|---|---|---|
| HEAD | `git rev-parse HEAD` | `d38e8e2dc3c058d949baad19965546f3137cc54a` |
| Dirty files | `git status --porcelain \| wc -l` | 0 before, 0 after (report file is the only new untracked artifact) |
| Typecheck | `npx tsc --noEmit` | **exit 2**, 4 errors (pre-existing, reproduced after clean `npm ci`) |
| Lint | `npm run lint` | 0 errors, 16 warnings |
| Jest | `npm test` | 49/49 suites, 1,378/1,378 tests pass |
| Vitest | `npm run test:client` | 52 files, 818/818 tests pass |
| Legacy Jest | `npm run test:legacy:coverage` | 6 suites, 138/138 tests pass |
| Asset budget | `npm run check:assets` | pass (936 img, 15 css, 9 js) |
| Generated types | `npx wrangler types --check` | **fail** — out of date |
| Dead code | `npx knip` | 26 unused files (mostly dynamic false positives), 8 unused exports, 12 unused types, 5 unused devDeps (3 real) |
| Duplication | `npx jscpd …` | 303 clones, 7.53% duplicated lines; cross-file hits listed above |

No `apply` batch ran, so there is no before/after diff to report.

---
*Report persisted at `reports/2026-10-21-lean-audit.md` (untracked until the cleanup branch is created).*
