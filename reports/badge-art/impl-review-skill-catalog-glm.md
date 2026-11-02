# Implementation Review — Achievement Image Generation Skill + Catalog Expansion

**Reviewer:** GLM-5.3-Flash #max (independent subagent) · **Date:** 2026-11-02
**Scope:** `.github/skills/achievement-image-generation/**`, `.github/skills/goal-image-generation/SKILL.md` (as reference), `scripts/badge-art/*`, `reports/badge-art/composite-{review,test-plan}.md`, `openspec/changes/achievement-catalog-expansion/**`, `migrations/0145…`, `tests/api/achievement-catalog-expansion.test.ts`, `migrations/0142–0143`, `docs/data-models.md` (achievement notes).

**Verdicts**

- `SKILL: READY`
- `CATALOG: READY`

Both hold conditionally: MUST-1 (stale parent-change docs) must be fixed before the production composite path is exercised, because the skill and the catalog change both defer production art to that stale text.

---

## Findings

Ranked must / should / nice. No file in this change's two artifacts failed hard; the single must-level defect lives in the sibling `profile-badge-display` change that both artifacts defer to.

### MUST

1. **Parent-change task/design text still plans a rank-ring template; the skill defers production art to it.**
   `openspec/changes/profile-badge-display/tasks.md:51` (task 8.6) specifies a PhotoCraft template of "`base` smart object plus `frame` and `rank` smart objects on shared geometry" — no 6 o'clock boss, no opaque well disc, no keyline. The F1 decision (`reports/badge-art/composite-review.md:99` ) ordered exactly this fix ("Applies to … `design.md` / `tasks.md` 8.6") and it was not done. Stale companions: `design.md:25`, `design.md:115–119` ("Rank ring — one master per rank… a shared rank ring gives consistent rank semantics"), `design.md:123`, `design.md:198` ("Family frame + rank ring, baked in PhotoCraft"), `proposal.md:15`.
   Failing case: once 8.6 is executed per its own text, the template yields production WebPs with a rank ring and a transparent 800–880 annulus — three explicit violations of `SKILL.md` (lines 74, 86, 207–216) and of review must-fix #1. The skill's "task 8.6 owns it" handoff (`SKILL.md:207`) points at contradictory instructions. Fix `tasks.md` 8.6 + `design.md` before running catalog task 4.1 production compositing.

### SHOULD

2. **Skill has a stop condition but no procedure for the production composite.**
   `SKILL.md:207–218` requires `raw_assets/badges/badge-template.pcraft` (verified absent → skill correctly says stop) and `photocraft-cli` (verified on `PATH`), but documents no invocation: no `photocraft-cli` command line, no automation read/write roots, nothing that produces the `raw_assets/badges/final/<slug>.webp` master consumed by Step 10 (`SKILL.md:239–251`). A future agent hits the PhotoCraft step and must recover the workflow from task 8.6 — the stale file from MUST-1. Add one operational paragraph (or at minimum a pointer to where the run procedure will live) alongside the template contract.
3. **First-of-type family mini-grid rule lost between style-reference and skill.**
   `resources/style-reference.md:260` requires "if the new badge is the first of its type, run a family mini-grid (three badges) before committing the frame language." `SKILL.md` Step 9 (lines 220–235) and `resources/checklist.md:94–105` have no such check. The catalog expansion's two `community-fellowship-*` badges are the first community art ever composited (`resources/style-reference.md:94` marks that frame as provisional/untested). Failing case: two community badges composited straight into the full 3×3 gate; if the bronze-knotwork cue vanishes at 96 px the set converges worse and the frame language is already committed. Also reconcile the rule itself: a mini-grid of three is impossible for a two-badge collection — pick a measurable substitute (e.g. community pair + one journey + one habit in a 4-tile arrangement).
4. **Step 11 metadata list makes `collection` look mandatory.**
   `SKILL.md:273` and `resources/checklist.md:123` list `collection` among required metadata keys; three of the five catalog seeds deliberately have none (`migrations/0145_seed_catalog_expansion.sql:28,37,46`) and the test asserts its absence (`tests/api/achievement-catalog-expansion.test.ts:136`). Failing case: an agent seeds `habit-weekend-warrior` with a collection block, contradicting the change it implements. Say "`collection`, when the badge belongs to one."
5. **Composite proof needs a per-slug mapping extension the skill gestures at but doesn't specify.**
   `composite_badges.py:104–106` resolves journey ranks from `prompts.json` rank (ints) and habit ranks from `HABIT_RANKS`, keyed by slug; `resolve_assets()` raises for any other family (`composite_badges.py:252–256`). The three repeatable habit badges raise at proof time("no habit rank for …") until `HABIT_RANKS` gains the three slugs, and community badges raise until a new branch maps `community → frame/community` + rank. `SKILL.md:216` says only "extend the family-to-frame and rank mapping in `resolve_assets()`" — one sentence naming the two dictionaries and the bronze-for-repeatables target (per `SKILL.md:111`) removes the guesswork.
6. **Test does not assert the seeded names/descriptions.**
   `tests/api/achievement-catalog-expansion.test.ts:107–110` checks `name`/`description` non-empty only. Spec scenarios require exact names and descriptions: `specs/achievement-catalog-expansion/spec.md:10,14,21,42,48` ("named 'Weekend Warrior'", "its description states that a walk is logged on both Saturday and Sunday…"). Failing case: a typo'd name or a truncated description ships green because every seeded string passes the `length > 0` assertion. Add name equality plus one substring per description.
7. **0144-joint ordering claim is asserted by naming, never executed.**
   `migrations/0145_seed_catalog_expansion.sql:8` and `proposal.md:28` promise safety before/after `0144_seed_journey_badges.sql`; that file exists in neither this worktree nor the main repo yet (planned at `profile-badge-display/tasks.md:20`). The spec scenario "Migration runs before the nine-badge seed" (`spec.md:70–75`) is therefore untested: `tests/api/achievement-catalog-expansion.test.ts:48–51` applies only 0142 + 0145, and the 0144-disjointness assertion is via constants (`:88–95`), not via applying the parent seed. When 0144 lands, extend the test to 0142 + 0144 + 0145-twice with an asserted row total (14); today the silent-`INSERT OR IGNORE` semantics mean a future slug collision between 0144 and 0145 would drop rows with no failing test.
8. **`node:sqlite` floor mismatch.**
   `tests/api/achievement-catalog-expansion.test.ts:1` imports `node:sqlite`, available without `--experimental-sqlite` only from Node ≥ 22.13. `package.json:6` allows `>=22.0.0` (22.5–22.12 would throw "No such built-in module"). All five workflow files pin `NODE_VERSION: '22'` (latest patch, currently fine — verified `.github/workflows/*.yml:11,13`), and local Node is 24.18. Raise `engines.node` to `>=22.13.0` (or comment the constraint in the test).
9. **Document the unknown-`criteria` skip for the existing progress hook.**
   `profile-badge-display/design.md:141–148` has `checkAndAwardJourneyBadges` loading "journey/habit definitions" and awarding per-slug conditions. After 0145, three new `habit` rows enter that pool with `criteria` the hook does not evaluate. Nothing in this change or the skill states the defensive rule: hooks must skip definitions whose `criteria` they do not recognize. Failing case: the parent hook ships, defaults unknown habit criteria to award-on-progress, and `habit-weekend-warrior` is awarded on any walk. One line in `achievement-catalog-expansion/design.md` (Ownership section, `design.md:74–85`) closes it; the SKILL's "art only" rule (`SKILL.md:56`) covers the reverse direction only.

### NICE

10. `reports/badge-art/selections.md:8–27` — every pick is still "Pending" although the composite-review consumed the recommended picks and the F1v2 set shipped. Stale relative to the skill's review-gate record (`SKILL.md:192`). Reconcile (record applied picks, or annotate that the file is superseded).
11. **No written decision record for F1v2 (colour + cut boss).** `reports/badge-art/composite-review.md` mentions the second axis only as optional ("Nice #10"); the skill cites that file as the standing decision (`SKILL.md:24`) and then encodes F1v2 as fixed (`SKILL.md:114`, `style-reference.md:108–147`). Provenance is code (`composite_badges.py:157–176`, `BOSS_V2`) plus the proof sheet. Append a short F1v2 adoption note to `composite-review.md` so the "do not reopen" pointer covers boss v2.
12. 70 px boss at 200 px is 13.67 px; three texts say ~13.8 (`SKILL.md:347`, `style-reference.md:122`). Trivial rounding harmonisation.
13. `SKILL.md:125` doesn't state the `prompts.json` `rank` value for repeatable badges; the only precedent is `"rank": "thresholds"` (`prompts.json:194`). State it, since validation only requires presence (`generate.py:79–80`).
14. Wording drift on rank-master fitting: `SKILL.md:170` says "fit to 880", the script fits the **short** axis (`process_candidates.py:180`, `fit_shortest`); `checklist.md:49` already says "short axis 880". Align the skill sentence.
15. Spec scenario "Migration changes no schema" (`spec.md:77–80`) is asserted by inspection only; the test could diff `sqlite_master` between a 0142-only DB and a 0142+0145(+repeat) DB. Cheap, optional.

---

## What was verified (passes)

- **Script/paths/flags:** all commands in `SKILL.md` exist and behave as described — `generate.py --list/--dry-run/--only/--force` (`generate.py:362–364`), `process_candidates.py --only` + short-axis rank fit + r440/r400 core cuts (`process_candidates.py:40,46,180`), `contact_sheets.py --only` (4 cols × 320 px tiles, processed→candidates fallback), `make_report.py --render` (shortlist.md, review.html, finalists/ webps, append-only `selections.md` per `make_report.py:418`), `composite_badges.py --proof f1v2 --only` (choices at `composite_badges.py:2073`). System python has Pillow so the plain `python3` invocations are valid.
- **Geometry/palette sync skill↔script:** emblem 800 / frame 1016–880 / boss (511,979) 70/54/25 with `BOSS` radii 35/27/12.5 (`composite_badges.py:134`); all four `BOSS_V2` palettes, cuts, mithril halo `#4f9fbd` 4 px α82 (`composite_badges.py:157–174`) match the skill tables to the hex. F1v2 is circle-only in code (`composite_badges.py:1129–1131`), as the skill states; the script's `circle-f1v2/` outputs and `rank-boss-v2.jpg` exist on disk.
- **Transparent-moat treatment:** correctly encoded at `SKILL.md:86`, template-contract item 3 (`SKILL.md:211`), checklist §7/§12, stop condition; the skill is right that proofs flatten to `#14181f` (`composite_badges.py:2162`, `save_image` converts RGB at `composite_badges.py:1211–1217`) and that no RGBA production path exists in the script.
- **PhotoCraft 8.6 dependency:** template absent → skill's stop is the correct state today (`SKILL.md:207`, `checklist.md:155`); `photocraft-cli` is on `PATH`.
- **Family-frame coverage:** all six `raw_assets/badges/processed/frame/<family>/` dirs exist, so the Step-2 mapping is exercisable; journey/habit are set-tested, the other four are honestly marked provisional (`style-reference.md:94`).
- **Seeds/candidate counts:** emblem seeds are exactly the six listed (`prompts.json:6–13`), frame/rank are the first four; 12/8 counts (`generate.py` default seeds) match Step 5 and checklist §3. The watercolour guard is real (`generate.py:60–62`). Resumability via `raw_assets` completion marker is real (`generate.py:243–252`).
- **512/200 export:** `resize-webp.js` flags/semantics match Step 10 exactly — `--targetKB 0` skips the loop (line 70), min quality 20, steps of 5, `--quality 90/80` honoured; alpha preserved.
- **Skill coherence with the F1 decision:** no rank ring and no hexagon silhouette anywhere in the skill or checklist; hexagons appear only as the parked decision and the gold boss cut (accurately disambiguated); the rank-ring prompt block is explicitly legacy (`prompt-patterns.md:107–121`). The reviewed F1v2 geometry/composites referenced by the skill all exist on disk.
- **Migration:** data-only; explicit column list, no IDs, valid JSON in all five literals (parsed programmatically); idempotent by unique index 0142 (`0142:20`); stable per design/spec for ranks, thresholds `[1,4,12,26]`/`[1,3,6,12]`, collection 1–2/2, `unit`, `storyline: null`, `image_slug = slug`. Test really executes the SQL (`DatabaseSync(':memory:')` + `db.exec` of 0142/0145 twice) and asserts count/uniqueness/type split/repeatable flags/thresholds/criteria/units/collection, plus namespace separation (rows must equal the constant, the constant must avoid `journey|book|challenge|field-guide|campaign-`).
- **Ownership:** no other open change claims `community-fellowship-*` or the three habit slugs (grepped all `openspec/changes/`); `campaign-*` stays with `community-campaigns` (design.md:83–85); awards/artwork are consistently marked follow-ups (`proposal.md:10,27`, `tasks.md:15–23`, spec inert-data scenario). `docs/data-models.md:104` documents `criteria`/`unit` correctly.

## Not checked

Did not run any generation, compositing, or test command (read-only review); did not verify the rembg/onnxruntime models inside the ComfyUI venv, the actual 0144 content (does not exist yet), D1 vs node:sqlite JSON edge semantics beyond quoting, or the full `main()` tail of `composite_badges.py` beyond the proof/`--only` paths read.
