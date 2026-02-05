# Story 1.5: Missing Milestone Images (Issue #105)

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **Explorer**,
I want **to see high-quality imagery for every single unlocked milestone**,
so that **I feel constantly rewarded and immersed in the journey regardless of which specific milestone I reach**.

## Acceptance Criteria

1.  **Complete Coverage**: Every single goal/milestone in the `goals` table must have a valid, non-null `image_id` that corresponds to an actual image file.
2.  **WebP Format**: All new and existing images should be standardized to WebP format for optimal performance (NFR_CONST_01).
3.  **Thumbnails**: Create smaller thumbnail versions (<20KB) of all images for use in lazy loading patterns.
4.  **Frontend Support**: The application must correctly load the WebP images and use thumbnails for lazy loading (blur-up or placeholder) before loading the high-res version.
5.  **Asset Location**: Images must be reachable via the Assets binding (processed as `public/img/highres/` and `public/img/thumbnails/`).
6.  **Database Sync**: A migration must update any goals with `NULL` `image_id` (from Story 1.4) or legacy placeholder IDs to the correct new image filenames.

## Tasks / Subtasks

- [x] **Audit & Source Assets**
  - [x] Identify all goals with `image_id IS NULL` (from Story 1.4).
  - [x] Identify all legacy goals where the image might be missing or low quality.
  - [ ] Source or generate license-appropriate images for these milestones.
  - [ ] **Critical**: Ensure filenames are safe, unique "slugs" (e.g., `woody-end`, `fog-on-downs`) rather than simple numbers, for better manageability.

- [x] **Image Optimization & Formatting**
  - [x] Convert all images (new and legacy) to **WebP**.
  - [x] Generate **High-Res** versions (Max 2560px width, Quality 90, <25MB).
  - [x] Generate **Thumbnail** versions (Max 400px width, Quality 60, <20KB).
  - [x] Place in `public/img/highres/` and `public/img/thumbnails/`.

- [ ] **Database Updates**
  - [ ] Create migration `0022_update_milestone_images.sql`.
  - [ ] Update `image_id` for all rows to match the new filename slugs (listing explicit updates for transparency).
  - [ ] Example: `UPDATE goals SET image_id = 'woody-end' WHERE id = X;`
  - [ ] Ensure NO rows have `image_id` as NULL after migration.

- [x] **Frontend Integration**
  - [x] **Refactoring Decision**: Evaluate complexity. If changes are significant (e.g., complex state management), **Refactor to Preact**. If minor (simple DOM updates), **maintain Vanilla JS**.
  - [x] Update `public/js/goals.js` (or create new Island if refactoring).
  - [x] Switch image source construction from `.jpg` to `.webp`.
  - [x] Implement distinction between "List View" (use `public/img/thumbnails/{image_id}.webp`) and "Detail View" (use `public/img/highres/{image_id}.webp`).
  - [x] Implement lazy loading: Focus on **Perceived Performance**. Show thumbnail immediately (placeholder/blur-up) while high-res loads.
  - [x] Handle error states (fallback image if WebP fails to load).

- [ ] **Verification & Testing**
  - [ ] **Path Verification**: Confirm new asset paths (`/img/thumbnails/`, `/img/highres/`) resolve correctly.
  - [ ] **Visual Check**: Verify **Blur-Up/Transition**: Ensure thumbnail is visible immediately, followed by smooth transition to high-res.
  - [ ] **Visual Check**: Verify no layout shift occurs during image swap.

- [ ] **Cleanup**
  - [ ] Remove legacy `.jpg` files from `public/img/` ONLY after verifying the new system works in staging/prod.

## Dev Notes

### Asset Strategy
- **Location**: `public/img/` is served by Cloudflare Workers Assets.
- **Paths**:
  - High Res: `/img/highres/{image_id}.webp`
  - Thumbnails: `/img/thumbnails/{image_id}.webp`
- **Frontend Change**: Story 1.4 logic used `.jpg`. You **MUST** change this to `.webp`.

### Database Schema
- `goals` table has `image_id` (TEXT).
- Do not use integer IDs for `image_id`. Use descriptive slugs (e.g., `hobbiton-leaving`, `three-trolls`) to make debugging easier.

### Intermediary Goals (from Story 1.4)
Be sure to specifically target the goals added in Story 1.4 which have NULL `image_id`s:
1. Woody End
2. The High Hay
3. Fog on the Downs
4. The East Road
5. Emyn Muil Foothills

### References
- [Story 1.4](1-4-intermediary-goals-system.md): Introduced `image_id` and intermediary goals.
- [Story 1.6](1-6-image-optimization-script.md): (Planned) Automated script. If not available, use manual tools (e.g., Squoosh, Sharp) or write a temporary script.

## Dev Agent Record

### Agent Model Used
{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
