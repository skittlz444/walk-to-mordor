# Tasks

## 1. Award Idempotency

- [ ] 1.1 In `src/achievement-utils.ts`, make the pre-insert existence check key-agnostic for non-repeatable definitions (look up `user_id + achievement_id` only) while keeping the keyed lookup for repeatables. Keep the sentinel and the unique-violation recovery unchanged. Verify with a new case that seeds a legacy-key instance and awards with the sentinel.

## 2. Data Correction

- [ ] 2.1 Add `migrations/0151_dedupe_non_repeatable_achievements.sql`: for definitions with `is_repeatable = 0`, acknowledge the earliest instance when any instance in its `(user, achievement)` group is acknowledged, delete every instance except the earliest, and re-key the survivor to `__non_repeatable__`. Must be pure SQL, data-only, and idempotent. Add a `node:sqlite` test modeled on `tests/api/achievement-backfill-migration.test.ts` that applies `0142`/`0143`/`0144`/`0145`/`0148`, awards a sentinel duplicate, applies `0151`, and asserts one sentinel-keyed survivor, a preserved acknowledgement, and a no-op re-apply.

## 3. Display Guard

- [ ] 3.1 In `client/src/islands/BadgeDisplayIsland.tsx`, render the repeat count and its accessible text only when `is_repeatable` is true, in both the card and the accessible-name builder. Add Vitest cases: a non-repeatable entry with `earned_count: 2` shows no `×2` and no "Earned 2 times" label; a repeatable entry still shows both.

## 4. Regression Coverage

- [ ] 4.1 Add the missing end-to-end award regression: apply the backfill migrations, run `checkAndAwardJourneyBadges` for a qualifying walk, and assert exactly one instance and `earned_count === 1` for First Steps and every qualifying journey badge. Run `npx jest tests/api/achievement-awards.test.ts tests/api/achievement-utils.test.ts tests/api/non-repeatable-dedupe-migration.test.ts --coverage=false`.

## 5. Validation

- [ ] 5.1 Run `openspec validate fix-non-repeatable-badge-duplicates --strict`.
- [ ] 5.2 Run the affected suites: the new/migration Jest tests, the full client Vitest run, and `npx tsc --noEmit`. Record the counts.
- [ ] 5.3 Run `lean-review` and `test-hygiene` in diff mode and resolve must/should findings.

## Workflow follow-up

- Archive the change after the reviewed implementation and a green CI run.
