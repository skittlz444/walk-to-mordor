# Design

## Context

`awardAchievement` (`src/achievement-utils.ts:220`) converts every non-repeatable award to the sentinel key `__non_repeatable__`:

```ts
const storageKey = definition.is_repeatable ? idempotencyKey : NON_REPEATABLE_IDEMPOTENCY_KEY;
const existing = await db.read.prepare(
  `SELECT id FROM user_achievement_instances
   WHERE user_id = ? AND achievement_id = ? AND idempotency_key = ? LIMIT 1`,
).bind(userId, definition.id, storageKey).first();
```

`0148` backfilled with `'habit-first-steps'` and `'journey:<slug>'`, so the sentinel lookup misses the backfilled row and the insert succeeds. The table's `UNIQUE(user_id, achievement_id, idempotency_key)` (`0143:25`) allows it because the keys differ.

The existing `shared-achievement-infrastructure` spec already requires that a non-repeatable badge "blocks second award ... with any idempotency key". The implementation does not satisfy that requirement; this change restores it and repairs the data.

## Goals / Non-Goals

**Goals**

- Stop any future duplicate non-repeatable grant, whatever key a caller or migration used.
- Repair existing duplicate rows without losing acknowledgement state.
- Never render a repeat count for a non-repeatable badge.
- Prove the backfill-plus-runtime combination with a regression test.

**Non-Goals**

- No change to repeatable award behavior or keys.
- No change to award thresholds, storylines, fellowship awards, or the pending/acknowledge contract.
- No edit to applied migration `0148`.
- No new schema, no new dependency.

## Decisions

### Non-repeatable pre-check ignores the key

```ts
const existing = definition.is_repeatable
  ? /* user + achievement + idempotency_key */
  : /* user + achievement LIMIT 1 */;
```

The keyed lookup remains for repeatables, where distinct keys are the whole point. For non-repeatables the key is an implementation detail of the storage format, not part of the identity, which is exactly what the spec says.

Concurrent awards still race safely: both callers insert the same sentinel key, and the unique constraint rejects the loser, which the existing `isUniqueConstraintViolation` branch already converts into `{ isNew: false }`.

Alternatives rejected: a partial unique index on `(user_id, achievement_id)` cannot reference `achievement_definitions.is_repeatable` (SQLite partial-index predicates cannot subquery another table). A `BEFORE INSERT` trigger could enforce it but would need new error handling around `last_row_id`; the code pre-check plus the sentinel covers every current call site.

### Cleanup keeps the earliest row and preserves "already seen"

`0151` operates only on definitions with `is_repeatable = 0`:

1. If any instance in a `(user, achievement)` group has an acknowledgement, insert an acknowledgement for the survivor first. This prevents a deleted duplicate's "seen" state from resurrecting an old badge as pending.
2. Delete every instance except `MIN(id)` for that group. Acknowledgements for deleted rows cascade (`0147`).
3. Re-key the survivor to `__non_repeatable__` so its storage matches every other non-repeatable award.

Keeping `MIN(id)` keeps the earliest `earned_at` (the backfill row) and its context metadata. The migration is idempotent: after it runs, each group has one row already keyed with the sentinel, so a re-run inserts nothing and deletes nothing.

Alternatives rejected: clamping `earned_count` in the API hides the corruption while leaving the pending queue and the table wrong; deleting the backfilled row instead loses its distance context and inverts "earliest earned".

### Repeat indicator is gated on `is_repeatable`

`BadgeDisplayIsland` currently renders `×N` whenever `earned_count > 1` (`client/src/islands/BadgeDisplayIsland.tsx:235`). The card contract is "repeat count", and a non-repeatable badge has no repeats. Gating on `is_repeatable` is correct independently of the data repair and keeps a stray legacy row from ever looking like a repeat.

### Future backfills use the sentinel

The runtime and every SQL backfill for a non-repeatable definition must store `__non_repeatable__`. `0148` is the only offender and is left in place; `0151` normalizes its rows.

## Risks / Trade-offs

- [Deleting rows conflicts with "append-only"] → The spec is amended to permit a one-time duplicate correction; instances are still never deleted by walk edits, deletes, or progress reconciliation.
- [A user had acknowledged only the duplicate] → Step 1 copies the acknowledgement to the survivor, so the badge does not reappear as pending.
- [Cleanup runs before the code deploy] → The survivor is re-keyed to the sentinel, so even the current (unfixed) pre-check finds it. Order is therefore safe either way.
- [Duplicate rows for a repeatable badge] → Out of scope; repeatables are keyed per window by design and are not touched.

## Test Plan

- `tests/api/achievement-utils.test.ts` (or the existing award suite): seed an instance with a legacy backfill key, call `awardAchievement` for the same non-repeatable slug with the sentinel → `isNew: false`, still one row.
- New `tests/api/non-repeatable-dedupe-migration.test.ts` (`node:sqlite`): apply `0142`/`0143`/`0144`/`0145`/`0148`, run the runtime award with the sentinel, assert two rows exist, then apply `0151` and assert one sentinel-keyed survivor, preserved acknowledgement, dissolved/none untouched, and a no-op re-apply.
- `client/src/islands/BadgeDisplayIsland.test.tsx`: a non-repeatable entry with `earned_count: 2` renders no `×2`; a repeatable entry still does.

## Migration Plan

1. Apply `0151` (data-only, idempotent), then deploy the code. Either order is safe because `0151` writes the sentinel.
2. Verify: `SELECT ad.slug, COUNT(*) n ... WHERE ad.is_repeatable = 0 GROUP BY user_id, ad.id HAVING n > 1` returns no rows, and a profile shows no `×N` on journey badges.
3. Rollback: code revert is safe. The migration is a correction and should not be rolled back; restoring duplicates would be wrong.

## Open Questions

None.
