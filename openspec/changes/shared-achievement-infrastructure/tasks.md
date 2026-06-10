## 1. Schema and Data Access

- [ ] 1.1 Add D1 migration for `achievement_definitions` with columns for slug, name, description, image_slug, badge_type, is_repeatable (boolean), metadata (TEXT/JSON), and timestamps, plus a unique index on slug.
- [ ] 1.2 Add D1 migration for `user_achievement_instances` with columns for user_id, achievement_id (FK to achievement_definitions), earned_at, context_metadata (TEXT/JSON), idempotency_key, and timestamps, plus a `UNIQUE(user_id, achievement_id, idempotency_key)` constraint and indexes for user-scoped achievement lookups.
- [ ] 1.3 Add strict TypeScript interfaces for `AchievementDefinition`, `UserAchievementInstance`, and `AchievementSummary` (with earned_count), following the existing `DbClient` result typing pattern with no `any`.
- [ ] 1.4 Update `docs/data-models.md` with the achievement schema invariants, idempotency-key semantics, and the append-only immutability rule.

## 2. Achievement Domain Service

- [ ] 2.1 Implement `awardAchievement(db, userId, achievementSlug, idempotencyKey, contextMetadata?)` in `src/achievement-utils.ts`: resolves slug to achievement_id, checks `is_repeatable` flag (blocks second award for non-repeatable badges), inserts an earned instance respecting the `UNIQUE(user_id, achievement_id, idempotency_key)` constraint, and returns `{ instanceId: number; isNew: boolean }`. Throws `AchievementDefinitionNotFoundError` for unknown slugs.
- [ ] 2.2 Implement `getUserAchievements(db, userId)` that returns all earned instances for a user joined with their definition metadata.
- [ ] 2.3 Implement `getUserAchievementSummary(db, userId)` that groups earned instances by achievement definition and returns a list of `AchievementSummary` entries with earned_count, name, description, image_slug, and badge_type.

## 3. Validation and Documentation

- [ ] 3.1 Add Jest coverage for: idempotent award (same key twice → one row, `isNew: false`), repeatable badge multiple awards with different keys (`isNew: true` each), non-repeatable badge blocks second award even with different key, missing slug throws `AchievementDefinitionNotFoundError`, summary aggregation with correct counts, empty summary for user with no achievements, and the immutability guarantee (no row mutation or deletion).
- [ ] 3.2 Run `npm test` and fix any regressions related to the new schema or domain service.
- [ ] 3.3 Run `npm run check` and resolve any TypeScript or Wrangler dry-run issues introduced by the new tables and interfaces.
