## Context

`field-guide-collectible-discovery-core` creates the `field_guide_regions`, `storyline_region_mappings`, and `collectible_definitions` tables and seeds initial data. This change adds the admin CRUD layer on top of those tables and a dedicated management page at `/admin/field-guide`.

The existing admin pattern applies: handler file per domain, admin session validation, audit logging via `logAdminAction`, Preact island with `data-island` hydration. Unlike encounters and campaigns (which live on the `/admin` dashboard), Field Guide admin gets its own page — regions and collectibles form a substantial catalog that needs dedicated screen real estate.

## Goals / Non-Goals

**Goals:**
- Provide admin APIs to create, read, update, and delete Field Guide regions, storyline-region distance mappings, and collectible catalog entries.
- Provide a dedicated `/admin/field-guide` page with tabbed or sectioned management for regions, mappings, and collectibles.
- Validate region slugs, collectible categories (flora/fauna), rarity tiers (common/uncommon/rare), slot ordering uniqueness, and non-overlapping active storyline mappings.
- Show mapping coverage validation (gaps, overlaps) inline.
- Log all mutations to `admin_audit_log`.

**Non-Goals:**
- No discovery tuning parameter UI in this change (rarity odds, distance budget — future follow-on).
- No image upload or asset management (uses existing image slug entry).
- No bulk import/export.

## Decisions

### Dedicated admin page rather than dashboard section

Field Guide admin lives at `/admin/field-guide` with its own SSR shell and island, rather than being embedded on the dashboard. A new "Field Guide" link is added to the admin sidebar navigation.

Rationale: unlike encounter definitions or campaigns (which are simple list + forms), Field Guide management involves regions, mappings across storylines, and a collectible catalog — it needs dedicated space. The sidebar link follows the established admin navigation pattern.

### Three management sections on one page

The `AdminFieldGuideIsland` renders three collapsible or tabbed sections:
- **Regions**: list of reusable regions with create/edit/delete. Each region shows its slug, title, global sort order, and artwork metadata.
- **Mappings**: per-storyline distance-band mappings. An admin selects a storyline, then assigns regions to distance ranges. Overlapping mappings are flagged.
- **Collectibles**: per-region catalog entries with category (flora/fauna), rarity tier, slot order, artwork slugs (image and silhouette), authored lore text, and description.

Rationale: these three concerns are interdependent (a collectible belongs to a region; a region is mapped to storylines). Managing them on one page with contextual linking makes the workflow coherent.

### Admin APIs under /api/admin/field-guide

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/admin/field-guide/regions` | List all regions |
| POST | `/api/admin/field-guide/regions` | Create a region |
| GET | `/api/admin/field-guide/regions/:id` | Get region detail |
| PUT | `/api/admin/field-guide/regions/:id` | Update region |
| DELETE | `/api/admin/field-guide/regions/:id` | Delete region |
| GET | `/api/admin/field-guide/regions/:id/mappings` | List mappings for a region |
| POST | `/api/admin/field-guide/regions/:id/mappings` | Create a storyline mapping |
| PUT | `/api/admin/field-guide/mappings/:id` | Update a mapping |
| DELETE | `/api/admin/field-guide/mappings/:id` | Delete a mapping |
| GET | `/api/admin/field-guide/regions/:id/collectibles` | List collectibles for a region |
| POST | `/api/admin/field-guide/regions/:id/collectibles` | Create a collectible |
| PUT | `/api/admin/field-guide/collectibles/:id` | Update a collectible |
| DELETE | `/api/admin/field-guide/collectibles/:id` | Delete a collectible |

Rationale: follows the nested resource pattern — collectibles and mappings belong to a region. This mirrors the existing `/api/admin/storylines/:id/goals` pattern.

### Validation rules

- Region slug: required, max 80 chars, kebab-case, unique
- Region title: required, max 120 chars
- Collectible category: required, must be `flora` or `fauna`
- Collectible rarity tier: required, must be `common`, `uncommon`, or `rare`
- Collectible slot order: required, integer, unique per region
- Mapping start/end distance: required, numbers, end > start, non-overlapping with other active mappings for the same storyline

### Mapping coverage validation

After creating or updating a mapping, the API returns the region gaps and overlaps for that storyline. The admin UI renders this as a visual summary: green for covered, yellow for unmapped gaps, red for overlapping bands. This helps admins ensure complete coverage before activating a storyline with Field Guide content.

### No new D1 migrations

This change reads and writes only the tables created by `field-guide-collectible-discovery-core`. No schema changes.

## Risks / Trade-offs

- [Dedicated admin page adds sidebar navigation item] → Follows existing pattern. New "Field Guide" link between "Metrics" and "Back to Site".
- [Mapping validation may flag intentional gaps] → Gaps are yellow warnings, not red errors. Admins can choose to leave gaps if some storyline distances intentionally have no Field Guide content.

## Migration Plan

1. Create `src/field-guide-admin-handlers.ts` with region, mapping, and collectible CRUD handlers.
2. Wire routes into `src/index.ts` under the admin block and `getAllowedMethods`.
3. Create `src/renderAdminFieldGuidePage.ts` SSR shell.
4. Create `AdminFieldGuideIsland` Preact island with three management sections.
5. Add "Field Guide" link to admin sidebar navigation in all admin page renderers.
6. Register island and add route for `/admin/field-guide`.
7. Add Jest and Vitest coverage.
8. Update docs.

Rollback: remove the island, page route, handler file, and sidebar link. No schema to revert.

## Open Questions

None.
