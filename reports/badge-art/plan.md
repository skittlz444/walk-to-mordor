# Badge Artwork — Generation and Review Plan

> **Current state (2026-11-02):** the catalog is now **15 achievements** — 8 journey (including the Glittering Caves return badge), 5 habit, 2 community. This plan's 9-badge / 188-candidate counts describe the first phase; the current review is `finalist-review.md` (15 achievements, 25 assets, 50 finalists).

Scope: OpenSpec tasks **8.1–8.5** only (author prompts, generate candidates, process, shortlist, report, review gate).
No application code, no seed migration, no island/CSS work. Final compositing (8.6–8.8) is deliberately **not** run; it happens only after the user signs off on the two finalists per asset.

## 1. Deliverables

| Deliverable | Path | Committed |
|---|---|---|
| Prompt matrix (19 assets × 2 variants) | `scripts/badge-art/prompts.json` | yes |
| ComfyUI batch generator | `scripts/badge-art/generate.py` | yes |
| Cutout / normalisation tool | `scripts/badge-art/process_candidates.py` | yes |
| Contact-sheet builder | `scripts/badge-art/contact_sheets.py` | yes |
| Run log (one JSON object per candidate) | `reports/badge-art/candidates.jsonl` | yes |
| Per-asset contact sheets | `reports/badge-art/sheets/<asset>.jpg` | yes |
| Review copies of the two finalists | `reports/badge-art/finalists/<slug>--<candidate>.webp` | yes |
| Shortlist report with proposals | `reports/badge-art/shortlist.md` | yes |
| Browseable review gallery | `reports/badge-art/review.html` | yes |
| Selection record template | `reports/badge-art/selections.md` | yes |
| Raw candidates | `raw_assets/badges/candidates/<asset>/` | no (gitignored) |
| Processed cutouts | `raw_assets/badges/processed/<asset>/` | no (gitignored) |
| Shortlist masters | `raw_assets/badges/shortlist/<asset>/` | no (gitignored) |

## 2. Art direction

One visual language for every asset:

> Collectible fantasy profile badge; high-end enamel pin and engraved metal; crisp vector-like shapes; strong readable silhouette; centred composition; rich saturated colour with gold and steel accents; subtle bevel and rim light.

Hard rules:

- **Profile badge, not a scene.** No landscapes, no characters, no faces, no hands, no text, letters, numbers, runes, or watermarks.
- **Centred, symmetrical, single motif.** The subject must read at 96 px.
- **Flat black field** behind the subject so it can be cut out cleanly.
- **No baked frame** on emblems — the frame and rank ring are separate reusable layers.
- **No baked rank or collection number** anywhere. Those are typographic on the card.
- Two prompt variants per asset, deliberately different in material treatment (not composition), e.g. polished enamel vs aged engraved metal. This widens the sample without changing the motif.

### Layer geometry (1024 × 1024 canvas)

| Layer | Outer diameter | Inner diameter | Notes |
|---|---|---|---|
| Base emblem | 800 px | — | circular face, centred |
| Rank ring | 880 px | 800 px | 40 px band, sits on the emblem edge |
| Family frame | 1016 px | 880 px | 68 px band, outermost |
| Canvas margin | 4 px | — | keeps antialiasing inside the canvas |

The final composite stacks emblem → rank ring → family frame. All three are authored at 1024 so PhotoCraft only has to place, never rescale.

## 3. Asset matrix

### Emblems — 9 assets × 2 variants × 6 seeds = 108 images

| # | Slug | Family | Rank | Motif (no characters) |
|---|---|---|---|---|
| 1 | `habit-first-steps` | habit | 1 | Round green hobbit door, brass knob, stone step, warm light in the crack |
| 2 | `journey-frodo-sam-buckleberry-ferry` | journey | 1 | Small wooden ferry with one lantern on stylised dark water, mooring post |
| 3 | `journey-frodo-sam-weathertop-survivor` | journey | 1 | Broken ring of standing stones around a blazing brand, embers |
| 4 | `journey-frodo-sam-through-khazad-dum` | journey | 2 | Arched Doors of Durin, silver tree-and-crown, seven stars, holly branches |
| 5 | `journey-frodo-sam-lothlorien-guest` | journey | 2 | Cluster of golden mallorn leaves on a pale silver branch |
| 6 | `journey-frodo-sam-rauros-parting` | journey | 3 | Cloven silver-bound horn over a crescent of falling water |
| 7 | `journey-frodo-sam-mordor-threshold` | journey | 3 | Black volcanic cone split by a molten fissure, ember ring |
| 8 | `journey-frodo-sam-home-at-sunset` | journey | 4 | Round hobbit door with lit windows and rose trellis, sunset rays |
| 9 | `habit-faithful-walker` | habit | thresholds | Winding path with seven milestone stones and a planted walking staff |

### Family frames — 6 assets × 2 variants × 4 seeds = 48 images

| Asset | Motif |
|---|---|
| `frame-journey` | Braided gold and dark steel band, engraved leaves, weathered notches |
| `frame-habit` | Brushed steel band, seven notches, thin copper inner line |
| `frame-challenge` | Black iron band, molten red cracks, hooked barbs |
| `frame-book` | Embossed dark leather, gold filigree, page corners, brass clasp |
| `frame-community` | Warm bronze interlocking knotwork, clasped-hand motifs |
| `frame-field-guide` | Aged brass, pressed leaves and seed pods, small rivets |

### Rank rings — 4 assets × 2 variants × 4 seeds = 32 images

| Asset | Motif |
|---|---|
| `rank-bronze` | Warm bronze, three evenly spaced studs, softly worn |
| `rank-silver` | Polished silver, four studs, bright edge |
| `rank-gold` | Deep gold, five studs, beaded edge |
| `rank-mithril` | Pale blue-white elven metal, six studs, faint cool glow |

**Total pool: 188 images.**

## 4. Generation configuration

| Setting | Value |
|---|---|
| Model | `flux3-image-klein-int8-convrot.safetensors` (int8; faster than Q4 for t2i and no LoRA) |
| Text encoder | `qwen3vl_4b_int8_convrot.safetensors`, `CLIPLoader` type `flux3` |
| VAE | `flux2-vae.safetensors` |
| Resolution | 1024 × 1024 |
| Steps | 16 |
| CFG | 1.0 |
| Sampler / scheduler | `er_sde` / `simple` |
| Seeds | emblems `[112358, 271828, 314159, 161803, 141421, 173205]`; frames/rings first four |
| Negative prompt | empty (CFG 1.0 makes it inert) |
| Output | `comfyui/output/badges/<asset>/<variant>-<seed>.png` |

At the measured ~35 s/image (warm int8 t2i), the full pool is ≈ 110 minutes. The generator runs one prompt at a time, keeps the model warm, logs each result, and is resumable: an existing output file with a non-zero size is skipped unless `--force`.

## 5. Processing

1. **Cutout** every candidate with `rembg` `birefnet-general` (transparent PNG). Fallback to `isnet-general-use` if the BiRefNet weights cannot be fetched.
2. **Trim** to the alpha bounding box.
3. **Normalise**:
   - emblems → fit longest side to 800 px, centre on 1024 canvas, apply a 800 px circular mask with 1 px feather;
   - family frames → fit longest side to 1016 px, centre, cut the core open at r=440 (880 px opening);
   - rank rings → fit the **short** axis to 880 px so the outer edge always meets the frame opening, centre, cut the core open at r=400 (800 px opening);
   - frames with a decorative clasp may end up with a slightly narrower band than 68 px because the bbox includes the protrusion; 8.6 re-normalises the outer to 1016 px and re-cuts the inner at 880 px before compositing.
4. **Verify** alpha, dimensions, non-empty pixel coverage, and that no candidate is fully transparent.
5. **Contact sheet** per asset: 320 px tiles, 4 columns, label strip with variant and seed, dark neutral background. Emblems = 3 rows; frames/rings = 2 rows.
6. **Shortlist** two per asset on five criteria: silhouette at 96 px, motif clarity, metalwork quality, family consistency, artifact-free edges. Record scores and a one-line rationale.

## 6. Review gate

The report presents, per asset:

- the full contact sheet (all candidates),
- the two finalists at 512 px,
- scores and the recommended pick,
- the family/rank the asset belongs to.

No compositing, no `public/img/achievements/` writes, no migration or UI work until the user records final picks in `selections.md`. After sign-off: build the PhotoCraft smart-object template, composite the nine badges, export 512 px main + 200 px thumb WebP, and verify sizes (8.6–8.8).

## 7. Failure handling

- ComfyUI fails to start or OOMs → stop, report the log tail, do not silently reduce quality.
- A single prompt errors → log it, continue; the run is resumable.
- More than 10 % failures → the generator exits non-zero and reports the count; do not start processing until the failures are understood.
- A frame/ring cutout keeps a filled centre → reject it in the shortlist rather than shipping a broken layer.
- rembg cannot download BiRefNet → fall back to `isnet-general-use` and note it in the report.

## 8. Git boundaries

Commit: `scripts/badge-art/**`, `reports/badge-art/**`.
Do not commit: `raw_assets/**` (already gitignored), ComfyUI output, or any `public/img/achievements/` file (none are produced in this phase).
