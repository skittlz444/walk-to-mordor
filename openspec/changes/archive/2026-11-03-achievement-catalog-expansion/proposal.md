## Why

`profile-badge-display` seeds ten badges — eight Frodo/Sam journey badges and two habit badges — which covers the core journey and the first habit loop but leaves the catalog thin. Habit badges reward only a first walk and seven active days, and the community family has no catalog entries at all. The shared achievement infrastructure already exists, so this next catalog slice adds five definitions and wires their awarding in the same change, so the expanded catalog is earnable rather than inert.

## What Changes

- Add `migrations/0145_seed_catalog_expansion.sql`, an idempotent `INSERT OR IGNORE` seed for five definitions: three repeatable global habit badges (weekend consistency, monthly consistency, a 100 km week) and a two-badge `community-fellowship` collection (founder, good company).
- Align the Hundred-K Week display text with its award rule in `migrations/0149_update_hundred_week_description.sql`, mirroring `0146`'s Faithful Walker correction. `0145` is not edited.
- Extend the log-time award hook to evaluate the three habit criteria against raw logged distance with one idempotency key per window: `weekend_both_days` (both weekend days logged), `distinct_days_month >= 20` (20 distinct dates in a calendar month), and `trailing_7d_km >= 100` (Sunday-gated Monday–Sunday week). Repeatable habit windows are not backfilled.
- Award `community-fellowship-founder` on fellowship creation and `community-good-company` to every active member when a fellowship reaches four active members, covering both the direct-join and invite-accept activation paths, once per user.
- Add `migrations/0150_backfill_fellowship_badges.sql` to grant the two community badges to existing fellowships: founder to current leaders and Good Company to active members of fellowships that already have four active members.
- Add focused Jest coverage: the catalog seed, the description alignment, the fellowship backfill, the extended habit hook (including the out-of-scope boundary test that must flip), and party lifecycle awarding.
- Add a short `docs/data-models.md` note for the `criteria` and `unit` metadata keys.
- Ship the five emblems: 512 px cards, 200 px thumbnails, and 1024 px inspection copies under `public/img/achievements/`, using the existing family frames and rank bosses.
- Complete the catalog: after this change all 15 definitions (8 journey, 5 habit, 2 community) are earnable and displayable.

## Capabilities

### New Capabilities

- `achievement-catalog-expansion`: The five seeded definitions, their metadata contract, idempotent seeding, habit and fellowship award integration, fellowship backfill, and catalog ownership boundaries.

### Modified Capabilities

- `profile-badge-display`: The log-time award hook now evaluates the three catalog habit criteria using raw logged distance and carries per-window idempotency rules; journey badge behavior is unchanged.

## Impact

- D1: three data-only migrations — `0145` (seed), `0149` (Hundred-K description alignment), `0150` (fellowship backfill). No table, index, or column changes.
- Worker: `src/achievement-awards.ts` (habit windows and keys) plus `src/party-handlers.ts` and `src/fellowship-invite-handlers.ts` (fellowship awards), all through the existing `awardAchievement()` service.
- Tests: `tests/api/achievement-catalog-expansion.test.ts` extends to `0149`; a new `node:sqlite` migration test modeled on `tests/api/achievement-backfill-migration.test.ts` covers `0150`; `tests/api/achievement-awards.test.ts` rewrites the out-of-scope boundary test; `tests/api/party-handlers.test.ts` and `tests/api/fellowship-invite-handlers.test.ts` cover the fellowship awards.
- Artwork: five cards, five thumbnails, and five inspection copies under `public/img/achievements/`; no data or code change is needed because `image_slug` equals each slug and the grid resolves art by slug.
- Docs: `docs/data-models.md` documents the `criteria` and `unit` metadata keys and the rule that they are descriptive, not executable.
- Out of scope: schema changes, API routes, client UI, admin UI, and book/challenge/field-guide/campaign definitions.
- Dependencies: requires `shared-achievement-infrastructure` (`0142`/`0143`) and the `profile-badge-display` conventions (`0144`); it does not edit `0144`–`0148`.
