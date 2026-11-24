# Design

## Context

See `proposal.md` for motivation. The existing implementation lives in `src/event-utils.ts`: `rollDailyEncounter()` inserts a `daily_rolls` row first, then evaluates eligibility and probability, and finally updates the same row when an offer is produced. `storedOffer()` treats "definition and target are non-null and status is `offered`" as an offer.

D1 is the source of truth and `daily_rolls` already has `UNIQUE(user_id, roll_date)`. The table also has an existing `status` column (`offered`, `accepted`, `declined`) whose `offered` value currently doubles as a placeholder for rows that never produced an offer. The API response is `{ offer: EncounterOffer | null }`; the client only consumes that shape.

The project deploy script applies D1 migrations before deploying the Worker, so a rolling window exists where the previous Worker can still write rows after the migration.

## Goals / Non-Goals

**Goals:**
- Remove the unfinalized placeholder row from the daily-roll flow.
- Store a precise outcome on every finalized roll.
- Preserve one roll per user per UTC day across retries and concurrent requests.
- Keep the existing API, UI, eligibility, probability, and challenge behavior unchanged.
- Make the migration additive and compatible with both old and new Worker code.

**Non-Goals:**
- Changing the 1-in-10 / 1-in-30 probabilities or adding a pity timer.
- Changing eligibility thresholds or challenge completion rules.
- Changing the client trigger, encounter modal, or API response contract.
- Reclassifying historical rolls whose original cause is unknown.
- Rebuilding `daily_rolls` to redesign the legacy `status` column.

## Decisions

### Evaluate first, then insert the finalized row

`rollDailyEncounter()` will:

1. Read today's existing row. If present, reconstruct and return its stored result.
2. Evaluate eligibility.
3. Draw the probability branch and select a definition when eligible.
4. Calculate the preview target.
5. Insert one fully populated row with its outcome.
6. On a unique conflict, read and return the winning row.

No row exists while eligibility, probability, definition selection, or target calculation is in progress. If any of those steps fails, the next request starts from a clean slate and can roll again. Once the insert succeeds, the row is terminal for that UTC day.

Alternative considered: keep a provisional row and add a lease/retry state. Rejected because it adds a state machine, stale-lease handling, and more failure modes for the same guarantee.

### Use `ON CONFLICT(user_id, roll_date) DO NOTHING` as the concurrency claim

Concurrent requests may both evaluate and draw, but only the first insert succeeds. The loser reads the winner's row and returns the same result. This uses the existing uniqueness constraint as the atomic arbiter and avoids a read-then-insert race.

Alternative considered: insert with `INSERT OR IGNORE`. Rejected because it also suppresses non-uniqueness constraint failures, which could hide programming or data errors. The conflict target should be the specific daily-roll uniqueness constraint.

### Persist a closed outcome enum on `daily_rolls`

Add `outcome` with these values:

| Outcome | Meaning |
|---|---|
| `offer` | Eligible, probability passed, definition and target stored |
| `probability_miss` | Eligible, probability branch did not pass |
| `insufficient_activity` | Activity threshold not met |
| `active_challenge` | User already has an active challenge |
| `no_definition` | No enabled eligible definition exists |
| `legacy_unknown` | Pre-migration row whose historical cause cannot be reconstructed |

The outcome is an internal operational contract; it is not added to the API response. `status` remains the accept/decline lifecycle field. For non-offer rows, `status` remains the legacy `offered` placeholder, but `outcome` is authoritative for what the roll actually produced. Rebuilding the table to make `status` nullable is intentionally deferred to avoid a higher-risk migration for no user-facing benefit.

Alternative considered: infer outcome from null fields. Rejected because a probability miss and an eligibility rejection are indistinguishable, which is the diagnostic gap this change closes.

### Add the column with a compatibility default and backfill offers

Migration `0169_add_daily_roll_outcome.sql` will:

- Add `outcome TEXT NOT NULL DEFAULT 'legacy_unknown'` with a CHECK constraint over the enum.
- Update rows with both a definition and preview target to `offer`.
- Leave existing null-offer rows as `legacy_unknown`.

The default is required for rolling-deploy compatibility: after the migration but before the new Worker is live, the old Worker can insert a row without naming `outcome`. The new Worker then treats such a row according to its stored fields. New code always supplies an explicit outcome.

No new index is needed. `daily_rolls` is user/day scoped and the existing `roll_date` index supports operational scans; adding `(outcome, roll_date)` would be premature for a table of this size.

### Treat legacy rows by their stored fields

`storedOffer()` will return an offer when:

- `status = 'offered'`, and
- `outcome = 'offer'`, or `outcome = 'legacy_unknown'`, and
- both `encounter_definition_id` and `preview_target_distance` are non-null.

A `legacy_unknown` row with null offer fields remains a no-offer result. Accepted or declined rows continue to return no offer. This keeps old rows and rows written by the previous Worker during the deploy window readable without rewriting them.

Alternative considered: eagerly converting all legacy rows to a real outcome. Rejected because the database cannot prove whether a null-offer row was a probability miss or an eligibility rejection.

## Risks / Trade-offs

- **Concurrent losers still perform read-only work and consume random numbers** → Accepted; only one row is stored and both responses converge, so the discarded draw has no persistent effect.
- **`legacy_unknown` cannot answer historical RNG-vs-eligibility questions** → Accepted; the migration preserves observability for all future rolls without inventing history.
- **The compatibility default could mask a missing explicit outcome in new code** → Tests must assert the stored outcome for every branch; treat `legacy_unknown` on newly written rows as a defect during review.
- **`status = 'offered'` remains semantically odd on no-offer rows** → Document that `outcome` is authoritative; avoid a table rebuild unless `status` needs a future redesign for another reason.
- **Two Worker versions overlap briefly during deploy** → New code accepts both `offer` and field-inferred `legacy_unknown` rows; old code ignores the added column.

## Migration Plan

1. Apply `0169_add_daily_roll_outcome.sql` with the normal predeploy migration step.
2. Deploy the Worker containing the finalized-roll flow.
3. Verify with an aggregate query grouped by `outcome`, and confirm newly written non-offer rows no longer remain `legacy_unknown`.
4. Rollback: redeploy the previous Worker. The additive column remains and is ignored by old code; old rows continue to behave as before. No destructive down-migration is required.

## Open Questions

None.
