# Expansion Review — Six New Finalists and Updated Report (GLM)

**Date:** 2026-11-02
**Reviewer:** GLM-5.3-Flash #max (independent; did not read other reviewers' files)
**Scope:** six new achievement pairs, the updated 15-achievement emblem deck, the 5×5 all-asset deck, and the six new contact sheets. Read-only review.

Reviewed inputs: `composite-review.md`, `shortlist.json`, `scripts/badge-art/prompts.json`, `finalist-review-emblems.jpg`, `finalist-review-all.jpg`, and all six `sheets/emblem/*.jpg` contact sheets (each shows 12 candidates).

## Verdict

**NEW PICKS: READY**
**REPORT: READY**

All six recommendations are the best-of-pool for their asset. Two of the six pairs (Steady Month, Hundred-K Week) are carried by finalists that survived systemic prompt misses rather than achieved prompt intent — the picks are still correct within the pool, and the defects are tracked below as shoulds, not blockers.

## 1. Pair-by-pair

| Asset | Pair | Call | Recommendation | Note |
|---|---|---|---|---|
| The Glittering Caves | a-271828 / a-173205 | **Good pair** | correct | B-slot `a-173205` is the stronger; keep. |
| Weekend Warrior | a-141421 / b-271828 | **Good pair** | correct | Near-tie with `a-173205`; keep. Strongest of the six. |
| Steady Month | a-271828 / b-161803 | **Weak pair** | correct within pool | Both carry a key/scepter instead of the prompt's walking staff — a 12/12 prompt miss, not a per-candidate artifact. |
| Hundred-K Week | a-112358 / b-161803 | **Acceptable pair** | correct within pool | No candidate renders the prompted spiral; concentric rings + 8 markers instead of 7. `a-112358` is the cleanest render in the pool. |
| Fellowship Founder | a-141421 / b-271828 | **Good pair** | correct | `a-141421` is the only polished candidate with a solid field; the split-field alternates are genuinely flag-like. |
| Good Company | a-112358 / b-271828 | **Good pair** | correct | Strongest small-size read of the whole expansion. |

No recommendation is wrong. The two compromised pools (Steady, Hundred) share the same failure mode as each other and would share a fix: one prompt-edit rerun each, not per-asset re-seeding.

## 2. The Glittering Caves (a-173205)

**Reads correctly, fits the set, rank is right, pair is clean on the checked specifics.**

- The cave read is carried by the dark cavern ceiling across the top of the disc — this is what separates `a-173205` from the other polished candidates, whose paler, filigree-filled fields read as "crystal cathedral/palace" (a-271828's top arch and a-314159/a-161803's tracery in particular). Crystal columns, the Dwarf stone terraces, and the water reflection are all present.
- Set fit: it is the densest and most scene-like journey emblem (wide cavern vista vs the door/leaf/horn/cone single motifs). That is inherent to the subject, not a pick error; the visual weight still lands inside the dark-navy/gold journey language.
- Rank 4/mithril at 3827 km, position 7/8 (Home now 8/8) is consistent: above Mordor (rank 3), sibling of Home Again (rank 4). No change.
- Baked-border check: clean. The recommended pair has a thin rim only; every b-variant on the sheet visibly carries the heavy gothic/engraved border ring, so the wholesale b rejection is justified on evidence.
- Multi-lantern check: passes. `a-173205` has exactly one warm lantern; a-112358, a-314159 and a-161803 visibly show multiple warm glows, matching the shortlist rejection note.
- Residual watch item: a pale blue-white emblem under a pale mithril boss is the one composite where the badge's own palette approaches the rank boss's colour. The boss's dark bezel should handle it, but check it in the 8.6 composite pass, not assume it.

## 3. Habit badge (Weekend / Steady / Hundred)

- **Weekend Warrior (a-141421):** reads as habit, not scenery. Sun + crescent moon (Sat+Sun), two flanking stones (two walk days), gold path — the semantic carriers survive at 96 px. It is the most landscape-like emblem in the entire set (full sky + hills + trees), but it is same-class as Faithful Walker's path-and-terrain composition, so it does not break family read. Best concept-to-render match of the expansion.
- **Steady Month (a-271828):** the ring-of-20 motif carries the "20 distinct days" meaning and reads as a cycle, not a scene. The **key/scepter is a defect**: in all 12 candidates the central object is an ornate key or scepter — `a-314159` and `b-314159` show an unmistakable round-bitters key; the others show crowned/trêfle mace heads. The prompt said "central walking staff"; the model never drew one. Mitigation: at 96 px the diagonal gold object reduces to a plain staff silhouette, and the badge meaning rests on the stone ring and the label (authoritative under F1). Ship `a-271828`, but record that the ornament is carried, not carried-well; a rerun should fix the prompt wording ("T-gripped wooden walking staff with wrapped grip").
- **Hundred-K Week (a-112358):** acceptable without the spiral, with reservations. No candidate in the pool has a spiral; all deliver compass + concentric rings + markers. `a-112358` is the crispest (clean navy, strong silhouette). Two reservations: (a) concentric rings + a ring of eight markers is the closest thing in the expansion to the multi-ring composition the composite review just killed for rank purposes — the read is "system decoration", and it must be watched in composite; (b) it is the only habit newcomer with no milestone-stone/path vocabulary at all — compass = navigation, not weekly volume. Neither reservation justifies shipping a worse candidate; note the prompt-miss and fold the spiral rerun into the same optional regen lane as Steady Month.
- Marker count 8 vs the prompted 7 is a harmless nit — invisible and irrelevant at display sizes; do not spend a rerun on it.
- **Strongest two: Weekend Warrior and Hundred-K Week** (silhouette + 96 px legibility). Steady Month is the weakest pair, purely because of the ornament defect; its ring composition itself is sound.

## 4. Community badges (Founder / Good Company)

- **Frame and idea fit: yes.** Three founding stones with a carved beacon flame (Founder) and a free-standing campfire with crossed logs among four stones (Good Company) both read as "people meet here", which is the right pictorial translation of "fellowship". Blue deep fields behind warm gold stones and fire sit correctly inside the bronze knotwork community frame.
- **Split-field flag risk: resolved by the picks.** The sheet confirms the hazard was real — a-112358 (blue/red/green sectors), a-271828 (navy/red split), a-314159 (blue/magenta split), a-161803 (vertical blue/red bars) all read as flags; the two realistic runners-up, Founder `a-173205` (solid red) and Good Company `a-271828`'s red field, lose fire-on-red contrast. The chosen `a-141421` and `a-112358` are the two correct picks.
- **Pair coherence: good.** Both pairs are the same composition in polished-blue vs aged-bronze, matching the expansion-wide pairing rule.
- **Watch items:** (a) Founder and Good Company are the near neighbours of the expansion — both read "flame among stones on blue" at 96 px; the distinction survives (carved inset flame vs bright free fire + crossed logs) but check the two cards side by side in the collection preview. (b) Founder is rank 1 → bronze boss on a bronze knotwork frame: bronze-on-bronze is the one boss contrast the composite review did not explicitly validate (it validated gold and steel). Verify at composite time.

## 5. Updated report

- **Counts are correct everywhere.** Emblem deck: 15 achievement cards × 2 finalists, subtitle matches. All-asset deck: "25 assets · 50 finalists" — 15 emblems + 6 frames + 4 rank rings = 25, 2 each = 50, both arithmetically right. Each contact sheet shows 12 candidates as claimed.
- **Recommended marks verified against `shortlist.json` for all 25 assets** — every "★ Recommended" slot and every `A · a-<seed>` / `B · b-<seed>` label matches; Home (B · b-161803) and Caves (B · a-173205) are the only B-slot picks, consistent in both decks.
- **The 5×5 all sheet still works** — rows 1–3 emblems, row 4 frames, row 5 field-guide frame + rank rings; every card readable at 140 px with kicker, name, and both variant labels present.
- **Rank-ring rows are NOT marked reference-only.** Nothing on the sheet distinguishes the four rank-ring assets from shipping assets; the footer even says "Reply with A or B per asset." Under F1 the rings are not composited at all, so the deck overstates scope (25 shippable vs 15 + 6). The decision record in `composite-review.md` is unambiguous, but the deck should carry it locally.
- Minor: family blocking is interleaved by insertion order — Faithful Walker (habit) sits between journey's Home and Caves, and Caves sits one slot away from the journey block. Row grouping by family would make the set structure readable at a glance.

## 6. Findings (ranked)

### Must

None. The two december blockers I looked hardest for — Caves borders/lanterns and the community flag-fields — are clean in the chosen picks, and all six recommendations are best-in-pool.

### Should

1. **Steady Month central object:** 12/12 candidates render the prompted walking staff as a key/scepter (evidence: `a-314159` and `b-314159` show a round-bitters key head outright). Ship `a-271828`, but open a prompt-fix rerun lane with corrected staff wording before the next regen pass; the picks need not wait.
2. **Hundred-K Week spiral miss:** pool-wide; concentric rings re-approach the multi-ring read retired in the composite review. Accept `a-112358`; if the regen lane opens, fix the spiral wording in the same pass.
3. **Mark the rank-ring rows reference-only** in the all-asset deck (and exempt them from the "A or B per asset" footer). The deck currently presents 25 assets as equivalent decisions when 4 are archived under F1.
4. **Verify in 8.6:** mithril boss contrast beneath the very pale Caves emblem, and bronze boss contrast on the bronze community frame for Founder.
5. **Extend the composite review's field-discipline/LUT pass to the six new emblems** — Weekend `a-141421`, Good Company `a-112358`, and Hundred `a-112358` arrive with pronounced dome sheen like the old Buckleberry/Golden Wood faces; they share that fix, not a new one.

### Nice

6. Check Founder and Good Company side by side in the collection preview (nearest-neighbour silhouettes).
7. Family-group the all sheet rows (currently insertion-ordered, interleaving habit between journey halves).
8. Record that the journey family ships 7 polished + 1 aged (Home) as an intentional palette-coherence call, so it does not read as drift later.
9. One-line footnote on the emblem deck explaining "Gold (representative)" for the four threshold badges, to pre-empt rank questions during sign-off.

## Not checked

- 96 px and 200 px composited legibility of the six new badges (composites do not exist yet; F1 boss contrast likewise) — this review is pre-8.6.
- Exact stone counts in Steady Month's ring (visually consistent with ~20 in both picks; not countable to the unit at sheet resolution).
- The HTML decks (`finalist-review.html`, `review.html`) — image decks only, per scope.
