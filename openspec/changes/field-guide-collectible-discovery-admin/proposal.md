## Why

`field-guide-collectible-discovery-core` seeds Field Guide regions, mappings, and collectibles via migration, but without an admin interface, adding new regions or collectibles requires writing migrations. This change gives admins a UI to manage the Field Guide catalog — creating regions, mapping them to storyline distance bands, authoring collectible entries with artwork and lore, and tuning discovery parameters — so the Field Guide can grow without code changes.

## What Changes

- Add admin API endpoints for CRUD operations on Field Guide regions, storyline-region distance mappings, and collectible catalog entries.
- Add a dedicated admin Field Guide management page at `/admin/field-guide` with its own SSR shell and navigation entry.
- Build an `AdminFieldGuideIsland` Preact island with three management sections: regions (with storyline mapping controls), collectibles (with slot ordering, category/rarity selection, artwork slugs, and authored lore), and mapping validation with gap/overlap feedback.
- Add admin audit logging for region, mapping, and collectible mutations using the existing `admin_audit_log` table.
- Validate region slugs, collectible categories, rarity tiers, slot ordering, and non-overlapping active mappings before persistence.
- Future: expose discovery engine tuning parameters via this admin surface (rarity odds, distance budget, long-walk thresholds) as a follow-on enhancement.

## Capabilities

### New Capabilities
- `field-guide-collectible-discovery-admin`: Admin CRUD APIs for Field Guide regions, storyline-region mappings, and collectible catalog entries, with a dedicated admin management page and coverage validation.

### Modified Capabilities
- None.

## Impact

- Worker APIs: new admin endpoints under `/api/admin/field-guide` for region, mapping, and collectible CRUD, guarded by `validateAdminSession`. Reads and writes the `field_guide_regions`, `storyline_region_mappings`, and `collectible_definitions` tables from `field-guide-collectible-discovery-core`.
- Frontend: new `/admin/field-guide` SSR shell (`renderAdminFieldGuidePage.ts`) and `AdminFieldGuideIsland` Preact island registered in `client/src/index.tsx`.
- Admin navigation: new "Field Guide" link in the admin sidebar.
- Admin audit: insert rows into `admin_audit_log` on region, mapping, and collectible mutations.
- CSS: new field guide admin styles within the existing admin CSS patterns.
- Tests: Jest coverage for admin API auth, validation, and CRUD; Vitest coverage for the admin island forms, mapping controls, and validation display.
- Documentation: update `docs/api-reference.md` with admin field guide endpoints.
