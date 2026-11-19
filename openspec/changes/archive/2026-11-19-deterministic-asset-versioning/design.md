# Design

## Context

See `proposal.md` - Why. The current constraints that shape the approach:

- `src/index.ts:773-782` serves static assets through `env.ASSETS.fetch()` before Hono; `wrangler.json:26-29` deploys `./public` atomically with the Worker.
- `client/vite.config.ts:11-28` builds the Preact bundle to fixed `islands.js` and `islands.css` names; chunks already use `[hash]`. `public/js/client/` is gitignored (`.gitignore:206`).
- `src/renderLayout.ts:96-107` emits unversioned `islands.js`, `islands.css`, and `main.js`; page renderers pass raw `stylesheets` and `scripts` arrays.
- `public/sw.js:5-11` precaches five shell files, serves static assets cache-first (`:430-468`), keeps HTML network-only (`:416-427`), and uses SWR only for an allowlist of API GETs (`:385-413`). It never caches arbitrary JSON.
- `public/js/update-cache-version.js` stamps a global `BUILD_TIMESTAMP` into the committed `public/sw.js`; `scripts/generate-image-manifest.js` writes a timestamp. Both make builds non-deterministic.
- `public/css/main.css:2-7` imports six domain stylesheets; `src/renderLayout.ts:70-72` links main, drawer, and badge-award CSS.
- `public/` holds about 1,096 files, 1,059 of them images, against a 15,000-file CI budget. There is no R2 or separate asset store.

## Goals / Non-Goals

**Goals:**

- Deterministic per-file versions through a `?v=<hash>` query; unchanged assets keep their URLs.
- Server-side resolution for entry assets and runtime resolution for images, without changing the client bundle when an image changes.
- Preserve cache-first offline behavior and let a new version bypass an old service-worker cache.
- Make generated artifacts and raw asset references enforceable in build and CI.
- Keep legacy JS and page renderers unchanged unless they directly build asset URLs.

**Non-Goals:**

- Content-hashed filenames; that is a follow-up if edge-cache object identity becomes necessary.
- R2, a CDN purge pipeline, or an automated deploy workflow.
- Per-tile image-map entries or versioning PWA icon files in this change.
- Changes to the image optimization, badge-art, or avatar pipelines.
- API contract changes; API payloads continue to expose image slugs, not versioned URLs.

## Decisions

### 1. Query-string content hashes over global timestamps or filenames

Use the first 12 lowercase hex characters of SHA-256 over the file bytes as `?v=<hash>`.

- Stable paths mean an old URL still resolves to the current deployment; there is no old-file 404 problem.
- Browser and Cache Storage keys include the query string, so a new hash is a cache miss even under an old service worker.
- Cloudflare's asset layer resolves by pathname and ignores the query when selecting the file; live probes returned `cf-cache-status: HIT` for arbitrary query values. The query is therefore a client/SW cache key, not a distinct edge object.
- Alternatives: the current global timestamp (rejected: invalidates everything and is non-deterministic); content-hashed filenames (deferred: stronger edge identity but requires rewriting every reference and creates old-file/404 cleanup).

### 2. Split the version maps by consumer

- `src/generated/asset-versions.ts` is the server entry map: `/js/client/islands.js`, `islands.css`, legacy JS/CSS, icons, and `manifest.json`. It is imported by the Worker.
- `public/img/image-versions.json` is the runtime image map: `/img/**` entries only, excluding `/img/map/tiles/**`.
- `public/img/map/tiles/metadata.json` carries one `version` for the tile set.

This keeps an image change from touching either the client bundle or the server entry map. Alternatives: one bundled map (rejected: an image update would change `islands.js`); server-provided `image_url` fields (rejected: broad API changes and SWR-cached payloads would pin old URLs).

### 3. Build order and generated-artifact policy

```
build:client
  -> public/js/client/islands.js, islands.css, chunks/
generate:assets
  -> src/generated/asset-versions.ts (entry map)
  -> public/img/image-versions.json (image map)
generate:sw
  -> public/sw.js (versioned precache URLs, deterministic cache names)
generate:image-manifest
  -> public/img/image-manifest.json (deterministic slug list)
```

- `public/js/client/` stays gitignored. The generated server map, runtime image map, `public/sw.js`, and `image-manifest.json` are committed.
- CI builds the client, regenerates the artifacts, and diffs the committed files. This is the only way a fresh checkout can typecheck the Worker import and still detect drift.
- Generators hard-fail when a required input (for example the built client bundle) is missing; they must not copy the empty-manifest fallback in `scripts/generate-image-manifest.js:28-38`.
- Alternatives: generate only during deploy (rejected: no drift gate, and `tsc` cannot typecheck a missing import); gitignore the maps (rejected: fresh-checkout typecheck fails).

### 4. Resolve page configuration in the layout

- `src/asset-url.ts` reads the entry map and appends/replaces `?v=`.
- `renderLayout` resolves `config.stylesheets`, `config.scripts`, the island bundle, CSS, icons, and the manifest.
- `src/renderAuthPage.ts` and `src/renderPasswordResetPage.ts` have standalone heads, so they call the helper directly.
- The reference check applies to client code and direct server image references. It exempts raw paths passed into the layout configuration, because the layout is the single resolution point. This avoids editing the 13 page renderers that pass `stylesheets` or `scripts` arrays.
- Alternatives: call the helper in every page renderer (rejected: noisy, easy to miss); make the reference check reject all raw literals (rejected: it would flag intentional layout config and force a larger diff).

### 5. Load images through a runtime map, not the bundle

- `client/src/utils/assetUrl.ts` holds the runtime map and appends versions.
- `loadAssetVersions()` fetches `/img/image-versions.json` in parallel with `initializeAppStore()` in `client/src/index.tsx`; it has a short timeout (about 1.5 s), falls back to a localStorage copy, then to the unversioned path.
- The load must not block hydration indefinitely. If the map is unavailable, islands still hydrate and images use unversioned paths, which still resolve to current bytes.
- The map format is `{ "version": "<hash>", "assets": { "/img/...": "<hash>" } }`, with keys sorted byte-wise.
- Alternatives: bundle the map (rejected: image updates change the bundle); API `image_url` fields (rejected: SWR caches would serve stale URLs, and the API surface is much larger).

### 6. Keep the service worker cache-first and add two network-first exceptions

- Versioned URLs are new cache keys. An old service worker's `caches.match` misses and fetches the new asset; no `skipWaiting` or `clients.claim` is required to fix the stale bundle.
- Keep static assets cache-first so cached versions remain available offline.
- Add a runtime cache rule for `/img/image-versions.json` and `/img/map/tiles/metadata.json`: network-first, cache the successful response, fall back to the cached copy. Today the SW only caches static destinations and `/css/`, `/js/`, `/manifest.json` paths, so these JSON responses would otherwise never be available offline.
- Precache only the shell (`main.css`, `main.js`, `islands.js`, `islands.css`, `manifest.json`); images are cached on demand. This set drops the non-existent `/css/mobiscroll.javascript.min.css` and `/js/mobiscroll.javascript.min.js` entries currently in `public/sw.js:4-10`, which make `cache.addAll` fail and leave the precache partially broken.
- Generate `public/sw.js` from a template. `CACHE_NAME` is a hash of the precache list plus the template. `SWR_CACHE_VERSION` is a deterministic hash of the SWR endpoint list and template, replacing the timestamp behavior in `public/js/update-cache-version.js`; it changes when the SWR surface changes, while the 5-minute TTL and background revalidation bound payload staleness when it does not.
- On activate and after a successful runtime-image-map refresh, prune cached `/img/` entries outside `/img/map/tiles/**` that the current map no longer references, so image-only deploys do not accumulate old versions. Skip pruning when the map cannot be fetched offline.
- Alternatives: network-first for all static assets (rejected: adds latency and is unnecessary with versioned URLs); `skipWaiting` only (rejected: it does not help a page that is already open and risks version skew).

### 7. Version CSS per file and preserve the cascade

- Remove the `@import` lines from `public/css/main.css`.
- `renderLayout` links `calendar.css`, `progress.css`, `goals.css`, `profile.css`, `palantir.css`, and `wrapped.css` before `main.css`, then `drawer.css`, `badge-award.css`, and page-specific CSS. This matches the current effective order, where the imports appear before main.css's own rules.
- `main.css` owns the CSS custom properties; auth and password-reset pages keep their `main.css` plus page CSS and remain self-contained. They do not need the six domain stylesheets.
- Alternatives: keep `@import` (rejected: a change to an imported file would also have to bump its parent); bundle all CSS (rejected: larger change to legacy page loading and cascade behavior).

### 8. Give the map tile set one version

- `scripts/tile-map-image.js` writes a `version` into `public/img/map/tiles/metadata.json`, derived from the metadata and tile bytes.
- The asset-version check recomputes the tile-set hash from `metadata.json` and the tile bytes and fails when `metadata.json.version` is stale. A tile change without rerunning `tile:map` must not silently keep old tile URLs.
- `client/src/islands/MapIsland.tsx` fetches metadata through a network-first path, reads `version`, and appends `?v=<version>` to every tile URL.
- `/img/map/tiles/**` is excluded from the runtime image map.
- Alternative: per-tile entries (rejected: 305 entries, all change together, and the map island would need a lookup per tile).

### 9. Version the manifest link, defer icon versioning

- Include `manifest.json` in the entry map and version its link through `renderLayout`.
- Leave the icon URLs inside `manifest.json` unversioned for now; PWA icon refresh is platform-controlled and changing the manifest icon URLs has installation implications. Revisit only if icon updates become a practical problem.

### 10. Enforce with checks, not documentation

Add CI scripts and run them after `npm run build:client`:

- `check:assets:versions`: regenerate the entry map and runtime image map in memory and diff the committed artifacts.
- `check:assets:refs`: reject raw `/img`, `/js`, `/css`, and `/icons` literals in `client/src` and direct server image references; allowlist the helpers, generated files, tests, layout configuration paths, and fetches of generated artifacts such as `/img/image-manifest.json` in `src/admin-goals-handlers.ts:428`.
- `check:service-worker`: regenerate `public/sw.js` from the template and maps and diff it.
- `check:image-manifest`: regenerate the deterministic image slug list and diff it.

The check messages must name the file, line, and the expected resolver. A docs-only rule is insufficient because it depends on someone reading the doc.

### 11. Retire the reset/timestamp workflow

- Remove `public/js/update-cache-version.js` and `public/js/reset-cache-version.js`.
- `dev` builds the client and generates the maps once; stale hashes during watch are acceptable because the asset layer serves the stable path and current bytes.
- `test:ui` and `test:ui:headed` build the client and generated SW without the reset script. Playwright contexts start with no service worker, so a fresh cache is not a requirement.
- `SWR_CACHE_VERSION` is filled by `generate-sw.js`; leaving the placeholder would stop SWR caches from version-busting.

### 12. Correct the push icon path

`src/scheduled-handlers.ts:152,274` uses `/img/icons/icon-192x192.png`, but the file is `/icons/icon-192x192.png`. Route the corrected path through the server helper so it is versioned and actually resolves.

## Risks / Trade-offs

- **Cloudflare serves by path, not query** -> The query still fixes browser and Cache Storage; the edge serves the current deployment's bytes. Verify after the first deploy. If the edge is observed serving stale bytes, add a cache key rule or switch to content-hashed filenames.
- **Runtime image map adds a request** -> Load it in parallel with session initialization, cap the wait at about 1.5 s, cache it in localStorage and the SW, and fall back to unversioned paths.
- **CSS order regression** -> Use the explicit base list above, which preserves the current `@import` position, and run the existing UI smoke tests.
- **Generated artifacts committed** -> Rebuilds are deterministic and CI diffs them. Agents must regenerate and commit the maps with the asset change; the drift check enforces this.
- **Map tile hashing cost** -> Hashing 305 tiles is a build-time cost only; metadata carries the single version so runtime lookups stay simple.
- **Runtime image map size** -> About 1,059 entries, roughly 60 KB uncompressed; it is fetched once, compressed in transit, and cached. It excludes map tiles.
- **Superseded image versions accumulate in Cache Storage** -> Prune cached `/img/` entries outside `/img/map/tiles/**` that are not referenced by the current runtime image map on activate and after a successful map refresh. Keep the current versions; skip pruning offline.
- **Tile bytes can change without a tile-generator run** -> The asset-version check recomputes the tile-set hash and fails when `metadata.json.version` is stale.
- **API SWR payloads can be up to 5 minutes stale when the SWR surface does not change** -> Accepted: the version busts when the SWR endpoint list or template changes, and background revalidation plus the 5-minute TTL bound the window.
- **Old service worker controls the page** -> A new query is a cache miss, so the old SW fetches and caches the new asset. No activation change is required for correctness.
- **Tests pin exact URLs** -> Badge component tests that assert exact `src` values must resolve through the helper or assert the logical path; the two spec deltas record the version-query allowance.
- **`tsc` before the client build** -> The server map is committed, so typecheck works on a fresh checkout; the CI drift check rebuilds the client to verify the committed map matches the produced bundle.
- **PWA icons stay stale** -> Accepted in this change; icon URLs are not versioned. Revisit only if the platform behavior becomes a problem.

## Migration Plan

1. Add the hashing/generation scripts, generated maps, server helper, and client helper. No page behavior changes yet.
2. Switch `renderLayout`, auth/reset pages, client image construction, and map tiles to the helpers. Correct the push icon path.
3. Remove the `@import` cascade, add the base stylesheet list, generate `public/sw.js`, and retire the timestamp/reset scripts in `package.json`.
4. Add the CI checks and docs. Update tests that assert exact unversioned URLs.
5. Deploy. Verify a rendered page carries `?v=`, an image-only change leaves `islands.js` unchanged, an old SW still fetches the new bundle, and offline cached assets and map metadata still work.
6. Rollback: revert the helper calls and the generated `sw.js` build step; the generated maps are additive and can remain unused. No D1 migrations or API changes are involved.
