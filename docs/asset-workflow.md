---
name: asset-workflow
description: Goal and encounter image optimization pipeline, image_id/image_slug conventions, admin image management, and static asset rules.
---

# Asset Workflow

> Last updated: 2026-11-05

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
| `assets/badge-art/` | Tracked reusable badge frames and rank bosses |
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
- `scripts/badge-art/rebuild_finals.py` is the deterministic production path: emblem 800 → opaque well 880 → family frame 1016/880 → rank boss tile at `(466, 934)` and shadow at `(466, 936)`, clipped to the badge alpha.
- The rebuild script writes the 512 card, 200 thumb, and 1024 full image, and refreshes `assets/badge-art/` by default.
- Repeatable badges get four rank variants plus a no-boss base image.

### Retained layers

- `assets/badge-art/frames/<family>.png` — six locked 1024 RGBA frames, 1016 outer / 880 inner.
- `assets/badge-art/bosses/<rank>.png` — 800 px master; `<rank>-tile.png` and `<rank>-shadow.png` are the ready-to-place 90 × 90 layers.
- These are tracked source layers. Do not delete them; `raw_assets/` is disposable.
- Picks: `scripts/badge-art/final-selections.json`. Decisions: `docs/badge-art-decisions.md`.

### Adding a badge

1. Choose the family frame from `badge_type` and the rank boss from the badge rank.
2. Generate and normalise the emblem.
3. Add the emblem candidate and frame family to `final-selections.json`.
4. Run `rebuild_finals.py`.
5. Verify alpha, size budgets, and legibility at 96/200 px.
6. Commit the public assets and any changed `assets/badge-art/` layers.

Badge artwork is not processed by `scripts/optimize-images.js` and is not part of the goal image manifest.

## Image Manifest

`public/img/image-manifest.json` — build-time inventory of all available image slugs.

- Regenerated by: `npm run build:manifest`, `npm run build`, `npm run optimize:images`
- Fetched at runtime via Assets binding (Workers cannot do filesystem I/O at runtime)
- Used by admin UI to browse images and detect orphaned/missing images

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
| Manifest generation | `scripts/build-image-manifest.js` |
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
