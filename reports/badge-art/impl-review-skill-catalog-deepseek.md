# Implementation Review — `achievement-image-generation` + `achievement-catalog-expansion`

**Date:** 2026-11-02
**Scope:** read-only review. No generation, no `public/` writes, no repo changes except this file.

## Verdicts

SKILL: NEEDS FIXES
CATALOG: READY — data scope is correct; the artwork follow-up (task 4.1) is blocked by the skill, not by the seed.

## What I verified

- `python3 scripts/badge-art/generate.py --list` → 19 assets, 188 candidates; matrix validates.
- `python3 scripts/badge-art/composite_badges.py --list` → 18 rows (9 emblems × circle/hexagon); existing journey/habit set resolves.
- Executed `0142` + `0145` twice in an in-memory `node:sqlite` DB: 5 rows, valid JSON, 3 habit + 2 community, `is_repeatable` 1/0, ranks 1/2, thresholds `[1,4,12,26]`/`[1,3,6,12]`, collection 1/2 of 2, `image_slug = slug`, unique slugs.
- Simulated a new `habit-*` and `community-*` emblem through `resolve_assets()`: both raise before rendering (errors below).
- Measured current processed frame masters: outer ≈1016, inner r 440; emblem art ≈780–790. The review's 993/872 measurement is historical.
- `openspec validate achievement-catalog-expansion --strict` → valid.
- Did not run ComfyUI, BiRefNet, PhotoCraft, or generation.

---

## Skill findings

### Must

**M1. The only production path is a template that does not exist, so the skill cannot deliver the WebP pair it promises.**
`SKILL.md:8` says the workflow ends in a committed 512/200 pair. `SKILL.md:207` makes `raw_assets/badges/badge-template.pcraft` mandatory and says stop if absent. `find raw_assets -name '*.pcraft'` returns nothing, and `openspec/changes/profile-badge-display/tasks.md:51` (8.6) is unchecked. **Failing case:** start the skill for any slug → Step 8 stops before Step 10; catalog task 4.1 (`openspec/changes/achievement-catalog-expansion/tasks.md:17`) cannot produce its five files. The skill needs the 8.6 template or a documented, scripted RGBA fallback; `SKILL.md:218` only says "if you add an RGBA export path…".

**M2. `composite_badges.py` cannot resolve the five catalog badges, so the documented proof/coherence commands fail before rendering.**
`SKILL.md:216` says the script resolves journey and habit. In fact `resolve_assets()` hardcodes habit ranks by slug (`composite_badges.py:104-105`) and rejects every other family (`:255-256`). Simulated:
- `emblem/habit-weekend-warrior` → `ValueError: emblem/habit-weekend-warrior: no habit rank for 'habit-weekend-warrior'`
- `emblem/community-fellowship-founder` → `ValueError: ... unknown family 'community'`

**Failing case:** `composite_badges.py --proof f1v2 --only habit-weekend-warrior` and the full `--proof f1v2` both fail, so Step 8/9 cannot run for 4.1's five badges. The skill's "extend the mapping" note covers "another type" but not the hardcoded per-slug habit map.

**M3. The ownership table says habit belongs to `profile-badge-display`, but this change owns three habit definitions.**
`SKILL.md:49-56` lists `habit` under `profile-badge-display` and says "Never add … a migration row for a type owned by another change." `openspec/changes/achievement-catalog-expansion/design.md:79` assigns the five new slugs (including three `habit-*`) to `achievement-catalog-expansion`; `migrations/0145_seed_catalog_expansion.sql:18-47` seeds them. **Failing case:** an agent following Step 1/11 would refuse to confirm or extend the three habit rows, or hand the art brief to a change that did not seed them.

**M4. The skill requires `collection` in every definition, but the three habit badges are deliberately standalone.**
`SKILL.md:273` and `resources/checklist.md:123` require `storyline`, `rank`/`rank_thresholds`, `collection`, `criteria`. `openspec/changes/achievement-catalog-expansion/design.md:71` says habit badges "have no fixed `rank` and no collection"; the migration's three habit rows have no `collection` key. **Failing case:** an agent validating the seed against the skill would either invent a fake `habit-*` collection or reject correct data.

**M5. The "repeatables bake bronze" rule cannot be produced or proofed by the documented tool.**
`SKILL.md:110-111` says repeatable badges bake the rank-1 bronze boss. `composite_badges.py:105` hardcodes `HABIT_RANKS = {"habit-first-steps": "bronze", "habit-faithful-walker": "gold"}`; there is no CLI flag or metadata path to render a repeatable at bronze. **Failing case:** `--proof f1v2 --only habit-faithful-walker` renders gold, which the skill says is only a comparison; a new repeatable habit cannot be proofed at the production rule at all.

**M6. The skill requires an opaque 800–880 well, but the F1v2 composite and manifest record the transparent stack.**
`SKILL.md:86` says the annulus must be opaque and "Never ship the moat." `compose_badge()` flattens only `[emblem, frame, boss]` (`composite_badges.py:1140`); the manifest's F1v2 stack is `"emblem 800 -> family frame 880..1016 -> boss"` (`composite_badges.py:1788`) with no well. **Failing case:** an agent following `SKILL.md:84` ("the script wins") or the manifest ships a 40 px transparent annulus; the flattened `#14181f` proof hides it, and the alpha export shows it on white.

**M7. The F1 decision was not applied to `profile-badge-display`'s design/proposal/tasks.**
`openspec/changes/profile-badge-display/design.md:115-119` still defines a rank ring as a required layer and says it "gives consistent rank semantics"; `:198` lists "Family frame + rank ring"; `proposal.md:15,32` promise rank rings; `tasks.md:51` (8.6) still specifies a `rank` smart object. `reports/badge-art/composite-review.md:99` explicitly said "Update design.md and tasks.md 8.6." The same change still specifies a hexagon placeholder/skeleton (`design.md:106,162`; `spec.md:136-139`) while the art is circle. **Failing case:** a future agent reading the design reintroduces the ring or builds a hexagon placeholder, both of which the skill bans (`SKILL.md:74, 112, 233, 329`).

### Should

**S1. "Approved" frame masters are not approved for four families, and the frame measurement is stale.**
`SKILL.md:23` requires an approved master; `resources/style-reference.md:94` says community/book/challenge/field-guide "have generated masters and finalists but have not been through a nine-badge coherence run. Treat them as provisional." **Failing case:** the community badges in 4.1 use `frame/community` as if approved. Also `style-reference.md:66` still cites the old 993/872 measurement; the current processed masters measure ~1016/880, so the re-normalise warning is stale.

**S2. Step 5/checklist still treat rank rings as deliverables.**
`SKILL.md:138` says "Eight per frame or rank master (2 × 4)"; `resources/checklist.md:36` repeats it; `resources/prompt-patterns.md:106-121` calls the rank prompts legacy. **Failing case:** an agent generates 32 unnecessary rank-ring candidates and a rank shortlist for a badge whose only rank device is the procedural boss (`SKILL.md:23`).

**S3. The commit list omits the F1v2 proofs the gate depends on.**
`SKILL.md:306-314` lists `public/`, `prompts.json`, `shortlist.*`, `review.html`, `selections.md`, `sheets/`, `finalists/`. It omits `reports/badge-art/composites/circle-f1v2/*`, `coherence-circle-f1v2.jpg`, `legibility-96-circle-f1v2.jpg`, `rank-boss-v2.jpg`, and `manifest.json`. **Failing case:** following "Commit only" leaves the gate evidence untracked (the current worktree shows exactly these as `??`), so the next agent cannot reproduce the 96/200 checks.

**S4. The proof grid does not group the families the gate says must sit together.**
`SKILL.md:224, 231` says the grid must keep collection members adjacent and "habit badges sit together". `build_coherence_grid()` iterates `prompts.json` order (`composite_badges.py:1324-1329`); that order is habit-first-steps, seven journey, habit-faithful-walker. **Failing case:** the current `coherence-circle-f1v2.jpg` puts the two habit badges at opposite corners, so the gate checks a grouping the tool does not produce.

**S5. The shortlist schema and `--write-template` step are missing; `--render` is all-or-nothing.**
`SKILL.md:184` says "Record both … in `shortlist.json`" but never shows the schema. `make_report.py:162-205` requires exactly two finalists and a `recommended` for **every** asset in `prompts.json`; one missing entry returns 2 for the whole report. **Failing case:** add a new emblem, run `make_report.py --render` before its shortlist entry exists, and the report for all 19 existing assets fails.

**S6. An undocumented second review tool hardcodes the old set size.**
`scripts/badge-art/finalist_review.py` is untracked and not named in `SKILL.md`. `FULL_COUNTS = {"emblem": 9, "frame": 6, "rank": 4}` (`:46`) and `render_sheets` raises if the counts differ (`:324-331`). **Failing case:** adding the five catalog emblems makes `finalist_review.py` raise `expected 19 assets (9 emblem, 6 frame, 4 rank), found 24`. Either document it as the review pack or fold it into `make_report.py`; two galleries (`review.html` and `finalist-review.html`) is duplication.

**S7. The 200 px "production thumb" has no consumer.**
`SKILL.md:226` calls it the production thumb and `SKILL.md:239-250` makes it a required export. The profile display contract constructs only `/img/achievements/<image_slug>.webp` (`openspec/changes/profile-badge-display/design.md:106`); no `srcset` or `-thumb` reference exists. **Failing case:** 4.1 ships `<slug>-thumb.webp`, but the card loads the 512 px main; the 200 px asset is dead weight and the 200 px gate is not exercised by the UI.

### Nice

**N1. Stale counts.** `SKILL.md:224` still says "The nine-badge grid must still read as one product"; after the catalog expansion the set is 14 (and 19 assets in `prompts.json`). `resources/style-reference.md:3` also calls the reference set "the nine".

**N2. Thumb fallback is not actionable.** `SKILL.md:253` says "if it is still over budget, reduce the master rather than the dimensions"; `resize-webp.js:70-75` stops at quality 20 and still writes the file. There is no command or threshold for "reduce the master".

**N3. `BOSS` units are ambiguous.** `SKILL.md:84` says `BOSS` is the source of truth while the table gives diameters (70/54/25); `composite_badges.py:134` stores radii (`bezel: 35.0, disc: 27.0, gem: 12.5`). A literal comparison makes the skill look wrong, and a "fix" to 35/27/12.5 would halve the boss.

**N4. The review report still has a "Rank rings" section.** `make_report.py:46` sets `GROUP_TITLES = {..., "rank": "Rank rings"}`, so the skill's Step 7 report keeps a legacy category even though F1 has no ring. **Failing case:** a new agent reads the review pack, sees "Rank rings", and assumes the rank masters are still required.

---

## Catalog findings

### Should

**C1. The test does not exercise the order-independence claim, and does not assert schema neutrality.**
`tests/api/achievement-catalog-expansion.test.ts:45-63` applies `0142` then `0145` twice; it never applies `0144`. `design.md:90` and `spec.md:70-75` claim "safe before or after 0144"; `0144_seed_journey_badges.sql` does not exist in this branch. The namespace check is a regex on the five slugs (`:88-95`), not a real collision. **Failing case:** a future 0144 that reuses `habit-weekend-warrior` still passes this test. Also `spec.md:77-80` says "no table, column, or index is created"; the test never snapshots `sqlite_master`, so an index added to 0145 would pass.

**C2. The spec asserts display/rank behavior this change does not implement, and `unit` has no consumer.**
`spec.md:28-33` requires `habit-weekend-warrior` to resolve rank 2 at four earns. Rank resolution lives in `src/badge-presentation.ts` (profile change, `tasks.md:8`), which does not exist. `design.md:67` says `unit` is the display plural ("12 weekends"), but the presentation contract returns only `{ rank, rank_label, storyline, collection }` (`profile tasks.md:8`); the display spec only shows a repeat count. **Failing case:** the catalog merges, but the UI cannot render "12 weekends" and the rank scenario is untested here. The same design's "existing missing-image placeholder" claim (`design.md:119`) refers to a UI that is not implemented in this branch (`public/css/badge-display.css` and `public/img/achievements/` do not exist).

### Catalog detail

- **Data:** 3 habit + 2 community, valid JSON, `is_repeatable` 1/0, ranks 1/2, thresholds `[1,4,12,26]` / `[1,3,6,12]`, collection `community-fellowship` 1/2 of 2, `image_slug = slug`, unique slugs. Verified by executing the SQL.
- **Ownership:** no collision with `book-*`, `challenge-*`, `field-guide-*`, or `campaign-*`. `campaign-*` is also `badge_type='community'` but uses a different slug namespace (`design.md:83-85`), so the catalog is correct; the **skill's** community row omits `campaign-*` and would misattribute future campaign art.
- **Migration:** `INSERT OR IGNORE`, no explicit IDs, no schema changes; safe before 0144 by disjoint slugs. After 0144 is unverified because 0144 is absent.
- **Test:** executes the real SQL and asserts the main invariants; gaps are C1 and C2.

---

## Stale text / drift summary

| Location | Stale claim | Current decision |
|---|---|---|
| `openspec/changes/profile-badge-display/design.md:115-119,198` | rank ring is a layer | F1: boss only, no ring |
| `openspec/changes/profile-badge-display/proposal.md:15,32` | frames and rank rings | F1 |
| `openspec/changes/profile-badge-display/tasks.md:46,48,51` | rank-ring prompts, eight per rank ring, `rank` smart object | F1 boss; ring legacy |
| `openspec/changes/profile-badge-display/design.md:106,162`; `spec.md:136-139` | hexagon placeholder/skeleton | circle art; placeholder shape diverges |
| `reports/badge-art/composites/manifest.json` (generated) | F1v2 stack `880..1016` with no well | opaque 800–880 well required |
| `resources/style-reference.md:66` | frames 993/872 | current 1016/880 |
| `SKILL.md:224` | nine-badge grid | 14 after catalog |
| `scripts/badge-art/make_report.py:46` | "Rank rings" group | no ring |

---

## Not checked

- Did not run ComfyUI generation, BiRefNet, PhotoCraft, or any `public/` write; no visual judgement beyond code/manifest inspection and the existing proof artifacts.
- Did not run the Jest suite in this worktree (no `node_modules`); the SQL was executed directly with `node:sqlite`. `openspec validate --strict` passed.
