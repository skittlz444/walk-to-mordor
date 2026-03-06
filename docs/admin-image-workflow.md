# Admin Image Workflow

This guide describes how administrators manage milestone images through the admin UI and the repository asset pipeline.

## Overview

Walk to Mordor uses a **repository-backed image pipeline** — images are not uploaded through the browser. Instead, they are:

1. Prepared and optimized locally
2. Committed to the git repository
3. Deployed as static assets via Cloudflare Workers Assets
4. Assigned to goals through the admin UI

This approach ensures images are version-controlled, optimized at build time, and served with maximum performance.

## Adding New Milestone Images

### Step-by-Step Workflow

1. **Place source image** in the `raw_assets/` directory at the project root
   - Supported formats: JPG, JPEG, PNG, WebP, TIFF, GIF
   - Use lowercase filenames with hyphens: `my-milestone-name.jpg`
   - The filename (without extension) becomes the `image_id` slug

2. **Run the optimization pipeline**:
   ```bash
   npm run optimize:images
   ```
   This generates:
   - High-res: `public/img/highres/<slug>.webp` (2048px max, quality 90)
   - Thumbnail: `public/img/thumbs/<slug>-thumb.webp` (256px, <20KB)
   - Updated image manifest: `public/img/image-manifest.json`

3. **Commit the new files**:
   ```bash
   git add public/img/highres/ public/img/thumbs/ public/img/image-manifest.json
   git commit -m "Add milestone image: <slug>"
   ```

4. **Build and deploy**:
   ```bash
   npm run deploy
   ```

5. **Assign in admin UI**: Navigate to `/admin/goals/<id>`, set the `image_id` field to the slug, and save.

### Image Naming Conventions

- **Slug format**: lowercase letters, numbers, hyphens only (regex: `/^[a-z0-9]+(-[a-z0-9]+)*$/`)
- **Examples**: `rivendell`, `bag-end`, `moria-bridge`, `weathertop-camp`
- The slug is used as the `image_id` in the goals table
- Thumbnails use `-thumb` suffix: `rivendell-thumb.webp`
- High-res files: `rivendell.webp`

## Image Manifest

The image manifest (`public/img/image-manifest.json`) is a build-time generated file that lists all available image slugs. It enables the admin UI to:

- Browse available images
- Cross-reference goals against deployed assets
- Detect orphaned and missing images

### Generating the Manifest

```bash
# Standalone generation
npm run build:manifest

# Included automatically in:
npm run build           # builds client + cache version + manifest
npm run optimize:images # optimizes images + regenerates manifest
```

### Manifest Format

```json
{
  "generated": "2026-03-06T12:00:00.000Z",
  "images": ["bag-end", "rivendell", "weathertop-camp"],
  "count": 3
}
```

## Admin UI Features

### Goal Edit Page (`/admin/goals/:id`)

The image section on the goal edit page provides:

- **Image ID input** with slug format validation
- **Browse Images** button — opens a modal to browse all available images with thumbnail previews
- **Live validation** — debounced check (300ms) that verifies the thumbnail exists
- **Status indicators**:
  - ✅ Green: Image found (both highres and thumbnail exist)
  - ⚠️ Amber: Image not found (files missing for this slug)
  - ℹ️ Grey: No image assigned
- **Thumbnail preview** with "View Full Size" link
- **Inline help** — collapsible panel with the complete image workflow steps
- **Non-blocking**: Saving is always allowed, even if image files don't exist yet

### Image Inventory API (`GET /api/admin/images`)

Returns a cross-referenced inventory of images and goal assignments:

```json
{
  "images": [
    { "image_id": "rivendell", "has_highres": true, "has_thumb": true }
  ],
  "total": 192,
  "orphaned": ["old-unused-image"],
  "missing": [
    { "goal_id": 42, "title": "Some Goal", "image_id": "missing-slug" }
  ]
}
```

- **images**: Goal `image_id` values that match deployed files
- **total**: Count of image slugs in the manifest
- **orphaned**: Manifest slugs not referenced by any goal
- **missing**: Goals with `image_id` values not found in the manifest

Authentication: Requires admin bearer token. Returns 401/403 for unauthorized access.

## Architecture Notes

- Images are served via the Cloudflare Workers **Assets binding** (`env.ASSETS.fetch()`)
- The manifest is fetched at runtime through the Assets binding, not filesystem reads
- Workers cannot perform filesystem operations at runtime — the build-time manifest bridges this gap
- No R2, no file uploads — all images are committed to the repository

## Related Documentation

- [Asset Workflow: Image Optimization](./asset-workflow.md) — Detailed optimization pipeline docs
- [API Reference](./api-reference.md) — Full API endpoint documentation
- [Architecture](./architecture.md) — System architecture and route topology
