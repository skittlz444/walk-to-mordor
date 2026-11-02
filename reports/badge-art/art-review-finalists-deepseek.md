# Finalist Review + F1 v2 Rank Boss — Art Direction Review

**Date:** 2026-11-02
**Scope:** `finalist-review-*.jpg`, `finalist-review.html`, and `rank-boss-v2.jpg`, judged at 512 px and 96 px. Read-only review; no production art changed.

## Verdict

**REPORT: NEEDS PICKS**
**BOSS V2: FIXED**

The pick UI is clear and the boss solves the silver/mithril collision. But the report stars A on 19/19 assets, and two of those stars contradict the F1 coherence must-fix. It also never shows a candidate inside the final frame + boss stack, so the user is picking bare emblems, not the object that ships.

## 1. Finalist report usability — 3/5

**Works:** the 2-up at 220/512 px, the A/B lettering, the score beside each candidate, the gold border + star, and the selections table. The nine emblems are genuinely choosable at a glance on `finalist-review-emblems.jpg`; the recommended chip is unambiguous and the labels do not truncate. The 140 px all-sheet is a good overview for emblems.

**Fails or misleads:**

1. **The A/B axis is a material choice, not 19 independent judgments.** Every recommendation in `shortlist.json` is an `a-*` (polished enamel / polished frame); every B is aged metal. 19/19 A is a set-direction preference. A user who picks B for Home and A everywhere else gets the only aged emblem in a polished set. The lede (`finalist-review.html:155`) and the summary table never say this; the report should lead with "A = polished set, B = aged alternative; pick a direction first."
2. **Two stars contradict the approved F1 fixes.** `shortlist.json:126` stars Home `a-112358`, while `composite-review.md:101` says swap to `b-161803`. `shortlist.json:15` stars First Steps `a-112358`, while the same must-fix says `b-141421`. The user can lock in the pink Home badge the composite review already rejected.
3. **No in-stack view.** The candidates are bare discs. Under F1 the final object is emblem + family frame + 6 o'clock boss; the frame opening, rim contrast, and boss overlap change the read. `finalist-review.html:157` links the category sheets but not `coherence-circle-f1v2.jpg`, and no candidate is shown in-frame. The only stack is the nine-badge composite of recommended picks.
4. **`Gold (representative)` is unexplained and inconsistent.** The emblem sheet / HTML say "Gold (representative)" (`finalist-review.html`, Faithful Walker), the composite says "Gold", and `prompts.json:194` says `"thresholds"`. Three answers for one rank. If the habit family is not on the bronze→mithril ladder, the gold boss on Faithful Walker is unjustified.
5. **Rank rings are offered as picks although F1 removes them.** The report presents 19 assets including four rank rings with "Recommended A"; under F1 the ring is not part of the final badge. Either label the section "comparison only — no effect on the final badge" or remove it from the pick flow.
6. **Frames at 140 px are too similar.** Book, Community, and Field Guide look nearly identical on the all-sheet. They are distinguishable at 512, but the glance test fails; frame rows need 220 px.
7. **Scores read as cross-asset.** The numbers are within-pair only. A 4.0 Home B is a better set citizen than a 4.5 Khazad A, yet the sheet implies the opposite. Label them "within-pair" or replace them with a one-line trade-off.
8. **Mobile stacks A/B vertically** (`@media(max-width:760px)`), so comparison requires scrolling. A 2-up at 50% width would preserve the glance.

**Pair sizing and chip: clear.** The gold card border plus the star is enough; the score is legible; the reasons are short. The usability problem is not presentation, it is that the presentation hides a set-level decision.

## 2. Pair quality

### Emblems

| Asset | Verdict | Note |
|---|---|---|
| **First Steps** | **weak pair** | A is the better badge at 96 — big door, clear step, strong green. B is the tone fix but is darker and less legible at 96, and it would be the only aged emblem. The star (A) is right for legibility and wrong against `composite-review.md:101`; resolve the set direction before picking, do not just flip the star. |
| **Across the Buckleberry Ferry** | **good pair** | A is the clear pick: green field + lantern reads at 96; B is a clean aged alternative but lower contrast. No change. |
| **Survivor of Weathertop** | **good pair** | A has the strongest flame silhouette and the blue field separates the torch; B is a good aged alternative. No change. |
| **Through Khazad-dûm** | **weak pair** | A reads at 96 but turns the door into a red/blue stained-glass window; the white tracery is the tree only at 512, and it is the only primary red/blue glass field in the set. B is the literal tree-and-crown doorway but is muddy at 96. The 4.5 vs 3.5 gap is not credible. A for the 96 read, B for motif accuracy — no clean winner. |
| **Guest of the Golden Wood** | **good pair** | A's navy field and gold leaves are the cleanest 96 read; B's aged branch is richer at 512 but lower contrast. A correct. |
| **The Breaking of the Fellowship** | **good pair** | A for the polished set; B's larger horns actually tell the cloven-horn story better, but the bronze field loses the water crescent at 96. The 4.0/4.0 tie is honest; the recommendation is defensible, not obvious. |
| **Standing at Mount Doom** | **good pair** | A is strongly correct: red sky + black cone + fissure is the achievement's identity. B is a good aged alternate but reads as a brown mountain at 96. |
| **Home Again at Sunset** | **wrong recommendation** | A is the only magenta/pink pastel field in the set and the strongest coherence break at 96. B is the better set citizen: clearer door, stone path, warmer bronze, no pastel gradient. `shortlist.json:126` contradicts `composite-review.md:101`; the star is on the wrong badge. Caveat: B is aged metal, so it fixes palette while adding the only aged emblem — see §4. |
| **Faithful Walker** | **good pair** | A is correct for 96; B's path is mud at thumbnail. But A is the most saturated cobalt in the set and needs the 15% desaturation + common field from `composite-review.md:108`. The report should say "A + grade", not just "A". |

### Family frames

| Asset | Verdict | Note |
|---|---|---|
| **Journey** | **good pair** | A is correct: the dark steel braid separates it from the gold emblems and the gold boss. B is almost all gold and would merge with gold ranks. |
| **Habit** | **good pair** | A is correct; B loses the copper inner line, the only family cue. But A's notches/copper still vanish at 96, so the frame reads as a silver rank tier while the boss says Bronze/Gold. Pair is fine; the frame needs the `composite-review.md:106` edit. |
| **Challenge** | **good pair** | A is correct: black iron + red cracks + gold barbs. B drifts gold and reads journey-adjacent. |
| **Book** | **good pair at 512** | A is the safer component: even band, clean clasp. B's wider leather band and 3/9 tabs are a real difference but shrink the opening and crowd the emblem. At 140 they look too similar; show at 220+. |
| **Community** | **good pair at 512** | A is correct. B is a darker, wider patina variant only; the weakest frame pair, but not a wrong pick. At 140 it is indistinguishable. |
| **Field Guide** | **good pair** | A is correct: thinner band, crisper leaf stamps, more opening. B's wider brass band would crowd the emblem at 96. |

**Rank rings (out of final scope):** do not treat these as a live pick. The B silver is warm/gunmetal and the B mithril has a gold rim — the exact silver/mithril confusion v2 just fixed. If the sheet stays, label it "archive / comparison only."

## 3. Rank boss v2

**Silver vs mithril: fixed.** At 96 the silver boss is neutral white-chrome and the mithril star is clearly cyan-blue; at 48 the hue difference survives (white dot vs cyan dot) even though the cut is gone. At the 200 crop they are unmistakable. Silver is neutral enough — it is the whitest boss, with no warm cast. Mithril is blue enough — cyan star, teal halo, no gold contamination.

**The 200 test is not a 200 px badge.** The sheet's header says "200 px boss crop"; that is a ~14x magnification of the boss art, not the production thumb. At a true 200 px badge the boss is about 14 px, so the cut will read less sharply than this row suggests. Add a 200 px badge row (and keep the crop as detail). The 96/48 rows are the real thumb tests; both pass the colour test.

**The cut is redundancy, not an axis.** Round/octagon/hexagon/star is tied 1:1 to rank, so it repeats colour rather than adding a second data dimension. It is readable at the 200 crop, marginal at 96, gone at 48. The side counts (0, 8, 6, 4) are not ordinal, and the four-point star is a different object class — a sparkle/compass, not a cabochon cut. It is useful for colour-blind users at 200, not for the 96 read. If the product wants an ordinal second axis, use 3/4/5/6-sided cuts or a stud count; otherwise call it a distinctness cue.

**Halo: not neon; slightly oversized at the crop.** At 96 it is a 1–2 px cyan bloom and reads correctly. At the 200 crop it is a broad teal field that tints the gold frame and makes the mithril boss visibly larger than the others (roughly 1.2x). Clip the halo to the bezel and pull the star points in 10–15%; keep the glow.

**Sitting on the frame:** at 96/48 it reads as a mounted stud at 6 o'clock, which is what F1 needs. At the 200 crop the dark bezel is a flat disc with no seat or shadow, so it reads applied rather than set; bronze is the only one whose outer disc domes. Add a 1 px inner shadow/seat and decide whether this is a jewel (shrink the bezel below band width, dome all four) or a stud (keep it, call it a stud). The gold-on-gold case is the weak one: on the journey frame at 96, the yellow hexagon nearly merges with the laurel (Mordor, Breaking); deepen it to amber and widen the dark bezel. Bronze, silver, and mithril read cleanly; gold is the weak case.

## 4. Set coherence

**Outliers at 96, in order:**

1. **Home Again at Sunset A** — magenta/pink pastel, the only full pastel gradient. It is the one badge that looks like a different product. B fixes the palette and the door read; A does not.
2. **Faithful Walker A** — cobalt + flat gold path, the most mobile-game read. It needs the 15% desaturation (`composite-review.md:108`), not a swap; B is too muddy at 96.
3. **First Steps A** — bright green/brown porch, the only full porch surround and one of the brightest fields. At 96 the porch arch reads as a second frame inside the badge. B is on-tone but costs legibility.
4. **Through Khazad-dûm A** — grey stone + red/blue stained glass, the only grey field and the only primary red/blue glass. It is legible, but it reads as a window rather than a door. B is on-motif but flat at 96.

Buckleberry, Weathertop, Golden Wood, Breaking, and Mordor cohere; Mordor's red is dark enough to read as the fire badge, not an outlier.

**System-level breaks:**

- **The habit frame is a second metal tier.** At 96 the seven notches and copper line vanish, so First Steps and Faithful Walker read as silver-framed while their bosses are bronze and gold. F1 adds a second metal instead of resolving the first. Strengthen the copper line/notch caps (`composite-review.md:106`) or change the habit family metal before the final composite. This is the biggest system issue after Home.
- **The material axis is unresolved.** All 19 recommendations are A (polished). The two must-fix swaps are B (aged). Applying both would make Home and First Steps the only aged emblems in a polished set — a new coherence break in exchange for the old one. Decide first: all-polished (then grade Home/First Steps/Walker) or all-aged (then swap the set, not two badges). The current report hides this choice.
- **Gold boss on gold journey frame** — Mordor and Breaking nearly merge at 96. Deepen the gold/amber and widen the bezel. This is a small but real rank-read failure on two of nine.
- **Mithril halo tints the gold frame at 200** — minor; clip to the bezel.

**Swaps that would improve coherence:**

- **Home A → B:** yes, the clearest single improvement — but only if the set accepts one aged badge, or if B is re-rendered polished. A grade of A is the cleaner all-polished fix.
- **First Steps A → B:** only if the whole set goes aged. In an all-polished set, B is the odd matte bronze and is weaker at 96; re-grade A instead.
- **Khazad A → B:** no. It would add a second aged badge and lose 96 legibility. Keep A, or commission a polished re-render of B's tree-and-crown.
- **Faithful Walker A → B:** no. B is the weakest 96 read in the set; grade A.

## 5. Verdict and fixes

**REPORT: NEEDS PICKS.** The document is presentable, but the recommendations are not aligned with the F1 coherence decisions and the material axis is hidden. Do not send it to the user until the stars and the framing are reconciled. No new generation is strictly required, though Khazad B is the one candidate worth a polished re-render.

### Must

1. **Re-star Home to B, or commit to a grade of A.** A is the pink outlier; the star currently contradicts `composite-review.md:101`.
2. **Reconcile First Steps.** Either keep A and revise the must-fix to "grade A" (my preference: A is the better 96 badge and B breaks the polished set), or star B and accept the 96/legibility hit. Do not ship the contradiction.
3. **State the material axis at the top.** "A = polished set, B = aged alternative; choose a direction, not 19 unrelated picks." Add a "set direction" choice or a "pick all A" control. The 19/19 A pattern is a style preference, not 19 wins.
4. **Show the F1 stack.** Add an in-frame thumbnail (family frame + boss) for each candidate, or at minimum for the recommended set and the contested Home/First Steps pairs, at 512 and 96. Link `coherence-circle-f1v2.jpg` from the report.
5. **Fix the gold boss on the journey frame** (Mordor, Breaking): deepen to amber, widen the dark bezel. Add a true 200 px badge row; the current 200 row is a boss crop.
6. **Resolve `Gold (representative)` / `thresholds`.** Decide whether habit badges carry the bronze→mithril ladder; if not, remove the gold boss from Faithful Walker and relabel the card.
7. **Label the rank-ring section "not used under F1 — comparison only"** or remove it from the pick flow.

### Should

- Strengthen the habit frame's copper line/notch caps so it is not read as a silver rank tier (`composite-review.md:106`).
- Desaturate Faithful Walker ~15% and apply the common field (`composite-review.md:108`); say so on the pick card.
- Clip the mithril halo to the bezel and shrink the star points 10–15%; keep the 96 glow.
- Use rank names (Bronze/Silver/Gold/Mithril) on the emblem sheet instead of "Rank 1/2/3/4"; match the composite labels.
- Show frame pairs at 220 px on the all-sheet; 140 is too small for Book/Community/Field Guide.
- Label scores "within-pair only" or replace them with a trade-off line ("cleaner at 96" vs "better aged metal").

### Nice

- One polished re-render of Khazad B to test the tree-and-crown motif without the aged field.
- A mobile 2-up at 50% width instead of stacking A/B vertically.
- A "pick all A" / "set direction" shortcut in the selections section.
