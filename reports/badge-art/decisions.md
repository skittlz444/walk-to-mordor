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

## Final composites

- **11 fixed-rank badges** have the selected boss baked in: 8 journey + 2 community + First Steps. The public 512/200 files are `<slug>.webp` / `<slug>-thumb.webp`.
- **4 repeatable habit badges** — Faithful Walker, Weekend Warrior, Steady Month, Hundred-K Week — have **four rank variants** each, because the rank changes with earned count:
  - `<slug>--bronze.webp`, `--silver`, `--gold`, `--mithril`, plus 200 px thumbs.
  - The base `<slug>.webp` remains a no-boss fallback.
  - The client must select the variant from `presentation.rank`; if it does not, the fallback shows the emblem/frame without a boss.
- 1024 masters: `raw_assets/badges/final-complete/` (gitignored).
- Set sheet: `final/final-set.jpg` (repeatables shown at gold preview).
- Rank variants sheet: `final/repeatable-ranks.jpg`.

## Locked — rank bosses

The user accepted all shortlist recommendations except **mithril**: `b-173205` over `b-314159`.

| Rank | Selected | Notes |
|---|---|---|
| Bronze | `a-112358` | Clean hand-forged round cabochon. |
| Silver | `a-314159` | Densest octagonal ray work. |
| Gold | `a-314159` | Dimensional filigree and domed cabochon. |
| Mithril | `b-173205` | User override; the more refined star. |

- Top-two finalist and stamped-frame review: `boss-review/index.html`.
- The shortlist recommendation for mithril was `b-314159`; the user chose `b-173205`. `boss-selections.json` records the final picks.
- Dual reviews: DeepSeek finalists ready, stamping flagged for a seat/shadow fix; GLM both ready. The shadow is clipped to the badge alpha in the final composites.
- The 12-candidate contact sheets were removed; the top-two review set, `boss-shortlist.json`, generation logs, prompts, processing script, and raw boss assets are retained.

## Applied — image-generation skill

The emblem skill now encodes the user's 2026-11-02 palette/material feedback:

- story-beat matrix (dark/bleak, warm/home, wonder/elder, habit, community);
- premium-over-bright rule and the “cheap” tells;
- 15 approved-direction examples from this review;
- prompt patterns for each beat and an avoid list;
- a pre-shortlist premium/story-beat gate in the checklist.

The handcrafted-boss pipeline remains a follow-up after boss selection:

- generate the selected bosses with ComfyUI;
- cut out/normalise the boss medallions and 90 px placement tiles;
- seat the chosen boss on the locked family frame in PhotoCraft with a contact shadow;
- rebuild the boss finalist and frame + boss review sheets.

## Cleanup

The old emblem/frame/rank-ring/shape review galleries, finalist WebPs, contact sheets, and superseded procedural-boss sheets have been removed. The boss review set is retained:

- `boss-review/` — top-2 finalist sheet, stamped full/detail sheets, individual files;
- `boss-shortlist.json`, `boss-candidates.jsonl`, `bosses.jsonl`;
- `scripts/badge-art/boss-prompts.json`, `process_bosses.py`;
- `raw_assets/badges/bosses/` (gitignored).

## Standing decisions

- **Shape:** circle.
- **Stack:** F1 — emblem 800 → family frame 880–1016 → 6 o'clock rank boss. No rank ring.
- **Rank rings:** retired; not part of the final art.
- **Frames:** locked as listed above.
- **Rank label:** the card label is authoritative; the boss is the visual cue.
- **Rank bosses:** bronze `a-112358`, silver `a-314159`, gold `a-314159`, mithril `b-173205`.
- **Repeatable bosses:** four rank variants are baked; fixed-rank badges have one bossed image.
