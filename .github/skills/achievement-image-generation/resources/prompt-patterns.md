# Achievement Badge Prompt Patterns

Prompts for `scripts/badge-art/prompts.json`. The matrix holds the shared style prefix and suffix once; each asset supplies only its motif and material treatment. `generate.py` joins the three parts.

Read `style-reference.md` first. This file is the wording library, not the art direction.

---

## The shared prefix and suffix

These strings are already in `scripts/badge-art/prompts.json`. Do not repeat them in an asset prompt.

**Prefix**

> Collectible fantasy profile badge in a high-end hard enamel pin and engraved metal style, circular badge face filling the frame, crisp vector-like shapes, strong readable silhouette, centred symmetrical composition, rich saturated colour with gold and steel accents, subtle bevel and rim light, isolated on a flat pure black background field.

**Suffix**

> Single centred motif only, no scene, no landscape, no background elements, no characters, no faces, no hands, no text, no letters, no numbers, no runes, no watermark, no signature, no extra props; clean crisp silhouette against the flat pure black field.

The joined prompt is:

```
<prefix> <motif and treatment> <suffix>
```

### Why there is no negative prompt

The graph uses CFG 1.0, which makes a negative prompt inert. The suffix carries every ban. Do not add a negative string to the graph and do not raise CFG to make a negative work; that changes the model behaviour and the whole set. If a motif keeps failing, rewrite the positive prompt.

---

## Emblem pattern

An emblem is one object on a flat field. It has **no frame** and **no border ring**.

```
<single object, one sentence, with its key parts and 2–3 colours>. <variant treatment>
```

### Variant A — polished enamel

> Polished hard enamel with glossy raised gold outlines, smooth saturated colour fields, a thin bright metal edge, and no separate outer frame or border ring.

### Variant B — aged metal

> Aged engraved metal with hand-chased relief, patinated bronze, worn polished highlights, deep recessed colour, and no separate outer frame or border ring.

The two variants must differ in **material treatment**, not in composition. If A and B describe different objects, the shortlist is comparing two motifs instead of two finishes. Both variant strings end with "no separate outer frame or border ring"; keep that clause if you write a custom treatment.

### Examples

| Motif sentence | Why it works |
|---|---|
| A small wooden ferry carrying one glowing lantern on stylised dark water, beside a weathered mooring post. | One object, strong horizontal silhouette, warm lantern accent |
| A broken ring of standing stones around a blazing brand, with scattered embers rising. | Circular composition that fits the mask; the brand is the focal point |
| An arched stone doorway carved with an interlacing silver tree-and-crown motif, seven small silver stars above the arch and two holly branches flanking its base. | Architectural object, symmetrical, reads at 96 px |
| A cluster of golden mallorn leaves on a pale silver branch. | Simple silhouette, two-metal palette, strong contrast |
| A cloven silver-bound horn above a crescent of falling water. | Two shapes, one diagonal, no scene |
| A black volcanic cone split by a molten fissure, circled by a thin ring of embers. | Dark mass with one hot accent; the ember ring is part of the object, not a rank ring |
| A round hobbit door with lit windows and a rose trellis, low sunset rays behind the round door. | The door is the object; the rays are a graphic accent, not a landscape |

Note the last one: "sunset rays behind the door" stays an emblem because the door fills the frame and there is no ground, sky, or figure. "A sunset over the Shire with a hobbit door in the foreground" would be a scene and is banned.

---

## Story-beat treatments

Choose the beat before writing the treatment clause; the palette matrix is in `style-reference.md`. The asset still ships both finishes. Apply the beat's palette to the recommended finish and mirror the motif colours into the other variant, so the shortlist compares finish rather than composition. The generic variant A/B strings above remain valid defaults; the clauses below are approved alternatives that keep the material split.

### Dark / bleak / tense

> Aged engraved bronze or steel with hand-chased relief, dark patina, deep recessed charcoal, umber, or muted blue colour, worn polished edges, a single small ember or lantern accent, and no separate outer frame or border ring.

Use for Buckleberry Ferry, Weathertop, Khazad-dûm, the Breaking of the Fellowship, and Mount Doom. Keep red to one ember accent; do not flood the field with it. Variant a on these beats stays polished but keeps the same muted palette: deep navy or charcoal enamel, never a candy fill.

### Warm / home / hopeful

> Warm aged bronze and amber enamel with a soft lamplight glow, gentle tonal depth, hand-chased metal edges, and no separate outer frame or border ring.

Use for First Steps and Home Again at Sunset. Warmth comes from the light and the metal, not from raising saturation.

### Wonder / elder / elven

> Polished gold and pale silver with fine engraving, crystal blue-white highlights, a deep cohesive field, restrained ornament, and no separate outer frame or border ring.

Use for Guest of the Golden Wood and The Glittering Caves. Richer is not more colours: hold to three families, and do not let ornament become noisy or oversized.

### Habit / consistency

> Limited deep green or blue enamel with a gold or copper structure, one accent metal, crisp engraved edges, and no separate outer frame or border ring.

Use for Steady Month and Faithful Walker, and for the aged variant of Hundred-K Week. Keep the enamel deep and the palette to one hue plus metal. Do not rainbow-code the repeatable ranks.

### Community / fellowship

> Bare or dark forged metal with warm firelight on the high points, aged bronze and iron, an ember-orange accent, minimal cool colour, and no separate outer frame or border ring.

Use for Fellowship Founder and Good Company. The fire is the only warm block; do not put a blue field behind it. A bare-metal flame is a valid, premium result even when it is quiet.

The canonical beat-to-finish recommendation is the table in `style-reference.md`; each pattern above names the finish it suits.

### Avoid in a beat treatment

- An oversized sun or moon, or any celestial symbol that dominates the motif. Keep it a small secondary accent.
- Candy or oversaturated green/blue enamel.
- More than three colour families in one emblem.
- A flat polished plate with no engraving, patina, or hand-chasing.
- Generic mobile-game gloss, hard dome, neon rim, or rainbow rank coding.

---

## Family frame pattern

A frame is a hollow ring. The centre must stay empty so the cutout can open it. The shared prefix still says "badge face filling the frame"; the frame sentence overrides it. Do not add a badge face or an emblem inside the opening.

```
An empty circular ring frame: a broad <material> band with <motif>, enclosing a completely hollow, empty, flat black centre. <polish or patina treatment>; a hollow ring only, with nothing inside the opening.
```

### Variant A — polished

> Polished precious metal with crisp engine-turned engraving and glossy enamel inlay; a hollow ring only, with nothing inside the opening.

### Variant B — aged

> Aged hand-engraved metal with dark patina, a hammered surface and worn edges; a hollow ring only, with nothing inside the opening.

### Family motifs

| Family | Band |
|---|---|
| `journey` | Broad braided band of gold and dark steel, engraved leaves, weathered notches |
| `habit` | Broad brushed steel band, seven evenly spaced notches, thin copper inner line |
| `challenge` | Broad black iron band split by molten red cracks, hooked barbs |
| `book` | Broad embossed dark leather band, gold filigree, small page-corner tabs, brass clasp |
| `community` | Broad warm bronze band of interlocking knotwork, small round studs, woven clasp motifs |
| `field-guide` | Broad aged brass band, pressed leaves, seed pods, small rivets |

Do not ask for a frame with a filled centre, an inner emblem, a gemstone in the middle, or a background behind the opening. A filled centre is rejected in the shortlist, not repaired.

### Frame failure modes

- The model draws a complete medallion with an emblem inside. Reject.
- The band is too thin for a 68 px depth after normalisation to 1016. Reject.
- The inner opening is elliptical or off-centre. Reject.
- A clasp protrudes so far that the bbox fit shrinks the band. Note it, then re-normalise the outer to 1016 before compositing.
- The frame is so ornate that the family cue vanishes at 96 px. Simplify the motif, not the metal.

---

## Rank prompt pattern (legacy)

F1 uses a **selected handcrafted boss master**, not a generated ring. These prompts exist only for the archived rank-ring masters. Do not composite a rank ring into a new badge.

```
A thin circular rank band with <3|4|5|6> evenly spaced round studs, <metal>, <finish>, enclosing a completely hollow, empty, flat black centre. <polish or patina treatment>; a thin band only, with nothing inside the opening.
```

| Rank | Studs | Metal | Finish |
|---|---|---|---|
| Bronze | 3 | Warm bronze | Softly worn |
| Silver | 4 | Polished silver | Bright edge |
| Gold | 5 | Deep gold | Beaded edge |
| Mithril | 6 | Pale blue-white elven metal | Faint cool glow |

If the product ever reverses the no-ring decision, these are the masters to regenerate. Until then, the boss palette and cut in `style-reference.md` are the rank system.

---

## Negative rules

The suffix already bans the big ones. Add nothing that contradicts it, and treat this list as a pre-flight check.

### Banned in the prompt

- **Scene words:** landscape, forest, sky, horizon, ground, field, valley, mountain range, establishing shot, cinematic, atmospheric perspective.
- **Narrative words:** walking, journeying, arriving, departing, battle, crowd, camp.
- **People:** character, figure, silhouette of a person, face, portrait, hands, fingers, crowd.
- **Text:** text, letters, numbers, runes, inscription, label, sign, map, banner with writing, watermark, signature.
- **Extra frame instructions on an emblem:** border, separate frame, ring, bezel, rim band, medallion edge. The shared prefix's "filling the frame" is compositional; keep the no-frame clause.
- **Rank words on an emblem:** rank, tier, studs, pips, chevrons, numerals.
- **Material drift:** watercolour, watercolor, painting, wash, brushwork, photorealistic, photograph, 3D render, CGI, cartoon, anime, comic, neon.
- **Lighting drift:** hard dome, specular highlight, glass dome, spotlight, vignette, lens flare.
- **Shape drift:** hexagon badge, octagon badge, shield badge, square badge.

### Positive substitutes

| Instead of | Write |
|---|---|
| watercolour painting | hard enamel pin, engraved metal |
| atmospheric, misty | crisp, high-contrast, clean silhouette |
| sunset scene | low sunset rays behind the object, graphic arc |
| glowing with magic | faint cool rim light |
| ornate border | no separate outer frame or border ring |
| rank ring | (omit; the boss is applied in the composite) |

### Prompt length

- Motif: one or two sentences, roughly 25–60 words.
- Treatment: one sentence, roughly 25–35 words.
- Joined prompt: keep under about 140 words. Longer prompts dilute the silhouette and invite scene elements.

---

## Per-type motif examples

All examples are **single objects**. Pick one, then adapt the colours to the family. Do not combine two rows into one badge.

### Journey

| Achievement idea | Motif |
|---|---|
| A river crossing | A small wooden ferry with one lantern, a mooring post, stylised dark water |
| A watched camp | A broken ring of standing stones around a blazing brand, scattered embers |
| A threshold under a mountain | An arched stone doorway with a silver tree-and-crown, seven stars, holly branches |
| A forest refuge | A cluster of golden leaves on a pale silver branch |
| A parting | A cloven silver-bound horn above a crescent of falling water |
| A dark destination | A black volcanic cone split by a molten fissure, a thin ember ring |
| A return home | A round hobbit door with lit windows and a rose trellis, low sunset rays |

Avoid: the One Ring as a standalone motif unless the definition is specifically about it; maps, landscapes, marching figures.

### Habit

| Achievement idea | Motif |
|---|---|
| First walk | A round green hobbit door, brass knob, stone step, warm light in the crack |
| Seven-day streak | A winding path with seven milestone stones and a planted walking staff |
| Daily consistency | A single milestone stone with a ribbon tied around it |
| Morning walks | A brass lantern with a low flame on a stone ledge |

Avoid: feet, boots in motion, calendars, clocks with numerals, checkmarks, text.

### Community

| Achievement idea | Motif |
|---|---|
| A shared campaign | Two interlocking bronze rings over a woven knot field |
| A fellowship milestone | A round knotwork shield with a central stud and four small rivets |
| A group contribution | Three stacked bronze ingots bound by a single band |
| A gathering | A woven bronze torc with a single clasp |

Avoid: clasped hands (the frame prompt uses "clasp motifs" as an abstract weave, not literal hands), crowds, banners with text, maps.

### Book

| Achievement idea | Motif |
|---|---|
| A book completed | A closed leather-bound book with a brass clasp and gold filigree |
| A chapter read | An open page fan with a ribbon bookmark, no writing on the pages |
| A storyline finished | A stack of three leather books with a single brass key |
| A collected tale | A leather satchel with a brass buckle and a corner of parchment |

Avoid: readable pages, runes, titles, maps, quills writing (a hand).

### Challenge

| Achievement idea | Motif |
|---|---|
| A hard encounter | A notched black iron blade crossed with a barbed hook |
| A survival | A black iron anvil split by a molten crack |
| A pursuit | A black iron horseshoe wrapped in a broken chain |
| A completion | A barbed iron hook with one molten seam |

Avoid: the Nazgûl as a figure, hooded silhouettes, horses in motion, faces, gore.

### Field guide

| Achievement idea | Motif |
|---|---|
| A plant discovery | A pressed oak leaf under a brass loupe |
| A seed collection | A split seed pod with three small brass rivets |
| A fauna discovery | A single feather pinned under a brass clip |
| A region survey | A brass compass rose with pressed leaves at its points, no letters |

Avoid: animals as characters, maps with place names, Latin labels, specimen grids with numbers.

---

## Worked example: adding one journey emblem

1. Definition: `journey-frodo-sam-rauros-parting`, type `journey`, rank 3, collection index 6 of 7.
2. Motif sentence: "A cloven silver-bound horn above a crescent of falling water."
3. Variant A: motif + polished enamel treatment + "no separate outer frame or border ring."
4. Variant B: motif + aged engraved treatment + "no separate outer frame or border ring."
5. Add to `prompts.json` with `target_outer_px: 800`, `canvas: 1024`, `family: "journey"`, `rank: 3`.
6. Generate 12, process, contact-sheet, shortlist two, review.
7. Composite with `frame/journey` and the gold hexagon boss.

The prompt never mentions Rauros, Boromir, the Fellowship, a riverbank, or a sunset. The object carries the meaning; the card text carries the name.

---

## Pre-flight check

Before saving a prompt:

- [ ] One object, centred, no scene.
- [ ] No person, face, hand, or figure.
- [ ] No text, letters, numbers, or runes.
- [ ] No frame or border ring on an emblem.
- [ ] No rank ring, studs, pips, or numerals.
- [ ] No watercolour or painting language.
- [ ] No hard dome, spotlight, or vignette.
- [ ] Two variants differ in material, not composition.
- [ ] The motif is legible as a silhouette at 96 px.
- [ ] The colours belong to the family, not to a different metal tier.
- [ ] Story beat named; material and palette follow the matrix.
- [ ] Palette is 2–3 families, with no candy green/blue.
- [ ] Any sun or moon is a secondary accent, not the dominant shape.
- [ ] Material detail (engraving, patina, hand-chasing) is visible; the plate is not flat gloss.
