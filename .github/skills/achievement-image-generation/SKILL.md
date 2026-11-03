---
name: Achievement Image Generation
description: Process for generating collectible enamel achievement badge images for Walk to Mordor. Use when adding or updating an achievement badge image.
---

# Achievement Image Generation Process

This workflow takes one achievement definition to a committed pair of WebP badge images: a 512 px card image and a 200 px thumbnail. The badge is a circular collectible object: an emblem, a family frame, and one rank boss at 6 o'clock.

It is not the goal-image pipeline. Goal images are watercolour scenes; badges are hard-enamel objects on a flat black field. It is not the avatar pipeline either.

## When to use

- Adding the artwork for a new achievement definition.
- Replacing or re-compositing an existing badge.
- Rebuilding a family frame master that the whole set uses.
- Not for goal images (use `goal-image-generation`), avatars (`public/img/avatars/`), or scene illustrations.

## Pre-requisites

- ComfyUI at `http://127.0.0.1:8188` with `flux3-image-klein-int8-convrot.safetensors`, `qwen3vl_4b_int8_convrot.safetensors`, and `flux2-vae.safetensors`; its venv at `/run/media/skittlz/LinuxStorageSSD/github/comfyui/venv/bin/python` has Pillow, numpy, and rembg 2.0.76.
- `photocraft-cli` on `PATH` for the production alpha composite, and `sharp` for the shared WebP resizer `.github/skills/goal-image-generation/resources/resize-webp.js`. The review proofs need neither.
- The locked family frames and handcrafted rank-boss layers under `assets/badge-art/`. The picks are recorded in `docs/badge-art-decisions.md`; the working copies under `raw_assets/badges/` are gitignored and disposable.
- Read `resources/style-reference.md`, `resources/prompt-patterns.md`, and `resources/checklist.md` first, plus `docs/badge-art-decisions.md` for the shape and stack decision. Do not reopen that decision per badge.

## Inputs

Collect every row before generating anything.

| Input | Source | Notes |
|---|---|---|
| `slug` | definition row / owning seed migration | Lowercase kebab-case. Becomes `image_slug` and both filenames. |
| `name`, `description` | definition row | Display only. Never baked into art. |
| `badge_type` | definition row | One of `journey`, `habit`, `community`, `book`, `challenge`, `field-guide`. Selects the family frame. |
| `rank` | definition metadata | Fixed 1–4 for non-repeatable badges. Selects the boss palette and cut. |
| `rank_thresholds` | definition metadata | Four ascending counts for repeatable badges. Replaces `rank`. |
| `collection` | definition metadata | `{slug, label, index, size}`. Grouping only; not baked. |
| `criteria` | definition metadata | Stable condition label for the owning award hook (e.g. `trailing_7d_km >= 100`). Not evaluated by SQL or the display resolver. |
| `storyline` | definition metadata | `null`/absent for global, otherwise the storyline slug. Award scope only. |
| family frame | `assets/badge-art/frames/<family>.png` | Locked, normalised 1024 alpha master; 1016 outer / 880 inner. |
| rank boss | `assets/badge-art/bosses/<rank>-tile.png` | Selected handcrafted 90 px tile plus `<rank>-shadow.png`, placed at 6 o'clock; master is `<rank>.png`. |

If the definition does not exist, the change that owns the feature seeds it. This skill adds the art and the `image_slug` link; it does not invent award hooks.

## Type ownership

| Type | Owner | Art in this skill |
|---|---|---|
| `journey` | `profile-badge-display` | Yes. Seed and award hook live in that change. |
| `habit` | `profile-badge-display` | Yes. Seed and award hook live in that change. |
| `community` | Fellowship/community feature (catalog expansion today; award hook owned there) | Catalog-only until its award hook exists. Generate the art to the same contract, but add no award logic. |
| `book` | `storyline-books-*` | The book change owns the definition, criteria, and award hook. This skill supplies the image. |
| `challenge` | `personal-challenges*` | The challenge change owns the encounter, criteria, and award hook. This skill supplies the image. |
| `field-guide` | `field-guide-collectible-discovery-*` | The Field Guide change owns discovery, criteria, and the hook. This skill supplies the image. |

One rule across all six: **art only**. Never add an award condition, a threshold, or a migration row for a type owned by another change. If the owning change has no hook yet, the badge stays catalog-only.

## Art direction

One visual language for every badge:

> Collectible fantasy profile badge; high-end hard enamel pin and engraved metal; crisp vector-like shapes; strong readable silhouette; centred symmetrical composition; rich saturated colour with gold and steel accents; subtle bevel and rim light; one motif, not a scene.

Hard rules:

- **Object, not a scene.** No landscape, sky, ground plane, perspective, or narrative tableau.
- **One centred motif.** It must read at 96 px.
- **Flat pure black field, no baked frame.** The field lets BiRefNet cut cleanly; the frame is a separate reusable layer.
- **No baked rank, collection number, or text.** Those are typographic on the card.
- **Matte field discipline.** Flat base plus a soft top-light gradient. No white specular dome, no vignette, no spotlight.

## User commissioning notes — emblem palette

The user's 2026-11-02 review of 15 emblem finalists established a preference: **the story beat chooses the material and palette, and premium beats bright.** Bright enamel is not the default; it is earned by the beat. "Story beat" here is the achievement's emotional context, not the `storyline` metadata slug.

| Story beat | Material / palette | Avoid |
|---|---|---|
| Dark, bleak, tense, or sombre after victory | Aged or hard metal: patinated bronze, steel, charcoal, umber, deep muted blue; engraved or hand-chased; 2–3 colour families | Bright candy green/blue enamel; flat polished plates |
| Warm, home, hopeful | Warm amber/gold, aged bronze, gentle lamplight glow, soft tonal depth | Neon warmth; pastel sunset wash |
| Wonder, elder, elven | Gold/silver/crystal; richer colour, still cohesive; polished enamel may fit | Oversized celestial symbols; many competing hues |
| Habit, consistency | Limited deep green or blue enamel may work; keep it premium and metal-structured | Saturated cobalt; rainbow colour-coding |
| Community, fellowship | Bare or dark metal with warm firelight: bronze, iron, ember orange | Cheap blue; glossy group-scene gloss |

**The "cheap" tells.** Reject a candidate that shows any of these:

- oversaturated candy green or blue;
- an oversized sun, moon, or other celestial symbol that dominates the motif;
- too many competing colours instead of a 2–3 family palette;
- a flat polished plate with no engraving, patina, or hand-chasing;
- generic mobile-game gloss.

Hard-metal detail, patina, engraving, hand-chasing, tonal depth, and a restrained palette read more premium than bright, flat enamel. A slightly quiet hard-metal option can beat a loud enamel one. Ornament on higher tiers stays controlled: ornate, never noisy or oversized.

The 15 picks are examples of this taste, not a mandate to copy their exact compositions. Derive the motif from the achievement; use the beat and palette rules to choose its treatment.

## Shape and stack

Circle only. No hexagon badge silhouette. No rank ring.

```
canvas 1024 × 1024, centre (512, 512)
  emblem        800 diameter  (r 400)
  family frame 1016 outer / 880 inner  (r 508 / r 440, 68 px band)
  rank boss     70 bezel / 54 disc / 25 gem, centre (511, 979)
  margin        4 px
```

The stack is emblem → family frame → boss. The rank label on the card is authoritative; the boss is a visual cue, not a second data source. The proof script's geometry lives in `BOSS`, `FRAME_SRC`, and `RANK_SRC` in `composite_badges.py`; production uses the selected handcrafted boss masters.

**The 800–880 annulus must be opaque.** With the rank ring removed, that annulus is the frame's dark inner well, not a hole. Frame masters cut for the retired stack A are cut at 880 because that stack filled 800–880 with a rank ring. Flattened proofs on `#14181f` hide the resulting transparent moat; a production alpha export will not. Fill it with an opaque near-black well disc at 880 behind the emblem, and keep the 68 px frame band. Never ship the moat.

The full palettes, cuts, and coherence rules are in `resources/style-reference.md`.

## Step 1: Confirm the definition

1. Find the definition row and the migration that seeds it. Record every input above.
2. Decide whether this is a new badge or a replacement. A replacement keeps the same `slug` and `image_slug`.
3. Check the type against the ownership table. If the owning change has not seeded the definition, stop and hand the art brief to that change.
4. Write one sentence each for the motif and its silhouette; if the silhouette needs more, the motif is too busy. Note the family frame, resolved rank, and collection group.

## Step 2: Choose the frame and the rank boss

Frame: `journey` → `frame/journey` (gold/steel braid, engraved leaves, notches); `habit` → `frame/habit` (brushed steel, seven notches, copper line); `community` → `frame/community` (bronze knotwork, studs); `book` → `frame/book` (dark leather, gold filigree, brass clasp); `challenge` → `frame/challenge` (black iron, molten red cracks, barbs); `field-guide` → `frame/field-guide` (aged brass, pressed leaves, seed pods, rivets).

Rank maps to one boss:

| Rank | Metal | Cut | Separator |
|---|---|---|---|
| 1 | Bronze, copper `#b87333` | Round cabochon | Dark bezel `#24160d` |
| 2 | Silver, neutral chrome `#c9ced6` | Octagon | Dark bezel `#1b2026` |
| 3 | Gold, yellow `#e0b23a` | Hexagon | Dark bezel `#2b2008` |
| 4 | Mithril, cool blue `#7fc9e8` | Four-point star | Dark bezel `#12232e` + cyan halo |

- **Fixed rank:** bake that boss.
- **`rank_thresholds`:** the rank varies per user. Ship four baked variants, `<slug>--bronze.webp` through `<slug>--mithril.webp`, and keep the base `<slug>.webp` as a no-boss fallback. The client selects from `presentation.rank`; the card label stays authoritative.
- **No rank ring.** Do not generate, composite, or restore one.

The gold boss cut is a **hexagon**. That is a cut on the boss, not a hexagonal badge silhouette; the ban applies to the badge shape only. The selected boss per rank is recorded in `docs/badge-art-decisions.md`.

## Step 3: Research the motif (optional, sub-agent)

Use a sub-agent only when the motif or the lore is genuinely unclear; do not delegate a motif you can already name. Give the sub-agent: the definition, `badge_type`, collection, the art-direction paragraph, and the banned list. Ask for three candidate motifs, each with the single object, its 96 px silhouette, two or three dominant colours, why it belongs, and the failure mode to avoid. No plot summary, no character scenes, no quotes. Pick one motif yourself.

## Step 4: Add the prompt to the matrix

Edit `scripts/badge-art/prompts.json`. Every asset needs:

- `id` exactly `"<group>/<slug>"`, where group is `emblem`, `frame`, or `rank`;
- `slug`, `name`, `family`, `rank`, `canvas: 1024`, and `target_outer_px` (`800` emblem, `1016` frame, `880` rank);
- exactly two variants, `a` and `b`, each with a non-empty `prompt`.

Do not repeat the shared style prefix or suffix in the per-asset prompt; `generate.py` joins them. Write one or two sentences of motif, then one sentence of material treatment.

Variant **a** is polished hard enamel with glossy raised gold outlines and smooth saturated fields; variant **b** is aged engraved metal with hand-chased relief and patinated bronze. Both emblem variants end with "no separate outer frame or border ring." Full wording is in `resources/prompt-patterns.md`.

The pair is still mandatory, but the **recommendation follows the story beat, not the polish**: dark, tense, and sombre beats → b; warm/home beats favour aged bronze and gentle glow (usually b); polished a is earned by elven wonder or a deliberately limited habit enamel, and is never the default for a dark beat. Tighten the treatment wording with the per-beat patterns in `resources/prompt-patterns.md`, and mirror the palette across both variants so the shortlist compares finish, not motif.

`generate.py` rejects the matrix if the string `watercolour` or `watercolor` appears anywhere. That is deliberate: this is not the goal pipeline.

Patterns and per-type motif examples are in `resources/prompt-patterns.md`.

## Step 5: Generate the candidate pool

Twelve candidates per emblem (2 variants × 6 seeds). Eight per frame or rank master (2 × 4), but frames and ranks are usually reused and not regenerated per badge.

```bash
python3 scripts/badge-art/generate.py --list
python3 scripts/badge-art/generate.py --only emblem/<slug> --dry-run
python3 scripts/badge-art/generate.py --only emblem/<slug>
```

| Setting | Value |
|---|---|
| Model | `flux3-image-klein-int8-convrot.safetensors` |
| Text encoder | `qwen3vl_4b_int8_convrot.safetensors`, `CLIPLoader` type `flux3` |
| VAE | `flux2-vae.safetensors` |
| Resolution | 1024 × 1024 |
| Steps | 16 |
| CFG | 1.0 |
| Sampler / scheduler | `er_sde` / `simple` |
| LoRA | None |
| Negative prompt | Empty (inert at CFG 1.0; the suffix carries the bans) |
| Seeds | emblems `112358, 271828, 314159, 161803, 141421, 173205`; frames/ranks first four |

Outputs land in `raw_assets/badges/candidates/<asset>/` and log to `reports/badge-art/candidates.jsonl`. The run is resumable. If more than 10% of a batch fails, stop and read the log; do not lower quality to get a number.

## Step 6: Cut out and normalise

```bash
/run/media/skittlz/LinuxStorageSSD/github/comfyui/venv/bin/python \
  scripts/badge-art/process_candidates.py --only emblem/<slug>
```

The script runs BiRefNet (`birefnet-general`), falls back to `isnet-general-use`, trims to alpha, and normalises on a 1024 canvas:

Emblems fit to 800 with an 800 px circular mask (1 px feather); family frames fit to 1016 and are cut open at r 440; rank rings fit to 880 and are cut at r 400 (legacy masters only; not used by F1).

Reject any frame or ring whose centre stays filled. Reject a fully transparent candidate. Verify every layer is 1024 × 1024 RGBA with real coverage before shortlisting.

## Step 7: Contact sheet, shortlist two, review gate

```bash
python3 scripts/badge-art/contact_sheets.py --only emblem/<slug>
```

The sheet is 4 columns, 320 px tiles, 3 rows for twelve emblem candidates and 2 rows for eight frame/ring candidates. It labels variant and seed.

Shortlist **exactly two** candidates on five criteria: silhouette at 96 px, motif clarity, metalwork quality, family consistency, and artifact-free edges. Apply the story-beat and premium gate in `resources/checklist.md` before marking `recommended`; the brighter option does not win by default.

Record both with a score and a one-line rationale in `reports/badge-art/shortlist.json`, and mark one as `recommended`. Then render the review pack:

```bash
python3 scripts/badge-art/make_report.py --render
```

That writes `reports/badge-art/shortlist.md`, `review.html`, `finalists/`, and (for a new file) `selections.md`.

**Review gate:** present the contact sheet, the two finalists at 512 px, the recommendation, the family, and the proposed rank. Wait for the pick to be recorded in `docs/badge-art-decisions.md`. The review is of two finalists, not twelve candidates. Do not composite and do not write `public/` before sign-off.

`make_report.py` deliberately leaves an existing `selections.md` untouched. If you add an asset to the matrix, append its row to `selections.md` by hand rather than deleting the file and losing earlier picks.

## Step 8: Composite the F1v2 badge

For a single-badge review proof:

```bash
/run/media/skittlz/LinuxStorageSSD/github/comfyui/venv/bin/python \
  scripts/badge-art/composite_badges.py --proof f1v2 --only <slug>
```

Omit `--only` to rebuild the full set grid and 96 px sheet. With `--only`, those sheets contain only that badge, so they are not a set check. Both write 512 px previews on `#14181f`. They are circle-only and review-only: the preview is flattened onto the dark background. Never ship it as a production asset.

**Production composite:** use PhotoCraft (MCP automation or the UI) or `scripts/badge-art/rebuild_finals.py`. The shared `.pcraft` template was superseded by the per-badge flow. The contract is fixed:

1. 1024 × 1024 transparent canvas with the base emblem at 800, centred.
2. Family frame at 1016 outer / 880 inner, centred.
3. Opaque dark well disc at 880 behind the emblem, so 800–880 is not transparent.
4. Selected handcrafted boss tile at centre `(511, 979)`, shadow at `(511, 981)`.
5. Clip the boss and shadow to the badge alpha.
6. Export a 1024 PNG master, then write the 512 card, 200 thumb, and 1024 `full/` WebP.

For a repeatable badge, repeat step 4–6 for each rank variant (`<slug>--bronze` … `<slug>--mithril`); keep the base image boss-less. The rebuild script refreshes `assets/badge-art/` from the working layers by default.

`composite_badges.py` resolves only the `journey` and `habit` families today. For another type, extend the family-to-frame and rank mapping in `resolve_assets()` before running the proof, or composite that family in PhotoCraft. Do not substitute a journey frame for another family.

`composite_badges.py` currently has no transparent production export; its CLI writes the opaque proof. Use PhotoCraft for production. If you add an RGBA export path to the script, export the flatten, add the opaque well, and assert there is no transparent annulus between r 400 and r 440.

## Step 9: Coherence and legibility gate

Run all of these on the composited badge, not on the raw emblem.

1. **3 × 3 set grid.** Run the full proof (no `--only`) and review `coherence-circle-f1v2.jpg` and `legibility-96-circle-f1v2.jpg` with the new badge in place. For a set larger than nine, extend the grid but keep collection members adjacent. The nine-badge grid must still read as one product.
2. **96 px.** The boss is about 6.6 px and reads as a coloured dot. The emblem silhouette, the family cue, and the rank colour must all survive. If the boss disappears into the family metal, reject the composite.
3. **200 px.** The production thumb. The boss is about 13.8 px and the cut becomes visible. Check the cut matches the rank.
4. **48 px.** Optional but cheap: colour only, no cut. If the boss turns into a smudge, the bezel contrast is too low.
5. **Family and palette.** The badge must sit in its family, not look like a metal tier. Habit is a family, not "silver journey".
6. **Density.** Neither a pin in an empty field (~60% empty) nor an edge-to-edge plate. Aim for the middle.
7. **Field treatment.** Matte flat base plus soft top-light gradient. No hard dome, no pastel full-bleed, no spotlight.
8. **Collection grouping.** Journey badges sit together; habit badges sit together. A collection is not a flat grid with everything else.
9. **Gold-on-gold.** The gold boss must separate from the gold journey frame. The dark bezel is the separator; if it vanishes at 96 px, reject.
10. **No rank ring.** Inspect the composite. A concentric metal band outside the family frame is a regression, not a variation.

The current set scores 3/5 on coherence. Do not ship a badge that makes it worse. The failure catalogue and the specific fixes are in `resources/style-reference.md`.

## Step 10: Export 512 and 200

From the 1024 RGBA production master:

```bash
node .github/skills/goal-image-generation/resources/resize-webp.js \
  raw_assets/badges/final/<slug>.webp \
  public/img/achievements/<slug>.webp \
  --max 512 --quality 90 --targetKB 0

node .github/skills/goal-image-generation/resources/resize-webp.js \
  raw_assets/badges/final/<slug>.webp \
  public/img/achievements/<slug>-thumb.webp \
  --max 200 --quality 80 --targetKB 20
```

`--targetKB 0` disables the quality-reduction loop, so the main image stays at quality 90. The thumb steps down from 80 toward 20 KB and stops at quality 20; if it is still over budget, reduce the master rather than the dimensions. Both files keep alpha.

Verify before committing:

| Check | Main | Thumb |
|---|---|---|
| Dimensions | 512 × 512 | 200 × 200 |
| Format | WebP with alpha | WebP with alpha |
| Size | Under ~120 KB | At or under 20 KB |
| Content | No text, no rank ring, no moat | Same |
| Read | 96 px in the grid | 200 px on a dark card |

Also open the 512 on a light background. A transparent 800–880 annulus is invisible on `#14181f` and obvious on white.

## Step 11: Seed and catalog

When the owning change is the one you are implementing, add or confirm the definition row.

- `image_slug` equals `slug`.
- Use `INSERT OR IGNORE`; seeding must be idempotent.
- Metadata keys: `storyline`, `rank` **or** `rank_thresholds`, `collection`, `criteria`. Journey badges also need `threshold_km`, which the award hook reads.
- `criteria` is a stable condition label (`weekend_both_days`, `trailing_7d_km >= 100`). The owning award hook consumes it; SQL and the display resolver do not. Do not invent a query language.
- Repeatable badges may also carry `unit`, the display plural for progress (e.g. `weeks`, `weekends`). It is not baked into art.
- Repeatable badges set `is_repeatable = 1` and four ascending `rank_thresholds`; fixed-rank badges set `rank` 1–4.
- Collection positions are `index` 1..`size`, with `size` matching the collection.

Example metadata for a fixed-rank journey badge:

```json
{
  "storyline": "frodo-sam",
  "rank": 3,
  "threshold_km": 2106.63,
  "collection": {
    "slug": "frodo-sam-journey",
    "label": "The Road to Mordor",
    "index": 6,
    "size": 7
  },
  "criteria": "distance_km >= 2106.63"
}
```

Update, or add if the seed is new, the catalog test that applies the seed twice. It must assert:

- the expected definition count and unique slugs;
- `badge_type` and `storyline` for each row;
- fixed ranks, or the four-value repeatable threshold array;
- collection positions 1..size;
- `image_slug` equals `slug` for every row.

Do not add an award hook in this skill. If the badge is catalog-only, its owning change will add the hook.

## Step 12: Commit and report

Commit only:

- `public/img/achievements/<slug>.webp`, `<slug>-thumb.webp`, and `full/<slug>.webp`; for repeatables, all `<slug>--<rank>` variants, thumbs, and full images;
- `assets/badge-art/` when a frame or boss layer changes;
- `scripts/badge-art/prompts.json`, `scripts/badge-art/final-selections.json`, and any pipeline script change;
- `docs/badge-art-decisions.md` when a pick or asset-layout decision changes;
- the seed migration and catalog test, when the owning change includes them.

`raw_assets/` is gitignored; never force-add it. `assets/badge-art/` is tracked and is the durable source for future achievements. Report the slug, type, rank, frame, boss cut, both candidate picks, the final dimensions and sizes, and the gate results.

## Sub-agent guidance

- **Research** only for motif or lore, and only when you cannot name the object yourself. Ask for three motifs with silhouettes, not a plot summary.
- **Generation and review stay in separate contexts.** The reviewer gets the contact sheet, the two finalists, and the acceptance criteria. It does not get your prompt reasoning or your preferred pick.
- **The review gate is two finalists.** Do not send twelve candidates to the user; the contact sheet exists so the shortlist is informed.
- **Verification is yours.** A sub-agent may run the export checks, but confirm the files, dimensions, alpha, and gate results on disk before reporting.

## Do not

- Do not generate a watercolour scene, landscape, sky, ground, or narrative tableau.
- Do not include characters, faces, hands, or figures.
- Do not include text, letters, numbers, runes, labels, watermarks, or signatures.
- Do not bake a frame or border ring onto an emblem.
- Do not add a rank ring. The rank is a 6 o'clock boss plus the card label.
- Do not use a hexagon badge silhouette for this set. A hexagonal boss cut is allowed.
- Do not write `public/img/achievements/` before sign-off.
- Do not invent award hooks, thresholds, or definition rows for another change's type.
- Do not add a LoRA, change CFG/steps/sampler, or upscale the raw candidate.
- Do not recommend candy green/blue enamel, oversized celestial symbols, or a 4+ colour palette for a dark or sombre beat.
- Do not ship the flattened `#14181f` proof as production art.

## Quick reference

| Item | Value |
|---|---|
| Canvas | 1024 × 1024, centre (512, 512), 4 px margin |
| Emblem | 800 diameter, circular mask, 1 px feather |
| Family frame | 1016 outer / 880 inner, 68 px band |
| Rank device | 6 o'clock boss only; no ring |
| Boss centre | (511, 979) |
| Boss size | 70 px bezel / 54 px disc / 25 px gem |
| Boss read at 96 px | ~6.6 px coloured dot |
| Boss read at 200 px | ~13.8 px; cut visible |
| Production | 512 main / 200 thumb; ≤ ~120 KB / ≤ 20 KB |
