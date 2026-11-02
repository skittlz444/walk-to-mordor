# Achievement Badge Style Reference

The badge is a **collectible object**, not a picture. One motif, centred, on a flat black field, built as a circular medallion with a reusable family frame and a single rank boss. The reference set is the committed art in `public/img/achievements/`.

Read this with `docs/badge-art-decisions.md`. That document is the decision record: circle only, no rank ring, F1 6 o'clock boss, family frames unchanged.

---

## Art direction

> High-end hard enamel pin and engraved metal. Crisp vector-like shapes, strong readable silhouette, centred symmetrical composition, rich saturated colour with gold and steel accents, subtle bevel and rim light. One object, no scene.

The badge must survive three reductions without turning to mush: 512 px card, 200 px thumb, 96 px grid. Design for the 96 px read first.

### Material language

| Treatment | Cue | Use |
|---|---|---|
| Polished hard enamel | Glossy raised gold outlines, smooth saturated fields, thin bright metal edge | Variant A |
| Aged engraved metal | Hand-chased relief, patinated bronze, worn highlights, deep recessed colour | Variant B |
| Enamel field | Flat colour with a soft top-light gradient | All emblems |
| Metalwork | Crisp edges, a lit top-left and a dark bottom-right bevel | Frames, bosses |

### Field discipline

- **Matte flat base plus a soft top-light gradient.** This is the set rule.
- No hard white specular dome.
- No vignette, spotlight, or cast shadow inside the art.
- No full-bleed pastel gradient. No magenta/pink sunset field.
- Keep saturation in the dark-fantasy key. If a badge reads as mobile-game art, desaturate about 15% and re-grade.

The current set still carries four field treatments: glossy dome, matte flat, pastel gradient, and no field. New art must use the matte flat rule so the set converges instead of widening the split.

### Density

- Not a pin in an empty field (~60% empty).
- Not an edge-to-edge painted plate.
- Aim for a readable object that fills roughly half to two-thirds of the circular face, with calm field around it.

### Composition

- One object, centred, symmetrical or near-symmetrical.
- No perspective scene, horizon, ground line, or framing device.
- The object may break the circle slightly at the edge, but it must not be cropped by the 800 px mask in a way that loses the read.
- Leave room at 6 o'clock for the boss; do not put a critical detail directly under it.

---

## Story-beat palette matrix

The emblem reads as the achievement's emotional beat, not only its noun. The same motif in bright enamel can look cheap on a dark beat; a quieter hard-metal treatment reads premium. Choose the beat first, then the material and palette.

| Beat | Visual read | Material | Palette | Typical families |
|---|---|---|---|---|
| Dark, bleak, tense, sombre after victory | Danger, loss, endurance | Aged or hard metal; patinated, hand-chased, engraved | Charcoal, steel, patinated bronze, umber, deep muted blue; ember red only as an accent; 2–3 families | journey, challenge |
| Warm, home, hopeful | Safety, return, rest | Aged bronze/brass; soft glow; warm enamel allowed | Amber, honey gold, deep green, warm brown; one gentle light source | journey, habit, community |
| Wonder, elder, elven | Awe, age, grace | Polished gold/silver, crystal, fine engraving | Gold, pale silver, crystal blue-white; richer but cohesive | journey, field-guide |
| Habit, consistency | Repetition, small wins | Enamelled field with steel/copper structure | Deep green or blue plus one warm metal; limited | habit |
| Community, fellowship | Shared fire, belonging | Bare or dark metal with firelight | Iron, bronze, ember orange; minimal cool colour | community |

Rules:

- **Mixed beats:** the dominant beat controls the material; the secondary beat gets one accent. Dark plus warm (a campfire at night, a homecoming after loss) stays dark metal with warmth as glow, not as a bright field.
- **Bright enamel is a choice, not a default.** It fits wonder and some habit badges. On a dark beat it reads cheap, however clean the rendering.
- **One palette test at 96 px.** The colour should still say the beat when the motif is a silhouette.
- **Premium beats bright on ties.** A slightly quiet hard-metal option can be the better pick; "a bit bland but better" is an acceptable verdict, "bright but cheap" is not.

### Approved directions from the 15 picks

These are evidence of the rule, not templates. Do not copy a composition because it was picked; derive the motif from the achievement.

| Emblem | Family | Beat | Approved direction |
|---|---|---|---|
| First Steps | habit | warm/home + habit | Aged (b): deep green door, brass knob, warm lamp; aged bronze carries the warmth |
| Across the Buckleberry Ferry | journey | dark | Aged (b): patinated metal hull, dark water, lantern as the only warm accent; bright green enamel rejected |
| Survivor of Weathertop | journey | dark/tense | Aged (b): deeper blue-grey, patinated bronze/steel, more engraved detail |
| Through Khazad-dûm | journey | dark/bleak | Aged (b): dark stone, patinated steel, pale silver linework; bright enamel rejected as cheap |
| Guest of the Golden Wood | journey | wonder/elven | Polished (a): gold mallorn leaves on pale silver, deep navy field |
| The Breaking of the Fellowship | journey | dark/sombre | Aged (b): cold steel and silver horn, muted water; hard-metal colour reads premium |
| Standing at Mount Doom | journey | dark/post-victory | Aged (b): darker hard metal, well-formed detailed mountain; muted ember red as accent only |
| Home Again at Sunset | journey | warm/home | Aged (b): amber and aged bronze, soft sunset glow |
| Faithful Walker | habit | habit | Polished (a): bright blue field with gold path and stones; one blue family, metal-structured |
| The Glittering Caves | journey | wonder | Polished (a): crystal blue-white with a gold lantern; richer palette, still cohesive |
| Weekend Warrior | habit | habit | Aged (b): sun and moon reduced to small secondary accents, palette cut to 2–3 families |
| Steady Month | habit | habit | Polished (a): deep forest-green enamel with gold; limited green family |
| Hundred-K Week | habit | habit/achievement | Aged (b): muted navy-blue, aged metal; the bright blue read cheap |
| Fellowship Founder | community | community | Aged (b): bare/dark metal flame on bronze stones; minimal colour, bright rejected |
| Good Company | community | community | Aged (b): aged bronze, warm campfire light, premium night-time read |

A blue field is not banned outright: Faithful Walker's approved blue is a single, deliberate habit enamel with gold structure. The failing blues are washy or oversaturated fills used on dark, community, or generic beats.

---

## Layer geometry

All layers are authored on a 1024 × 1024 canvas with centre `(512, 512)`. The outer frame is 1016, leaving a 4 px margin for antialiasing.

| Layer | Outer diameter | Inner diameter | Band | Notes |
|---|---|---|---|---|
| Emblem | 800 | — | — | Circular face, r 400, 1 px feathered mask |
| Family frame | 1016 | 880 | 68 | r 508 outer, r 440 inner |
| Rank boss | 70 bezel | 54 disc / 25 gem | — | Centre `(511, 979)`, 6 o'clock |
| Canvas | 1024 | — | — | 4 px margin |

**Stack:** emblem → family frame → rank boss. There is no rank ring.

### The 800–880 well

The retired stack A put a rank ring in the 800–880 annulus. F1 removes the ring. The annulus must now be **opaque**: the frame's dark inner well, or a near-black disc at 880 placed behind the emblem. Keep the frame band at 68 px; do not widen it to hide the gap.

Frame masters from the original run may be undersized and their inner edge is not guaranteed to be 880 (the review measured about 993 outer / 872 inner); the emblem art is about 776. That was acceptable for the old three-ring stack; it is not acceptable for F1 as-is. Re-normalise the outer to 1016 and the inner to 880, then fill 800–880 opaquely. The review proofs hide the gap because they are flattened onto `#14181f`; an alpha export shows it immediately.

### Keyline

Add a 1 px dark keyline around the emblem edge. It separates the art from the well and the metal, and makes the emblem sit inside the frame instead of floating over it. Do not use a bright ring; the keyline is a shadow, not a highlight.

### Production tolerance

- Every layer is 1024 × 1024 RGBA.
- The emblem's visible art should reach r 400. A 1 px keyline hides a 1 px seam; it cannot hide a 12 px gap. If the art stops at 388, fix the master or the mask, do not rely on the keyline.
- The frame's inner edge should be a clean circle at r 440 before the well is added.
- The boss is a selected handcrafted master, normalised to the 70 px tile; it is not generated per badge.

---

## Family frames

Each `badge_type` owns one frame. The frame is the family identity; the boss is the rank. Never plate the whole frame in the rank metal (that was variant F2, rejected).

| Family | Frame master | Motif | Family cue at 96 px |
|---|---|---|---|
| `journey` | `frame/journey` | Braided gold and dark steel band, engraved leaves, weathered notches | Gold laurel/braid against dark steel |
| `habit` | `frame/habit` | Brushed steel band, seven evenly spaced notches, thin copper inner line | Copper pinstripe and seven notches |
| `challenge` | `frame/challenge` | Black iron band, molten red cracks, hooked barbs | Black iron with red fissures |
| `book` | `frame/book` | Embossed dark leather, gold filigree, page-corner tabs, brass clasp | Leather texture plus gold filigree |
| `community` | `frame/community` | Warm bronze interlocking knotwork, round studs, woven clasp motifs | Bronze knotwork |
| `field-guide` | `frame/field-guide` | Aged brass band, pressed leaves, seed pods, small rivets | Brass with organic inclusions |

The journey and habit frames are set-tested. The other four have generated masters and finalists but have not been through a nine-badge coherence run. Treat them as provisional until their owning change runs one.

### Habit is a family, not a tier

The habit pair reads as silver versus gold at a glance, which makes it look like a lower metal tier. The actual family cue is the copper inner line plus seven notches. Widen or brighten that copper line and the notch caps so the cue survives 96 px. Do not "fix" habit by giving it a rank-coloured frame.

### Frame generation prompt shape

> An empty circular ring frame: a broad [material] band with [motif], enclosing a completely hollow, empty, flat black centre. [Polish/patina treatment]; a hollow ring only, with nothing inside the opening.

The centre must stay empty for the cutout. A frame that generates a filled centre is rejected in the shortlist, not repaired by hand.

---

## Rank boss v2

F1v2 gives rank two independent axes on the same 6 o'clock boss: **colour** is the primary read at 96 px, **cut** is the secondary read at 200 and 512 px.

Geometry is identical for all four ranks:

| Part | Diameter at 1024 | Radius | Notes |
|---|---|---|---|
| Dark bezel | 70 | 35 | Sits on the 68 px frame band; outer rim stays visible |
| Metal disc | 54 | 27 | Rank metal, top-left key light |
| Gem / cut stone | 25 | 12.5 | Same cut as the disc |

The boss is centred at `(511, 979)`. Keep that exact value; it is the tested F1 position and must match `BOSS["centre"]` in `composite_badges.py`.

At 96 px the bezel is about 6.6 px and the whole boss reads as a coloured dot. At 48 px it is about 3.3 px and only colour survives. At 200 px it is about 13.8 px and the cut is visible. Do not expect the cut to carry rank at 96 px.

### Palettes and cuts

Source of truth: `BOSS_V2` in `scripts/badge-art/composite_badges.py`. If a value here differs, the code wins; update this table with the code.

| Rank | Read | Bezel | Metal | Highlight | Gem | Cut |
|---|---|---|---|---|---|---|
| Bronze | Warm copper | `#24160d` | `#b87333` | `#f0c090` | `#6e3b1d` | Round cabochon |
| Silver | Neutral chrome | `#1b2026` | `#c9ced6` | `#ffffff` | `#8a949f` | Octagon (flat-top) |
| Gold | Yellow gold | `#2b2008` | `#e0b23a` | `#fff0b0` | `#8a6410` | Hexagon (pointy-top) |
| Mithril | Cool blue | `#12232e` | `#7fc9e8` | `#d6f6ff` | `#4f9fbd` | Four-point star |

Rules:

- **Silver is neutral.** No cyan tint. It must not compete with mithril.
- **Mithril is the only cool-blue metal and the only star cut.** It also gets a subtle cyan halo: `#4f9fbd`, 4 px wide at 1024, alpha 82. The halo must not grow the badge's alpha bbox.
- **Bronze is round, silver octagon, gold hexagon, mithril star.** Do not swap cuts between ranks.
- **The dark bezel is mandatory.** It is what separates the boss from both gold and steel frame bands.
- **The gold-on-gold case is the stress test.** Gold boss on the journey gold frame must still show a dark bezel ring at 96 px. If the bezel disappears, the boss merges and the rank cue is lost.

### Why the cut exists

Colour alone collapses under small sizes and under colour-vision differences. The cut gives a second, shape-based cue at 200 and 512 px without adding a second data source. It does not replace the rank label; it reinforces it.

Reference: the selected boss per rank in `docs/badge-art-decisions.md`; regenerate comparison sheets with `scripts/badge-art/process_bosses.py`.

---

## Coherence rules

The set is one product, not nine unrelated medallions. Score coherence 1–5; the current set is 3/5. A new badge must not lower it.

1. **One field treatment.** Matte flat plus soft top-light. No hard dome, no pastel gradient, no unfielded postcard.
2. **Palette discipline.** Keep the dark-fantasy key. Desaturate outliers by about 15%. No magenta/pink sky, no saturated cobalt field, no neon.
3. **Density discipline.** Mid-density object. Neither a pin nor a painted plate.
4. **Family cue at 96 px.** The frame must say journey, habit, challenge, book, community, or field-guide before the motif does.
5. **Rank cue at 96 px.** A dark-bezelled coloured dot at 6 o'clock. The label carries the exact tier.
6. **Collection grouping.** The seven journey badges sit together; the two habit badges sit together. Do not present a flat nine-grid that makes habit look like a lower tier.
7. **No rank ring.** A concentric ring outside the family frame is a regression. Remove it; do not restyle it.
8. **No hexagon silhouette.** The shape decision is circle. The gold boss's hexagonal cut is not a badge shape.
9. **Keyline.** A 1 px dark separation between emblem and frame keeps the stack legible.
10. **One material story.** Enamel field, metal frame, metal boss. Do not mix a painted illustration field with an enamel frame.

---

## What the reference set looks like

| Badge | Family | Boss | What it proves |
|---|---|---|---|
| Across the Buckleberry Ferry | journey | Bronze, round | Warm copper on gold frame; the default rank-1 read |
| Through Khazad-dûm | journey | Silver, octagon | Neutral chrome separates from the gold frame without reading cold |
| The Breaking of the Fellowship | journey | Gold, hexagon | Yellow gold on gold frame; the bezel is the only separator |
| Home Again at Sunset | journey | Mithril, star | The only cool-blue metal and the only halo; star reads at 200 |
| First Steps | habit | Bronze, round | Habit family cue: steel band, copper line, seven notches |
| Faithful Walker | habit | Four rank variants | Repeatable badge; bronze/silver/gold/mithril are baked separately and the label carries the live rank |

Repeatable badges ship all four rank variants (`<slug>--<rank>.webp`); the base `<slug>.webp` is the no-boss fallback.

### Files

Final assets: `public/img/achievements/<slug>.webp` (512), `<slug>-thumb.webp` (200), and `<slug>--<rank>.webp` for repeatables.

Generated review proofs are temporary and not committed; the scripts write them under `reports/badge-art/` when a new review is needed.

---

## Failure catalogue

These are observed failures from the first nine-badge run. Do not repeat them.

### Rank ring

- At 1016 px the ring band is 40 px; at 96 px it is 3.8 px.
- The 3/4/5/6 studs are about 2 px and cannot be counted.
- Four metals collapse to two visual families: bronze≈gold (warm), silver≈mithril (cool).
- Gold-on-gold disappears against the journey frame.
- In stack A the ring reads as a separate element on only two of nine badges. The rest merge with the emblem rim or frame.
- Verdict: remove it. Use the boss.

### Variant E (rank as outer border)

- Gold-on-gold still disappears.
- The rank band covers the outer 46 px of the 68 px frame, reducing the journey laurel to ~2 px at 96 px.
- The emblem is scaled to 880 to meet the frame opening, which crops edge-composed art.
- The habit pair splits into bronze-rimmed and gold-rimmed silhouettes.
- Verdict: worst of the four for set coherence, even though the intent is right.

### Masked hexagon

- Reads as a coin in a tray: the circular dome, vignette, and baked rim survive inside the hexagonal frame.
- The corners are dead space; the art is clipped at the sides.
- Bespoke hexagon emblems are a different art style and need a full re-run.
- Verdict: parked. Circle only.

### Field failures

- Hard white dome on Buckleberry, Golden Wood, and Faithful Walker.
- Matte flat on Weathertop, Khazad-dûm, Rauros, and Mordor.
- Full-bleed pastel gradient on Home at Sunset.
- No field on First Steps.
- At 96 px the eye sees two lighting models and one postcard.
- Fix: one matte flat base plus soft top-light gradient. Grade first; regen only if the dome is baked in.

### Palette failures

- Home at Sunset: magenta/pink/orange pastel outlier.
- Faithful Walker: very saturated cobalt plus bright gold; the most mobile-game read in the set.
- First Steps: brighter than the dark-fantasy key.
- Fix: desaturate about 15%, add the common field gradient, keep the family metal.

### Density failures

- Golden Wood and Rauros: ~60% empty field.
- First Steps and Khazad-dûm: edge-to-edge.
- Fix: mid-density object with calm field around it.

### Habit-as-tier

- The habit frame reads as silver versus the journey gold, so habit looks like a lower metal tier.
- The copper pinstripe and seven notches are the real cue, and they vanish at 96 px.
- Fix: strengthen the copper line and notch caps. Do not recolour the frame to a rank metal.

### Gold-on-gold boss

- The gold boss on the gold journey frame is the one place the boss can disappear.
- The dark bezel must remain a visible ring at 96 px. If it does not, reject the composite; do not lighten the frame to compensate.

---

## Applying the style to a new type

1. Start from the family frame, not from a blank circle. The frame is the family.
2. Pick one motif that belongs to the achievement's criteria, not to its name alone.
3. Keep the family metal in the frame and put the rank only in the boss.
4. Grade the field to the matte-flat rule before judging the motif.
5. Composite into the 3 × 3 grid and judge it there, not in isolation.
6. If the new badge is the first of its type, run a family mini-grid (three badges) before committing the frame language.

---

Provenance: `docs/badge-art-decisions.md` (final decision record), `scripts/badge-art/prompts.json` and `boss-prompts.json` (prompt matrices), and the pipeline scripts under `scripts/badge-art/`.
