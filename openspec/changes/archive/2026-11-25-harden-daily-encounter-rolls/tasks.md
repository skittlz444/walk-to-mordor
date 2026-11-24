# Tasks

## 1. Schema and Migration

- [x] 1.1 Add `migrations/0169_add_daily_roll_outcome.sql` with `outcome TEXT NOT NULL DEFAULT 'legacy_unknown'`, a CHECK constraint for `offer`, `probability_miss`, `insufficient_activity`, `active_challenge`, `no_definition`, and `legacy_unknown`, and a backfill setting rows with both a definition and preview target to `offer`; verify by applying it to an in-memory database and inspecting `PRAGMA table_info(daily_rolls)` plus the stored outcome values.
- [x] 1.2 Extend `tests/api/personal-challenges-migrations.test.ts` to include migration `0169`, assert the new column/default/CHECK constraint, assert existing offer rows backfill to `offer`, assert null-offer rows remain `legacy_unknown`, and simulate an old-Worker insert omitting `outcome`; verify the migration test file passes.
- [x] 1.3 Update `docs/data-models.md` to document that `outcome` is authoritative for roll diagnosis, `status` remains the accept/decline field, and historical null-offer rows are `legacy_unknown`; verify the documented enum and migration number match the migration file.

## 2. Roll Finalization and Outcome Persistence

- [x] 2.1 Add a strict `DailyRollOutcome` union and the `outcome` field to the `daily_rolls` row/domain types in `src/event-utils.ts`; verify TypeScript reports no untyped row fields with `npx tsc --noEmit`.
- [x] 2.2 Refactor `rollDailyEncounter()` to read an existing roll first, evaluate eligibility and probability, calculate any offer, and only then insert one fully populated row using `ON CONFLICT(user_id, roll_date) DO NOTHING`; on conflict, re-read and return the winning result; verify the existing roll idempotency tests still pass.
- [x] 2.3 Update `storedOffer()` to require `status = 'offered'`, accept `outcome = 'offer'`, and accept `legacy_unknown` only when both definition and preview target are present; verify legacy offer and legacy null-offer tests pass.
- [x] 2.4 Add Jest coverage in `tests/api/event-utils.test.ts` for every persisted outcome branch (`offer`, `probability_miss`, `insufficient_activity`, `active_challenge`, `no_definition`) and assert no newly written row is `legacy_unknown`; verify the event-utils suite passes.
- [x] 2.5 Add a retry test where the first roll fails before the insert and the second request on the same UTC day performs a normal roll; verify the test fails against the old placeholder flow and passes against the finalized-row flow.
- [x] 2.6 Add a concurrent first-request test that starts two rolls for the same user/day, asserts exactly one `daily_rolls` row, and asserts both results are identical; verify the test passes without depending on execution order.
- [x] 2.7 Add API-level assertions in `tests/api/event-handlers.test.ts` that the response remains `{ offer }`, a stored no-offer roll is terminal, and a repeated offer returns the same definition and target; verify the event-handler suite passes.

## 3. Integration Verification

- [x] 3.1 Run `npm test -- --runInBand --coverage=false tests/api/event-utils.test.ts tests/api/event-handlers.test.ts tests/api/personal-challenges-migrations.test.ts` and verify all targeted suites pass.
- [x] 3.2 Run the full `npm test` suite and verify no regressions outside the personal-challenge tests.
- [x] 3.3 Run `npm run check` and verify TypeScript and the Wrangler dry-run build succeed.

## Workflow follow-up

- Deploy normally so the migration runs before the new Worker, then query `daily_rolls` grouped by `outcome` and confirm new rolls no longer land in `legacy_unknown`.
- Archive the change after review and production verification.
