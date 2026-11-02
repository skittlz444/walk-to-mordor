## Context

`shared-achievement-infrastructure` provides `achievement_definitions` (`0142`) and append-only `user_achievement_instances` (`0143`). `profile-badge-display` defines the display metadata contract (`storyline`, `rank`, `rank_thresholds`, `collection`) and seeds nine definitions in `0144`: seven `journey-frodo-sam-*` badges plus `habit-first-steps` and `habit-faithful-walker`. Neither the tables nor the display contract changes here.

The catalog is pure data. Definitions can exist before any code awards them, which lets catalog growth, award wiring, and artwork land independently.

## Goals / Non-Goals

**Goals:**

- Seed five new definitions: three repeatable global habit badges and two non-repeatable community badges forming one collection.
- Keep the seed idempotent, ID-free, and order-independent from `0144`.
- Prove the SQL with a focused Jest test using the real migration files.
- Document the two new metadata keys (`criteria`, `unit`).

**Non-Goals:**

- No award hooks, criteria evaluation, or progress/fellowship integration.
- No badge artwork, compositing, or `public/img/achievements/` writes.
- No schema, API, UI, or admin changes.
- No book, challenge, field-guide, or campaign definitions — those stay with their owning changes.
- No edits to `profile-badge-display` or its nine-definition seed.

## Definitions

| Slug | Name | `badge_type` | Repeatable | Rank data | `criteria` | `unit` |
|---|---|---|---|---|---|---|
| `habit-weekend-warrior` | Weekend Warrior | `habit` | 1 | `rank_thresholds` `[1,4,12,26]` | `weekend_both_days` | `weekends` |
| `habit-steady-month` | Steady Month | `habit` | 1 | `rank_thresholds` `[1,3,6,12]` | `distinct_days_month >= 20` | `months` |
| `habit-hundred-week` | Hundred-K Week | `habit` | 1 | `rank_thresholds` `[1,4,12,26]` | `trailing_7d_km >= 100` | `weeks` |
| `community-fellowship-founder` | Fellowship Founder | `community` | 0 | `rank` 1 | `party_created` | — |
| `community-good-company` | Good Company | `community` | 0 | `rank` 2 | `party_active_members >= 4` | — |

Descriptions are the user-facing strings in the migration. Every row sets `image_slug` equal to its slug so artwork can be added without a data change.

## Metadata and criteria

Habit shape:

```json
{
  "storyline": null,
  "rank_thresholds": [1, 4, 12, 26],
  "criteria": "weekend_both_days",
  "unit": "weekends"
}
```

Community shape:

```json
{
  "storyline": null,
  "rank": 1,
  "collection": {
    "slug": "community-fellowship",
    "label": "The Fellowship",
    "index": 1,
    "size": 2
  },
  "criteria": "party_created"
}
```

`criteria` is a stable condition label, not SQL and not an expression language. No code evaluates it in this change. A future award hook maps each exact string to its own query, which keeps the definition readable by the display layer while keeping execution in the owning feature. The test asserts the exact strings so a hook cannot silently diverge from the catalog.

`unit` is the display plural used for repeatable progress ("12 weekends"). `storyline: null` marks the badge global, matching the existing convention.

## Rank and collection

- Habit badges are repeatable and derive rank from `earned_count` against four ascending `rank_thresholds`; they have no fixed `rank` and no collection.
- Community badges are non-repeatable, fixed rank 1 and 2, and share collection `community-fellowship` ("The Fellowship") at positions 1/2 of 2. The collection is deliberately small and complete so the profile grid can render `1/2`, `2/2`.

## Ownership

| Definition scope | Owner |
|---|---|
| `journey-frodo-sam-*`, `habit-first-steps`, `habit-faithful-walker` | `profile-badge-display` (`0144`) |
| The five slugs in this change | `achievement-catalog-expansion` (`0145`) |
| `book-*` | `storyline-books-core` |
| `challenge-*` | `personal-challenges` |
| `field-guide-*` | `field-guide-collectible-discovery-core` |
| `campaign-*` (also `badge_type='community'`) | `community-campaigns` |

`badge_type='community'` is a display family, not an ownership boundary. `community-campaigns` owns campaign-completion badges under `campaign-*`; the fellowship collection owns `community-fellowship-*`. No slug or collection is shared.

## Migration plan

1. `0145_seed_catalog_expansion.sql` inserts the five rows with `INSERT OR IGNORE` into `achievement_definitions`, naming columns explicitly and using no IDs.
2. It must run after `0142`/`0143`. It is independent of `0144`: the slug sets are disjoint, so it is safe before or after the nine-badge seed.
3. Re-applying it is a no-op. There is no schema change, backfill, or update path.

## Test plan

No migration harness exists under `tests/api/`; the established Jest tests mock D1. For a seed migration the SQL itself is the deliverable, so the test executes the real files in an in-memory SQLite database via Node's built-in `node:sqlite`:

1. Apply `0142_create_achievement_definitions.sql`.
2. Apply `0145` twice.
3. Assert exactly five rows, five distinct slugs, valid JSON metadata, three `habit` plus two `community`, repeatable flags, `image_slug = slug`, habit thresholds/`criteria`/`unit`, and community rank/collection `index`/`size`/`criteria`.
4. Assert the slugs are disjoint from the `journey-*`, `book-*`, `challenge-*`, `field-guide-*`, and `campaign-*` namespaces and from the two `profile-badge-display` habit slugs.

This adds no dependency and no test runner. Node 24 ships `node:sqlite`; CI's Node requirement is already `>=22` and this project runs Node 24 locally.

## Artwork workflow

Art is produced after this change by the `achievement-image-generation` skill, one emblem per slug. Use the reviewed F1 treatment from `reports/badge-art/composite-review.md`: circle, family frame, 6 o'clock rank boss, no concentric rank ring. Habit badges use the habit family frame; community badges use the community family frame. For repeatable badges the boss is a decorative cue — the card's rank label remains authoritative.

Outputs are `<slug>.webp` at 512 px and `<slug>-thumb.webp` at 200 px under `public/img/achievements/`, matching the existing path convention. Until art exists, the UI's existing missing-image placeholder covers the badges. No art is generated or committed by this change.

## Rollback

The change adds no runtime behavior, so rollback is data-only. Before any earned instances exist, a follow-up migration can `DELETE FROM achievement_definitions WHERE slug IN (...)` by slug. Once instances exist, do not delete definitions: `user_achievement_instances.achievement_id` has no cascade, and earned rows are append-only. Retire them through metadata or a future archived flag instead. Because this change ships no award hook, it cannot create instances on its own.

## Risks / Trade-offs

- [`criteria` strings drift from the eventual hook] → The test asserts the exact strings; the hook must reuse them rather than re-declaring conditions.
- [Community ownership collision] → Slug namespaces are disjoint and `campaign-*` stays with `community-campaigns`; only `badge_type` is shared.
- [Definitions exist before they can be earned] → Intentional. Catalog data is inert; the display only shows earned badges, so no empty grid or broken slot appears.
- [Artwork lags the data] → The placeholder already covers missing images; slugs are stable so art needs no migration.
- [Seed ordering with `0144`] → No IDs, disjoint slugs, and `INSERT OR IGNORE` make order irrelevant.

## Open Questions

None.
