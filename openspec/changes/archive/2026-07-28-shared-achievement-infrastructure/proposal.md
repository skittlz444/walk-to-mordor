## Why

Walk to Mordor has three planned features — personal challenges, storyline books, and the Field Guide — that all need to award durable, immutable, repeatable achievement badges to users. Without a shared achievement model, each feature would independently invent its own badge storage, idempotency rules, and aggregation logic, creating three parallel but slightly different achievement systems that are hard to unify later. This change establishes one canonical achievement infrastructure before any of those features land.

## What Changes

- Introduce a shared `achievement_definitions` table so any feature can register badge metadata (slug, name, description, image, type, repeatability) without creating its own badge definition table.
- Introduce an append-only `user_achievement_instances` table for earned badge records with idempotency keys and per-occurrence context metadata, supporting both one-time and repeatable badges.
- Add TypeScript domain interfaces for achievement definitions, earned instances, and aggregated summaries (with repeat counts).
- Add a domain service providing idempotent award, read-back, and summary aggregation that all consuming features call through the same path.
- Keep this change data-layer-only: no standalone API endpoints and no badge display UI. Consuming changes wire badge display into their own surfaces through the summary methods this service exposes.

## Capabilities

### New Capabilities
- `shared-achievement-infrastructure`: Immutable and repeatable achievement definitions, idempotent earned-instance storage, and aggregated badge summary service consumed by other application capabilities.

### Modified Capabilities
- None.

## Impact

- D1 schema: new `achievement_definitions` and `user_achievement_instances` tables with indexes for user-scoped lookups, idempotency-key uniqueness, and badge-type grouping.
- Worker domain layer: new TypeScript interfaces (`AchievementDefinition`, `UserAchievementInstance`, `AchievementSummary`) and a domain service (`awardAchievement`, `getUserAchievements`, `getUserAchievementSummary`) following the existing `DbClient` pattern.
- No API routes, no UI changes, no scheduled processing.
- Three planned OpenSpec changes (`personal-challenges`, `storyline-books-core`, `field-guide-collectible-discovery-core`) will consume this infrastructure and must coordinate migration numbering and table naming.
- Documentation: update `docs/data-models.md` with achievement schema invariants.
- Tests: Jest coverage for idempotent award, repeat-count aggregation, and immutability guarantees.
