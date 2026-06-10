## Context

Walk to Mordor already models journey progress as raw walking distance plus storyline-specific presentation state. Milestones are currently deterministic because they are tied to ordered `storyline_goals`, while the map can already derive exact coordinates for any distance on a path through the existing `getUserPosition()` pipeline.

The product shape is a global Field Guide spanning all storylines, with reusable regions such as Hollin or Fangorn appearing once in the collection even when they map to multiple storyline distance bands. Discoveries must feel exploratory rather than deterministic, preserve duplicates immutably, and place first-discovery markers on the map without being vulnerable to progress-edit farming.

This is cross-cutting because it introduces new D1 models, new public APIs, progress-handler side effects, new Field Guide UI, and a new Konva marker layer. Admin workflows for region/collectible management are handled separately in `field-guide-collectible-discovery-admin`. The design references the shared `achievement_definitions` table from `shared-achievement-infrastructure` for forward compatibility with future duplicate-threshold badges.

## Goals / Non-Goals

**Goals:**
- Provide one global Field Guide collection per user that persists across storyline switches.
- Model reusable regions separately from storyline mappings so the same region and collectible roster can appear on multiple routes at different distances.
- Let admins manage regions, region-to-storyline distance bands, and collectible catalog entries independently from storyline admin (admin APIs and UI are in `field-guide-collectible-discovery-admin`).
- Trigger collectible discovery from positive walk-distance changes rather than fixed milestone unlocks.
- Support duplicates as immutable discovery instances while revealing each collectible slot on first find.
- Show first-discovery markers on compatible map paths.
- Count both first discoveries and duplicates in the Field Guide drawer badge.
- Keep the MVP limited to flora and fauna while staying compatible with future repeatable badge support.
- Avoid historical backfill so the collection begins fresh at launch.
- When map dev mode (`window.__MAP_DEV_LOG`) is active, render region distance bands visually on the path so developers can debug mapping coverage and boundary placement.

**Non-Goals:**
- No milestone-based collectible unlocks.
- No non-flora/fauna categories in MVP.
- No per-duplicate map markers in MVP.
- No social sharing, showcasing, or friend-visible collectible markers in MVP.
- No duplicate-threshold achievement awarding in MVP.
- No requirement that every storyline distance must belong to a mapped region in the first release.
- No revocation of discoveries after walk edits or deletes.
- No admin management UI in this change (in `field-guide-collectible-discovery-admin`).

## Decisions

### Use global reusable regions plus storyline distance-band mappings

The design will model Field Guide regions as first-class reusable entities with their own slug, title, description, artwork metadata, and global sort order. A separate mapping table will link each region to one or more storylines with start and end distance bands.

Rationale: the product explicitly wants one shared Hollin collection even when Hollin appears on multiple outward and return journeys. Tying regions directly to a single storyline would duplicate content and fracture the user's collection.

Alternative considered: storing region labels directly on collectibles or on storyline rows. Rejected because the same region would need duplicated entries and would not support one shared Field Guide section across routes.

### Keep collectible entries global to a region, not to goals or storyline mappings

Collectible definitions will belong to a reusable region and carry category (`flora` or `fauna`), rarity tier, slot order, name, lore text, and illustration metadata. Storyline mappings determine where a region is encountered; they do not create storyline-specific copies of collectibles.

Rationale: users should reveal the same region roster regardless of which storyline led them there. This also keeps the Field Guide page global instead of route-fragmented.

Alternative considered: attaching collectibles directly to storyline-region mappings. Rejected because it would create duplicate region pages and make global collection progress incoherent.

### Trigger discovery from positive walk deltas and split attempts by traversed region segments

Discovery rolls will be evaluated only when a walk entry adds positive distance on `POST` or `PUT`. The system will derive the positive delta in displayed storyline distance, intersect that interval with the active storyline's mapped region bands, and allocate discovery attempts across the traversed region segments rather than only the ending region.

Rationale: this matches the intended feel of finding things while traveling through the world, including long walks that cross region boundaries.

Alternative considered: rolling only against the ending region. Rejected because it makes boundaries gameable and causes long walks to skip collectibles from regions the user actually traversed.

### Use distance-budget attempts with tier-based odds and a long-walk rare bump

The system will convert each positive walked delta into multiple discovery attempts from a distance budget. Each attempt first rolls a 1-in-10 chance of finding anything at all. If that succeeds, a rarity tier is resolved using the configured tier odds, then a collectible is selected uniformly from eligible items in the active region pool for that tier. Long walks receive a rare-tier multiplier based on distance.

**Tuning parameters** (configurable constants, adjustable without schema changes):
| Parameter | Default | Description |
|-----------|---------|-------------|
| Rarity tier odds | Common 75%, Uncommon 20%, Rare 5% | Probability distribution for tier selection |
| Distance budget | 1 attempt per km | How many discovery rolls per km walked |
| Base find chance | 1-in-10 (10%) | Chance that any attempt yields a discovery |
| Long-walk threshold min | 10 km | Distance below which no rare bump applies |
| Long-walk threshold max | 20 km | Distance at which rare bump caps |
| Rare multiplier at cap | 3× | Maximum rare-tier probability multiplier |
| Rare multiplier curve | Gentle exponential | 10 km = 1×, 15 km ≈ 1.5×, 20 km = 3× |
| Per-request attempt cap | 999 (effectively uncapped) | Can be lowered later for tuning |

Rationale: these defaults make the first discovery feel achievable while keeping rares genuinely exciting. The two-phase roll (find something → which tier) lets us tune overall drop rates and rarity distribution independently. All values are configurable constants so the admin UI (`field-guide-collectible-discovery-admin`) can expose tuning controls later.

### Prevent progress-edit farming with per-date discovery high-water state

The system will track a per-user, per-date high-water mark for discovery processing. New walk entries process their full distance once. Updates only generate new discovery attempts for distance above that date's previously processed high-water mark. Decreases and deletes do not revoke discoveries and do not reduce the stored high-water mark.

Rationale: discoveries are meant to be immutable, but the product also should not allow farming by repeatedly raising and lowering the same daily entry.

Alternative considered: using the current row value only and ignoring prior processed state. Rejected because a user could repeatedly edit the same date downward and upward to farm discoveries.

### Store immutable discovery instances and derive duplicates and first markers from them

Each successful discovery will be stored as an append-only discovery instance containing the user, collectible, discovered-at timestamp, storyline context, path key, and displayed storyline distance at the moment of discovery. The first instance for a collectible becomes the source of truth for its map marker. Duplicate counts are derived by counting all instances for that collectible and user.

Rationale: append-only discovery instances align with the desired immutable collection behavior and keep future repeatable badge integration compatible with the shared achievement direction already being established elsewhere.

Alternative considered: one mutable row per user and collectible with an incrementing counter. Rejected because it loses first-discovery context and makes future occurrence-based rewards less robust.

### Keep unread badge state server-backed and count duplicates

Unread Field Guide state will be tracked in D1 using user-scoped state that records the latest seen discovery instance. The drawer badge will count all later discovery instances, including duplicates, until the user visits or explicitly marks the Field Guide as seen.

**"Last visit" is defined as opening the Field Guide page.** When the user navigates to `/field-guide`, the mark-seen endpoint is called, which updates the stored `last_seen_discovery_id` to the latest discovery instance ID. The drawer badge count becomes zero. New discoveries (first finds or duplicates) after that visit increment the badge count again.

Rationale: the collection is global and durable, so unread state should behave consistently across devices and browsers. Opening the Field Guide page is the natural "acknowledge" action — users who care about the badge will open it.

Alternative considered: localStorage-only last-visit tracking. Rejected because it makes badge counts device-specific and out of sync with a global collection.

### Use dedicated silhouette image slugs with CSS blur treatment

Each collectible definition includes a `silhouette_image_slug` — a black, lower-resolution version of the collectible's key visual with an alpha-channel border. Undiscovered slots render this silhouette with CSS `filter: blur(8px)` and reduced opacity to create a shadowy, mysterious appearance. Discovered slots reveal the full-resolution `image_slug` at full opacity and sharpness.

A generic placeholder silhouette (`field-guide/placeholder`) provides a shadowy question-mark shape for collectibles that don't have their own silhouette art yet, or as a fallback.

Rationale: black silhouettes with blur and opacity create a unified "unlocked" aesthetic across all slots. The alpha-channel border lets key recognizable shapes peek through the blur. Dedicated silhouette slugs allow authors to choose what part of each creature is most visually identifiable.

Alternative considered: CSS-only silhouette via `brightness(0)` on the full image. Rejected because it doesn't allow selective key-shape emphasis and looks bad for complex images.

### Empty state for first-time visitors: all silhouettes visible

A user who has never discovered anything sees all region sections with all silhouette slots rendered in their blurred/shadow state. There is no "start walking" message or gated content — the full Field Guide catalog is visible from the moment the user first visits. The silhouettes themselves communicate "there are things to find here."

Rationale: hiding content behind zero discoveries would make the page look broken. Showing all regions and silhouettes gives users an immediate sense of the collection's scope and motivates walking. This matches the spec's existing statement: "silhouettes visible from the start."

### Show first-discovery markers only on matching map paths

Map markers will render only for collectibles whose first discovery was recorded on the currently displayed map path. If the user switches to a different storyline path, markers from incompatible paths are hidden rather than projected onto the wrong route. Duplicates do not create additional markers in MVP.

Rationale: first-discovery locations are path-specific because map coordinates are derived from the stored path and storyline distance at discovery time.

Alternative considered: projecting every first discovery onto every mapped storyline version of the same region. Rejected because it invents locations the user never actually discovered on that route.

### Keep region admin separate from storyline admin while allowing mapping crossover

Regions and collectibles will be administered in a dedicated Field Guide admin surface (in `field-guide-collectible-discovery-admin`). The core change does not include admin UI — only the public-facing discovery experience. Data for regions, mappings, and collectibles is seeded via migration.

Rationale: the product explicitly wants region management separate from storyline admin. Splitting admin into its own change follows the established pattern (personal-challenges-admin, community-campaigns-admin, storyline-books-admin).

## Risks / Trade-offs

- [Route mapping ambiguity] → Overlapping region bands within the same storyline could make discovery pools ambiguous. Mitigation: disallow overlapping active mappings per storyline while permitting unmapped gaps.
- [Progress hook contention] → This change and existing progress reconciliation hooks (party sync, event reconciliation) all need side effects in `progress-handlers.ts`. Mitigation: isolate each concern's post-write processing and keep failures from blocking walk saves.
- [Large walk entries skew rarity] → Very large manual entries can distort perceived rarity. Mitigation: use distance-budget attempts with configured per-request caps and a modest rare-tier bump rather than uncapped percentage escalation.
- [Map clutter] → A mature collection can place many first-discovery markers on one path. Mitigation: reuse existing Konva marker clustering and keep MVP to first-discovery markers only.
- [Partial region coverage] → Unmapped storyline gaps mean users may walk without eligible discoveries in some spans. Mitigation: allow this in MVP for rollout flexibility; gaps are visible in admin tooling (in `field-guide-collectible-discovery-admin`).
- [Cross-change achievement drift] → Future duplicate-threshold badges could fork from the shared achievement model. Mitigation: store immutable discovery instances in a shape compatible with later occurrence-based badge awarding instead of inventing a separate mutable counter model.

## Migration Plan

1. Add additive D1 migrations for reusable regions, storyline-region mappings, collectible definitions, discovery high-water state, immutable user discovery instances, and user unread state.
2. Seed initial reusable regions, mappings, and flora/fauna catalog entries before enabling discovery logic in production.
3. Add public Field Guide list/detail/status endpoints plus a mark-seen endpoint for unread badge behavior.
4. Extend progress create and update flows to evaluate discovery attempts from positive deltas, while leaving delete flows non-revoking.
5. Add the Field Guide page, drawer badge updates, and first-discovery map markers.
6. Update docs and add backend, client, and Playwright coverage.
7. Update docs and add backend, client, and Playwright coverage.

Rollback strategy: keep migrations additive. If the UI or route handlers need to be rolled back, the app can stop reading Field Guide tables without affecting canonical walk history. Existing discovery instances remain stored for later repair or re-enable, and no revocation is required.

## Open Questions

None currently blocking. Initial rarity-tier odds, long-walk threshold, and per-request attempt caps can be implementation-tuned as constants within the constraints of this design.