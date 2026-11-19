---
name: asset-workflow
description: Goal and encounter image optimization pipeline, image_id/image_slug conventions, admin image management, and static asset rules.
---

# Asset Workflow

> Last updated: 2026-11-19

## Architecture Decision: Static Assets over R2

Goal and personal-challenge images are repository-backed static files served from `public/img/` via the Workers Assets Binding (`env.ASSETS.fetch()`) — not from R2 or any external object store.

- Images are finite (one per goal milestone, one per encounter definition) and change infrequently
- Static assets deploy atomically with the Worker — no separate infra
- No signed-URL logic, CORS headers, or bucket policies needed
- Do **not** introduce R2 for goal or encounter images without explicit approval

## Directory Layout

| Path | Contents |
|---|---|
| `raw_assets/` | Unprocessed source images (gitignored — never commit) |
| `public/img/highres/` | Optimized full-size WebP images (goal and encounter images) |
| `public/img/thumbs/` | Thumbnail WebP images (`-thumb` suffix) |
| `public/img/avatars/` | Avatar images (separate pipeline — `scripts/optimize-avatars.js`, 64×64 thumbs) |
| `public/img/achievements/` | Badge cards (512 px) and thumbs (200 px, `-thumb` suffix) |
| `public/img/achievements/full/` | Badge inspection images (1024 px) |
| `assets/badge-art/` | Tracked reusable badge frames, rank bosses, and per-badge emblem masters |
| `public/img/image-manifest.json` | Build-time generated list of all available image slugs |

## image_id / image_slug Convention & Naming Rules

The `image_id` column in `goals` is the **base filename without extension or suffix** — the single key mapping a goal to its images. Personal challenge definitions use the same convention through `personal_encounter_definitions.image_slug`.

- File paths: `public/img/highres/{image_id}.webp`, `public/img/thumbs/{image_id}-thumb.webp`
- URL paths: `/img/highres/{image_id}.webp`, `/img/thumbs/{image_id}-thumb.webp`
- Slug format: lowercase letters, numbers, hyphens only — regex `/^[a-z0-9]+(-[a-z0-9]+)*$/`
- Never include extensions or `-thumb` in the `image_id` value
- Source filenames become output filenames (with `.webp` extension); subdirectories are flattened

Set `image_id` via a migration:

```sql
UPDATE goals SET image_id = 'rivendell-valley' WHERE distance = 150 * 1.60934;
```

Distance is stored in **kilometers** — multiply miles by `1.60934`.

## Format & Size Specs

### High-Resolution

| Property | Value |
|---|---|
| Format | WebP |
| Max width | 2048px (aspect ratio preserved) |
| Quality | 90 |
| Resize rule | Only downscales if source > 3840px; never upscales |
| Target size | < 1 MB |

### Thumbnails

| Property | Value |
|---|---|
| Format | WebP |
| Max width | 256px (never upscales) |
| Starting quality | 60 |
| Target size | < 20 KB (iteratively compressed) |
| Use case | Blur placeholder for lazy loading |

## Adding New Goal Images

1. Place source images (JPG, PNG, WebP, TIFF, GIF) in `raw_assets/`
2. Run `npm run optimize:images` → `scripts/optimize-images.js`
3. Run `npm run build:manifest` (or `npm run build`) to regenerate the image manifest
4. Create a migration to set `image_id` on the target goal
5. Commit the optimized WebP files in `public/img/` (not the raw sources)
6. Deploy — assign `image_id` to goal via admin UI or migration

## Encounter Illustrations

Personal challenge illustrations are consumers of the same pipeline, not a separate image surface.

- `personal_encounter_definitions.image_slug` is the single key. It follows the same slug rules as `goals.image_id`.
- Seeded Nazgul encounter: `nazgul-pursuit` → `public/img/highres/nazgul-pursuit.webp` and `public/img/thumbs/nazgul-pursuit-thumb.webp`.
- Add the source to `raw_assets/`, run `npm run optimize:images`, then rebuild the manifest. The slug appears in `public/img/image-manifest.json` alongside goal images.
- `EncounterPopupIsland` renders `/img/highres/<image_slug>.webp` and falls back to copy-only rendering when the file is missing.
- Badge artwork for the completion badge (`challenge-nazgul-outrun`) stays in the badge pipeline below — `challenge` frame plus rank bosses via `scripts/badge-art/`; it is not processed by `scripts/optimize-images.js` and is not in the image manifest.

## Achievement Badge Artwork

Badge artwork is a separate pipeline from goal images. All outputs are WebP with alpha.

| Output | Path | Size | Budget |
|---|---|---|---|
| Card | `public/img/achievements/<name>.webp` | 512 px | ≤ 120 KiB |
| Thumbnail | `public/img/achievements/<name>-thumb.webp` | 200 px | ≤ 20 KiB |
| Full / inspection | `public/img/achievements/full/<name>.webp` | 1024 px | ≤ 500 KiB |

`<name>` is `<slug>` for fixed-rank badges and the no-boss fallback, and `<slug>--<rank_label>` for repeatable rank variants.

### Generation

- ComfyUI runs FLUX.3 Klein from `scripts/badge-art/prompts.json` (emblems and family frames) and `scripts/badge-art/boss-prompts.json` (rank bosses).
- Candidates are generated at 1024, cut out with BiRefNet, trimmed, and normalised to transparent RGBA.
- Candidate renders and logs are working data; keep them out of git.

### Compositing

- PhotoCraft MCP is used for one-off or preview composites.
- `scripts/badge-art/rebuild_finals.py` is the deterministic production path: opaque well 880 painted first, then emblem 800 over it, then family frame 1016/880, then rank boss shadow and tile at `(466, 936)` / `(466, 934)`, clipped to the badge alpha. It reads layers tracked-first from `assets/badge-art/` (including per-badge emblem masters) and falls back to the `raw_assets/badges/` staging workspace.
- The rebuild script writes the 512 card, 200 thumb, and 1024 full image, and fills in missing tracked layers under `assets/badge-art/` from the staging workspace by default (it never overwrites an existing tracked layer); `--no-retain-layers` skips that.
- Repeatable badges get four rank variants plus a no-boss base image.

### Retained layers

- `assets/badge-art/frames/<family>.png` — six locked 1024 RGBA frames, 1016 outer / 880 inner.
- `assets/badge-art/bosses/<rank>.png` — 800 px master; `<rank>-tile.png` and `<rank>-shadow.png` are the ready-to-place 90 × 90 layers.
- `assets/badge-art/emblems/<slug>.png` — one processed 1024 RGBA emblem layer per badge (recovered for the recorded set by disc-cropping the committed `full/<slug>.webp`).
- These are tracked source layers. Do not delete them; `raw_assets/` is disposable.
- Picks: `scripts/badge-art/final-selections.json`. Decisions: `docs/badge-art-decisions.md`.

### Adding a badge

1. Choose the family frame from `badge_type` and the rank boss from the badge rank.
2. Generate and normalise the emblem.
3. Add the emblem candidate and frame family to `final-selections.json`.
4. Run `rebuild_finals.py` with the staging workspace present so the rebuild adopts the new emblem master into `assets/badge-art/emblems/<slug>.png`.
5. Verify alpha, size budgets, and legibility at 96/200 px.
6. Commit the public assets and the new `assets/badge-art/emblems/<slug>.png` layer.

Badge artwork is not processed by `scripts/optimize-images.js` and is not part of the goal image manifest.

## Image Manifest

`public/img/image-manifest.json` — deterministic build-time inventory of all available image slugs.

- Regenerated by: `npm run generate:image-manifest` (alias: `npm run build:manifest`, also run by `npm run build` and `npm run optimize:images`)
- No timestamp: two runs over the same `public/img/highres/` produce byte-identical output
- Missing `public/img/highres/` is a hard failure — the generator never writes an empty manifest
- Fetched at runtime via Assets binding (Workers cannot do filesystem I/O at runtime)
- Used by admin UI to browse images and detect orphaned/missing images

## Deterministic Asset Versioning

Public assets are addressed with `?v=<hash>`, where `<hash>` is the first 12 lowercase hex characters of SHA-256 over the file bytes. Unchanged bytes keep their URL; changed bytes get a new one. Cloudflare resolves by path (the query still busts browser and Cache Storage keys).

### Generated artifacts (commit all four)

| Artifact | Consumer | Contents |
|---|---|---|
| `src/generated/asset-versions.ts` | Worker | Entry assets: everything under `public/css/**`, `public/icons/**`, `public/js/**` (client chunks excluded; `islands.js`/`islands.css` included), plus `/manifest.json` |
| `public/img/image-versions.json` | Client (runtime fetch) | `{ "version": "<hash>", "assets": { "/img/...": "<hash>" } }`; excludes `/img/map/tiles/**`, itself, and `image-manifest.json` |
| `public/sw.js` | Browser | Generated from `scripts/templates/sw.js`; versioned precache URLs and deterministic cache names |
| `public/img/image-manifest.json` | Worker | Deterministic image slug list |

`public/js/client/` stays gitignored. Generators hard-fail when a required input is missing (for example an unbuilt `islands.js`) and never write empty or partial maps.

### Build order

```bash
npm run build:client            # produces public/js/client/islands.js + islands.css
npm run generate:assets         # entry map + runtime image map
npm run generate:sw             # public/sw.js from scripts/templates/sw.js
npm run generate:image-manifest # deterministic slug list
```

Never edit `public/sw.js` directly — edit `scripts/templates/sw.js` and regenerate. The template's precache line is `const urlsToCache = [];`; the generator fills it with the five shell assets (`main.css`, `main.js`, `islands.js`, `islands.css`, `manifest.json`), each versioned. `CACHE_NAME` hashes the precache list plus the template; `SWR_CACHE_VERSION` hashes the SWR endpoint list plus the template.

### Drift checks

| Command | Fails when |
|---|---|
| `npm run check:assets:versions` | Entry map, runtime image map, or `metadata.json.version` is stale |
| `npm run check:service-worker` | `public/sw.js` differs from a fresh render |
| `npm run check:image-manifest` | `image-manifest.json` is stale |
| `npm run check:assets:refs` | Raw `/img`, `/js`, `/css`, `/icons` literals appear outside the approved resolvers |

Run the four checks (and `npm run build:client` first) after changing any public asset. Do not hand-edit the generated maps.

### Regenerate and commit (contributor / agent workflow)

The maps are committed, so a clean checkout typechecks; CI rebuilds and diffs them. Whatever you change, regenerate in the same commit:

| You changed | Run, then commit |
|---|---|
| An image under `public/img/**` | `npm run generate:assets` and `npm run generate:image-manifest` → `public/img/image-versions.json`, `public/img/image-manifest.json` |
| A legacy JS/CSS, icon, or `manifest.json` | `npm run generate:assets` and `npm run generate:sw` → `src/generated/asset-versions.ts`, `public/sw.js` |
| Client code (`client/src/**`) | `npm run build:client && npm run generate:assets && npm run generate:sw` → `src/generated/asset-versions.ts`, `public/sw.js` |
| Map tiles | `npm run tile:map` (writes `metadata.json.version`), then `npm run generate:assets` |
| `scripts/templates/sw.js` | `npm run generate:sw` → `public/sw.js` |

The reliable catch-all is the full deterministic order:

```bash
npm run build:client
npm run generate:assets
npm run generate:sw
npm run generate:image-manifest
```

Then run the four checks. If a check reports drift, the committed artifact is stale — regenerate it; never edit it by hand.

### CI enforcement

`.github/workflows/lint.yml` runs these after `npm ci`, ESLint, `tsc --noEmit`, generated-type/validator checks, and the asset-count budget:

```bash
npm run build:client        # the version checks hash the built bundle
npm run check:assets:versions
npm run check:assets:refs
npm run check:service-worker
npm run check:image-manifest
```

A PR fails on any drift between the tree and the generators, or on a raw asset URL outside the approved resolvers.

### Service worker runtime rules

- Cache-first for versioned static assets. A new `?v=` is a new Cache Storage key, so an old worker fetches the new bytes without `skipWaiting`/`clients.claim`.
- Network-first for `/img/image-versions.json` and `/img/map/tiles/metadata.json`, with the cached copy as the offline fallback. These two paths are handled before the static cache-first branch.
- Superseded `/img/` cache entries (outside `/img/map/tiles/**`) are pruned on activate and after a successful map refresh. Pruning is skipped when the map cannot be fetched and never fails activation.
- HTML navigations stay network-only; offline navigation is unsupported by design.

### Dev and test workflow

- `npm run dev` builds the client and generates the maps + SW once, then runs Vite watch and `wrangler dev`. Hashes can go stale during watch; the asset layer serves the stable path with current bytes, so restart `npm run dev` after changing a public asset.
- `npm run test:ui` / `npm run test:ui:headed` run `build:client`, `generate:assets`, and `generate:sw` before Playwright; the SW/offline specs need the real generated worker. There is no reset-cache script — each Playwright context starts with empty Cache Storage.

### Map tile set version

`public/img/map/tiles/metadata.json` carries one `version` for the whole tile set. It is computed from the metadata (excluding the `version` field itself) plus every tile byte, via `computeTileSetVersion()` in `scripts/lib/asset-manifest.js`. `npm run tile:map` writes it as the last step, and `check:assets:versions` fails when the field is missing or stale.

```bash
npm run tile:map        # re-encode tiles and write metadata.json + its version
npm run check:assets:versions
```

The map island appends `?v=<version>` to every tile URL and falls back to unversioned URLs when metadata has no `version`.

### Server-rendered entry assets

- `src/asset-url.ts` (`assetUrl(path)`) is the only server resolution point. It appends or replaces `?v=` from the committed entry map, keeps other query parameters, and returns unknown paths unchanged.
- `src/renderLayout.ts` resolves everything it emits: `config.stylesheets`, `config.scripts`, the islands bundle/CSS, icons, `main.js`, and `manifest.json`. Page renderers keep passing raw paths in `stylesheets`/`scripts`; do not resolve them again in page code.
- `src/renderAuthPage.ts` and `src/renderPasswordResetPage.ts` have standalone heads (no shared layout), so they call `assetUrl()` directly for their stylesheets, icons, manifest, and client bundle.
- Server-generated payloads resolve through the same helper. Scheduled push payloads use `assetUrl('/icons/icon-192x192.png')` (the icon lives at `/icons/`, not `/img/icons/`).
- CSS cascade: `renderLayout` links `calendar`, `progress`, `goals`, `profile`, `palantir`, `wrapped`, then `main`, `drawer`, `badge-award`, then page-specific stylesheets. `main.css` must not `@import` the six domain sheets — each file is versioned independently, and the explicit order preserves the old import-before-main-rules cascade.
- Auth and password-reset pages intentionally load only `main.css` plus `auth.css`; they do not need the six domain stylesheets.

### Raw URL rule

- Client code: use `client/src/utils/assetUrl.ts`; map tiles use `tileUrl()` with the shared tile-set version. Never hardcode `/img/**` paths in `client/src/`.
- Server code: use `src/asset-url.ts` (task 2.1), or pass paths through `renderLayout`'s `stylesheets`/`scripts` arrays, which resolve centrally.
- Exempt: resolver helpers, literals passed directly to a resolver (`assetUrl('/css/main.css')`), generated files, tests, layout configuration arrays, and fetches of generated artifacts (`/img/image-manifest.json`, `/img/image-versions.json`, `/img/map/tiles/metadata.json`).
- There is no migration allowlist. A raw URL in any unlisted file fails with `file:line` and the expected resolver; add a narrow exemption only for a new generated artifact.

## Admin Interface

### API Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/admin/images` | Cross-referenced inventory: deployed images, orphaned slugs, goals with missing images |
| `PUT /api/admin/goals/:id` | Update goal fields including `image_id` |

Both require admin bearer token (401/403 on failure). Saving a goal with a non-existent `image_id` is allowed (non-blocking validation).

### Code Pointers

| Concern | Location |
|---|---|
| Optimization pipeline | `scripts/optimize-images.js` |
| Manifest generation | `scripts/generate-image-manifest.js` |
| Admin image API handler | `src/admin-handlers.ts` |
| Admin goal edit island | `client/src/islands/AdminGoalEditIsland.tsx` |
| Image slug validation | `src/validators.ts` |

## Key Constraints

- Only optimized WebP files in `public/img/` are committed to git
- `raw_assets/` is gitignored — never commit source images
- Durable badge source layers live in `assets/badge-art/`, not `raw_assets/`
- Badge images use the 512/200/1024 paths above and are not run through `scripts/optimize-images.js`
- Encounter illustrations use the goal-image pipeline with `image_slug` as the key (`highres/<slug>.webp` + `thumbs/<slug>-thumb.webp`) and must appear in the manifest
- Avatar images use a **separate** pipeline (`scripts/optimize-avatars.js`) with different sizes
- After optimizing, always rebuild the manifest so the admin UI stays in sync
- Script config constants are at the top of `scripts/optimize-images.js` — tune there if size targets change

## Related Docs

- [api-reference.md](./api-reference.md) — API reference (includes admin endpoints)
- [architecture.md](./architecture.md) — Assets binding and route topology
- [badge-art-decisions.md](./badge-art-decisions.md) — final badge frames, emblems, bosses, sizes, and retained layers

## Asset Count CI Check

The CI pipeline automatically counts all files under `public/` on every PR and enforces a file budget to stay within Cloudflare Workers Assets limits.

### Thresholds

| Level | File Count | Behavior |
|-------|-----------|----------|
| **Pass** | < 15,000 | Green check — no action needed |
| **Warning** | ≥ 15,000 and < 18,000 | Check passes, but a `::warning::` annotation alerts the PR |
| **Fail** | ≥ 18,000 | Pipeline fails — PR cannot merge until count is reduced |

These thresholds provide early warning before reaching the Cloudflare Workers Assets 25,000-file soft limit.

### CI Integration

The "Check Asset Count" step runs early in `.github/workflows/pr-tests.yml` (after checkout, before build/tests). It:

1. Counts all files recursively under `public/`
2. Writes a Markdown summary to the GitHub Actions Job Summary
3. Emits `::warning::` or `::error::` annotations visible on the PR
4. Exits with code 1 on failure to block the pipeline

### Local Check

Run the same check locally before deploying:

```bash
npm run check:assets
```

This outputs a human-readable table with the total count, breakdown by directory, and pass/warn/fail status.

You can also check a different directory:

```bash
node .github/scripts/check-asset-count.js path/to/dir
```

> **Note:** Locally, `public/js/client/` (Vite build output) is included in the count. In CI, the check runs before the build step, so only checked-in files are counted.

### If the Count Is Too High

1. **Audit large directories** — run `npm run check:assets` to see the breakdown
2. **Optimize images** — run `npm run optimize:images` to compress WebP files
3. **Remove unused assets** — check for orphaned images via the admin images API
4. **Consolidate map tiles** — if map tiles are the main contributor, consider reducing zoom levels or tile density
5. **Review generated files** — ensure build output isn't accidentally committed
