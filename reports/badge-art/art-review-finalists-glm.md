# Finalist Report Review — GLM (independent art director)

**Date:** 2026-11-02 · Reviewed at 512 px (pair montages), 220 px sheets, 140 px all-sheet, 96/48 px zoom crops and sampled pixel hues. Files inspected: `finalist-review-all/emblems/frames/ranks.jpg`, `rank-boss-v2.jpg`, `coherence-circle-f1v2.jpg`, `legibility-96-circle-f1v2.jpg`, `finalist-review.html/.md`, `shortlist.json`, `prompts.json`, `composite-review.md`.

## Verdict lines

```
REPORT: NEEDS PICKS
BOSS V2: FIXED
```

## 1. Finalist report usability — 3/5

Mechanically strong: named pairs at 220 px per category sheet, a 140 px 4×5 glance sheet, scores + rationales + a clear ★-chip per pair, A/B answer format, and all 38 finalists exist (`reports/badge-art/finalists/`). It fails as a briefing in three ways:

1. **The rank rings are retired, but the report doesn't say so.** Under F1 the four rank rings are not final art, yet they appear as 4 of 19 pickable rows ("Reply with A or B per asset"). Nothing in the HTML or md tells the user their 4 picks are throwaway. Gate them ("reference only — no pick required") or the user spends a quarter of the decision on retired assets.
2. **Three recommendations contradict the standing coherence decisions.** `composite-review.md` musts #3 require Home at Sunset → `b-161803` and First Steps → `b-141421`; the report still marks both ★A, and `coherence-circle-f1v2.jpg` (titled "9 recommended badges") still composites the A picks. A user who honours the ★ locks the coherence wound open. My 512 px look agrees the B picks are the set-correct ones.
3. **19/19 recommendations are A.** With Home, First Steps and (below) Challenge Frame provably wrong, the uniform A bias reads as an anchored shortlist score, not an independent judgement. Fix the three wrong recs and add one line explaining the a/b slot convention (a = polished, b = aged) — the sheet never states it.

Pair sizing, labels, scores, the "Gold (representative)" tag on Faithful Walker and the md table are all clear. No pair is unreadably presented.

## 2. Pair quality

Emblems (9):

| Asset | Call |
|---|---|
| First Steps | **wrong recommendation** — `b-141421` is the set pick (cohort must; A's candy-green + bright portico is the flagged palette outlier, coherence sheet confirms). Standalone, A is prettier — say so, but recommend B. |
| Across the Buckleberry Ferry | **good pair**, rec A correct (B=`b-141421` is cleanest aged but low-contrast). |
| Survivor of Weathertop | **good pair**, rec A correct. |
| Through Khazad-dûm | **good pair** (strong polish-aged bracket). Rec A defensible; B's 3.5 is harsh — `b-112358`'s silver-on-sage tree holds fine — and A's red/blue glass is the loudest face of the set. |
| Guest of the Golden Wood | **good pair**, rec A correct. |
| The Breaking of the Fellowship | **good pair, indecisive rec** — 4.0/4.0 tie with no decisive reason stated. A is cleaner on tile at 96 (B's patina blotches read as noise); state that and keep A. |
| Standing at Mount Doom | **good pair**, rec A correct (B=`b-314159`'s dotted ember band is stamp-like). |
| Home Again at Sunset | **wrong recommendation** — `b-161803` is the set pick (cohort must; A's magenta/pink pastel is the worst outlier in the coherence sheet). |
| Faithful Walker | **good pair**, rec A correct, with the planned ~15 % desat (cohort should #7) attached as an explicit post-pick scope note. |

Frames (6, brief):

- **Journey** — good pair, rec A.
- **Habit** — good pair, rec A (B's patina buries the copper inner line the family cue needs).
- **Challenge** — **wrong recommendation.** `a-112358` is a hairline silver-black band with thread cracks and thin barbs; at 96 (checked) it collapses to a double wire and its band weight mismatches the broad journey/habit frames. `b-161803` keeps the broad black-iron band, gold rim and molten story at 96. Recommend B.
- **Book** — good pair, rec A (B genuinely older/patinated).
- **Community** — good pair, rec A.
- **Field Guide** — **too similar** (same motif, exposure-only difference; pick either). Cosmetic, not harmful.

Rank rings (4, reference-only): bronze **too similar** (two interchangeable thin bands); silver/gold/mithril pairs acceptable. Not final art under F1 — quality here gates nothing.

## 3. Rank boss v2

- **Silver vs mithril: fixed at 200 and 96.** Sampled: silver plate sat 0.06 (neutral chrome, hue meaningless), mithril arms hue 196° / sat 0.50, halo apex sat 0.84. At 96 px the boss highlights separate cleanly: neutral `rgb(205,204,209)` vs cyan `rgb(130,187,216)`, vs copper `(214,145,70)` and yellow `(218,180,73)`. At 48 px all bosses are 2–3 px specks — a hue hint at best; the label stays authoritative, as designed.
- **Cut axis: useful at ≥200 px only.** Round/octagon/hex/star are distinct silhouettes at 200, invisible at 96, irrelevant at 48. Bronze keeps a plain dome as the null cut — sensible. Axis pays for its complexity exactly where thumbnails are made (200 px production size), so keep it.
- **Halo: not too neon; slightly too loud.** It's a soft bloom, not a neon ring, and thematically right for mithril — but mithril is the only emissive of four bosses (siblings are matte metal), and the glow spills visibly over the gold laurel band at 200. Trim radius/opacity ~15–20 % so the set stays matte-uniform with one faint exception.
- **Seating:** the dark bezel does its job on both gold and steel bands; all four bosses (incl. bronze dot on the chrome habit frame, gold star on Home at Sunset's magenta field) sit naturally at 6 o'clock. No floating or bleeding.

## 4. Set coherence — remaining outliers in the coherence sheet

1. **Home Again at Sunset (A)** — the one true outlier left (magenta/pink/orange pastel). Swapping to `b-161803` fixes the set's worst break. Biggest single coherence win available.
2. **First Steps (A)** — second outlier (bright candy-green in a dusk-toned set). Swap to `b-141421`.
3. **Faithful Walker (A)** — pair pick is right; needs the grade pass (desat ~15 %), else it stays the most "mobile-game" face.
4. **Habit frame read** — First Steps / Faithful Walker still read as silver-tier rings beside the gold journey family; the copper-line brightening (cohort should #5) remains open, not the A/B pick's fault.
5. **Rauros (A)** — thinnest silhouette at 96 (hairlike horn over empty navy). Not fixable by the current pair; honest "should" regen candidate for 8.6, not a blocker.

Swaps required by the 9-badge set: Home → B, First Steps → B. After those two, the A-pick set reads as one collection for the first time.

## 5. Verdict and list

The report is not ready: it would let the user ratify three recommendations that the standing review already vetoed, and pick four retired assets. No candidates are missing — every needed alternative already exists, so this is editorial, not generation work.

- **Must 1.** Flip recommendations: Home at Sunset → `b-161803`, First Steps → `b-141421`, Challenge Frame → `b-161803`; keep the other 16 recs. Re-composite `coherence-circle-f1v2.jpg` with the corrected picks (it currently shows contradicted A picks under a "recommended badges" title).
- **Must 2.** Mark the 4 rank rings "reference only — not part of final art under F1" in the md table, HTML summary row and all sheets (grey card / no ★ / no pick cell), so the user's pick list is 15, not 19.
- **Should 3.** Replace the Rauros tie rationale with the decisive 96 px argument (A cleaner on tile; note B's patina reads as noise) — ties with no stated tiebreak are how the challenge-frame miss happened.
- **Should 4.** Attach explicit post-pick grade-scope notes to the picks that need them: Faithful Walker desat ~15 %; habit-frame copper/notch brightening; Home B matte-field pass (cohort shoulds #5–#7), so "pick" and "regen/grade" are not conflated.
- **Should 5.** Trim the mithril halo ~15–20 % (see §3); note in the report that the rank-boss decision lives outside this report, with a link to `rank-boss-v2.jpg`, so the pick round and boss round read as one system.
- **Nice 6.** Add one line to the report header stating the slot convention (a = polished/enamel, b = aged/patina) — it explains 19/19-A patterns and de-personalises the picks.
- **Nice 7.** Book/Field Guide pairs each take one genuinely different second candidate next round (clasp variant / leaf-scale variant); current B's are exposure-only.

`NOT checked: production glyph/HUD context of the badges in-app, UI slot sizes other than 96/200/48, PhotoCraft compositing variances at 8.6, selections.md round-trip, other reviewers' files.`
