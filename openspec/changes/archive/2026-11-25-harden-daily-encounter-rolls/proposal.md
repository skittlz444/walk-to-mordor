# Proposal

## Why

A daily encounter roll currently inserts its `daily_rolls` row before eligibility, probability, and target calculation finish. If any later step fails, the placeholder row remains and blocks every retry for that UTC day. The same row also has no persisted reason, so a probability miss, an eligibility rejection, and a failed roll all look identical to operators. Production already contains 15 such indistinguishable null-offer rows, which prevents a reliable answer to whether zero Nazgûl offers were ordinary RNG outcomes.

## What Changes

- Evaluate eligibility, probability, definition selection, and target calculation **before** writing the final `daily_rolls` row.
- Persist an explicit roll outcome for every finalized roll: offer, probability miss, insufficient activity, active challenge, or no definition.
- Make concurrent first rolls converge on one stored result using the existing `(user_id, roll_date)` uniqueness constraint rather than exposing an unfinalized placeholder.
- Backfill existing offer rows as `offer` and existing null-offer rows as `legacy_unknown`, since their historical cause cannot be reconstructed.
- Keep the daily-roll API response and encounter popup contract unchanged.
- **No BREAKING changes.** No user-facing copy, probability, eligibility, or challenge-lifecycle behavior changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-challenges`: Daily rolls must be finalized only when an outcome is known, must persist that outcome for diagnosis, and must remain retry-safe and idempotent under failures and concurrent requests.

## Impact

- **Database:** Additive D1 migration for `daily_rolls.outcome`, including a safe default for rolling-deploy compatibility and backfill of existing rows.
- **Code:** `src/event-utils.ts` roll flow and stored-offer reconstruction; TypeScript row/result types.
- **Tests:** Jest coverage for outcome persistence, retry after a pre-write failure, concurrent insert convergence, legacy-row compatibility, and migration backfill.
- **Docs:** Personal challenge data-model notes describing `outcome` and the finalized-row invariant.
- **Rollout:** Apply the additive migration before deploying the Worker. The new column has a safe default so rows written by the previous Worker during the deploy window remain readable. Previous Worker code ignores the extra column on rollback.
