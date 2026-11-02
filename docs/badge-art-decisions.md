---
name: badge-art-decisions
description: Final badge family frames, emblem and rank-boss picks, asset layout, and retained reusable layers.
---

# Badge Art — Final Decisions

**Date:** 2026-11-02

This is the durable record for the badge artwork. Final art lives in `public/img/achievements/`; reusable frame and boss layers live in `assets/badge-art/`. Review galleries, candidate sheets, and the `raw_assets/` workspace are not kept in the repo.

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

All badges are circular. The F1 stack is emblem 800 → opaque dark well 880 → family frame 1016/880 → 6 o'clock rank boss. There is no rank ring.

| Output | Path | Size |
|---|---|---|
| Card | `public/img/achievements/<name>.webp` | 512 × 512 |
| Thumbnail | `public/img/achievements/<name>-thumb.webp` | 200 × 200 |
| Inspection | `public/img/achievements/full/<name>.webp` | 1024 × 1024 |

`<name>` is `<slug>` for fixed-rank badges and the no-boss fallback, and `<slug>--<rank_label>` for repeatable rank variants.

**Fixed-rank badges** — 11 badges have the selected boss baked in: First Steps (bronze), the 8 journey badges at their fixed ranks, Fellowship Founder (bronze), Good Company (silver).

**Repeatable habit badges** — Faithful Walker, Weekend Warrior, Steady Month, Hundred-K Week. Their rank changes with `earned_count`, so each has four baked variants:

- `<slug>--bronze`, `--silver`, `--gold`, `--mithril`, with thumbs and full images.
- The base `<slug>` image is a no-boss fallback.
- The client must select the variant from `presentation.rank`; otherwise the fallback shows the emblem + frame without a boss.

All sizes are generated from the same 1024 master; do not hand-edit the 512 or 200 files. Budgets: card ≤ 120 KiB, thumb ≤ 20 KiB, full ≤ 500 KiB.

On 2026-11-02 the set was rebuilt from the original ComfyUI 1024 candidates. The rebuild filled the 800–880 annulus with an opaque dark well; the earlier 512 set had a semi-transparent moat. Card, thumb, and full images now come from the same master.

## Retained reusable layers

`assets/badge-art/` is the durable, tracked source for future achievements. It is not runtime data and must not be deleted or regenerated in place by the client.

| Layer | Path | Notes |
|---|---|---|
| Family frames | `assets/badge-art/frames/<family>.png` | 1024 RGBA, 1016 outer / 880 inner, open core |
| Boss masters | `assets/badge-art/bosses/<rank>.png` | 1024 RGBA, 800 px art |
| Boss tiles | `assets/badge-art/bosses/<rank>-tile.png` | 90 × 90 RGBA, 70 px art, place at `(466, 934)` |
| Boss shadows | `assets/badge-art/bosses/<rank>-shadow.png` | 90 × 90 RGBA, place at `(466, 936)` |

Machine-readable picks are in `scripts/badge-art/final-selections.json`. Rebuild all composites with `scripts/badge-art/rebuild_finals.py`; the script refreshes `assets/badge-art/` by default. Rebuilding needs the processed emblem layers in the gitignored `raw_assets/badges/` workspace; the final `full/` images are the durable inspection copies. Only reusable frames and bosses are retained as source layers; emblems are achievement-specific.

## Standing decisions

- Circle badges only; no hexagon silhouette.
- F1 stack: emblem 800 → opaque well 880 → family frame 1016/880 → 6 o'clock rank boss.
- Rank rings are retired.
- The card's rank label is authoritative; the boss is the visual cue.
- The achievement image-generation skill has been updated with the palette/material preferences.

## Cleanup / next step

`reports/badge-art/` and `raw_assets/badges/` were removed after the rebuild. Final art remains in `public/img/achievements/` (including `full/`), reusable layers in `assets/badge-art/`, the pipeline in `scripts/badge-art/`, and the skill in `.github/skills/achievement-image-generation/`.

Implementation of the API, seed wiring, island/CSS, and award hooks is pending and should not be inferred from this artwork record.
