# Tasks

## 1. Deterministic asset manifest tooling

- [x] 1.1 Add `scripts/lib/asset-manifest.js` with SHA-256 hashing (12 lowercase hex), byte-wise key sorting, path normalization, and hard failures when a required input is missing. Verify with a small fixture: two runs produce identical output, and a missing input exits non-zero.
- [x] 1.2 Add `scripts/generate-asset-versions.js` to write `src/generated/asset-versions.ts` (entry assets only) and `public/img/image-versions.json` (images only, excluding `/img/map/tiles/**`), with `--check`. Verify a clean run passes `--check`, and changing one image makes `--check` fail for that image only.
- [x] 1.3 Add `scripts/templates/sw.js` and `scripts/generate-sw.js` to inject versioned precache URLs plus deterministic `CACHE_NAME` and `SWR_CACHE_VERSION`, with `--check`. Verify generated `public/sw.js` contains no `{{...}}` placeholders and `--check` fails when the template or maps change.
- [x] 1.4 Add `scripts/check-asset-refs.js` to reject raw `/img`, `/js`, `/css`, and `/icons` literals in `client/src` and direct server image references, with an allowlist for helpers, generated files, tests, layout configuration paths, and fetches of generated artifacts such as `/img/image-manifest.json` in `src/admin-goals-handlers.ts`. Verify a deliberate hardcoded image URL fails with `file:line`, and the cleaned tree passes.
- [x] 1.5 Make `scripts/generate-image-manifest.js` deterministic: remove the `generated` timestamp, sort byte-wise, and add `--check`. Verify two runs produce byte-identical `public/img/image-manifest.json` and `--check` passes.
- [x] 1.6 Wire `package.json` scripts in the required order (`build:client`, then `generate:assets`, `generate:sw`, `generate:image-manifest`) and add the corresponding check scripts. Verify the full sequence from a clean `public/js/client/` creates the expected files and `git status` shows only generated artifacts under version control.
- [x] 1.7 Commit the generated server map, runtime image map, generated `public/sw.js`, and deterministic image manifest; keep `public/js/client/` gitignored. Verify a fresh checkout can run `npx tsc --noEmit` with the committed server map, and a stale map fails the drift check.
- [x] 1.8 Document the generated artifacts and build order in `docs/asset-workflow.md`. Verify every documented command matches `package.json`.
- [x] 1.9 Extend `check:assets:versions` to recompute the map tile-set hash from `metadata.json` and the tile bytes and fail when `metadata.json.version` is stale. Verify a tile-byte change without a metadata update fails, and a clean tree passes.

## 2. Server-side entry asset resolution

- [x] 2.1 Add `src/asset-url.ts` that appends `?v=<hash>` for known entry assets, preserves existing query strings, and returns the input unchanged for unknown paths. Verify with Jest tests for clean paths, existing queries, and unknown assets.
- [x] 2.2 Update `src/renderLayout.ts` to resolve `config.stylesheets`, `config.scripts`, the islands bundle/CSS, icons, and `manifest.json` through the helper. Verify a Jest render test asserts versioned URLs and the existing stylesheet order.
- [x] 2.3 Update `src/renderAuthPage.ts` and `src/renderPasswordResetPage.ts` to resolve their standalone stylesheet, icon, manifest, and client-bundle URLs. Verify render tests assert `?v=` on each.
- [x] 2.4 Correct the push notification icon path in `src/scheduled-handlers.ts` to `/icons/icon-192x192.png` and route it through the helper. Verify the push payload test sees the corrected, versioned URL.
- [x] 2.5 Add the server asset rule to `docs/asset-workflow.md` and verify `npm run check:assets:refs` passes after the server changes.

## 3. Client-side image resolution

- [x] 3.1 Add `client/src/utils/assetUrl.ts` with a synchronous resolver, a `loadAssetVersions()` loader using a bounded timeout, and a localStorage fallback. Verify Vitest tests for success, timeout, cached fallback, and unversioned fallback.
- [x] 3.2 Wire `loadAssetVersions()` into `client/src/index.tsx` in parallel with `initializeAppStore()` so a slow map fetch does not block island hydration. Verify a Vitest bootstrap test covers success and timeout paths.
- [x] 3.3 Replace raw `/img/...` construction in client islands and components (goals, badges, campaigns, encounters, avatars, map waypoints, admin image browser) with the client resolver. Verify `npm run check:assets:refs` and the affected Vitest suites pass.
- [x] 3.4 Add one `version` to `public/img/map/tiles/metadata.json` in `scripts/tile-map-image.js` and append it in `client/src/islands/MapIsland.tsx` to metadata and tile URLs. Verify a Vitest test covers the tile URL and metadata fallback.
- [x] 3.5 Update all client tests that assert exact unversioned `src` values — badges, encounters, events, avatars, map markers, and profile settings — to resolve through the helper or assert the logical path. This includes at least `BadgeDisplayIsland.test.tsx`, `BadgeAwardModal.test.tsx`, `EncounterPopupIsland.test.tsx`, `EventsIsland.test.tsx`, `ProfileSettingsIsland.test.tsx`, `UserMarker.test.ts`, and `Avatar.test.tsx`. Verify the client Vitest suite passes.
- [x] 3.6 Add the client image rule to `docs/frontend-guide.md` and verify the documented command sequence runs as written.

## 4. CSS independent versioning

- [x] 4.1 Remove the `@import` lines from `public/css/main.css` and add the base stylesheet list to `src/renderLayout.ts` in the order `calendar`, `progress`, `goals`, `profile`, `palantir`, `wrapped`, then `main`, `drawer`, `badge-award`. Verify a Jest test asserts the emitted link order.
- [x] 4.2 Verify the auth and password-reset pages still render correctly with `main.css` and their page-specific CSS, without the six domain stylesheets. Verify with the existing Playwright auth smoke tests.
- [x] 4.3 Verify the journey, map, profile, party, and events pages visually at desktop and mobile widths after the cascade change. Verify with Playwright screenshots or the existing UI smoke suite.

## 5. Service worker, dev, and test workflow

- [ ] 5.1 Add the network-first runtime cache for `/img/image-versions.json` and `/img/map/tiles/metadata.json` to the SW template, and set the precache list to `main.css`, `main.js`, `islands.js`, `islands.css`, and `manifest.json`, dropping the non-existent mobiscroll CSS/JS entries that currently make `cache.addAll` fail. Keep cache-first for versioned static assets. Verify the generated SW contains both JSON paths, the cache fallback branch, and no missing precache entries.
- [ ] 5.2 Update `package.json` `dev`, `test:ui`, and `test:ui:headed`; remove the `build:sw`/`build:sw:reset` scripts and delete `public/js/update-cache-version.js` and `public/js/reset-cache-version.js`. Verify `npm run dev` starts and `npm run test:ui` completes without module-not-found errors.
- [ ] 5.3 Add a service-worker test that asserts the exact precache list (`main.css`, `main.js`, `islands.js`, `islands.css`, `manifest.json`), that every precache URL is versioned and exists under `public/`, that `SWR_CACHE_VERSION` is filled, and that the two JSON paths are network-first. Verify the test fails if a placeholder, missing file, or unversioned precache entry is reintroduced.
- [ ] 5.4 Add an offline test: load a page, confirm the service worker is active, fetch a versioned asset and the runtime image map with the network disabled, and assert both resolve from cache. Document the existing HTML-navigation limitation in the test comment.
- [ ] 5.5 Document the SW caching rules, the offline exceptions, and the new dev/test workflow in `docs/architecture.md` or `docs/asset-workflow.md`. Verify the documented commands match the scripts.
- [ ] 5.6 Prune cached `/img/` entries outside `/img/map/tiles/**` that are not referenced by the current runtime image map on activate and after a successful map refresh, skipping pruning when the map is unavailable offline. Verify an image-only version change removes the old entry and keeps the new one.

## 6. CI enforcement

- [ ] 6.1 Add `check:assets:versions` (including the tile-set version check), `check:assets:refs`, `check:service-worker`, and `check:image-manifest` to `package.json`. Verify each passes on a clean tree and each fails on a deliberate corresponding drift or raw URL.
- [ ] 6.2 Update `.github/workflows/lint.yml` to run `npm run build:client` before the asset-version and service-worker checks, then run all four checks. Verify the command sequence locally from a clean checkout.
- [ ] 6.3 Update `docs/asset-workflow.md` with the CI checks, the raw-URL rule, and the “regenerate and commit maps” workflow. Verify the documented commands match the workflow file.
- [ ] 6.4 Run `npm run lint`, `npx tsc --noEmit`, `npm run check:validators`, `npm run check:assets`, and the four new checks. Verify all pass.

## 7. Integration verification

- [ ] 7.1 Run `npm run build` twice and diff the generated artifacts. Verify the entry map, runtime image map, `public/sw.js`, and image manifest are byte-identical.
- [ ] 7.2 Change one image only, rebuild, and verify only that image’s URL and the runtime image map change; `islands.js` and the server entry map must stay unchanged. Restore the original image afterward.
- [ ] 7.3 Change one legacy JS or CSS file only, rebuild, and verify only that file’s URL and the entry map change. Restore the original file afterward.
- [ ] 7.4 Simulate an old service worker cache entry, request the same asset with a new version query, and verify the request goes to the network and the new response is cached. Verify with a Playwright or Node test.
- [ ] 7.5 Verify offline behavior for a cached versioned stylesheet, the runtime image map, and map tile metadata. Verify with a Playwright offline test or the documented manual procedure.
- [ ] 7.6 Run the full Jest, Vitest, and Playwright suites. Verify all pass.
- [ ] 7.7 Run `npm run check` and `npm run check:assets`; verify the Worker dry-run succeeds and the asset count stays under the warning threshold.
- [ ] 7.8 Review the generated artifact diffs, the rendered HTML, and the docs for consistency. Verify no raw asset URLs remain outside the allowlist.
- [ ] 7.9 Change one map tile without updating metadata; verify `check:assets:versions` fails, then rerun `tile:map` and verify it passes.

## Workflow follow-up

- Archive the change after the project’s review and merge requirements are satisfied.
- Verify the archived change and the resulting main specs.
