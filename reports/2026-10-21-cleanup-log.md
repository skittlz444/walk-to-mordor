# Cleanup log — lean audit 2026-10-21

**Branch:** `chore/repo-cleanup-2026-10-21`, based on updated `main` (`d38e8e2`).
**Report:** `reports/2026-10-21-lean-audit.md` (audit findings and evidence).
**Scope applied:** 18 of 20 findings. Nothing merged; branch is local.

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
| S11 | Split `admin-handlers.ts` into users/metrics/goals/storylines + barrel | `85815d3`, plus type/JSDoc cleanup `dd65622` |
| S12 | Removed test-only `safeJsonParse` / `isValidMethod` | `582d024` |
| S13 | Removed dead `canReadFriendEntry` (and its newly-orphaned `areAcceptedFriends`) | `5b72895`, `dd65622` |
| N1 | Deleted 2 unreferenced screenshots | `66c6cee` |
| N2 | Deleted one-off scripts and unused E2E helper exports | `b51d92c` |
| N3 | Deleted empty `client/package-lock.json` | `4e9bf03` |
| N4 | Fixed stale editor pin and `TESTING.md` pointer | `4d5f446` |
| N5 | Deleted stale `docs/project-scan-report.json` | `57f33a7` |
| N6 | Replaced 5 duplicated admin page test suites with one table-driven suite (see deferred) | `7e0fd6e`, `dd65622` |

## Deliberately not applied

- **S1 (`achievement-utils`)**: user decision — UI is planned soon, so the module, its tests, and the two migrations stay. Re-evaluate when the UI lands.
- **N6 E2E half**: the fellowship `comprehensive`/`functional` Playwright overlap was not deleted. Removing cases without running the browser suite could silently drop coverage; it needs a Playwright run (`npm run test:ui`) before pruning.
- **History rewrite**: the two 45 MB map blobs were removed from `HEAD` only. They remain in git history (`.git` ~429 MB). A `git filter-repo` rewrite is a separate, explicit decision.

## Review gates

Three independent read-only reviews ran against `d38e8e2...HEAD` (lean-review diff, test-hygiene diff, reviewer). All three found the same blocker and coverage gaps; fixed in the last two commits:

- **Blocker (fixed):** the `wrangler types --check` gate depended on the local gitignored `.dev.vars` and would have failed on every clean CI checkout. Fixed by declaring `VAPID_*` in `wrangler.json` `secrets.required`, `ALLOW_TEST_AUTH` as a `"false"` var (only `'true'` enables test auth — `src/auth-handlers.ts:259`), and generating with `--strict-vars=false`. Verified `--check` passes both with and without `.dev.vars`.
- **Test gaps (fixed):** breadcrumb assertions were document-wide (could pass on nav text); per-page meta descriptions, icon `aria-hidden` sweep, and shell asset assertions were lost; users/metrics pages were untested. Restored in the table-driven suite and added `tests/api/validators-client.test.ts`.
- **Stragglers (fixed):** orphaned `areAcceptedFriends`, stale `safeJsonParse` mock, JSDoc blocks misattached by the mechanical split, duplicated admin types moved to their domains, stale `tile:map`/validators docs.

Remaining accepted trade-off: the generated `window.validators` API has no in-repo caller, but it is a legacy browser surface loaded by `src/renderHtml.ts`; it is now tested and freshness-checked rather than hand-maintained.

## Final measured gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | pass |
| `npm run lint` | 0 errors, 16 legacy warnings |
| `npm test` | 46/46 suites, 1,316/1,316 tests |
| `npm run test:client` | 52 files, 818/818 tests |
| `npm run test:legacy:coverage` | 6 suites, 138/138 tests |
| `npm run check:assets` | pass |
| `npx wrangler types --check --strict-vars=false` | pass (with and without `.dev.vars`) |
| `npm run check:validators` | pass |
| `npm ci --dry-run` | pass |
| `npm run build:client` | pass (prebuild generates validators) |

Diff: 338 files, +4,476 / −41,330 (288 deletions are duplicated skill files, generated types, and removed assets).
