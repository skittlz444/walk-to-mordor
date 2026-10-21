# Cleanup log — lean audit 2026-10-21

**Branch:** `chore/repo-cleanup-2026-10-21`, based on updated `main` (`d38e8e2`).
**Reports:** `reports/2026-10-21-lean-audit.md` (audit findings) and this log (what was applied).
**Scope applied:** all 20 audit findings, plus a full test-hygiene pass. Nothing merged; branch is local.

## Applied by finding

| ID | Finding | Commit |
|---|---|---|
| M1 | Typecheck red: `RESEND_API_KEY` typed via `src/env.d.ts`; `tsc` added to CI | `1679b2d` |
| S2 | Deleted dead `.agent/` duplicate (217 files) | `3041306` |
| S3 | `opsx-*` skills reduced to pointers at `openspec-*` | `a2b8fe3` |
| S4 | Deleted orphaned `_bmad/core/skills` (53 files) | `181bf1e` |
| S5 | Regenerated `worker-configuration.d.ts`; freshness gate in CI | `3fdd162`, `238735d` |
| S6 | Extracted `renderAdminShell`; 7 pages reduced to options | `15d36ed` |
| S7 | Client validators generated from `src/validators.ts` + `src/validators-client.ts` via esbuild | `2cd3f4c` |
| S8 | Deleted dead `test-auth.js` / `mock-auth.ts`; dropped supertest deps | `5af8726` |
| S9 | Dropped `pnpm` + `jest-environment-miniflare`; README Node 22+ | `d7a6ce4` |
| S10 | Untracked 45 MB local-only map sources; gitignore covers them | `cebb90d` |
| S11 | Split `admin-handlers.ts` into users/metrics/goals/storylines + barrel | `85815d3`, `dd65622` |
| S12 | Removed test-only `safeJsonParse` / `isValidMethod` | `582d024` |
| S13 | Removed dead `canReadFriendEntry` (and its newly-orphaned `areAcceptedFriends`) | `5b72895`, `dd65622` |
| N1 | Deleted 2 unreferenced screenshots | `66c6cee` |
| N2 | Deleted one-off scripts and unused E2E helper exports | `b51d92c` |
| N3 | Deleted empty `client/package-lock.json` | `4e9bf03` |
| N4 | Fixed stale editor pin and `TESTING.md` pointer | `4d5f446` |
| N5 | Deleted stale `docs/project-scan-report.json` | `57f33a7` |
| N6 | Replaced 5 duplicated admin page suites with one table-driven suite; deleted the duplicated fellowship E2E spec and pruned 19 non-failing/duplicate E2E cases | `7e0fd6e`, `dd65622`, `bda951d` |

## Test-hygiene pass (second wave)

A full test-hygiene audit classified 119 files / 2,327 static test declarations and ranked 20 findings. Applied:

| Area | Change | Result |
|---|---|---|
| Playwright | Deleted `fellowship-functional` (16 duplicate tests) after porting its 2 unique assertions; deleted API-only `admin` (11) and `goal-content` (11) after porting 403-JSON and `has_content` to Jest; deleted `progress` (3) whose helpers could not fail | 260 → 202 tests (2 new edit/delete tests) |
| Playwright | Made conditional no-ops unconditional (fellowship join/kick/selector/activity), removed map-popup/map-canvas structural pins, merged goals popup tests, tightened profile/navigation/system, restored map-popup desktop viewport for the Mobile Chrome project | 18 specs, 0 skipped |
| Jest | Deleted `db.test.ts` (pass-through), `dev-pipeline.test.js` (package.json substrings), `eslint-config.test.js` (config severities + fixture writes) | −34 tests |
| Jest | Removed 57 router call-graph pins (now body assertions), SQL-text pins, SW constant pins, formatter snapshots; SSR page suites table-driven; added an admin-guard matrix over all 23 routes and body assertions for every API route | 1,316 → 1,302 tests, 43 suites |
| Vitest | Removed CSS/class/colour pins from GoalModal, Avatar, MapLegend, MapWalkButton, Next/UpcomingGoalCard; table-driven PWA UA matrix and push cooldown | 818 → 787 tests, 52 files |
| Fixture safety | `generate-image-manifest.test.ts` now runs the generator in a temp sandbox; it no longer rewrites `public/img/image-manifest.json` or renames `public/img/highres` (previously crashed a running dev server) | repo untouched by tests |

## Deliberately not applied

- **S1 (`achievement-utils`)**: user decision — UI is planned soon, so the module, its tests, and the two migrations stay.
- **History rewrite**: the two 45 MB map blobs were removed from `HEAD` only. They remain in git history (`.git` ~429 MB). A `git filter-repo` rewrite is a separate, explicit decision.
- **Test-helper extraction**: `waitForMapReady` (4 copies), `navigateToProfile` (2), and the chainable D1 mock (7 API files) remain duplicated. Refactor-only follow-up; the behavioral dedupe is done.
- **Full browser matrix**: Chromium passes 202/202; `map-popup` passes under the Mobile Chrome project. Firefox and Mobile Firefox projects were not run in full (the default `npm run test:ui` is chromium-only).
- **Legacy Jest double-run**: `jest.config.legacy.json` still re-collects `tests/**/*.test.js`; it provides `public/js/**` coverage but duplicates a few suites.
- **Remaining SQL pin**: `tests/api/goal-content-handlers.test.ts:136` still asserts `ORDER BY sort_order ASC, id ASC`.

## Review gates

Two review rounds ran, each with lean-review (diff), test-hygiene (diff), and an independent reviewer. All findings were fixed in the follow-up commits:

**Round 1 — implementation cleanup**
- **Blocker (fixed):** the `wrangler types --check` gate depended on the local gitignored `.dev.vars` and would have failed on every clean CI checkout. Fixed by declaring `VAPID_*` in `wrangler.json` `secrets.required`, `ALLOW_TEST_AUTH` as a `"false"` var (only `'true'` enables test auth — `src/auth-handlers.ts:259`), and generating with `--strict-vars=false`. Verified `--check` passes both with and without `.dev.vars`.
- **Test gaps (fixed):** breadcrumb assertions were document-wide; per-page meta descriptions, icon `aria-hidden` sweep, and shell asset assertions were lost; users/metrics pages were untested. Restored, and added `tests/api/validators-client.test.ts`.
- **Stragglers (fixed):** orphaned `areAcceptedFriends`, stale `safeJsonParse` mock, JSDoc blocks misattached by the mechanical split, duplicated admin types moved to their domains, stale `tile:map`/validators docs.

**Round 2 — test-hygiene pass**
- **Fixed:** restored per-route dispatch assertions (32 routes), added a 23-route admin-guard matrix (46 tests), ported `has_content` and 403 JSON content-type, made the kick/empty-name/activity assertions unconditional, restored UI edit/delete E2E, restored `renderHtml` script/CSS dependencies, fixed the manifest test to compare exact slugs and stop mutating the repo, fixed `MapLegend` null contract, restored 404 URL and strikethrough assertions, and fixed map-popup for the Mobile Chrome project.
- **Accepted:** the generated `window.validators` browser API has no in-repo caller but remains a tested, freshness-checked legacy surface.

## Final measured gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | pass |
| `npm run lint` | 0 errors, 16 legacy warnings |
| `npm test` | 43/43 suites, 1,302/1,302 tests (coverage 88.7% stmts / 81.9% branch) |
| `npm run test:client` | 52 files, 787/787 tests |
| `npm run test:legacy:coverage` | 4 suites, 104/104 tests |
| `npx playwright test --project=chromium` | 202/202 pass, 0 skipped |
| `npx playwright test tests/ui/map-popup.spec.js --project="Mobile Chrome"` | 11/11 pass |
| `npm run check:assets` | pass |
| `npx wrangler types --check --strict-vars=false` | pass (with and without `.dev.vars`) |
| `npm run check:validators` | pass |
| `npm ci --dry-run` | pass |
| `npm run build:client` | pass (prebuild generates validators) |

Diff: implementation cleanup 338 files, +4,476 / −41,330 (288 deletions are duplicated skill files, generated types, and removed assets). Test-hygiene pass: 44 files, +826 / −3,040 lines, net −103 tests (E2E 260→202, Jest 1,316→1,302, Vitest 818→787) while adding the missing behavioral assertions.
