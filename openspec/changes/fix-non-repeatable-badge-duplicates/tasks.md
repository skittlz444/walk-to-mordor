# Tasks

## 1. Award Idempotency

- [x] 1.1 In `src/achievement-utils.ts`, make the pre-insert existence check key-agnostic for non-repeatable definitions (look up `user_id + achievement_id` only) while keeping the keyed lookup for repeatables. Keep the sentinel and the unique-violation recovery unchanged. Verify with a new case that seeds a legacy-key instance and awards with the sentinel. Done: non-repeatables resolve by `(user_id, achievement_id)` ordered by id; repeatables keep the keyed lookup; sentinel and unique-violation recovery unchanged.

## 2. Data Correction

- [x] 2.1 Add `migrations/0151_dedupe_non_repeatable_achievements.sql`: for definitions with `is_repeatable = 0`, acknowledge the earliest instance when any instance in its `(user, achievement)` group is acknowledged, delete every instance except the earliest, and re-key the survivor to `__non_repeatable__`. Must be pure SQL, data-only, and idempotent. Add a `node:sqlite` test modeled on `tests/api/achievement-backfill-migration.test.ts` that applies `0142`/`0143`/`0144`/`0145`/`0148`, awards a sentinel duplicate, applies `0151`, and asserts one sentinel-keyed survivor, a preserved acknowledgement, and a no-op re-apply. Done: `0151_dedupe_non_repeatable_achievements.sql` acknowledges the survivor, deletes later duplicates, then re-keys survivors; 5 `node:sqlite` cases prove survivor identity, ack carry-over, repeatables untouched, and a no-op re-apply.

## 3. Display Guard

- [x] 3.1 In `client/src/islands/BadgeDisplayIsland.tsx`, render the repeat count and its accessible text only when `is_repeatable` is true, in both the card and the accessible-name builder. Add Vitest cases: a non-repeatable entry with `earned_count: 2` shows no `×2` and no "Earned 2 times" label; a repeatable entry still shows both. Done: the `×N` chip and "Earned N times" accessible text require `is_repeatable`; 29/29 Vitest including a non-repeatable `earned_count: 2` case.

## 4. Regression Coverage

- [x] 4.1 Add the missing end-to-end award regression: apply the backfill migrations, run `checkAndAwardJourneyBadges` for a qualifying walk, and assert exactly one instance and `earned_count === 1` for First Steps and every qualifying journey badge. Run `npx jest tests/api/achievement-awards.test.ts tests/api/achievement-utils.test.ts tests/api/non-repeatable-dedupe-migration.test.ts --coverage=false`. Done: the new regression applies the real `0148` backfill, then awards through both entry points and asserts one row and `earned_count === 1`; 58/58 across the three focused suites.

## 5. Validation

- [x] 5.1 Run `openspec validate fix-non-repeatable-badge-duplicates --strict`. Done: `openspec validate fix-non-repeatable-badge-duplicates --strict` → "Change is valid".
- [x] 5.2 Run the affected suites: the new/migration Jest tests, the full client Vitest run, and `npx tsc --noEmit`. Record the counts. Done: full Jest 1506/1506, full client Vitest 884/884, `npx tsc --noEmit` clean.
- [x] 5.3 Run `lean-review` and `test-hygiene` in diff mode and resolve must/should findings. Done: lean-review diff 0 findings; test-hygiene diff removed one unfalsifiable mocked test and kept the real-sqlite regression.

## Workflow follow-up

- Archive the change after the reviewed implementation and a green CI run.
