# Tasks

## 1. Drawer layering fix

- [x] 1.1 Add `body.drawer-open header { z-index: 900; }` to `public/css/drawer.css` with a comment explaining that the drawer mounts inside the header stacking context (`public/css/main.css:96`) and must stay below app-level modals at 1000. Verify by grepping the rule and rebuilding the client styles (`npm run build:client`) without errors.
- [x] 1.2 Add the layer-scale comment block to `public/css/drawer.css` (page overlays ≤200, navigation 900, app modals 1000, PWA banner 9999, progress modal 11000). Verify the documented values match the z-index values currently declared in `public/css/*.css` and `client/src/components/map/WaypointPopup.css`.

## 2. Regression coverage

- [x] 2.1 Add a Playwright test in `tests/ui/map-shell.spec.js` that creates a fellowship via `POST /api/party` (reuse the fixture pattern from `tests/ui/fellowship-comprehensive.spec.js`), opens `/map`, switches the social panel to that fellowship, and waits for `.map-legend`. Verify the test fails on the pre-fix CSS by temporarily removing the rule in 1.1.
- [x] 2.2 In the same test, open the drawer and assert `document.elementFromPoint` at a point inside the party legend (measured from `getBoundingClientRect`, not hard-coded) does not resolve to an element inside `.map-legend`. Verify the assertion passes with the fix applied.
- [x] 2.3 Extend the same test (or add a sibling in `tests/ui/map-shell.spec.js`) to open `#map-calendar-sheet`, open the drawer, and assert `document.elementFromPoint` over the sheet resolves to the drawer or `.drawer-backdrop`. Verify with `npx playwright test tests/ui/map-shell.spec.js --project=chromium`.

## 3. Integration check

- [x] 3.1 Run `npm run test:client` and `npx playwright test tests/ui/map-shell.spec.js --project=chromium` and confirm the drawer still opens, closes via backdrop and Escape, and navigates. Record the results in the change.
- [x] 3.2 Run `npm run lint` and `npm run build:client` and confirm no lint or build errors.

## Verification record

Date: 2026-11-03 · Branch: `fix/navigation-drawer-layering` · Project: chromium (desktop)

| Command | Result |
|---|---|
| `npm run build:client` | ✓ built in 274 ms (pre-existing >500 kB chunk-size warning only) |
| `npm run test:client` | ✓ 57 files, 873 tests passed |
| `npm run lint` | ✓ 0 errors (16 pre-existing legacy warnings) |
| `npx playwright test tests/ui/map-shell.spec.js --project=chromium` | ✓ 6 passed (9.6 s), incl. the new layering test and drawer open/close/backdrop/Escape/navigation tests |
| `npx playwright test tests/ui/journal.spec.js --project=chromium --list` | ✓ 10 tests collected (file loads after helper dedup) |
| `npx playwright test tests/ui/fellowship-comprehensive.spec.js --project=chromium --list` | ✓ 54 tests collected (file loads after helper dedup) |
| Mutation check (`-g "paints above"`) | Killed: rule commented out → `Error: party legend painted above the open drawer at (16, 611); top element was div.map-legend` (`hitTarget` assertion, map-shell.spec.js:236); rule restored → 1 passed |

One earlier full run (before the Playwright-managed web server was in place) failed only in fixture teardown: the reused dev server flapped and `cleanupAllTestData` got a `ECONNRESET` after 3 retries (`tests/ui/helpers/cleanup.js:34`). A re-run against the Playwright-managed web server passed all 6 tests; unrelated to the change under fix.

## Workflow follow-up

- Archive the change after review and verification pass.
