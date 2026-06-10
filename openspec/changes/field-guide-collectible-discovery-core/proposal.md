## Why

Walk to Mordor currently rewards progress mainly through fixed milestones. A collectible field guide becomes more motivating if it behaves like exploration: users discover flora and fauna through walking itself, keep a permanent collection across all storylines, and gain reasons to keep logging distance even between major milestones.

## What Changes

- Introduce a global Field Guide collection for collectible Middle-earth flora and fauna that persists across all storylines.
- Model reusable geographic regions in D1, with separate storyline-to-region distance-band mappings so the same region and guide page can appear at different distances on different routes.
- Add admin management for Field Guide regions, region-to-storyline mappings, and collectible catalog entries with category, rarity tier, artwork, silhouette ordering, and authored lore text (handled separately in `field-guide-collectible-discovery-admin`).
- Add probabilistic discovery triggered by positive walk-distance changes, using multiple attempts from a walk-distance budget, immutable discovery records, and rarity-tier odds with a slight rare-tier bump for unusually long walk entries.
- Show the Field Guide as a dedicated user-facing page with region sections in fixed slot order, silhouettes visible from the start, discovered entries revealed in place, duplicate counts, and filters for flora and fauna.
- Add first-discovery map markers so users can see where each collectible was first found on the active storyline path.
- Add lightweight “new since last visit” tracking for the Field Guide drawer badge, counting both first discoveries and duplicates.
- Explicitly defer duplicate-threshold achievements, sharing/showcasing, and non-flora/fauna categories from MVP while keeping the design compatible with the shared repeatable-achievement model already being introduced elsewhere.
- Do not backfill discoveries for existing users; collection starts fresh when the feature launches.

## Capabilities

### New Capabilities
- `field-guide-collectible-discovery-core`: Reusable Field Guide regions and route mappings, probabilistic walk-triggered discovery, immutable duplicate collection, Field Guide presentation, and first-discovery map markers.

### Modified Capabilities
None.

## Impact

- D1 schema: new tables for Field Guide regions, storyline-region distance mappings, collectible definitions, user discovery instances, and last-visit or unread-count support as needed for badge behavior.
- Worker APIs: public Field Guide list/detail/status endpoints, unread-state and mark-seen endpoints, and progress-handler hooks to evaluate discovery rolls on walk create/update flows. Admin CRUD endpoints are in `field-guide-collectible-discovery-admin`.
- Frontend: new SSR Field Guide page plus Preact island, Drawer navigation badge updates, Konva map marker layer for first discoveries, and supporting client stores.
- Cross-change coordination: references the `achievement_definitions` table from `shared-achievement-infrastructure` for forward compatibility with future duplicate-threshold badges. Discovery instances are stored in a shape compatible with later occurrence-based badge awarding. Progress hooks are isolated from existing walk save flows.
- Rendering and content: should reuse the existing Markdown rendering and image-management patterns where possible without coupling discovery to goal unlock behavior.
- Testing and docs: requires Jest, Vitest, and Playwright coverage plus updates to data model, API, frontend, architecture, and asset workflow docs.