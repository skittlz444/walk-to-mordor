# Proposal

## Why

Public assets are served under fixed, unversioned URLs, while the service worker serves static assets cache-first. After a deploy, an existing service worker can keep serving an old client bundle indefinitely, so users miss client-side features until they clear site data or the service worker updates. The current mitigation is a global build timestamp on the service-worker cache plus an in-place rewrite of the committed `public/sw.js`; it invalidates every asset on every build, is non-deterministic, and forces separate reset steps for dev and UI tests.

This surfaced in production as a user with recent walk activity never receiving the client-triggered Nazgûl encounter offer; a stale client bundle is the leading hypothesis. We need per-asset, deterministic cache busting so unchanged assets keep their URLs and changed assets get new ones automatically.

## What Changes

- Add deterministic content-hash query strings (`?v=<hash>`) to public asset URLs. The hash is the first 12 lowercase hex characters of SHA-256 over the file bytes. Unchanged files keep their URL; changed files get a new one.
- Generate two version maps at build time:
  - a **server entry map** for the client bundle, CSS, legacy JS, icons, and manifest, imported by the Worker;
  - a **runtime image map** for `/img/**`, fetched by the client at startup so image changes do not change the client bundle.
  - Exclude `/img/map/tiles/**` from the runtime image map; the map tile set uses one version from `metadata.json` for both metadata and tile URLs, and the build verifies that version against the tile bytes.
- Commit the generated server map, runtime image map, generated `public/sw.js`, and deterministic image manifest. Keep `public/js/client/` gitignored. CI builds the client, regenerates the artifacts, and fails on drift; generators hard-fail on missing inputs instead of writing an empty map.
- Add `assetUrl()` helpers for the Worker and the client. Resolve page `stylesheets`/`scripts` arrays centrally in `renderLayout`; the standalone auth and password-reset pages call the helper directly. The reference check rejects raw asset literals in client code and direct server image references, and exempts paths passed into the layout config.
- Add a service-worker runtime-cache rule for the runtime image map and tile metadata. Load the image map with a short timeout before hydration and fall back to the last cached copy or unversioned paths; a slow or failed fetch must not block island hydration.
- Replace the timestamp-based service-worker cache version with a deterministic cache name derived from the precached URL list and the service-worker template; generate `public/sw.js` with versioned precache URLs. The generator fills the API SWR cache version deterministically from the SWR endpoint list and template; the 5-minute TTL and background revalidation bound stale API payloads when the SWR surface does not change.
- Keep the service worker cache-first for static assets. Make only the runtime image map and map-tile metadata network-first with cache fallback.
- Make CSS files independently versionable by removing the `@import` cascade from `public/css/main.css` and listing the base stylesheets in the layout. Link `calendar.css`, `progress.css`, `goals.css`, `profile.css`, `palantir.css`, and `wrapped.css` before `main.css` to preserve the current cascade order.
- Add CI checks that regenerate the maps, generated service worker, and image manifest and fail on drift, plus a reference check that rejects raw `/img`, `/js`, `/css`, and `/icons` literals outside the helpers.
- Correct the push notification icon path to `/icons/icon-192x192.png` while routing it through `assetUrl()`.
- Retire `public/js/update-cache-version.js` and `public/js/reset-cache-version.js`; update `dev`, `test:ui`, and `test:ui:headed` so they no longer invoke the reset script.
- **BREAKING** for the internal asset-reference workflow, not for public URLs: existing unversioned URLs continue to resolve, but CI rejects new raw internal references; callers must use `assetUrl()`. API payloads continue to expose image slugs, not versioned URLs.
- No new runtime dependencies and no D1 migrations.

## Capabilities

### New Capabilities
- `asset-versioning`: deterministic content-hash URLs for public assets, manifest-based resolution on the server and client, service-worker cache behavior, and CI enforcement for generated maps and asset references.

### Modified Capabilities
- `profile-badge-display`: badge artwork URL scenarios permit a cache-busting version query while keeping the logical `/img/achievements/...` path and existing fallback behavior.
- `badge-award-modal`: full-artwork URL scenarios permit a cache-busting version query while keeping the logical `/img/achievements/full/...` path and existing fallback behavior.

## Impact

- **Build**: `package.json` build/dev/test scripts; new hashing and generation scripts; generated server map under `src/generated/`; generated `public/img/image-versions.json`; generated `public/sw.js`; deterministic `public/img/image-manifest.json`. CI's lint/build job must run `npm run build:client` before the drift checks. The dev watch loop may keep stale hashes; because the asset layer serves the stable path, fresh bytes still load, and production regeneration is enforced in the build and CI.
- **Server**: `src/renderLayout.ts` (central resolver), `src/renderAuthPage.ts`, `src/renderPasswordResetPage.ts`, new `src/asset-url.ts`, `src/scheduled-handlers.ts` (push icon correction and versioning). Page renderers that pass raw `stylesheets`/`scripts` arrays to `renderLayout` need no changes under the central-resolver model; the reference check exempts those arrays.
- **Client**: `client/src/index.tsx` bootstrap, new `client/src/utils/assetUrl.ts`, image URL construction in islands and components, `MapIsland` tile URLs, and tests that currently assert exact unversioned `src` values.
- **CSS**: `public/css/main.css` import list and the layout's base stylesheet list.
- **CI/docs**: `.github/workflows/lint.yml`, `docs/asset-workflow.md`, and tests for the helpers and rendered HTML. Add the client build before the drift checks; add the reference check to the lint job.
- **Rollout/rollback**: no D1 migrations and no API shape change. Reverting the helpers and generators restores fixed URLs; generated maps are additive and can be left unused. Deploy remains manual (`npm run deploy`) unless a deploy workflow is added separately.
- **Known boundary**: Cloudflare's asset layer resolves by path and ignores the query string when selecting the file; the query still busts browser and Cache Storage keys. This was observed in live probes and must be re-verified after the first deploy. If strict edge-cache object identity is later required, switch to content-hashed filenames as a follow-up.
