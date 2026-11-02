## 1. Catalog Seed

- [x] 1.1 Add `migrations/0145_seed_catalog_expansion.sql` with `INSERT OR IGNORE` rows for `habit-weekend-warrior`, `habit-steady-month`, `habit-hundred-week`, `community-fellowship-founder`, and `community-good-company`. Set `image_slug` equal to each slug and use the metadata values from `design.md`. Verify by running the migration test in 2.2 and confirming five rows.
- [x] 1.2 Confirm the migration is data-only: no explicit IDs, no `CREATE`/`ALTER`/`DROP`, valid JSON literals in every `metadata` value, and no trailing-comma or statement errors. Verify with `node -e "JSON.parse(...)"` for each value or by the migration test's parse assertions.

## 2. Migration Test

- [x] 2.1 Add `tests/api/achievement-catalog-expansion.test.ts` using `node:sqlite` `DatabaseSync(':memory:')`: apply `0142`, apply `0145` twice, and assert five rows, unique slugs, three `habit` plus two `community`, repeatable flags, `image_slug = slug`, habit thresholds/criteria/units, community rank/collection `index`/`size`/criteria, and namespace separation from the other catalog owners. Verify with `npx jest tests/api/achievement-catalog-expansion.test.ts --coverage=false`.
- [x] 2.2 Confirm the test adds no dependency and no runner: `package.json` and `jest.config.json` are unchanged, and the suite runs under the existing Jest config.

## 3. Documentation

- [x] 3.1 Add a concise note to `docs/data-models.md` for the `criteria` and `unit` metadata keys and the rule that `criteria` is descriptive, not executable. Verify the achievement section stays under the doc's length budget and does not restate the full seed.

## 4. Badge Artwork (follow-up)

- [ ] 4.1 Run the `achievement-image-generation` skill for the five slugs: habit family frame for the three habit badges, community family frame for the two fellowship badges, circle with a 6 o'clock rank boss and no concentric rank ring (F1 in `reports/badge-art/composite-review.md`). Verify five 512 px `<slug>.webp` and five 200 px `<slug>-thumb.webp` files under `public/img/achievements/`, each under the existing size budgets.
- [ ] 4.2 Verify the profile grid still shows the placeholder for any badge without art and that adding the images requires no data or code change.

## 5. Award Hooks (follow-up, other owners)

- [ ] 5.1 Extend the progress award hook to evaluate `weekend_both_days`, `distinct_days_month >= 20`, and `trailing_7d_km >= 100` using the exact `criteria` strings from the seed, with one idempotency key per qualifying weekend, month, and trailing-week window. Verify with hook tests for first award, same-window suppression, and rank progression.
- [ ] 5.2 Wire `party_created` and `party_active_members >= 4` inside the fellowship feature that owns party lifecycle events; do not add community award logic to this change. Verify in that feature's tests that founder and good-company badges award once per user.

## 6. Validation

- [x] 6.1 Run `openspec validate achievement-catalog-expansion --strict` and resolve any spec-format errors.
- [x] 6.2 Run the focused Jest test and record the result.
- [x] 6.3 Confirm the diff leaves the five `0145` rows unchanged and adds no book, challenge, field-guide, or campaign definitions.
