## Context

Walk to Mordor already models journey progress as raw walking distance plus storyline-specific presentation state. Milestones are currently deterministic because they are tied to ordered `storyline_goals`, while the map can already derive exact coordinates for any distance on a path through the existing `getUserPosition()` pipeline.

The product shape is a global Field Guide spanning all storylines, with reusable regions such as Hollin or Fangorn appearing once in the collection even when they map to multiple storyline distance bands. Discoveries must feel exploratory rather than deterministic, preserve duplicates immutably, and place first-discovery markers on the map without being vulnerable to progress-edit farming.

This is cross-cutting because it introduces new D1 models, new admin workflows, new public APIs, progress-handler side effects, new Field Guide UI, and a new Konva marker layer. It also overlaps with active OpenSpec work around progress reconciliation, immutable repeatable achievements, and route-aware presentation.

## Goals / Non-Goals

**Goals:**
- Provide one global Field Guide collection per user that persists across storyline switches.
- Model reusable regions separately from storyline mappings so the same region and collectible roster can appear on multiple routes at different distances.
- Let admins manage regions, region-to-storyline distance bands, and collectible catalog entries independently from storyline admin.
- Trigger collectible discovery from positive walk-distance changes rather than fixed milestone unlocks.
- Support duplicates as immutable discovery instances while revealing each collectible slot on first find.
- Show first-discovery markers on compatible map paths.
- Count both first discoveries and duplicates in the Field Guide drawer badge.
- Keep the MVP limited to flora and fauna while staying compatible with future repeatable badge support.
- Avoid historical backfill so the collection begins fresh at launch.
- When map dev mode (`window.__MAP_DEV_LOG`) is active, render region distance bands visually on the path so admins and developers can debug mapping coverage and boundary placement.

**Non-Goals:**
- No milestone-based collectible unlocks.
- No non-flora/fauna categories in MVP.
- No per-duplicate map markers in MVP.
- No social sharing, showcasing, or friend-visible collectible markers in MVP.
- No duplicate-threshold achievement awarding in MVP.
- No requirement that every storyline distance must belong to a mapped region in the first release.
- No revocation of discoveries after walk edits or deletes.

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

The system will convert each positive walked delta into multiple discovery attempts from a distance budget. Attempts first resolve a rarity tier using shared tier odds, then select uniformly from eligible undiscovered or already-discovered collectibles in the active region pool for that tier. Walk entries above a configured long-walk threshold will receive a slight bump toward rarer tiers, but MVP will not store per-item roll weights.

Rationale: this preserves the user's desired “chance scales with distance entered” behavior while keeping rarity tuning understandable and content authoring simple.

Alternative considered: one large percentage roll per walk entry. Rejected because it is harder to tune across short and long walks and makes edge cases around very large manual entries more extreme.

Alternative considered: item-specific roll weights. Rejected for MVP because the user explicitly wants rarity-tier-based odds instead of authoring per-item chances.

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

Rationale: the collection is global and durable, so unread state should behave consistently across devices and browsers.

Alternative considered: localStorage-only last-visit tracking. Rejected because it makes badge counts device-specific and out of sync with a global collection.

### Show first-discovery markers only on matching map paths

Map markers will render only for collectibles whose first discovery was recorded on the currently displayed map path. If the user switches to a different storyline path, markers from incompatible paths are hidden rather than projected onto the wrong route. Duplicates do not create additional markers in MVP.

Rationale: first-discovery locations are path-specific because map coordinates are derived from the stored path and storyline distance at discovery time.

Alternative considered: projecting every first discovery onto every mapped storyline version of the same region. Rejected because it invents locations the user never actually discovered on that route.

### Keep region admin separate from storyline admin while allowing mapping crossover

Regions and collectibles will be administered in a dedicated Field Guide admin surface. Storyline crossover will be handled through explicit mapping UIs or APIs that reference existing storylines, but Field Guide administration will not be embedded inside the storyline editor.

Rationale: the product explicitly wants region management separate from storyline admin, while still supporting reusable distance-band mappings.

Alternative considered: extending `AdminStorylinesIsland` directly. Rejected because it would mix route editing with collectible catalog management and make reusable-region authoring harder to reason about.

## Risks / Trade-offs

- [Route mapping ambiguity] → Overlapping region bands within the same storyline could make discovery pools ambiguous. Mitigation: disallow overlapping active mappings per storyline while permitting unmapped gaps.
- [Progress hook contention] → This change and the active events work both need side effects in `progress-handlers.ts`. Mitigation: centralize post-write hooks and keep each concern isolated and idempotent.
- [Large walk entries skew rarity] → Very large manual entries can distort perceived rarity. Mitigation: use distance-budget attempts with configured per-request caps and a modest rare-tier bump rather than uncapped percentage escalation.
- [Map clutter] → A mature collection can place many first-discovery markers on one path. Mitigation: reuse existing Konva marker clustering and keep MVP to first-discovery markers only.
- [Partial region coverage] → Unmapped storyline gaps mean users may walk without eligible discoveries in some spans. Mitigation: allow this in MVP for rollout flexibility, but make gaps visible in admin tooling.
- [Cross-change achievement drift] → Future duplicate-threshold badges could fork from the shared achievement model. Mitigation: store immutable discovery instances in a shape compatible with later occurrence-based badge awarding instead of inventing a separate mutable counter model.

## Migration Plan

1. Add additive D1 migrations for reusable regions, storyline-region mappings, collectible definitions, discovery high-water state, immutable user discovery instances, and user unread state.
2. Seed initial reusable regions, mappings, and flora/fauna catalog entries before enabling discovery logic in production.
3. Add admin APIs and dedicated admin UI for region, mapping, and collectible management.
4. Add public Field Guide list/detail/status endpoints plus a mark-seen endpoint for unread badge behavior.
5. Extend progress create and update flows to evaluate discovery attempts from positive deltas, while leaving delete flows non-revoking.
6. Add the Field Guide page, drawer badge updates, and first-discovery map markers.
7. Update docs and add backend, client, and Playwright coverage.

Rollback strategy: keep migrations additive. If the UI or route handlers need to be rolled back, the app can stop reading Field Guide tables without affecting canonical walk history. Existing discovery instances remain stored for later repair or re-enable, and no revocation is required.

## Open Questions

None currently blocking. Initial rarity-tier odds, long-walk threshold, and per-request attempt caps can be implementation-tuned as constants within the constraints of this design.