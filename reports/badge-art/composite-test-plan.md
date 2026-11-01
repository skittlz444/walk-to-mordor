# Badge Composite Test — Coherence, Shape, and Layer Stacking

Scope: evaluate the **recommended picks** as a set, not as individual badges. No application code, no final production assets.

## Questions to answer

1. **Set coherence** — do the nine badges read as one intentional collection, or as nine unrelated medallions?
2. **Rank + frame compatibility** — does the thin rank ring work with the thick family frame, or do they look like two unrelated concentric rings?
3. **Shape** — circle vs pointy-top hexagon. Which shape supports the art, the frame, and the rank ring better?
4. **Stack** — what is the clearest hierarchy: rank inside the frame, rank as an inlay on the frame's inner edge, or no rank ring at all?

## Inputs

- Emblems, frames, and rank rings from `raw_assets/badges/processed/`.
- Recommended pick per asset from `reports/badge-art/shortlist.json`.
- Family frames: `journey` for the seven journey badges; `habit` for the two habit badges.
- Rank rings: journey ranks 1,1,2,2,3,3,4 → bronze, bronze, silver, silver, gold, gold, mithril. `habit-first-steps` uses bronze; `habit-faithful-walker` uses gold as a representative repeatable rank.
- Background for previews: `#14181f`, with a soft shadow so the badge separates from the field.

## Geometry

### Circle (existing layers)

| Layer | Outer | Inner |
|---|---|---|
| Emblem | 800 | — |
| Rank ring | 880 | 800 |
| Family frame | 1016 | 880 |

Stack: emblem → rank → frame.

### Pointy-top hexagon (test remap)

Regular hexagon, circumradius R (centre to vertex). Overall height 2R, width R·√3.

| Layer | Outer R | Inner R | Overall |
|---|---|---|---|
| Emblem | 400 | — | 800 × 693 |
| Rank ring | 440 | 400 | 880 × 762 |
| Family frame | 508 | 440 | 1016 × 880 |

Stack: emblem → rank → frame.

The hexagon layers are **geometric remaps of the selected circular art** for this test: the emblem is masked to a hexagon; the rank and frame bands are unwrapped from the circular annulus and wrapped around the hexagon annulus. This preserves the chosen metalwork and answers the shape question without a second generation run. If hexagons win, bespoke hexagon masters are generated in 8.6.

### Variant E (rank as outer border)

| Shape | Rank destination | Emblem |
|---|---|---|
| Circle | 1016 outer / 923.6 inner diameter (scale 1016/880) | scaled 880/800 |
| Hexagon | R508 outer / R468 inner | scaled to R440 |

Stack: emblem → frame → rank. The rank covers the frame's outer ~46 px (circle) / ~40 px (hexagon) and becomes the outermost coloured rim. The emblem is scaled to the frame's 880 opening because moving the rank outward empties the 800–880 slot it filled in variant A; without the scale-up a transparent ring shows between the emblem and the frame.

## Stack variants (one badge, both shapes)

- **A — Rank inside frame (current):** emblem 800 · rank 800–880 · frame 880–1016.
- **C — Rank inlay:** emblem 800 · frame 880–1016 · rank scaled to 920/840 and laid over the frame's inner edge. The rank reads as a coloured bezel rather than a third ring.
- **D — Frame only:** emblem + frame, no rank ring. Baseline for whether the rank ring adds value.
- **E — Rank as outer border:** emblem scaled 880/800 · frame 880–1016 · rank scaled 1016/880 and laid over the frame's outer edge. The rank reads as the outermost coloured rim with the family frame visible inside.

## Deliverables

| Output | Contents |
|---|---|
| `composites/circle/<slug>.webp` | nine full circle badges, recommended picks |
| `composites/hexagon/<slug>.webp` | nine full hexagon badges |
| `composites/circle-e/<slug>.webp` | nine variant E circle badges |
| `composites/hexagon-e/<slug>.webp` | nine variant E hexagon badges |
| `composites/coherence-circle.jpg` | 3×3 set grid, names and ranks |
| `composites/coherence-hexagon.jpg` | 3×3 set grid |
| `composites/coherence-circle-e.jpg` | variant E 3×3 set grid |
| `composites/coherence-hexagon-e.jpg` | variant E 3×3 set grid |
| `composites/stack-circle.png` | exploded A stack: emblem, +rank, +frame, final |
| `composites/stack-hexagon.png` | exploded A stack |
| `composites/stack-variants.jpg` | A / C / D / E for one badge, circle and hexagon |
| `composites/rank-matrix-circle.jpg` | one badge × four ranks, circle |
| `composites/rank-matrix-hexagon.jpg` | one badge × four ranks, hexagon |
| `composites/manifest.json` | asset, shape, variant, layer paths, output paths |

## Review

Two independent artistic reviews, each reading the composites and `docs/design-guide.md`:

- **DeepSeek V4.1 Flash #max** — `reports/badge-art/art-review-deepseek.md`
- **GLM-5.3-Flash #max** — `reports/badge-art/art-review-glm.md`

Each review must answer:

1. Does the set cohere? Name the specific mismatches (palette, density, material, background field, frame weight).
2. Do the rank ring and family frame combine? Is the hierarchy legible at 96 px and 512 px?
3. Circle or hexagon — pick one and justify it against the art.
4. Stack variant A, C, D, or E — pick one.
5. Concrete fixes, ranked must/should/nice, with the asset or layer they apply to.

No reviewer sees the other's review. The final synthesis is `reports/badge-art/composite-review.md`.

## Non-goals

- No final `public/img/achievements/` writes.
- No seed, island, CSS, or API work.
- No compositing into production until the shape/stack decision is made.
