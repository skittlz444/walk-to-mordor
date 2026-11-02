## Why

`profile-badge-display` seeds nine badges — seven Frodo/Sam journey badges and two habit badges — which covers the core journey and the first habit loop but leaves the catalog thin. Habit badges reward only a first walk and seven active days, and the community family has no catalog entries at all. The shared achievement infrastructure already exists, so this next catalog slice ships as data alone: no schema change and no new service code.

## What Changes

- Add `migrations/0145_seed_catalog_expansion.sql`, an idempotent `INSERT OR IGNORE` seed for five definitions: three repeatable global habit badges (weekend consistency, monthly consistency, a 100 km week) and a two-badge `community-fellowship` collection (founder, good company).
- Add a focused Jest migration test that applies `0142` and `0145` twice in an in-memory SQLite database and asserts row count, slug uniqueness, type/repeatability, collection position, and criteria strings.
- Add a short `docs/data-models.md` note for the `criteria` and `unit` metadata keys.
- Leave award wiring and artwork to follow-up work. Habit awards extend the existing progress award hook later; community awards belong to the fellowship feature. The `achievement-image-generation` skill produces the five emblems after this change.

## Capabilities

### New Capabilities

- `achievement-catalog-expansion`: The five seeded definitions, their metadata contract, idempotent seeding, and catalog ownership boundaries.

### Modified Capabilities

None. The shared storage and display contracts are unchanged; this change only adds definition rows.

## Impact

- D1: one data-only migration, `0145_seed_catalog_expansion.sql`. No table, index, or column changes.
- Tests: new `tests/api/achievement-catalog-expansion.test.ts` using Node's built-in `node:sqlite`; no new dependency and no new test runner.
- Docs: `docs/data-models.md` gains a one-bullet metadata note.
- Out of scope: application code, API routes, award hooks, admin UI, and badge art. Nothing is written to `public/img/achievements/`.
- Dependencies: requires the `shared-achievement-infrastructure` tables (`0142`/`0143`) and follows the metadata conventions established by `profile-badge-display` (`0144`). Slugs are disjoint from that seed, so `0145` is safe to apply before or after `0144`.
