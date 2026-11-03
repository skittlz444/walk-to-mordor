# Design

## Context

`shared-achievement-infrastructure` provides `achievement_definitions` (`0142`), append-only `user_achievement_instances` (`0143`), and `awardAchievement()` in `src/achievement-utils.ts`, which stores the sentinel key `__non_repeatable__` for non-repeatable definitions so runtime awards stay idempotent.

`profile-badge-display` seeds ten definitions (`0144`) and owns the log-time hook `checkAndAwardJourneyBadges` in `src/achievement-awards.ts`, called after progress creates (`src/progress-handlers.ts:155`) and updates (`:263`). Ranks for repeatable badges are derived from `earned_count` in `src/badge-presentation.ts`; no rank storage is needed.

Two precedents shape this change. `0146` corrected a seeded display text with a targeted `UPDATE` because `0144` uses `INSERT OR IGNORE`, and `0148` backfilled every qualifying non-repeatable badge in pure SQL while deliberately leaving repeatable habits on the log-time path (`migrations/0148_backfill_existing_achievements.sql:9-10`).

Fellowships use `parties` and `party_members` from `0119`: membership becomes active in two places, `handleJoinParty` (`src/party-handlers.ts:292-318`) and `handleAcceptFellowshipInvite` (`src/fellowship-invite-handlers.ts:289-323`). `parties` stores `leader_id` but no creator column.

Badge artwork for the five slugs is already committed under `public/img/achievements/`; the profile grid resolves the 512 px card by slug and falls back to `<slug>--<rank>.webp` for repeatables (`client/src/islands/BadgeDisplayIsland.tsx:121-164`), while thumbnails are used only by the award modal.

## Goals / Non-Goals

**Goals:**

- Make all five seeded definitions earnable from their owning feature write paths, with no schema change.
- Pin the habit window anchors, idempotency keys, and raw-distance rule.
- Backfill the two non-repeatable fellowship badges for existing fellowships.
- Keep award failures from failing walk logs, fellowship creation, joins, or invite acceptance.

**Non-Goals:**

- No table, column, index, API route, client UI, or admin UI change.
- No book, challenge, field-guide, or campaign definitions or award logic; those stay with their owning changes.
- No retroactive backfill of repeatable habit windows.
- No edits to applied migrations `0144`–`0148`; corrections ship as new migrations.

## Decisions

### Habit criteria live in the existing log-time hook

`checkAndAwardJourneyBadges` already runs after every successful progress create or update, receives the walked date, and isolates award failures through `awardSafely`. The loader gains the definition's `criteria` field and routes only the three known strings; unknown criteria remain skipped so other families stay owned by their features.

Habit conditions use raw `progress.distance` sums. `displayedDistance` remains a journey-only concept because the storyline offset is a display device, not walked distance.

Alternatives rejected: a generic SQL/expression evaluator (criteria are stable labels, not a query language) and a separate hook per criterion (more call sites, no isolation benefit).

### One stable key per window

| Criteria | Gate | Condition | Key | Context |
|---|---|---|---|---|
| `weekend_both_days` | logged date is Saturday or Sunday | both dates of that weekend have progress rows | `habit-weekend-warrior:<saturday-iso>` | `{"weekend":"<saturday-iso>"}` |
| `distinct_days_month >= 20` | any progress write | `COUNT(DISTINCT date)` in the logged month is at least 20 | `habit-steady-month:<YYYY-MM>` | `{"month":"<YYYY-MM>"}` |
| `trailing_7d_km >= 100` | logged date is Sunday | `SUM(distance)` for that Monday–Sunday week is at least 100 | `habit-hundred-week:<sunday-iso>` | `{"week_ending":"<sunday-iso>","km":<sum>}` |

Keys must not overlap. Keying a literal rolling seven-day window to each log date would create a new instance every day for a 20 km/day walker and reach mithril in 26 days. The Sunday gate mirrors the existing faithful-walker rule and keeps `unit: "weeks"` honest. Accepted trade-off: a week with no Sunday log is never awarded, exactly like faithful-walker.

### Fellowship awards fire at both activation edges

- `handleCreateParty` awards `community-fellowship-founder` to the creator after the existing atomic batch, so the party and leader membership already exist.
- Every successful activation — fresh join, reactivated membership, and invite acceptance — counts active members and, at four or more, awards `community-good-company` to **every** active member, including the member whose activation crossed the threshold and later joiners to an already-qualifying fellowship.
- Award-to-all matches the definition text ("belongs to a fellowship with at least four active members"); awarding only the threshold-crossing member would leave the founding leader without the badge.
- Each award is wrapped so a failure is logged and the party write still succeeds. Per-user idempotency comes from the non-repeatable sentinel, not a caller-supplied key.

Alternative rejected: a scheduled sweep over fellowships (delayed awarding, new cron surface for no benefit at this scale).

### Backfill only the non-repeatable fellowship badges

`0150` is pure SQL with `INSERT OR IGNORE` and the `__non_repeatable__` key — the same sentinel `awardAchievement()` stores — so a later runtime award is a no-op rather than a duplicate instance.

- Founder goes to the current leader of every non-dissolved fellowship. `parties` has no creator column, so the current leader is the only persisted proxy; a founder who transferred leadership is not retroactively identified.
- Good Company goes to active members of non-dissolved fellowships that already have at least four active members.
- Repeatable habit windows stay unbackfilled, matching `0148` and the main spec.

### Display text is corrected by a new migration

`0149` mirrors `0146`: `0145`'s `INSERT OR IGNORE` cannot update an existing row, so a targeted `UPDATE` matching the old description aligns Hundred-K Week with the calendar-week rule.

### Artwork needs no runtime work

The five cards, thumbnails, and inspection copies already exist and sit within the documented budgets (`docs/badge-art-decisions.md:76`). `image_slug` equals each slug, so no data or code change was required. The image manifest is unaffected because it only scans `public/img/highres/`.

## Test plan

- `tests/api/achievement-catalog-expansion.test.ts`: applies `0145`, then `0149`, asserts the corrected Hundred-K description and unchanged metadata.
- A new `node:sqlite` test modeled on `tests/api/achievement-backfill-migration.test.ts`: applies a minimal `users`/`parties`/`party_members` schema plus `0142`/`0145`/`0150`, asserts founder and Good Company rows, the sentinel key, and idempotency on re-apply.
- `tests/api/achievement-awards.test.ts`: rewrites the out-of-scope test (`:425-433`) into first-award, same-window suppression, non-Sunday, raw-vs-offset, and rank-progression coverage.
- `tests/api/party-handlers.test.ts` and `tests/api/fellowship-invite-handlers.test.ts`: founder on create, threshold crossing, invite-accept activation, late joiner, duplicates, and award-failure isolation.

## Risks / Trade-offs

- [Sunday gate misses weeks without a Sunday log] → Accepted; matches faithful-walker and is stated in the description and spec.
- [Award-to-all loop cost] → One active-member query per activation, bounded by fellowship size.
- [Founder backfill proxy] → Current leader only; the limitation is documented in the migration header.
- [`criteria` strings drift] → Tests assert the exact strings and the hook maps those literals.
- [Award failure hides a missed badge] → Errors are logged; the party or walk write still succeeds by contract.
- [Backfill and runtime duplicate] → Sentinel key, `INSERT OR IGNORE`, and the unique constraint keep both paths idempotent.
- [Habit rank flooding] → Per-window keys cap one instance per weekend, month, and week.

## Migration Plan

1. Apply `0145` (seed), then `0149` (description alignment), then `0150` (fellowship backfill). All are data-only and idempotent; only `0149` depends on `0145`.
2. Deploy the hook and party wiring after the migrations; there is no dual-write or feature flag.
3. Rollback: revert the runtime commits first. Definitions can be deleted only while no instances exist; once instances exist they are append-only, so retire definitions through metadata instead of deleting rows.

## Open Questions

None.
