# Badge Art Decisions

**Date:** 2026-11-02

## Locked — family frames

The user approved **all six recommended family-frame candidates** on 2026-11-02. No further frame selection or frame regeneration is needed.

| Frame | Locked candidate |
|---|---|
| Journey Frame | `a-271828` |
| Habit Frame | `a-112358` |
| Challenge Frame | `a-112358` |
| Book Frame | `a-271828` |
| Community Frame | `a-314159` |
| Field Guide Frame | `a-314159` |

These are the borders used for the final frame + boss composites. `selections.md` records the six frame rows as **Locked**.

## Locked — emblems

The user selected all 15 emblems on 2026-11-02. The picks are recorded in `final-selections.json` and `selections.md`.

| Achievement | Selected | User rationale |
|---|---|---|
| First Steps | `b-141421` | Agree with the aged door; full step and margin. |
| Across the Buckleberry Ferry | `b-141421` | Dark story beat; bright green enamel looks cheap and does not fit. |
| Survivor of Weathertop | `b-161803` | Deeper blues and more detail; the bright option looks cheap. |
| Through Khazad-dûm | `b-112358` | Bleak beat; bright enamel is too bright; hard metal is better. |
| Guest of the Golden Wood | `a-314159` | Agree; bright gold/silver works for the golden wood. |
| The Breaking of the Fellowship | `b-161803` | Bright colours do not fit; hard metal feels more premium. |
| Standing at Mount Doom | `b-314159` | Better-formed mountain; darker hard metal fits the beat. |
| Home Again at Sunset | `b-161803` | Agree; warm aged sunset. |
| Faithful Walker | `a-173205` | Agree; the bright path badge works. |
| The Glittering Caves | `a-173205` | Agree; the crystal cave reads. |
| Weekend Warrior | `b-271828` | Sun/moon too large; too many colours; aged is more cohesive. |
| Steady Month | `a-271828` | Agree; the green enamel works for the habit. |
| Hundred-K Week | `b-161803` | The bright blue feels cheap compared with the aged option. |
| Fellowship Founder | `b-271828` | Flame in bare metal is cooler; the aged option is better. |
| Good Company | `b-271828` | Aged night-time campfire feels premium; bright blue looks cheap. |

**Preference rules captured for future emblems:** story beat drives the material; dark/bleak beats use aged or hard metal, deep blues and limited palettes; avoid candy green/blue, oversized sun/moon, too many competing colours, and flat polished gloss. Warm/home beats can use warm enamel; wonder/elder beats can use gold/silver/crystal; habit beats can use limited green/blue. A restrained hard-metal option can beat a cheap bright one.

## Final base composites

- 15 base composites generated in PhotoCraft: **selected emblem + locked family frame + 880 px dark well**.
- 1024 px masters: `raw_assets/badges/final/<slug>.png` (gitignored).
- Production review sizes: `public/img/achievements/<slug>.webp` (512) and `<slug>-thumb.webp` (200).
- Set sheet: `final/final-set.jpg`.
- **Rank boss layer is deliberately not baked yet.** The handcrafted bosses are still under user review; after selection, the chosen boss will be added to these 15 composites and the frame + boss sheets will be rebuilt.

## Pending — rank bosses

The new handcrafted boss candidates are generated with ComfyUI (4 ranks × 12 candidates). Contact sheets:

- `sheets/rank-bosses/bronze.jpg`
- `sheets/rank-bosses/silver.jpg`
- `sheets/rank-bosses/gold.jpg`
- `sheets/rank-bosses/mithril.jpg`

The earlier procedural F1v2 bosses and the old frame + boss sheets are superseded as review artifacts. The new handcrafted boss review is still open.

## In progress — image-generation skill

A subagent is applying the user's palette/material feedback to the emblem-generation skill. After the emblem/boss review settles, the skill should also cover:

- generating the selected handcrafted bosses with ComfyUI;
- cutting out/normalising the boss medallions and 90 px placement tiles;
- seating the chosen boss on the locked family frame in PhotoCraft with a contact shadow;
- rebuilding the boss finalist and frame + boss review sheets.

## Cleanup

The old emblem/frame/rank-ring/shape review galleries, finalist WebPs, contact sheets, and superseded procedural-boss sheets have been removed. The boss review set is retained:

- `sheets/rank-bosses/` — four contact sheets;
- `boss-candidates.jsonl`, `bosses.jsonl`;
- `scripts/badge-art/boss-prompts.json`, `process_bosses.py`;
- `raw_assets/badges/bosses/` (gitignored).

## Standing decisions

- **Shape:** circle.
- **Stack:** F1 — emblem 800 → family frame 880–1016 → 6 o'clock rank boss. No rank ring.
- **Rank rings:** retired; not part of the final art.
- **Frames:** locked as listed above.
- **Rank label:** the card label is authoritative; the boss is the visual cue.
