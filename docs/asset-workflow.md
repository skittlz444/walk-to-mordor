# Asset Workflow: Image Optimization

This guide describes how to add and optimize new milestone images for the Walk to Mordor application.

## Overview

The project uses an automated image optimization pipeline to generate WebP images in two formats:
- **High-resolution images** (`public/img/highres/`): For detail views, lazy-loaded after thumbnails
- **Thumbnails** (`public/img/thumbs/`): Lightweight placeholders for instant loading with blur effect (with `-thumb` suffix)

## Adding New Images

### 1. Prepare Source Images

Place your original, unprocessed images in the `raw_assets/` directory at the project root:

```bash
raw_assets/
├── milestone-mountain.jpg
├── milestone-forest.png
└── milestone-river.jpg
```

**Notes:**
- The `raw_assets/` directory is gitignored and not committed to the repository
- Supported formats: JPG, JPEG, PNG, WebP, TIFF/TIF, GIF
- Use descriptive filenames (they'll be preserved in output with `.webp` extension)
- Original images can be any size; the script handles resizing intelligently

### 2. Run the Optimization Script

Execute the image optimization script:

```bash
npm run optimize:images
```

The script will:
1. Scan `raw_assets/` recursively for all image files
2. Process each image through two pipelines:
   - **High-res**: Target 2048px width, quality 90 (only downscales if >3840px/4K, preserves original otherwise)
   - **Thumbnail**: 256px width, quality 60, iteratively compressed to <20KB (with `-thumb` suffix)
3. Output WebP files to `public/img/highres/` and `public/img/thumbs/`
4. Display a summary with file sizes and savings

**Example output:**
```
🖼️  Image Optimization Script
================================

Source: /path/to/raw_assets
High-res output: /path/to/public/img/highres
Thumbnail output: /path/to/public/img/thumbs

Scanning for images...
Found 3 image(s) to process.

[Optimized] milestone-mountain.jpg -> milestone-mountain.webp + milestone-mountain-thumb.webp
  Original: 3.24 MB | High-res: 856.45 KB (2048px) | Thumb: 18.72 KB (256px, q60)
[Optimized] milestone-forest.png -> milestone-forest.webp + milestone-forest-thumb.webp
  Original: 2.87 MB | High-res: 742.33 KB (2048px) | Thumb: 19.45 KB (256px, q55)
[Optimized] milestone-river.jpg -> milestone-river.webp + milestone-river-thumb.webp
  Original: 1.98 MB | High-res: 634.21 KB (1920px) | Thumb: 17.89 KB (256px, q60)

================================
Summary
================================

Files processed: 3
Original total: 8.09 MB
High-res total: 2.21 MB
Thumbnail total: 56.06 KB
Combined output: 2.27 MB
Total savings: 5.82 MB (72.0%)

✅ Optimization complete!
```

### 3. Reference Images in Code

After optimization, reference the WebP files in your code or database using the `image_id` field.

**In Database Migrations:**

To add or update an image for a milestone, create a migration file that updates the `image_id` field in the goals table:

```sql
-- Migration number: 0XXX    YYYY-MM-DDTHH:MM:SS.000Z

-- Update image_id for goal: {Goal Title} (Distance: {distance_miles})
UPDATE goals SET image_id = 'milestone-mountain' WHERE distance = {distance_miles} * 1.60934;
```

**Example migration file** (`migrations/0099_update_image_milestone-mountain.sql`):
```sql
-- Migration number: 0099    2026-02-02T12:00:00.000Z

-- Update image_id for goal: Reach Mountain Pass (Distance: 150)
UPDATE goals SET image_id = 'milestone-mountain' WHERE distance = 150 * 1.60934;
```

**Notes:**
- The `image_id` should match the base filename of your optimized images (without extensions or `-thumb` suffix)
- For example, if your images are `milestone-mountain.webp` and `milestone-mountain-thumb.webp`, use `image_id = 'milestone-mountain'`
- Distance is stored in kilometers in the database, so multiply miles by 1.60934 to convert
- Migration number should be the next sequential number in the migrations folder
- Use ISO 8601 timestamp format

**In HTML/Templates:**

The frontend automatically constructs image paths using the `image_id`:

```html
<!-- Thumbnail for lazy loading placeholder -->
<img 
  src="/img/thumbs/{image_id}-thumb.webp" 
  class="blur-placeholder"
  alt="Goal image">

<!-- High-res for full quality view -->
<img 
  data-src="/img/highres/{image_id}.webp"
  class="lazy-load"
  alt="Goal image">
```

**In JavaScript/TypeScript:**

The `GoalModal` component automatically handles image loading using the goal's `image_id` field:

```typescript
interface Goal {
  id: number;
  distance: number;
  title: string;
  image_id?: string | null;
}

// Images are loaded as:
// Thumbnail: `/img/thumbs/${goal.image_id}-thumb.webp`
// High-res: `/img/highres/${goal.image_id}.webp`
```

## Image Specifications

### High-Resolution Images
- **Format**: WebP
- **Target width**: 2048px (maintains aspect ratio)
- **Quality**: 90 (high quality for detail views)
- **Resizing logic**:
  - If original width ≤ 3840px (4K): Preserves original dimensions (no resizing or upscaling)
  - If original width > 3840px (4K): Resizes to 2048px max width
  - Examples: 1920px stays 1920px, 3000px stays 3000px, 5000px becomes 2048px
  - Never upscales images smaller than their original size
- **Use case**: Full-quality image loaded after thumbnail via lazy loading

### Thumbnails
- **Format**: WebP
- **Width**: 256px (maintains aspect ratio)
- **Starting quality**: 60
- **Target file size**: < 20KB
- **Compression strategy**: Iteratively reduces quality by 5% steps until <20KB or minimum quality (20) reached
- **Use case**: Blur placeholder for instant page load before high-res loads

## Best Practices

### Source Image Guidelines
- **Resolution**: Provide high-quality originals (ideally 2000px+ width)
- **Format**: JPG or PNG recommended for source files
- **Naming**: Use lowercase, hyphens for spaces (e.g., `my-milestone-name.jpg`)
- **Organization**: Keep source files organized; subdirectories in `raw_assets/` are supported

### Workflow Tips
1. **Batch processing**: Add multiple images to `raw_assets/` and run the script once
2. **Filename consistency**: Output WebP files use the same base filename as source
3. **Manual cleanup**: After optimization, you can optionally delete or archive source files from `raw_assets/`
4. **Version control**: Only the optimized WebP files in `public/img/` are committed to git

### File Size Monitoring
- If thumbnails consistently exceed 20KB, consider:
  - Reducing thumbnail width (currently 256px)
  - Adjusting starting quality (currently 60)
  - Using simpler source images with less detail
- High-res images should typically be < 1MB for web delivery

## Troubleshooting

### "Source directory not found" Error
```bash
mkdir raw_assets
# Add images, then run: npm run optimize:images
```

### Script Fails on Specific Image
- Check image file integrity (try opening in image viewer)
- Verify format is supported (JPG, PNG, WebP, TIFF, GIF)
- Check file permissions

### Output Images Too Large/Small
- Adjust configuration constants in `scripts/optimize-images.js`:
  - `HIGHRES_MAX_WIDTH`: Max width for high-res (default: 2048)
  - `HIGHRES_QUALITY`: WebP quality for high-res (default: 90)
  - `THUMB_WIDTH`: Width for thumbnails (default: 256)
  - `THUMB_QUALITY_START`: Starting quality for thumbs (default: 60)
  - `THUMB_TARGET_KB`: Target file size for thumbs (default: 20)

## Related Documentation

- [Story 1.5: Milestone Image Detail View](../README.md) - Consumer of optimized images
- [Sharp Documentation](https://sharp.pixelplumbing.com/) - Image processing library
- [WebP Format Guide](https://developers.google.com/speed/webp) - WebP format details

## Script Location

The optimization script is located at: `scripts/optimize-images.js`

To modify behavior, edit the configuration constants at the top of the file.
