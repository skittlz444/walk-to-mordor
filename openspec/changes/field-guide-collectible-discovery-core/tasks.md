## 1. Schema And Domain Foundations

- [ ] 1.1 Add D1 migrations for reusable Field Guide regions, storyline-region distance mappings, collectible definitions, per-date discovery high-water state, immutable user discovery instances, and user unread state.
- [ ] 1.2 Seed initial flora/fauna regions, reusable storyline mappings, and collectible catalog rows needed for the MVP launch set.
- [ ] 1.3 Add strict TypeScript interfaces and data-access helpers for regions, mappings, collectibles, discovery instances, high-water state, unread state, and public response shapes. Admin interfaces are defined in `field-guide-collectible-discovery-admin`.
- [ ] 1.4 Implement validation for region slugs, collectible categories, rarity tiers, slot ordering, and non-overlapping active mappings within a storyline.

## 2. Discovery Engine And Progress Integration

- [ ] 2.1 Extend walk create/update flows to load the previous saved distance, calculate the positive delta, and respect the per-date discovery high-water mark.
- [ ] 2.2 Implement storyline-aware interval resolution so a positive walk delta is split across each mapped region band traversed during that save.
- [ ] 2.3 Implement the distance-budget discovery engine: 1 attempt per km walked × 1-in-10 base find chance. On success, roll for rarity tier using 75/20/5 odds then select uniformly from eligible collectibles in that tier. Apply long-walk rare multiplier: starts at 10 km (1×), gentle exponential curve to 20 km (3× cap). All tuning parameters are configurable constants. No per-request attempt cap (nominally 999).
- [ ] 2.4 Persist immutable discovery instances with storyline, path, and first-discovery distance context, and ensure deletes or negative updates never revoke discoveries.
- [ ] 2.5 Isolate Field Guide post-write discovery processing alongside existing progress side effects so failures do not break the primary walk save flow.

## 3. Public Field Guide APIs And State

- [ ] 3.1 Implement public Field Guide list and detail endpoints that return the global region collection, fixed slot roster, discovery state, duplicate counts, and category-filterable item data.
- [ ] 3.2 Implement unread-status and mark-seen endpoints backed by server-side unread state so duplicates and first discoveries both contribute to the drawer badge.
- [ ] 3.3 Implement public map-marker data for first discoveries, filtered to the currently viewed compatible path and derived from stored first-discovery context.

## 4. User-Facing Field Guide And Map UI

- [ ] 4.1 Add the `/field-guide` SSR shell, stylesheet wiring, and Preact island registration following existing page patterns.
- [ ] 4.2 Build the Field Guide island with authored region order, fixed silhouette slots (rendering `silhouette_image_slug` with CSS blur and reduced opacity for undiscovered, `image_slug` at full clarity for discovered), discovered detail views, duplicate counts, progress indicators, and flora/fauna filters. First-time empty state shows all regions and silhouettes — no "start walking" message. Use generic placeholder silhouette (`field-guide/placeholder`) as fallback for missing silhouette art.
- [ ] 4.3 Add the Drawer navigation link and unread badge behavior for the Field Guide.
- [ ] 4.4 Add a Konva first-discovery marker layer on the map that shows only compatible-path first discoveries and does not add markers for duplicates.
- [ ] 4.5 Add dev-mode region band overlays on the map path when `window.__MAP_DEV_LOG` is active, rendering each mapped region band visually for debugging and testing.

## 5. Validation And Documentation

- [ ] 5.1 Add Jest coverage for mapping validation, positive-delta/high-water discovery processing, multi-region traversal, immutable duplicate behavior, unread-state updates, and no-backfill rollout behavior.
- [ ] 5.2 Add Vitest coverage for Field Guide region rendering, silhouettes, revealed details, duplicate counts, filters, and unread badge behavior. Admin UI Vitest coverage is in `field-guide-collectible-discovery-admin`.
- [ ] 5.3 Add Playwright coverage for post-launch discovery flow, duplicate unread counts, and first-discovery map marker rendering. Admin setup Playwright coverage is in `field-guide-collectible-discovery-admin`.
- [ ] 5.4 Update `docs/data-models.md`, `docs/api-reference.md`, `docs/frontend-guide.md`, `docs/architecture.md`, and `docs/asset-workflow.md` for the Field Guide discovery model.
- [ ] 6.5 Run focused backend, client, and UI validation commands and fix regressions related to the new schema, progress hooks, Field Guide UI, and map marker behavior.