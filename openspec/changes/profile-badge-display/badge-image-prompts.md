# Badge Image Prompts — profile-badge-display

> Companion to `plan.md` in this folder. Nine badge images for the initial achievement catalog. Generated 2026-10-08. Follows the `Goal-Image-Generation` skill workflow (`.github/skills/goal-image-generation/`).

## Workflow

1. **Generate** each prompt at 1024×1024 (current generator limit).
2. **Pass reference images** for style adherence (max 3) — actual files are `.webp` (skill doc says `.jpg`; stale):
   - `public/img/highres/2.webp` — warm golden light, stone bridge, soft reflections
   - `public/img/highres/30.webp` — elven ruins, misty atmosphere, small figures for scale
   - `public/img/highres/28.webp` — rider in forest, dappled light, green/gold harmony
3. **Save raws** to `raw_assets/badges/` (gitignored — never commit source images).
4. **Optimize** into `public/img/achievements/` (directory already created):
   ```bash
   # Main badge image (512px, no size target — do NOT omit --targetKB 0)
   node .github/skills/goal-image-generation/resources/resize-webp.js \
     raw_assets/badges/<slug>.png \
     public/img/achievements/<slug>.webp \
     --max 512 --quality 80 --targetKB 0

   # Thumbnail (200px, <20KB)
   node .github/skills/goal-image-generation/resources/resize-webp.js \
     public/img/achievements/<slug>.webp \
     public/img/achievements/<slug>-thumb.webp \
     --max 200 --targetKB 20 --quality 60
   ```
   > **Gotcha:** the script's default `--targetKB` is 20 and it degrades quality until the target is met. Always pass `--targetKB 0` for the main image.
5. **Verify**: main image roughly 30–120 KB at 512px; thumb <20 KB; visual style matches references.
6. **Wire up**: seed migration uses `image_slug = <slug>` (see plan.md task group 5); the island loads `/img/achievements/<slug>.webp` and hides broken images gracefully.

**Standard style prefix / suffix** (every prompt below already includes them):

- Prefix: `Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe —`
- Suffix: `High detail, museum quality, square format, no text, no watermarks, no borders.`

---

## The Nine Prompts

### 1. `first-steps` — First Steps from Bag End (habit, first logged distance)

> Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe — a round green hobbit door set into a grassy hillside at first light, a garden path winding down toward rolling Shire hills, dew on the grass, warm morning mist lying in the valley below. Idyllic pastoral mood, a journey beginning; warm golden sunlight, soft greens, gentle atmospheric glow, hope and quiet resolve. A single small hooded walker with a walking stick and laden pack pauses on the threshold, the door left ajar behind him — simple silhouette, no portrait detail, small figure in the landscape for scale. High detail, museum quality, square format, no text, no watermarks, no borders.

### 2. `buckleberry-ferry` — Across the Buckleberry Ferry (≥ 112.65 km / 70 mi)

> Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe — a small wooden flat-boat ferry crossing a slow dark river at dusk, a timber landing stage on the near bank behind it, reeds and willows along the far shore, mist rising from the Brandywine. Tense escape at nightfall; cool twilight blues and greens with one warm lantern accent, misty bleeding edges, quiet dread. Four small hobbit figures huddle in the boat around a lantern, while a lone cloaked rider stands silhouetted on the landing stage they have just left — shapeless hooded silhouette for the pursuer, no facial detail. High detail, museum quality, square format, no text, no watermarks, no borders.

### 3. `weathertop-survivor` — Survivor of Weathertop (≥ 387.85 km / 241 mi)

> Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe — the ruined summit of Amon Sûl, a broken ring of ancient stone on a bare, windy hilltop beneath a bruised purple-black sky. Cold dread and sudden violence; deep blue-greys and umber with a hot orange firelight accent, dramatic shadows, lost edges in the darkness. Five tall hooded riders close in as pale shapes with faint gleaming eyes while a small figure raises a flaming brand to drive them back, sparks scattering on the wind, tiny companions huddled by a dying fire — figures as small silhouettes in the landscape, no faces. High detail, museum quality, square format, no text, no watermarks, no borders.

### 4. `through-khazad-dum` — Through Khazad-dûm (≥ 1284.25 km / 798 mi)

> Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe — a sheer dark cliff beside a still black lake, the Doors of Durin revealed in silver moonlight: an arched elven doorway of interlacing lines flanked by two great holly trees. Ancient wonder and lurking menace; cold blue-greys and blacks, pale silver and a weak warm staff-glow, mist over the lake, vast oppressive rock walls. A small company of nine travellers gathers at the threshold, one figure raising a staff whose faint golden light traces the silver lines, slow ripples spreading in the dark water behind them — small silhouettes, no faces. High detail, museum quality, square format, no text, no watermarks, no borders.

### 5. `lothlorien-guest` — Guest of the Golden Wood (≥ 1375.98 km / 855 mi)

> Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe — the eaves of the Golden Wood, immense mallorn trees with smooth silver-grey trunks rising into a canopy of pale gold leaves, a narrow path leading beneath the branches, the Silverlode glinting behind. Otherworldly serenity and healing; gold, silver and pale-green palette, dreamlike haze, ethereal atmospheric glow, gentle depth. A small company of eight travellers steps under the trees as their weariness begins to lift, golden light falling in soft shafts — small figures in the landscape for scale, simple silhouettes, no portrait detail. High detail, museum quality, square format, no text, no watermarks, no borders.

### 6. `rauros-parting` — The Breaking of the Fellowship (≥ 2106.63 km / 1309 mi)

> Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe — the green lawn of Parth Galen above the roaring falls of Rauros at grey dawn, mist rising from the great falls, spray drifting in the cold air. Sorrow, loss and grim resolve; muted blue-greys with the first pale light of morning, soft bleeding edges, melancholic atmosphere. A small elven boat carrying two tiny figures slips across the wide river toward the eastern shore, while three small figures are left standing on the lawn among scattered gear and a cloven horn — silhouettes only, no faces. High detail, museum quality, square format, no text, no watermarks, no borders.

### 7. `mordor-threshold` — Standing at Mount Doom (≥ 2863.01 km / 1779 mi)

> Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe — the barren volcanic slopes of Orodruin beneath a sky of ash and smoke, the Crack of Doom glowing with sullen red light at the summit above. Cataclysmic ruin and a burden lifted; oppressive blacks and greys with fiery reds and oranges, ember glow, vast scale. Two tiny exhausted figures lie collapsed on the black rock as the mountain begins to convulse, rivers of fire breaking through fissures, the silhouette of the Dark Tower crumbling in the far distance beyond the ash plain — figures as small silhouettes against the firelight, no faces. High detail, museum quality, square format, no text, no watermarks, no borders.

### 8. `home-at-sunset` — Home Again at Sunset (≥ 6422.49 km / 3991 mi)

> Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe — the Hill of Hobbiton at evening, the round windows of Bag End aglow with warm welcome light, roses on the trellis and tilled earth in long golden shadows, smoke rising gently from the chimney, the Shire's rolling hills fading into soft dusk behind. Bittersweet peace and homecoming; warm golds and soft greens with a tender melancholy, gentle atmospheric glow, quiet comfort. One small weary traveller with a pack climbs the garden path toward the lit doorway — silhouette only, no face. High detail, museum quality, square format, no text, no watermarks, no borders.

### 9. `faithful-walker` — Faithful Walker (repeatable, 7 logged days in a 7-day window)

> Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe — a well-worn country footpath winding through rolling green hills, seven small milestone stones set at intervals along the way, distant misty hills and hedgerows. Quiet endurance and steady habit; fresh greens, earth browns and slate blues, balanced warm and cool, soft diffused light, a peaceful rhythm. The sky above shifts from pale dawn on one side to soft dusk on the other as a single small hooded walker strides steadily with a staff — small figure in the landscape for scale, simple silhouette, no portrait detail. High detail, museum quality, square format, no text, no watermarks, no borders.

---

## Character & Scene Validation (per skill Step 5 checklist)

Each prompt was checked against the in-repo goal descriptions (latest `*_update_goal_descriptions_*.sql` for that distance) and the skill's character-location quick reference:

| Badge | Characters depicted | Source check |
|---|---|---|
| first-steps | 1 generic walker | Habit badge — deliberately generic (the user themself); no named characters to misrepresent |
| buckleberry-ferry | 4 hobbits (Frodo, Sam, Merry, Pippin) + 1 Black Rider silhouette | Goal description: hobbits cross, rider reaches the landing stage they left |
| weathertop-survivor | 5 Nazgûl + 1 figure with flaming brand (Strider) + 4 huddled hobbits | Goal description: five figures close in, Strider leaps with flaming brands; Fellowship (9) intact at 241 mi, Gandalf alive |
| through-khazad-dum | 9 travellers incl. staff-bearer (Gandalf) | Pre-842 mi → full Company; description: Gandalf reveals the doors, ripples = Watcher hint |
| lothlorien-guest | 8 travellers | Post-842 mi → Gandalf fallen; description: "remaining members of the Company" |
| rauros-parting | 2 in boat (Frodo, Sam) + 3 on shore (Aragorn, Legolas, Gimli) + cloven horn (Boromir) | Goal description: Frodo and Sam escape east, companions scattered or fallen |
| mordor-threshold | 2 collapsed figures (Frodo, Sam) | Goal description: Frodo claims the Ring, Gollum falls, mountain convulses |
| home-at-sunset | 1 traveller (Sam) | Goal description: Sam climbs the Hill to Bag End at evening |
| faithful-walker | 1 generic walker | Habit badge — no story-specific characters |

Anachronisms: none — all scenes are landscape/structure + silhouette figures, no modern elements, no text.
