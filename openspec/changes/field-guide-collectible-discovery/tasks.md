## 1. Schema And Domain Foundations

- [ ] 1.1 Add D1 migrations for reusable Field Guide regions, storyline-region distance mappings, collectible definitions, per-date discovery high-water state, immutable user discovery instances, and user unread state.
- [ ] 1.2 Seed initial flora/fauna regions, reusable storyline mappings, and collectible catalog rows needed for the MVP launch set.
- [ ] 1.3 Add strict TypeScript interfaces and data-access helpers for regions, mappings, collectibles, discovery instances, high-water state, unread state, and public/admin response shapes.
- [ ] 1.4 Implement validation for region slugs, collectible categories, rarity tiers, slot ordering, and non-overlapping active mappings within a storyline.

## 2. Discovery Engine And Progress Integration

- [ ] 2.1 Extend walk create/update flows to load the previous saved distance, calculate the positive delta, and respect the per-date discovery high-water mark.
- [ ] 2.2 Implement storyline-aware interval resolution so a positive walk delta is split across each mapped region band traversed during that save.
- [ ] 2.3 Implement the distance-budget discovery engine with shared rarity-tier odds, a configured per-request attempt cap, and a long-walk rare-tier bump.
- [ ] 2.4 Persist immutable discovery instances with storyline, path, and first-discovery distance context, and ensure deletes or negative updates never revoke discoveries.
- [ ] 2.5 Isolate Field Guide post-write discovery processing alongside existing progress side effects so failures do not break the primary walk save flow.

## 3. Admin APIs And Management UI

- [ ] 3.1 Implement admin region CRUD endpoints plus storyline-mapping endpoints for reusable Field Guide regions.
- [ ] 3.2 Implement admin collectible CRUD endpoints with validation for flora/fauna category, rarity tier, slot order, illustrations, and authored lore content.
- [ ] 3.3 Add a dedicated admin Field Guide region management surface with mapping controls and gap/overlap validation feedback.
- [ ] 3.4 Add a dedicated admin collectible management surface with slot ordering, content preview, and illustration selection workflow.

## 4. Public Field Guide APIs And State

- [ ] 4.1 Implement public Field Guide list and detail endpoints that return the global region collection, fixed slot roster, discovery state, duplicate counts, and category-filterable item data.
- [ ] 4.2 Implement unread-status and mark-seen endpoints backed by server-side unread state so duplicates and first discoveries both contribute to the drawer badge.
- [ ] 4.3 Implement public map-marker data for first discoveries, filtered to the currently viewed compatible path and derived from stored first-discovery context.

## 5. User-Facing Field Guide And Map UI

- [ ] 5.1 Add the `/field-guide` SSR shell, stylesheet wiring, and Preact island registration following existing page patterns.
- [ ] 5.2 Build the Field Guide island with authored region order, fixed silhouette slots, discovered detail views, duplicate counts, progress indicators, and flora/fauna filters.
- [ ] 5.3 Add the Drawer navigation link and unread badge behavior for the Field Guide.
- [ ] 5.4 Add a Konva first-discovery marker layer on the map that shows only compatible-path first discoveries and does not add markers for duplicates.
- [ ] 5.5 Add dev-mode region band overlays on the map path when `window.__MAP_DEV_LOG` is active, rendering each mapped region band visually for debugging and testing.

## 6. Validation And Documentation

- [ ] 6.1 Add Jest coverage for mapping validation, positive-delta/high-water discovery processing, multi-region traversal, immutable duplicate behavior, unread-state updates, and no-backfill rollout behavior.
- [ ] 6.2 Add Vitest coverage for Field Guide region rendering, silhouettes, revealed details, duplicate counts, filters, unread badge behavior, and admin management forms.
- [ ] 6.3 Add Playwright coverage for admin setup, post-launch discovery flow, duplicate unread counts, and first-discovery map marker rendering.
- [ ] 6.4 Update `docs/data-models.md`, `docs/api-reference.md`, `docs/frontend-guide.md`, `docs/architecture.md`, and `docs/asset-workflow.md` for the Field Guide discovery model.
- [ ] 6.5 Run focused backend, client, and UI validation commands and fix regressions related to the new schema, progress hooks, Field Guide UI, and map marker behavior.