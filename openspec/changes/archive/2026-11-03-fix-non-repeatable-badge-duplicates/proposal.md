## Why

`0148_backfill_existing_achievements.sql` awarded already-earned non-repeatable badges under per-definition keys (`'habit-first-steps'`, `'journey:<slug>'`), while the runtime award service stores every non-repeatable award under the sentinel `__non_repeatable__` and checks for an existing row **by that key**. The unique constraint is `(user_id, achievement_id, idempotency_key)`, so it cannot collapse the two.

Result: on the first walk logged after the backfill, every badge that had been backfilled was inserted a second time. A user can end up with `earned_count = 2` for First Steps and each already-earned Frodo/Sam journey badge — up to nine badges. Each duplicate is also a new unacknowledged instance, so it re-queues a celebration.

Live report: journey badges and First Steps showed `×2` on the profile grid even though they are non-repeatable. Community badges are unaffected (`0150` already uses the sentinel); repeatable habits are unaffected.

## What Changes

- Make the award service's non-repeatable pre-check **key-agnostic**: any existing instance for `(user, achievement)` satisfies a later award. The sentinel still guards the concurrent race through the existing unique constraint.
- Add `migrations/0151_dedupe_non_repeatable_achievements.sql`: keep the earliest instance per `(user, non-repeatable achievement)`, preserve acknowledgement state, delete the extras (acknowledgements cascade), and re-key the survivor to `__non_repeatable__`. Idempotent.
- Only render the `×N` repeat indicator when `is_repeatable` is true, so legacy duplicates can never look like repeats.
- Add the missing regression tests: backfill + runtime award must yield exactly one instance per non-repeatable; the cleanup migration must leave one sentinel-keyed row and keep acknowledgements; the grid must not show a repeat count for a non-repeatable definition.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shared-achievement-infrastructure`: the append-only requirement now states that any existing instance of a non-repeatable achievement blocks a later award regardless of key, and permits a one-time duplicate correction.
- `profile-badge-display`: the badge grid shows a repeat count only for repeatable badges.

## Impact

- `src/achievement-utils.ts` — key-agnostic pre-check for non-repeatables.
- `migrations/0151_dedupe_non_repeatable_achievements.sql` — new data-correction migration.
- `client/src/islands/BadgeDisplayIsland.tsx` — repeat indicator gated on `is_repeatable`.
- Tests: `tests/api/achievement-utils.test.ts`, a new `node:sqlite` cleanup-migration test combining `0148` and `0151`, and `client/src/islands/BadgeDisplayIsland.test.tsx`.
- No schema change, no API shape change, no award-rule change. `0148` is applied and is not edited; the correction ships forward.
