# Tasks

## 1. Catalog Seed

- [x] 1.1 Add `migrations/0145_seed_catalog_expansion.sql` with `INSERT OR IGNORE` rows for `habit-weekend-warrior`, `habit-steady-month`, `habit-hundred-week`, `community-fellowship-founder`, and `community-good-company`. Set `image_slug` equal to each slug and use the metadata values from `design.md`. Verify by running the migration test in 2.1 and confirming five rows.
- [x] 1.2 Confirm the migration is data-only: no explicit IDs, no `CREATE`/`ALTER`/`DROP`, valid JSON literals in every `metadata` value, and no trailing-comma or statement errors. Verify with `node -e "JSON.parse(...)"` for each value or by the migration test's parse assertions.
- [x] 1.3 Add `migrations/0149_update_hundred_week_description.sql` updating `habit-hundred-week` to "Log at least 100 km within a Monday–Sunday calendar week." only where the old trailing-window description matches, mirroring `0146`. Extend `tests/api/achievement-catalog-expansion.test.ts` to apply `0149` after `0145` and assert the new text and that re-applying is a no-op. Verify with `npx jest tests/api/achievement-catalog-expansion.test.ts --coverage=false`. Done: `0149` corrects the description idempotently; `achievement-catalog-expansion.test.ts` covers correction, metadata stability, re-apply no-op, and the old-text guard (3 new tests).

## 2. Migration Test

- [x] 2.1 Add `tests/api/achievement-catalog-expansion.test.ts` using `node:sqlite` `DatabaseSync(':memory:')`: apply `0142`, apply `0145` twice, and assert five rows, unique slugs, three `habit` plus two `community`, repeatable flags, `image_slug = slug`, habit thresholds/criteria/units, community rank/collection `index`/`size`/criteria, and namespace separation from the other catalog owners. Verify with `npx jest tests/api/achievement-catalog-expansion.test.ts --coverage=false`.
- [x] 2.2 Confirm the test adds no dependency and no runner: `package.json` and `jest.config.json` are unchanged, and the suite runs under the existing Jest config.

## 3. Documentation

- [x] 3.1 Add a concise note to `docs/data-models.md` for the `criteria` and `unit` metadata keys and the rule that `criteria` is descriptive, not executable. Verify the achievement section stays under the doc's length budget and does not restate the full seed.

## 4. Badge Artwork

- [x] 4.1 Run the `achievement-image-generation` skill for the five slugs: habit family frame for the three habit badges, community family frame for the two fellowship badges, circle with a 6 o'clock rank boss and no concentric rank ring (F1 in `docs/badge-art-decisions.md`). Verify five 512 px `<slug>.webp` and five 200 px `<slug>-thumb.webp` files under `public/img/achievements/`, each under the existing size budgets.
- [x] 4.2 Verify the profile grid placeholder and that art needs no data or code change. `BadgeDisplayIsland` renders `badge-card__placeholder` when the image slug is missing or both image loads fail (`client/src/islands/BadgeDisplayIsland.tsx:162-215`), the five committed cards resolve by `image_slug = slug`, and each file sits within the `docs/badge-art-decisions.md:76` budgets. Verified with `npx vitest run --root client src/islands/BadgeDisplayIsland.test.tsx` (28/28 passing).

## 5. Award Hooks

- [x] 5.1 Extend `checkAndAwardJourneyBadges` (`src/achievement-awards.ts`) to surface `criteria` in the candidate loader and add the weekend and monthly evaluators: `weekend_both_days` on Saturday/Sunday logs when both dates of that weekend have progress rows, keyed `habit-weekend-warrior:<saturday-iso>`; `distinct_days_month >= 20` on any log when the logged month has 20 distinct dates, keyed `habit-steady-month:<YYYY-MM>`. Use raw `progress.distance` rather than `displayedDistance` and keep per-criterion failure isolation. Verify with new cases in `tests/api/achievement-awards.test.ts` for first award, repeated-weekend/month suppression, and 19-distinct-days no-award, using `npx jest tests/api/achievement-awards.test.ts --coverage=false`. Done: `criteria` surfaced in the loader; weekend and steady-month evaluators use raw `progress.distance` with per-window keys. Covered by first-award, suppression, 19-vs-20 distinct-day, and December year-boundary cases.
- [x] 5.2 Add the `trailing_7d_km >= 100` evaluator: only when the logged date is a Sunday, sum raw distance for that Monday–Sunday week, and award keyed `habit-hundred-week:<sunday-iso>` with `{week_ending, km}` context; non-Sunday logs never award. Rewrite the out-of-scope test at `tests/api/achievement-awards.test.ts:425-433` (it currently asserts these three badges are never awarded) and add a raw-vs-offset case and a rank-progression case. Verify with the same Jest command. Done: Sunday-gated hundred-week evaluator with `{week_ending, km}`; the old boundary test was rewritten and raw-vs-offset, 99.9 km, and rank-progression cases were added.
- [x] 5.3 Wire the fellowship awards: `handleCreateParty` (`src/party-handlers.ts:64`, after the batch at `:139-151`) awards `community-fellowship-founder`; both activation paths — `handleJoinParty` (`src/party-handlers.ts:292-318`) and `handleAcceptFellowshipInvite` (`src/fellowship-invite-handlers.ts:289-323`) — award `community-good-company` to every active member when the count reaches four, including later joiners to an already-qualifying fellowship. Wrap each award so a failure logs without failing the party write. Verify with new cases in `tests/api/party-handlers.test.ts` and `tests/api/fellowship-invite-handlers.test.ts` (founder, threshold crossing, invite-accept path, late joiner, duplicate, failure isolation) and `npx jest tests/api/party-handlers.test.ts tests/api/fellowship-invite-handlers.test.ts --coverage=false`. Done: founder on create plus Good Company on both activation paths in both handlers, award-to-all at four, failure-isolated. Covered by founder/threshold/invite-accept/late-joiner/duplicate/throw-isolation and members-query-failure cases.
- [x] 5.4 Add `migrations/0150_backfill_fellowship_badges.sql`: `INSERT OR IGNORE` Founder for the current leader of every non-dissolved fellowship and Good Company for active members of non-dissolved fellowships with at least four active members, using the `__non_repeatable__` idempotency key so later runtime awards are no-ops. Verify with a new `node:sqlite` test modeled on `tests/api/achievement-backfill-migration.test.ts` asserting both badges, the sentinel key, dissolved-party exclusion, and re-apply idempotency. Done: `0150` backfills founder and Good Company with the sentinel; 6 `node:sqlite` tests cover both badges, the 3-member floor, dissolved exclusion, non-active exclusion, and re-apply idempotency.

## 6. Validation

- [x] 6.1 Run `openspec validate achievement-catalog-expansion --strict` and resolve any spec-format errors.
- [x] 6.2 Run the focused Jest test and record the result.
- [x] 6.3 Confirm the diff leaves the five `0145` rows unchanged and adds no book, challenge, field-guide, or campaign definitions.
- [x] 6.4 Re-run `openspec validate achievement-catalog-expansion --strict` after the widened spec delta and confirm the change is valid. Done: `openspec validate achievement-catalog-expansion --strict` → "Change is valid".
- [x] 6.5 Run the affected suites — `achievement-catalog-expansion`, `achievement-awards`, `party-handlers`, `fellowship-invite-handlers`, and the new fellowship backfill test — and record the results in the change. Done: `npx jest` over the five affected suites → 161/161 passed; Playwright (chromium) → 57/57 passed (`achievement-catalog-flow` 2, `fellowship-comprehensive` 54, `profile-achievements-flow` 1); `npx tsc --noEmit` clean.

## Workflow follow-up

- Archive the change after the reviewed implementation and validation land.
