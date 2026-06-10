## 1. Admin Field Guide API

- [ ] 1.1 Create `src/field-guide-admin-handlers.ts` with handlers for region CRUD, storyline-region mapping CRUD, and collectible CRUD. Each handler validates admin session, performs the requested DB operation on `field_guide_regions`, `storyline_region_mappings`, or `collectible_definitions`, logs via `logAdminAction` from `admin-handlers.ts`, and returns JSON responses.
- [ ] 1.2 Implement validation for: region slug (required, max 80, kebab-case, unique), region title (required, max 120), collectible category (required, `flora` or `fauna`), collectible rarity (required, `common`/`uncommon`/`rare`), collectible slot order (required, integer, unique per region), mapping start/end distance (required, numbers, end > start, non-overlapping per storyline). Return `{ error: "validation", fields: { ... } }` on failure.
- [ ] 1.3 Implement mapping coverage validation: after creating or updating a mapping, compute covered ranges per storyline, identify gaps and overlaps, and return a coverage summary with color-coded ranges.
- [ ] 1.4 Wire admin Field Guide routes into `src/index.ts` under the admin block: nested routes under `/api/admin/field-guide/regions`, `/api/admin/field-guide/mappings`, and `/api/admin/field-guide/collectibles`. Add `matchRoute` patterns to `getAllowedMethods`.
- [ ] 1.5 Add Jest coverage for: admin CRUD operations (regions, mappings, collectibles), field validation, non-admin rejection, mapping overlap detection, coverage validation, and audit log entries.

## 2. Admin Field Guide UI

- [ ] 2.1 Create `src/renderAdminFieldGuidePage.ts` SSR shell rendering the `/admin/field-guide` page with admin layout, sidebar navigation (adding "Field Guide" link), and a `data-island="AdminFieldGuideIsland"` placeholder.
- [ ] 2.2 Wire the `/admin/field-guide` page route in `src/index.ts` to serve `renderAdminFieldGuidePage()`.
- [ ] 2.3 Create `client/src/islands/AdminFieldGuideIsland.tsx` with three tabbed or collapsible sections: Regions (list + create/edit/delete forms), Mappings (storyline selector + distance-band table with coverage visualization), and Collectibles (per-region catalog with category/rarity/slot-order/artwork forms).
- [ ] 2.4 Implement the Regions section: displays region list with slug, title, sort order. Inline create/edit form with slug, title, description, image slug, and sort order fields.
- [ ] 2.5 Implement the Mappings section: storyline dropdown selector, table of current mappings with start/end distances and region names, coverage visualization bar (green/yellow/red), and create/edit form.
- [ ] 2.6 Implement the Collectibles section: region selector, slot-order table with category, rarity, image slug, silhouette slug, and lore text. Inline create/edit form with all collectible fields.
- [ ] 2.7 Add "Field Guide" link to the admin sidebar navigation in all existing admin page renderers.

## 3. Registration and Styling

- [ ] 3.1 Register `AdminFieldGuideIsland` in `client/src/index.tsx`: add import, add to `autoHydratedIslands` and `allIslands` objects.
- [ ] 3.2 Add admin CSS for the Field Guide management sections following existing admin style patterns. Reference the stylesheet from `renderAdminFieldGuidePage.ts`.

## 4. Validation

- [ ] 4.1 Add Vitest coverage for `AdminFieldGuideIsland`: renders region list with create/edit forms, renders mappings table with coverage visualization, renders collectible catalog with slot ordering, validates form fields, and shows validation errors.
- [ ] 4.2 Run `npm test` and fix regressions related to admin Field Guide handlers, route dispatch, and audit logging.
- [ ] 4.3 Run `npm run test:client` and fix regressions related to the new admin island and island registration.
- [ ] 4.4 Run `npm run check` and resolve any TypeScript or Wrangler dry-run issues.
- [ ] 4.5 Update `docs/api-reference.md` with admin Field Guide endpoint specifications.
