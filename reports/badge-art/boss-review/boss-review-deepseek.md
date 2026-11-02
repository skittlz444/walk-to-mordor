# Rank boss finalists — independent review

**Reviewer:** DeepSeek (independent) · **Date:** 2026-11-02

**Scope:** read-only review of `boss-shortlist.json`, `decisions.md`, `final-selections.json`, `bosses.jsonl`, the three `boss-review` sheets, the four 12-up rank sheets, the 8 finalist renders at 512/200/96, and the 48 stamped composites. No art or config changed; this file is the only write.

**Method:** compared the top-2 pair against all 12 candidates per rank at 320–512 px; measured the placed boss and the 6 o'clock band from the 1024 composites (frame inner edge `y=952`, outer `y=1019` at `x=512` — a 68 px band; boss alpha bbox 77 px for bronze/silver/gold and 84 px for mithril in the 90 px `[466,934,556,1024]` box); re-composited bosses onto three locked final bases to check them against a real emblem rather than an empty well; downscaled the stamped composites to 200 and 96 px for the production read.

## 1. Pairs (1–5)

**Short answer: the top two per rank are defensible; no outsider is clearly better. The pair sets are less diverse than the shortlist implies, and two of the strongest hand-worked outsiders are not discussed.**

| Rank | Pair | Right pair? | Main outsider risk |
|---|---|---|---|
| Bronze | `a-112358` / `a-271828` | Yes, but near-duplicate | `a-173205` (undocumented) |
| Silver | `a-314159` / `a-271828` | Yes | `b-173205` (undocumented, most hand-forged) |
| Gold | `a-314159` / `b-314159` | Yes | `a-271828` (no gem) |
| Mithril | `b-314159` / `b-173205` | Yes | none close |

- **Bronze.** A and B are effectively one medallion — same repeated oval bezel, same domed field, near-identical amber cabochon and proportions — with B adding fan chasing. That is not a real alternative; if A had failed there would be no fallback with a different silhouette. `a-173205` is the only structurally different bronze: deep concentric planish, irregular rim, small cabochon. It is the most convincingly hand-planished bronze in the rank, but the stone is small and would lose at 40 px. It is not clearly better; it is clearly *different* and should have been discussed.
- **Silver.** A and B are both octagon + ray fields; they differ mainly in the bezel and ray regularity. A has the richest engraved bezel; B has a bright chip/line across the top bezel (the shortlist calls it a hairline crack) and pitting. `a-161803` (oval stone, plain bezel) is cleaner than B but flatter. `b-173205` is the most hand-forged silver in the rank — irregular scalloped rim, uneven ray lengths, visible scratches — but its charcoal stone reads iron/pewter, not silver. Neither is clearly better. The silver notes omit `a-141421`, `b-112358`, `b-141421` and `b-173205`; the last is a material omission.
- **Gold.** A and B are genuinely different (ornate cartouche vs broad bead ring), and A is the right #1. B is a legitimate fallback but has real defects: a bright scrape/gouge on the upper-left rim and horizontal banding/moiré across the amber at 512. `a-271828` is the closest outsider (small gold dome + filigree) but has no gem, so it would break the tier's gem language. Gold notes omit `a-112358` and `b-271828`.
- **Mithril.** A and B are the best two and are meaningfully different (laurel sprigs vs running vine). No outsider is close; `a-161803` and `a-173205` are flatter and less engraved. The notes omit only `a-161803`.
- **Action:** keep all four pairs. Add one line each on bronze `a-173205` and silver `b-173205` (and finish the silver/gold rejected lists) so the picks are auditable. The notes currently read as a partial audit, not a complete one.

## 2. Naturalness

**At 512 px boss art, none of the eight is a photograph of a hand-forged medallion; all read as high-end game asset.** The tells are consistent: perfectly mirrored filigree/engraving, uniformly spaced beads and bezel lobes, a single hard white specular on every glass cabochon, flat plates with no tool marks or solder seams, and a cutout silhouette with flat spots/steps at 512 (bronze A at 3 o'clock; silver A at the corners).

**Strongest:** `mithril b-314159`. The patina sits in the engraving recesses, the laurel leaves vary slightly, and the blue cabochon is properly domed with a dark girdle. It is the best "old silver" read in the set, though the four arms are still mirror-symmetric.

**Then:** `bronze a-112358`. The planished dome, the dark recess around the stone, and the slightly uneven rim read as worked copper. Its weakest element is the repeated oval depressions in the outer bezel, which are identical and evenly spaced — the most procedural-looking part of the recommended set.

**Weakest:** `silver a-314159`. A geometrically perfect octagon, evenly spaced equal-length rays with no overlaps or crossings, and a flat frosted stone with a soft bloom. It reads as etched/vector silver, not chased. **Second weakest:** `gold b-314159` — uniform beads, a flat amber with horizontal banding, and the upper-left rim gouge.

**Caveat that matters:** at the actual production size the boss is 38–42 px at 512 and 15–16 px at 200. At those sizes the CG tells are invisible. The hires sheet shows the art at ~6× its use size. The correct claim is "handcrafted-style at badge scale", not "hand-forged at hero scale"; the dossier overstates this.

## 3. Tier escalation

- **Bronze → silver:** ornament steps up (ray field, engraved bezel), but *handcraft* steps down. Silver is the most graphic/vector rank; it is the one inversion in the ladder. If one rank is ever regenerated, regenerate silver before anything else.
- **Silver → gold:** clear step up. The gold A cartouche is the densest, most dimensional ornament and the amber cabochon is the first real gem. It still reads as a gold tier at 40 px because the hex plate and gold mass survive.
- **Gold → mithril:** refinement steps up, density steps down. The mithril star is the most elegant and the best material, but it is visually lighter than gold — thin arms, less mass. It is premium as art, not as mass.
- **Size normalization:** bronze/silver/gold are 77 px and mithril 84 px by alpha bbox (≈9% more), which helps, but the star's thin arms still read lighter than the round bosses. On the silver habit frame the mithril is the least visible top-rank boss in the set.
- **Verdict:** the escalation reads, but not monotonically in ornament. If the ladder is meant to be "more ornate each step", mithril breaks it; if it is "more refined/material", it works. The gold tier's gold-on-grey plate is the most legible middle step; silver is the weak link.

## 4. Stamped fit

**Overall placement.** The boss is centered on the frame's 6 o'clock focal point with no seat or collar. All six frames already have a clasp, pin, chevron, or ornament there; the boss covers its center but leaves the ends visible. The result is a medallion laid on top of the frame's own hardware, not a boss set into it. The boss body's bottom edge is tangent to the frame's outer edge (77 px boss ending `y≈1018` against a frame edge at `1019`; mithril `1020`), so there is no margin of frame below it. On the thin habit band the bright boss edge interrupts the circular outline, and the mithril star's lower point touches the silhouette.

**Shadow/bezel.** The contact shadow is a 2–3 px black fringe (the shadow tile peaks at alpha 114/255, ~45%), nearly concentric with the boss. It reads as a sticker outline, not contact occlusion: invisible on the black well side, dirty on gold, and it does not seat the boss. It also spills past the frame's outer edge into transparency at 6 o'clock — `y=1019` alpha 42 → `1023` alpha 0 on habit/mithril, and `y=1018` alpha 129 → `1023` alpha 3 on book/bronze, i.e. a 4–5 px black smudge outside the badge circle. There is no frame-side bezel; the boss's own rim is the only bezel, and it is a different metal/height from the frame.

**Book (`a-271828` frame) — worst collision.** The frame's gold book-clasp is wider than the boss and occupies the same spot. Bronze A reads as a medallion buckled over the clasp, with the clasp's gold tabs sticking out left/right and its pin hidden. Gold A is the worst offender: its gold cartouche merges with the clasp's gold and its lower point sits on the clasp, so the boss reads as a gold buckle rather than a separate medallion; only the grey hex edge survives. Mithril's star is cut by the clasp's top/bottom edges and its lower point runs onto the outer gold rail. This needs a clasp-shaped seat/mask, not a smaller boss.

**Challenge (`a-112358` frame) — second collision.** The two gold chevron clusters meet at 6 o'clock and are wider than the gap. The boss clips their tips: on gold A the tips read as gold wings growing out of the boss; on silver A the white octagon cuts them hard; on mithril the star's horizontal points land on the tips. Bronze A is the only one that reads as a collar, because its copper ties to the gold. A dark seat or a 6–8% shrink on this frame would fix it.

**Journey / community / field-guide.** On journey a gold nub (the frame's center pin) peeks above the boss. On community the weave gap actually seats the boss best — the rope ends meet the disc cleanly, and bronze A reads as a woven-in clasp. On field-guide the gold fan's leaves peek around the boss shoulders and the mithril points tangle with them. On habit the copper pinstripe is cut by every boss; silver A/B and mithril nearly disappear on the silver band.

**Emblem clearance.** The boss top sits ~12 px into the 880 well but still ~25–28 px below the 800 emblem, so there is no emblem collision by geometry. The final composite still needs a visual check because the emblem's bottom detail competes for attention with the boss.

## 5. Recommendation

| Rank | Pick | Agree? | Reason |
|---|---|---|---|
| Bronze | A `a-112358` | Yes | Cleaner, larger cabochon; B's chasing reads as scratches and its stone is smaller. |
| Silver | A `a-314159` | Yes, weakly | Best bezel and pale rank cue; B has the top-bezel chip/crack. A is also the most vector — if silver is ever regenerated, chase the `b-173205` rim/ray direction while keeping a pale stone. |
| Gold | A `a-314159` | Yes | The only candidate with a real cartouche + gem; B's striped stone and rim gouge are worse than A's mirror-symmetric filigree. |
| Mithril | A `b-314159` | Yes, strongly | Better gem and engraving; B's gem has a doll's-eye white reflection and its thinner arms lose more at 200. |

4/4 agree; no pick should change. The only disagreement is with the gold B rationale, which omits the visible defects.

## 6. At 96 / 200 px

- **Measured:** 77 px (bronze/silver/gold) and 84 px (mithril) in the 1024 master = 7.5–8.2% of the badge. That is **38–42 px at 512, 15–16 px at 200, 7–8 px at 96**.
- **At 512 with the emblem present:** the boss reads as a small stud/jewel at 6 o'clock, not as a rank boss. On habit the mithril star is effectively only a blue cabochon; on journey the gold hex reads as a tiny gold bolt with a hint of filigree.
- **At 200:** a colored dot — amber/white/gold/blue; the octagon/hex/star silhouettes are mostly gone. Bronze and gold collapse into the same warm dot (same amber, same warm metal); silver and mithril are both pale/cool, with blue vs white the only cue.
- **At 96:** a 7–8 px dot; it disappears into the frame. On habit/silver it is invisible. Rank is not readable at 96 by boss alone.
- **Is the mithril star too dominant?** No. At 512 it reads lighter than the round bosses; at 200 it is a small sparkle. The failure mode is the opposite: it is the first to vanish (thin arms, cool metal on a silver frame).
- **If the boss must be a rank cue at 96/200:** the current scale fails. Either enlarge to ~100–110 px at 1024 (which needs a seat/band rework — do not enlarge without one) or accept that the card label carries rank. Do not use the standalone 96/200 finalist renders as evidence: they show the boss at ~70 px in a 96 px tile, not at 7 px on a badge.

## 7. Verdict

**BOSS FINALISTS: READY**
**FINALISTS: READY**
**STAMPING: NEEDS FIXES**

`READY` means ready to lock for the 512/200 production size; it does not mean the 512 px art would pass as hand-forged hero art.

### Must

1. **Habit + all ranks (worst mithril):** the boss is tangent to the outer edge and the star's lower point touches the silhouette; the bright boss edge interrupts the circle. Add a 4–6 px seat margin or a recessed socket clipped to the frame.
2. **Book + gold A / mithril:** clasp collision — the clasp's gold tabs/pin show around the boss and the gold-on-gold silhouette merges. Mask the clasp under the boss or add a clasp-shaped seat.
3. **Challenge + silver A / mithril:** the chevron tips are clipped and read as wings growing from the boss. Add a seat/mask or reduce the boss 6–8% on this frame.

### Should

1. **All frames:** clip the baked shadow to the frame alpha (it spills 4–5 px past the rim at 6 o'clock) and replace the 2–3 px black fringe with a real AO ring plus a reflected lower-edge highlight.
2. **Habit + silver/mithril and journey/community/field-guide + gold A:** add a dark seat/socket ring (2–3 px visible at 1024) for separation; this one change fixes contrast, seating, and the clasp/chevron masking.
3. **Decide the 512/200 rank-cue requirement:** the current 77–84 px reads as a stud at 512 and a dot at 200. If rank legibility is required, enlarge only with a seat; if the label is authoritative, document that.
4. **Silver art (if regeneration is possible):** replace `a-314159`'s uniform rays with irregular, overlapping chisel cuts; keep the pale stone. Silver is the weakest handcraft tier.
5. **Shortlist audit:** document silver `b-173205` and bronze `a-173205` exclusions and complete the omitted silver/gold/mithril rejections.

### Nice

1. Per-frame scale/offset instead of the single `[466,934,556,1024]` box (book/challenge/habit).
2. Bronze pair diversity: add `a-173205` as a third look so the pair is not one design twice.
3. Mithril at 200: +3–5% or slightly thicker arm roots to hold the star shape; do not enlarge for 96 (it would break the band).
