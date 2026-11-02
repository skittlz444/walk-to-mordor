# Achievement Badge Run Sheet

Copy this into the task or work through it in order. Every checkbox is a gate, not a suggestion. Stop at the review gate until the pick is signed off.

---

## 1. Definition and ownership

- [ ] Definition row located; `slug`, `name`, `description`, `badge_type`, `rank` or `rank_thresholds`, `collection`, `criteria`, `storyline` recorded.
- [ ] New badge or replacement confirmed. A replacement keeps the same `slug` and `image_slug`.
- [ ] Type ownership checked:
  - [ ] `journey` / `habit` → `profile-badge-display`.
  - [ ] `community` → fellowship/community feature; catalog-only until its hook exists.
  - [ ] `book` → `storyline-books-*`.
  - [ ] `challenge` → `personal-challenges*`.
  - [ ] `field-guide` → `field-guide-collectible-discovery-*`.
- [ ] No award hook, threshold, or definition row invented for another change's type.
- [ ] Motif sentence written: one object, one silhouette, two or three colours.
- [ ] Story beat named: dark/bleak/tense, warm/home, wonder/elder, habit, or community. The 2026-11-02 user picks are examples of the taste, not compositions to copy.
- [ ] Family frame master exists under `raw_assets/badges/processed/frame/<family>/`.
- [ ] Rank resolved. Fixed rank → that boss. `rank_thresholds` → bake bronze; label carries the live tier.

## 2. Prompt and matrix

- [ ] Two variants added to `scripts/badge-art/prompts.json`: `a` polished enamel, `b` aged engraved metal.
- [ ] `id` is exactly `<group>/<slug>`; `slug`, `name`, `family`, `rank`, `canvas: 1024`, and `target_outer_px` (800 emblem / 1016 frame / 880 rank) present.
- [ ] Prompt is one object, no scene, no person, no text, no frame, no rank ring.
- [ ] Treatment follows the story-beat palette matrix: 2–3 colour families, aged/hard metal on dark beats, no candy green/blue.
- [ ] The recommended variant is chosen for beat fit, not because it is the brightest.
- [ ] Any sun or moon is a secondary accent, not the dominant shape.
- [ ] No `watercolour` / `watercolor` anywhere in the matrix (the generator rejects it).
- [ ] Variants differ in material treatment, not composition.
- [ ] Prompt under about 140 words joined; silhouette readable at 96 px.
- [ ] `python3 scripts/badge-art/generate.py --list` resolves the asset with no validation error.
- [ ] `--dry-run` shows the joined prompt and the expected seed count.

## 3. Candidate pool

- [ ] Emblem: 2 variants × 6 seeds = 12 candidates.
- [ ] Frame or rank master (only when rebuilding): 2 variants × 4 seeds = 8.
- [ ] Model is `flux3-image-klein-int8-convrot`, 1024 × 1024, 16 steps, CFG 1.0, `er_sde` / `simple`, no LoRA.
- [ ] Negative prompt empty; bans are in the suffix.
- [ ] Run completed or resumed; `reports/badge-art/candidates.jsonl` has one line per candidate.
- [ ] Failure rate at or below 10%. If higher, stop and read the log.

## 4. Processing

- [ ] Run with the ComfyUI venv: `process_candidates.py --only <asset>`.
- [ ] Cutout is BiRefNet; fallback `isnet-general-use` noted if used.
- [ ] Emblem: 1024 canvas, longest side 800, circular mask, 1 px feather.
- [ ] Frame: 1024 canvas, longest side 1016, centre cut open at r 440.
- [ ] Rank master (legacy only): short axis 880, centre cut open at r 400.
- [ ] Every layer is 1024 × 1024 RGBA with real coverage.
- [ ] No fully transparent candidate.
- [ ] No frame or ring with a filled centre.
- [ ] `reports/badge-art/processing.jsonl` updated.

## 5. Contact sheet and shortlist

- [ ] `python3 scripts/badge-art/contact_sheets.py --only <asset>` wrote `reports/badge-art/sheets/<asset>.jpg`.
- [ ] Sheet shows every candidate, labelled by variant and seed.
- [ ] Exactly two finalists chosen on: silhouette at 96 px, motif clarity, metalwork quality, family consistency, artifact-free edges.
- [ ] **Story-beat and premium gate** passed for the recommended pick:
  - [ ] Story-beat fit: the material and palette read as the achievement's emotional beat.
  - [ ] Palette cohesion: 2–3 colour families; no candy green/blue, no rainbow coding.
  - [ ] Material credibility: engraving, patina, or hand-chasing is visible; not a flat gloss plate.
  - [ ] Premium vs cheap: the quieter hard-metal option wins ties; bland-but-premium may beat bright-but-cheap.
  - [ ] No oversized sun, moon, or celestial symbol dominating the motif.
  - [ ] 96 px silhouette still reads after the palette is applied.
- [ ] Both have a score and a one-line rationale in `reports/badge-art/shortlist.json`.
- [ ] One is marked `recommended`.
- [ ] `python3 scripts/badge-art/make_report.py --render` completed.
- [ ] `finalists/<slug>--<candidate>.webp` exists for both.
- [ ] Existing `selections.md` preserved; the new row appended by hand if the file already existed.

## 6. Review gate

- [ ] Contact sheet, two finalists at 512 px, recommendation, family, and proposed rank presented.
- [ ] Reviewer sees only the art and the acceptance criteria, not the prompt reasoning.
- [ ] User pick recorded in `docs/badge-art-decisions.md`.
- [ ] No compositing and no `public/` write before sign-off.
- [ ] If the pick is "neither", regenerate or expand seeds; do not promote a third candidate silently.

## 7. Composite

- [ ] Circle only. No hexagon badge silhouette.
- [ ] Stack is emblem 800 → family frame 1016 / 880 → boss at 6 o'clock.
- [ ] No rank ring anywhere in the stack.
- [ ] Emblem centred at `(512, 512)`, visible art reaches about r 400.
- [ ] Frame outer 1016, inner 880, centred; band about 68 px.
- [ ] The 800–880 annulus is opaque (dark well disc at 880). No transparent moat.
- [ ] 1 px dark keyline around the emblem edge.
- [ ] Boss centre `(511, 979)`; bezel 70, disc 54, gem 25.
- [ ] Boss palette and cut match the rank:
  - [ ] Bronze `#b87333` / round / bezel `#24160d`.
  - [ ] Silver `#c9ced6` / octagon / bezel `#1b2026`.
  - [ ] Gold `#e0b23a` / hexagon / bezel `#2b2008`.
  - [ ] Mithril `#7fc9e8` / star / bezel `#12232e` + `#4f9fbd` halo (4 px, alpha 82).
- [ ] Production export is RGBA, not the `#14181f` proof.
- [ ] `composite_badges.py` supports only `journey` and `habit`; another family was mapped or composited in PhotoCraft, not forced into a journey frame.
- [ ] Per-badge PhotoCraft composite checked: 1024 RGBA, base emblem 800, frame 1016 / 880, opaque well at 880, selected boss at `(511, 979)`, clipped shadow at `(511, 981)`, alpha export.

## 8. Coherence and legibility

- [ ] 3 × 3 set grid re-rendered with the new badge in place.
- [ ] Collection members sit together (journey seven, habit two); the grid is not a flat unrelated nine.
- [ ] 96 px: emblem silhouette reads; family cue reads; boss reads as a ~6.6 px coloured dot.
- [ ] 200 px: boss is ~13.8 px; the cut is visible and matches the rank.
- [ ] 48 px: boss is a colour, not a smudge (optional).
- [ ] Family check: the badge belongs to its family, not to a metal tier. Habit does not read as "silver journey".
- [ ] Palette check: dark-fantasy key; no pastel outlier, no saturated cobalt, no neon.
- [ ] Story-beat check: dark beats stay muted; bright enamel appears only where the beat earns it; 2–3 colour families.
- [ ] Material check: engraving, patina, or hand-chasing reads at 512 px; not a flat gloss plate.
- [ ] Density check: mid-density object, not a pin and not a painted plate.
- [ ] Field check: matte flat base plus soft top-light gradient; no hard dome, vignette, or spotlight.
- [ ] Gold-on-gold check: gold boss on the gold journey frame still shows the dark bezel at 96 px.
- [ ] No rank ring: no concentric band outside the family frame.
- [ ] Coherence score did not drop below the current 3/5.

## 9. Export and verify

- [ ] 1024 RGBA production master at `raw_assets/badges/final-complete/<slug>.png`.
- [ ] Main: `public/img/achievements/<slug>.webp`, 512 × 512, `--max 512 --quality 90 --targetKB 0`.
- [ ] Thumb: `public/img/achievements/<slug>-thumb.webp`, 200 × 200, `--max 200 --quality 80 --targetKB 20`.
- [ ] Repeatable: all four `<slug>--<rank>.webp` variants and thumbs exist; the base image stays boss-less.
- [ ] Both are WebP with alpha.
- [ ] Main is under ~120 KB; thumb is at or under 20 KB.
- [ ] No text, no rank ring, no transparent 800–880 moat.
- [ ] 512 opened on a light background as well as a dark one.
- [ ] 96 px grid check repeated on the exported file, not the proof.
- [ ] Filenames match `image_slug` exactly; no numeric-only names.

## 10. Seed and definition

- [ ] `image_slug` equals `slug`.
- [ ] Row uses `INSERT OR IGNORE`; seeding is idempotent.
- [ ] Metadata contains `storyline`, `rank` **or** `rank_thresholds`, `collection`, `criteria`; repeatable badges may add `unit`.
- [ ] Journey badges also contain `threshold_km`.
- [ ] `criteria` is a stable condition label for the owning hook; SQL and the display resolver do not evaluate it.
- [ ] Repeatable: `is_repeatable = 1` and four ascending `rank_thresholds`.
- [ ] Fixed: `rank` is 1–4.
- [ ] Collection `index` is 1..`size`, and `size` matches the collection.
- [ ] Catalog test updated and passing:
  - [ ] expected definition count and unique slugs;
  - [ ] `badge_type` and `storyline` per row;
  - [ ] fixed ranks or the four-value threshold array;
  - [ ] collection positions 1..size;
  - [ ] `image_slug` equals `slug` for every row.
- [ ] Seed applied twice in the test; no duplicates.
- [ ] No award hook added for a catalog-only type.

## 11. Commit and report

- [ ] `public/img/achievements/<slug>.webp` and `<slug>-thumb.webp` staged; repeatable rank variants staged too.
- [ ] `scripts/badge-art/prompts.json` staged if changed.
- [ ] `docs/badge-art-decisions.md` updated when a pick or asset-layout decision changes.
- [ ] Seed migration and catalog test staged when the owning change includes them.
- [ ] `raw_assets/` not staged (gitignored; never force-add).
- [ ] Report includes slug, type, rank, frame, boss cut, both picks, dimensions, sizes, and gate results.

## 12. Stop conditions

Stop and report; do not work around these:

- [ ] ComfyUI unreachable, OOM, or model missing.
- [ ] More than 10% of a generation batch fails.
- [ ] BiRefNet cannot load and the fallback is not accepted.
- [ ] No frame master for the family, and the owning change has not produced one.
- [ ] PhotoCraft is unavailable and the production alpha composite cannot be exported.
- [ ] No selected boss master exists for the rank, and the owning change has not produced one.
- [ ] The review gate has no signed pick.
- [ ] The composite has a transparent moat that cannot be filled opaquely.
- [ ] The 96 px boss disappears into the family metal.
- [ ] The production export path would flatten onto `#14181f`.
- [ ] The badge would require an award hook owned by another change.
