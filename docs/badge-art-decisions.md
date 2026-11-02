# Badge Art — Final Decisions

**Date:** 2026-11-02

This is the durable record for the badge artwork. Review galleries, candidate sheets, logs, and raw working assets have been removed; the committed production assets are the source of truth.

## Family frames — locked

| Frame | Candidate |
|---|---|
| Journey | `a-271828` |
| Habit | `a-112358` |
| Challenge | `a-112358` |
| Book | `a-271828` |
| Community | `a-314159` |
| Field Guide | `a-314159` |

## Emblems — selected

| Achievement | Selected |
|---|---|
| First Steps | `b-141421` |
| Across the Buckleberry Ferry | `b-141421` |
| Survivor of Weathertop | `b-161803` |
| Through Khazad-dûm | `b-112358` |
| Guest of the Golden Wood | `a-314159` |
| The Breaking of the Fellowship | `b-161803` |
| Standing at Mount Doom | `b-314159` |
| Home Again at Sunset | `b-161803` |
| Faithful Walker | `a-173205` |
| The Glittering Caves | `a-173205` |
| Weekend Warrior | `b-271828` |
| Steady Month | `a-271828` |
| Hundred-K Week | `b-161803` |
| Fellowship Founder | `b-271828` |
| Good Company | `b-271828` |

**Palette rule:** the story beat chooses the material. Dark/bleak beats use aged or hard metal, deep blues and a limited palette; avoid candy green/blue, oversized sun/moon, too many colours, and flat polished gloss. Warm/home beats can use warm enamel; wonder/elder beats can use gold/silver/crystal; habit beats can use limited green/blue. Premium hard-metal detail beats cheap brightness.

## Rank bosses — selected

| Rank | Selected |
|---|---|
| Bronze | `a-112358` |
| Silver | `a-314159` |
| Gold | `a-314159` |
| Mithril | `b-173205` |

Mithril is a user override of the shortlist recommendation (`b-314159`).

## Final asset layout

**Fixed-rank badges** — 11 badges have the selected boss baked in:

- `public/img/achievements/<slug>.webp` — 512 px
- `public/img/achievements/<slug>-thumb.webp` — 200 px

Fixed badges: First Steps (bronze), the 8 journey badges at their fixed ranks, Fellowship Founder (bronze), Good Company (silver).

**Repeatable habit badges** — Faithful Walker, Weekend Warrior, Steady Month, Hundred-K Week. Their rank changes with `earned_count`, so each has four baked variants:

- `public/img/achievements/<slug>--bronze.webp` / `-thumb.webp`
- `--silver`, `--gold`, `--mithril`
- The base `<slug>.webp` / `-thumb.webp` is a no-boss fallback.

The client must select the variant from `presentation.rank`; otherwise the fallback shows the emblem + frame without a boss.

All final composites use the locked family frame, an 880 px dark well, the selected emblem, the selected handcrafted boss at 6 o'clock, and a shadow clipped to the badge alpha. Main images are ≤ 120 KiB; thumbs are ≤ 20 KiB.

## Standing decisions

- Circle badges only; no hexagon silhouette.
- F1 stack: emblem 800 → family frame 880–1016 → 6 o'clock rank boss. No rank ring.
- Rank rings are retired.
- The card's rank label is authoritative; the boss is the visual cue.
- The achievement image-generation skill has been updated with the palette/material preferences.

## Cleanup / next step

The review galleries, finalist WebPs, contact sheets, logs, selection JSONs, and `raw_assets/badges/` working tree have been removed. Final production art remains in `public/img/achievements/`; the generation pipeline remains in `scripts/badge-art/`, and the skill remains in `.github/skills/achievement-image-generation/`.

Implementation of the API, seed wiring, island/CSS, and award hooks is pending and should not be inferred from this artwork record.
