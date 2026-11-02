# Badge Art — Six New Finalists and the 15-Achievement Report

**Date:** 2026-11-02

**Reviewer:** DeepSeek V4.1 Flash (independent read-only review)

**Scope:** the six new achievement finalists (`shortlist.json` lines 147–241), the updated 15-achievement / 25-asset report and its sheets, and the six new contact sheets. No production files changed; this review file is the only write.

**File:** `reports/badge-art/art-review-expansion-deepseek.md`

## Verdict

**NEW PICKS: NEEDS CHANGES**

**REPORT: NEEDS FIXES**

| Decision | Verdict |
|---|---|
| Six new picks | **NEEDS CHANGES** — five of six recommended emblems are shippable; **Steady Month** ships a key/scepter where the brief says walking staff, and the **Fellowship Founder** pair's aged alternate is the weakest option in the contact sheet. |
| Updated report | **NEEDS FIXES** — the rank-ring rows are not marked reference-only in the action surfaces, rank/family labels are inconsistent, and the Caves rationale overstates the 96 px read while the Steady rationale calls a key a staff. |

The recommended picks are not blocked by style or quality. The only pick-level blocker is **one semantic mismatch (Steady Month)**; the Founder B finalist is a pair-quality issue, not a reason to change the A pick. The report fixes are copy/label work, not a re-layout.

---

## 1. The six new pairs

| Asset | Pair verdict | Stronger candidate | Specific reason | Action |
|---|---|---|---|---|
| **The Glittering Caves** | **Good pair** | **`a-173205`** | One lit foreground lantern, a dominant crystal tower, still water and a dark cave ceiling; the cleanest cave read. `a-271828` is brighter at 96 px but reads as an elven city, and its large gold pavilion at left-centre looks like a second lantern at thumbnail size even though it is unlit. | Keep `a-173205`; fix the rationale (`shortlist.json:157`) to say "cleaner cave read + cleaner foreground", not "most legible". |
| **Weekend Warrior** | **Good pair** | **`a-141421`** | The polished version keeps the sun, crescent and S-path as three separate gold shapes at 96 px. `b-271828`'s moon disappears into the green-brown sky at 96 px, and the whole badge goes muddy. | Keep `a-141421`. |
| **Steady Month** | **Weak pair** | **`a-271828`** for contrast; **`b-161803`** for key legibility | Both candidates show a **key/scepter**, not the briefed walking staff. At 200 px `a-271828` reads as a cross/scepter; `b-161803` reads as a classic key. At 96 px the 20-stone ring is a beaded border, not 20 days. | Decide the metaphor: accept the key and change the copy, or regenerate. Do not ship "walking staff" copy. |
| **Hundred-K Week** | **Good pair** | **`a-112358`** | The compass is the strongest 96 px silhouette in the habit set; the orbit rings and markers imply a cycle. `b-161803` is busier and lower contrast. The missing spiral costs the "path around a week" idea but the compass still says distance/navigation. | Keep `a-112358`; optional: fix 8 markers vs 7 days. |
| **Fellowship Founder** | **Good pair, weak B** | **`a-141421`** | A is the only solid-blue polished option; it avoids the split red/blue flag read and the flame is visible at 200 px. B (`b-271828`) is a monochrome bronze with a ghosted flame; the contact sheet's `b-173205` (red flame) and `b-141421` (yellow flame on dark bronze) read the flame better at 96 px. | Keep A; grade A's flame; swap B if the aged option matters. |
| **Good Company** | **Good pair** | **`a-112358`** | Deep blue field, red-orange campfire, four standing stones; the fire is the clear focal point at 96 px. `b-271828` is warmer but the stones merge into the bronze field. | Keep `a-112358`. |

### Pair notes

- **Caves:** the pair is not "too similar" in the bad sense — two different compositions of the same scene. The recommendation is right for the cave read and the cleaner foreground, but not for the stated "most legible at 96 px" reason. `a-271828` is the brighter, more legible thumbnail; it loses on cave read and foreground clutter (the gold pavilion reads as a second light at 96 px), not on lantern count. See §2.
- **Weekend:** all 12 candidates are the same sun/moon/two-stones/path composition. There is no more iconic candidate; the choice is material, and `a-141421` is clearly the best polished version. The pair is good.
- **Steady:** the pair is weak because the defect is in the concept, not the render. `a-271828` is the cleaner badge; `b-161803` is the clearer key. Neither is a staff. See §3.
- **Hundred:** the pair is good; the 8-vs-7 marker count is a small factual mismatch, not a pick problem. See §3.
- **Founder:** the A pick is right; the B finalist is the issue. The finalist list should have been `b-173205` or `b-141421`, not `b-271828`. The A's flame is yellow-on-gold and loses contrast at 96 px; Good Company's red-orange fire is the stronger community read.
- **Good Company:** the strongest new community badge at both 96 and 200 px. No change.
- **No pair is "too similar" in the disqualifying sense.** The closest is Founder/Good Company at 96 px: both are blue fields with bronze stones and a flame. The monolith vs four-stones-around-a-campfire composition separates them, and they are meant to be siblings in a two-badge collection. The Caves pair is two compositions of one scene; the difference is cave read and foreground clutter, not subject. The Steady pair is weak for a different reason — both share the key/scepter defect.

---

## 2. The Glittering Caves

### Does it read as the Glittering Caves?

**At 512 and 200 px: yes.** The chosen `a-173205` has the full cave vocabulary: crystal columns rising from still dark water, carved stone terraces, a dark blue-grey cavern ceiling with gold veins, and exactly one warm lantern on a terrace. The single lantern is the Dwarf-hall cue; the water reflections are clean; the thin gold/silver rim is within the prompt's "thin bright metal edge" spec.

**At 96 px: it reads as a pale crystal city, not obviously a cave.** The ceiling and terraces collapse into a dark band and a blue band; the columns become a fine vertical picket. It is the palest and busiest journey badge, and the only one that reads as a cityscape rather than a single object. That is a set-coherence caveat, not a wrong pick: the alternate `a-271828` is brighter and even less cave-like, and the b variants have heavy ornate borders (correctly rejected). A light grade — darken the top vignette, enlarge the lantern slightly — would let the cave read survive 96 px without a re-pick.

### Does it fit the journey set?

**Yes, with one caveat.** It shares the journey palette (blue/silver/gold with Khazad-dûm and the Breaking of the Fellowship) and the gold frame will hold it. But the journey set's strongest badges read as one silhouette — a door, a torch, a horn, a volcano. The Caves reads as an architectural scene, and at 96 px it is the least iconic of the eight. The pale silver field also accidentally matches the mithril rank while Home (rank 4) is bronze; under F1 the boss and label carry rank, so this is not a data problem, but do not let the pale art be read as the rank cue.

### Is rank 4/mithril right?

**Yes, mechanically.** `openspec/changes/profile-badge-display/design.md:104` seeds the Caves at rank 4, 3827.0 km, position 7 of 8; `design.md:109` explains it is the return-journey "Reach Helm's Deep" goal, with Home still 8/8 at 6422.49 km. The seed test asserts the same order and values (`tests/api/achievement-catalog-seed.test.ts:144-156`, `:167`).

The narrative oddity is real but pre-existing: **Mount Doom is rank 3/gold at 2863 km, while the return-leg Caves is rank 4/mithril at 3827 km**. The rank ladder is distance-based, not stakes-based. If that is the intended rule, document it; if rank is meant to signal story importance, Mount Doom should be the mithril badge, not the epilogue. This does not change the art pick.

### Baked border / multi-lantern

- **No baked border in the chosen pair.** `a-173205` and `a-271828` both have a thin rim; the heavy gothic/engraved borders are on the rejected b variants. The chosen rim is a thin gold band with a silver inner line. In the F1 composite it meets the journey frame's gold inner edge and reads as a slightly thicker gold edge; the `composite-review.md:116` 1 px dark keyline is still the right set-wide fix, but this is not a Caves-specific defect.
- **One lit lantern in each finalist; the false second light is the issue.** `a-173205` has one lit lantern at the bottom-right and a clean foreground. `a-271828` also has one lit lantern (centre-right), but its large **unlit gold pavilion/dome** at left-centre reads as a second lantern at 96 px, and the gold foreground is busier. The shortlist's "single warm lantern" is accurate for both; what separates them is the **cleaner foreground**, not the lantern count. The pick is right; the note should say so. `shortlist.json:152`, `:157`.

---

## 3. The habit badges

### Do they read as habits rather than scenes?

- **Weekend Warrior: a scene, not an icon.** Green hills, trees, sky, a path, two stones, sun and moon. The habit idea ("walk on both weekend days") is carried by the name and the steel frame; the emblem itself reads "day/night walk". The two flanking stones are supposed to encode Saturday/Sunday but read as scenery at 96 px. All 12 candidates are the same scene, so no pick fixes this; it is acceptable as a habit-family scene (Faithful Walker is also a scene), not as an iconic habit mark.
- **Steady Month: an object, not a walking habit.** It reads as a green badge with a key/scepter and a beaded stone ring. The key is a coherent "unlock consistency" metaphor, but it is not the briefed walking staff, and the 20 stones do not read as 20 distinct days at 96 px. The steel frame is the only habit cue.
- **Hundred-K Week: an object, and the most iconic.** The compass reads instantly at 96 px; the orbit rings and eight markers imply a cycle. It says "navigation/distance" more than "100 km in seven days", but that is close enough for a habit badge and far stronger than the other two at thumbnail size.

### Is the Steady Month key/scepter a defect?

**Yes — a moderate defect, not a rendering artifact.** The object is unmistakably a key/scepter at 200 px: `a-271828` has an ornate cross/scepter head and a pointed shaft; `b-161803` has a round key bow and a bit. The shortlist itself admits "the central object reads as a key/scepter rather than the intended walking staff in both finalists" (`shortlist.json:193`) while the rationale still calls it an "ornate diagonal staff" (`shortlist.json:184`) and the review motif says "central walking staff" (`finalist-review.md`, Steady Month section). That is a copy/art mismatch.

Two honest options:

1. **Accept the key.** Change the motif and description to "a key to consistency" and keep `a-271828` for contrast. If the key read matters more than polish, `b-161803` is the clearer key at 200 px, but it is darker at 96 px.
2. **Keep the walking brief.** Regenerate; neither finalist passes, and the 20-stone ring should be redrawn so the stones read as a count rather than a border.

Do not ship the current art with "walking staff" copy.

### Is the Hundred-K compass acceptable without the spiral?

**Yes.** The compass is the strongest 96 px read in the habit set and a better badge than a literal spiral would likely be. The spiral's "path around a week" is lost, but the compass + orbit rings + markers still say distance and cycle. The eight markers vs the requested seven days is a minor factual mismatch: invisible at 96 px, but if the design claims seven stones, remove one or state that the markers are decorative. `a-112358` is the right pick; `b-161803` is busier and lower contrast.

### Which two are strongest?

**Hundred-K Week and Weekend Warrior.** Hundred is the clearest at 96 px and the most distinct silhouette; Weekend is the best-balanced scene and has the strongest two-shape read (sun/moon) after Hundred. Steady is the weakest of the three new habit badges because its focal object is the wrong metaphor and its 20-day count is not legible.

### Habit family coherence

The habit family now has three green fields (First Steps, Steady, Weekend) and two path scenes (Weekend, Faithful Walker). The steel frame with seven notches is doing most of the family work. The polished habit emblems have gold rims inside the steel/copper frame, producing a second warm ring at the seam; the `composite-review.md:116` dark keyline or a rim grade would clean that up. First Steps is the only aged/bronze-rimmed habit pick, so the family's emblem rims are four gold + one bronze — acceptable, but not a single material language.

---

## 4. The community badges

### Do they fit the community frame and the "fellowship" idea?

**Yes.** In a 96/256 px F1 approximation, the bronze knotwork frame warms the blue fields and the two badges read as a matched pair. The narrative is good: **Fellowship Founder** is a central standing stone carved with a flame, flanked by two smaller stones — a founding marker. **Good Company** is four stones around a campfire — the gathering that follows. Founder (1/2) → Good Company (2/2) is a before/after collection, not two unrelated badges.

### Are the chosen blue/aged pairs coherent, or do the split fields read as flags?

- **The chosen blue/blue pair is coherent and legible.** Both are solid blue fields with bronze/gold stones and a flame. The blue is cool against the warm bronze frame, but the frame and the stone colour tie them together. At 96 px they read as a pair; at 200 px the Founder's monolith and Good Company's campfire are distinct.
- **The split red/blue candidates would read as flags, and were correctly rejected.** `a-112358` and `a-161803` (Founder) are the flag-risk fields; the chosen `a-141421` is the only solid-blue polished option (`shortlist.json:216`, `:225`). Good Company's `a-112358` is also solid blue. No flag read in the chosen pair.
- **The aged/bronze pair is more frame-cohesive but too dark at 96 px.** `b-271828` on both would be warmer and would match the community frame's bronze, but both become monochrome brown badges at thumbnail size. The blue pair is the right legibility choice.

### Founder-specific issues

- **The flame is low-contrast at 96 px.** It is yellow on a gold/bronze stone; at 200 px the shape reads, at 96 px it is a yellow blob on a gold monolith. Good Company's red-orange fire separates cleanly. Grade the Founder flame to red-orange or add a dark outline; do not change the pick.
- **The B finalist is the wrong aged alternate.** `b-271828` is described as having a "ghosted gold flame" (`shortlist.json:221`) — that is exactly why it loses at 96 px. In the contact sheet, `b-173205` (red flame on dark bronze) and `b-141421` (yellow flame on dark bronze) read the flame better and keep the bronze field. If the aged option is meant to be a real alternative, swap B; if it is only a material sample, say so.
- **Rank/frame collision: Founder is rank 1/bronze on a bronze community frame.** Under F1 the bronze boss is a 54 px disc on a 70 px dark bezel (`composite-review.md:79`) mounted on a bronze knotwork band (`shortlist.json:312`). The dark bezel helps, but bronze-on-bronze is the weakest rank/frame pairing in the set; Good Company rank 2/silver will separate. Test the bronze boss on the community frame at 96/200 px; if the metal merges, darken the bezel or use a deeper bronze.

### Community palette

The chosen blue fields overlap the journey family's blue (Golden Wood, Breaking, Faithful, Caves). The only community cues are the bronze knotwork frame and the standing-stone/campfire motif. It works at 96 px because the frame is visible, but if the four families must separate at a glance, the community family needs a warmer field or a stronger bronze accent. This is a nice-to-have, not a blocker for the two picks.

---

## 5. The updated report: layout, labels, counts

### Counts

**Correct.** 15 emblems + 6 family frames + 4 rank rings = 25 assets; 25 × 2 = 50 finalists. The emblems sheet has 15 cards, the frames sheet 6, the ranks sheet 4, the all sheet 25, and `finalist-review.md:3` and `:10` state the same. The 5 × 5 all sheet fits without clipping; all 25 cards are visible at 140 px. No count error.

### Rank rings are not clearly reference-only everywhere

- **Correct in three places:** the report intro (`finalist-review.md:3`), the ranks sheet footer ("Rank rings are reference only — F1 removes them."), and the HTML rank sections ("Rank ring · Tier 1 · reference only").
- **Wrong in the action surfaces:** the **all sheet** shows the four rank rings with the same gold ★ and no "reference only" caption, and its footer says "Reply with A or B per asset" for all 25. The **selection table** (`finalist-review.md:40-43`) still gives the rank rings a "Pending" selection, and **`selections.md:30-33`** still lists them as pickable with "Pending" and the instruction "Replace each Pending pick with a-… or b-…". A user working from the pick file can select a component that F1 retires.
- **Fix:** add "Reference only — retired under F1; leave Pending" to the all-sheet rank row and to the rank rows in `selections.md` and the selection table, and scope the "Reply with A or B" instruction to the 21 live assets.

### Label inconsistency

The report uses **four naming schemes** for the same ranks:

| Surface | Journey | Habit | Rank rings |
|---|---|---|---|
| Emblems sheet / emblems HTML | `Rank 1` / `Rank 4` | `Gold (representative)` | — |
| Ranks sheet | — | — | `Bronze Rank Ring`, `Silver`, `Gold`, `Mithril` |
| Ranks HTML | — | — | `Tier 1` / `Tier 2` / `Tier 3` / `Tier 4` |
| `prompts.json` | `4` | `"thresholds"` | `1`–`4` |

Fix: use one scheme everywhere — **`Bronze · rank 1`, `Silver · rank 2`, `Gold · rank 3`, `Mithril · rank 4`** — and add a one-line habit legend: "Habit badges are repeatable; the emblem is shown at Gold (rank 3 of 4)." The habit thresholds are `[1,4,12,26]` (Weekend, Hundred) and `[1,3,6,12]` (Steady) per `openspec/changes/achievement-catalog-expansion/design.md:28-30`, so "Gold" is a representative state, not a fixed rank. The current label is not wrong, just unexplained.

### Family labels

The emblem cards show rank but not **family**; the selection table encodes it only in the slug (`journey-`, `habit-`, `community-`). For a review whose main job is set coherence, add `Family · Rank` to each emblem card/row, or group the sheet by family. The current emblems sheet is ordered by when the asset was added: the Caves (journey) starts the new block in row 4, the row above ends with Faithful Walker (habit), and the habits are split across rows 4–5. The 5 × 5 all sheet also interleaves families. This does not break the pick UI, but it makes the set-coherence read harder than it needs to be.

### Caves rationale

Two rationale problems:

- `shortlist.json:152` calls `a-271828` a "single warm lantern" — that is technically true (one lit lantern), but the large **unlit gold pavilion** at left-centre reads as a second lantern at 96 px, so the note overstates the clean single-light read. Say "one lantern, busier foreground with a gold pavilion that can read as a second light".
- `shortlist.json:157` calls `a-173205` the "cleanest and most legible … at 96 px" — it is the cleanest **cave** read with the cleaner foreground; `a-271828` is brighter and arguably more legible at 96 px. The recommendation is right; the reason should be "best cave read + cleaner foreground", not "most legible".

### Steady rationale

`shortlist.json:184` says "ornate diagonal staff"; the art is a key/scepter, and `shortlist.json:193` admits it. The source prompt still says "central walking staff" (`scripts/badge-art/prompts.json:260`). Fix the copy or the art; do not leave the contradiction.

### Caves A/B label

Both Caves finalists are `a-` variants. Every other card's A/B maps to polished/aged, so on the Caves card "B" means "second polished candidate", not "aged variant". The candidate IDs make it decodable, but label the card "both polished" or use "Finalist 1 / Finalist 2" to avoid a wrong mental model.

### Frame/rank grouping in the 5 × 5

The all sheet's 5 × 5 works, but the six frames split 5 + 1 across rows 4–5: the Field Guide Frame sits at the start of the rank row and, at 140 px, looks like a rank ring. The labels distinguish them, but a divider or a 3 × 2 frame block would make the frame/rank boundary explicit. This is a nice-to-fix, not a count error.

### Collection positions

The report shows rank but not collection position. The Caves is `frodo-sam-journey` 7/8 and Home 8/8 (`openspec/changes/profile-badge-display/design.md:104`); Founder/Good Company are `The Fellowship` 1/2–2/2 (`openspec/changes/achievement-catalog-expansion/design.md:72`). Those positions are not in the art report, so the 7/8 reorder cannot be verified from the report alone. Add a Collection column or a caption.

---

## 6. Must / Should / Nice

### Must

1. **Resolve Steady Month.** Either accept the key and change the motif/description to "a key to consistency", or regenerate with a staff and a readable 20-stone count. Do not ship "walking staff" copy with a key. `shortlist.json:184`, `:193`.
2. **Fix the Caves rationale.** `a-173205` is the cleaner cave read with the cleaner foreground; `a-271828` has one lit lantern too, but its unlit gold pavilion reads as a second light at 96 px. The pick is right; the "most legible" claim is not. `shortlist.json:152`, `:157`, `:161`.
3. **Make the rank rings reference-only in the action surfaces.** Add the caption to the all sheet, mark the rank rows in the selection table and `selections.md` as reference-only, and scope the A/B instruction to the 21 live assets. `finalist-review-all.jpg`; `finalist-review.md:40-43`; `selections.md:30-33`.

### Should

4. **Founder: grade the flame for 96 px** (red-orange or a dark outline), and **replace B `b-271828` with `b-173205` or `b-141421`** if the aged option is meant to be a real alternate. `shortlist.json:221`; Founder contact sheet.
5. **Unify rank labels and add a habit legend.** Use `Bronze/Silver/Gold/Mithril · rank N` everywhere; explain `Gold (representative)` as habit rank 3 of 4. `finalist-review-emblems.jpg`; `finalist-review.html`; `finalist-review-ranks.jpg`.
6. **Test the bronze boss on the bronze community frame** at 96/200 px; darken the bezel or the boss if it merges. `composite-review.md:79`; `shortlist.json:312`.
7. **Add the 1 px dark keyline at the emblem/frame seam.** The Caves' gold rim and the polished habit rims currently merge with the frame's inner edge. `composite-review.md:116`.
8. **Add family labels to the emblem cards/rows** (`Journey · Rank 4`, `Habit · Thresholds`, `Community · Rank 1/2`) so the 15-achievement sheet can be read as a set, not an addition log.

### Nice

9. **Caves 96 px grade:** darken the top vignette and enlarge the lantern slightly; keep `a-173205`.
10. **Hundred-K markers:** remove one marker or state that the eight markers are decorative, not seven days.
11. **Separate the Field Guide Frame from the rank row** in the 5 × 5; a divider or a 3 × 2 frame block.
12. **Document rank = distance tier, not story stakes**, so the Caves rank 4/mithril above Mount Doom rank 3/gold is not read as a narrative error.

**Not checked:** runtime app rendering, database seed values beyond the design/test documents, on-device colour management at 96 px, and the final 1016/880 F1 composite with the rank boss. The 96/200 px strips and the 96/256 px F1 approximation used here were built in scratch space only.
