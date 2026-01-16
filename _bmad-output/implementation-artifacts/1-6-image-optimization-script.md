# Story 1.6: Image Optimization Script (Issue #157)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Developer**,
I want **an automated script to process milestone images**,
so that **I can easily generate optimized WebP high-res and thumbnail assets without manual processing**.

## Acceptance Criteria

1.  **Script creation**: A Node.js script exists `scripts/optimize-images.js` that processes images from a source directory.
2.  **Format Standardization**: Output images are strictly WebP format.
3.  **High-Res Output**: Generates high-quality images (Max 2560px width, Quality 90) for the detail view. **Constraint:** Do not downscale images unless they exceed 4K (3840px), and never upscale.
4.  **Thumbnail Output**: Generates lightweight thumbnails (Max 400px width, Quality 60, Target <20KB) for use as blurred lazy-loading placeholders. Priority is minimal file size to allow instant loading before the high-res image comes in.
5.  **Output Structure**: Organized into `public/img/highres/` and `public/img/thumbnails/`.
6.  **Reporting**: The script outputs a summary of files processed and size savings.
7.  **Integration**: Runnable via `npm run optimize:images`.

## Tasks / Subtasks

- [ ] **Setup & Dependencies**
  - [ ] Install `sharp` (or equivalent) as a dev dependency.
  - [ ] Create `scripts/optimize-images.js`.
  - [ ] Define source folder (e.g., `raw_assets/` or `scripts/source_images/`) and destination folder (`public/img/`).

- [ ] **Script Implementation**
  - [ ] Implement file discovery (recursive or flat).
  - [ ] **Smart Resizing**: Check original dimensions. If width > 2560px, resize to 2560px. If width <= 2560px, keep original width. **NEVER upscale**.
  - [ ] Implement High-Res pipeline: WebP (quality: 90) to ensure visual fidelity matches or exceeds source.
  - [ ] Implement Thumbnail pipeline: Resize (fit: inside, 400px), WebP (quality: 60) to serve as blurred placeholders. Ensure strict <20KB output.
  - [ ] Ensure filename sanitization (create "slugs" if source names are complex, though manually renaming source files is preferred).
  - [ ] Logging: Print `[Optimized] filename.jpg -> filename.webp (Original: X MB, HighRes: Y KB, Thumb: Z KB)`.

- [ ] **NPM Script Integration**
  - [ ] Add `"optimize:images": "node scripts/optimize-images.js"` to `package.json`.
  - [ ] Add `.gitignore` entry for `raw_assets/` (if we don't want to commit huge source files).

- [ ] **Documentation**
  - [ ] Create `docs/asset-workflow.md` describing how to add new images: "Put raw file in X, run Y, update DB/Code to use Z".

## Dev Notes

### Technical Stack
- **Library**: `sharp` is the industry standard for fast Node.js image processing.
- **Node Version**: Check `.nvmrc` or `package.json` engines if compatible.
- **Source Files**: It is recommended *not* to commit raw heavy assets to the git repo. The script should look in a local-only folder or one that is gitignored but referenced in docs.

### Configuration
```javascript
const sharp = require('sharp');
// High Res: { width: 2560, fit: 'inside' }, { quality: 90 }
// Thumbnail: { width: 400, fit: 'inside' }, { quality: 60 }
```

### References
- [Story 1.5](1-5-missing-milestone-images.md): The consumer of these images.
- [Sharp Documentation](https://sharp.pixelplumbing.com/)

## Dev Agent Record

### Agent Model Used
{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
