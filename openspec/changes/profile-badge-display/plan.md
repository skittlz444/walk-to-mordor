# Repo Assessment & Next-Step Plan

> **Note:** This is an implementation/assessment plan companion for the `profile-badge-display` change — not a core OpenSpec artifact (those are `proposal.md`, `design.md`, `specs/`, `tasks.md`). Saved here so future sessions can find it alongside the change it implements. Generated 2026-10-08.

## Problem
Walk-to-Mordor has been idle on feature work; 11 OpenSpec change proposals sit unimplemented. Repo needs a state assessment, housekeeping, and a chosen next feature stream.

## Current State (verified Oct 2026)

**Health**
- Working tree clean; branch `agents/idea-sorting-and-repo-cleanup` synced to main (34ae53d).
- Unit tests: **1378/1378 pass** (49 suites, ~16s). Coverage ~88.6% statements.
- Lint: clean (0 errors; 16 informational legacy-JS warnings, expected).
- **`tsc` broken on main**: 4 errors — `RESEND_API_KEY` missing from generated `Env` type (`worker-configuration.d.ts`), so `npm run check` fails. Cause: email feature uses a Worker secret not declared in `wrangler.json`/generated types. Small fix.

**Unimplemented OpenSpec changes (all tasks at 0%)**
| Stream | Changes | Task counts | Depends on |
|---|---|---|---|
| Storyline books | core → ui → admin | 44 / 23 / 13 | archived shared-achievement infra (done) |
| Personal challenges | core → admin | 42 / 17 | shared-achievement infra (done) |
| Community campaigns | core → admin → notifications | 40 / 17 / 11 | personal-challenges |
| Field Guide collectibles | core → admin | 22 / 19 | shared-achievement infra (done) |
| Profile badge display | single | 15 | shared-achievement infra (done) — fully standalone |

Note: `2026-06-10-storyline-books-and-achievements` and `2026-06-10-events-and-challenges` were archived without implementation; their scopes live on in the open changes above.

**Housekeeping candidates**
- Unmerged remote branch `copilot/add-colour-grouping-feature` (one `Initial plan` commit — likely plan-only junk).
- Unmerged dependabot branch `vitest/coverage-v8-5.0.0` (likely superseded by lockfile updates; verify then delete via GitHub UI/gh).
- Recurring **failing dependabot workflow runs** on main (`http-cache-semantics`/`undici` group update fails on a schedule) — investigate or ignore.
- Stale merged remote branches (`chore/opsx-prompts-to-skills`, `copilot/fix-calendar-*`, `feature/shared-achievement-infrastructure`) — merged; can be deleted.

## Recommended Approach
1. **Fix `tsc` / `npm run check`** — add `RESEND_API_KEY?: string` Env augmentation so `src/auth-handlers.ts` / `src/index.ts` typecheck. Small, unblocks CI-style checks.
2. **Housekeeping** — delete merged/stale remote branches; verify dependabot branches before removal.
3. **Feature: `profile-badge-display`** (user-selected) — display layer for the already-shipped shared achievement infra. Full detail below.

## profile-badge-display — Detailed Plan

### How badges work today (what we build on)
- **Data exists, UI doesn't.** Shared-achievement infra is implemented: `achievement_definitions` + `user_achievement_instances` D1 tables (migrations 0142/0143), `awardAchievement()` and `getUserAchievementSummary()` in `src/achievement-utils.ts`.
- **Where badges come from**: consuming features (storyline books, personal challenges, field guide) seed rows into `achievement_definitions` via migration and call `awardAchievement()` at the moment a user qualifies. **Today zero definitions are seeded and zero badges awarded** — this change is the surface those features will light up.
- **Badge shape**: slug, name, description, `image_slug`, `badge_type`, `is_repeatable`. Summary aggregates `earned_count` (never a mutable counter), ordered by most recently earned.

### Badge creation & design process (for when consumer features ship)
- **Artwork**: watercolour-style images generated in the existing goal-image pipeline pattern (per the `Goal-Image-Generation` skill process) — source in gitignored `raw_assets/`, optimized to `public/img/achievements/<image_slug>.webp` via `scripts/optimize-images.js` style pipeline.
- **Definitions**: each seeded via D1 migration (`INSERT INTO achievement_definitions`) with matching `image_slug`; slug format = lowercase/hyphens per repo convention.
- **Display**: hexagonal badge cards (CSS `clip-path` hexagons) — hex skeleton placeholders shimmer while loading, signaling "something unlockable lives here."

### Implementation steps (15 tasks, 4 groups)
1. **API endpoint** — new `src/achievement-handlers.ts` with `handleGetAchievements(request, db, userId?)`:
   - `GET /api/achievements` → own summary; `GET /api/achievements?userId=<id>` → friend's summary (verify accepted friendship via `friendships` table, else 403; unauthenticated 401).
   - Wire route near `/api/total-distance` (line ~312 of `src/index.ts`) + add to `getAllowedMethods`.
   - Jest: own with/without data, friend allowed/rejected, 401, method metadata.
2. **Preact island** — new `client/src/islands/BadgeDisplayIsland.tsx`:
   - Detects context from `window.location.pathname` (pattern proven by `FriendProfileIsland`): `/profile` → own; `/friends/:id` → extract id, friend fetch.
   - Hex skeleton placeholders (4–6 CSS hexagons, shimmer) while loading; badge grid on data: image, name, repeat-count overlay when `earned_count > 1`; renders nothing on empty or error.
   - **Image path correction**: design doc says `/images/achievements/`, but repo convention is `/img/...` (no `public/images/` exists) → use `/img/achievements/<image_slug>.webp` with graceful hide on load error. PNG fallback dropped (repo serves WebP only).
   - Register in `client/src/index.tsx` (`autoHydratedIslands` + `allIslands`).
3. **SSR + CSS** — add `<div data-island="BadgeDisplayIsland"></div>` to `renderProfilePage.ts` (below profile/push islands in `profile-islands` container) and `renderFriendProfilePage.ts` (below `FriendProfileIsland`); new `public/css/badge-display.css` (auto-fill grid `minmax(80px, 1fr)`, card sizing, overlay, hex skeleton + shimmer), referenced in both renderers' stylesheet arrays.
4. **Validation & docs** — Vitest island coverage (grid render, repeat overlay, skeletons, empty, error, friend-mode URL detection, broken-image hide); run `npm test`, `npm run test:client`, `npm run check`; update `docs/api-reference.md` with the endpoint spec.

## Initial Badge Catalog (seeded + auto-awarded)

Scope extension beyond the display-only change: seed an initial badge set and auto-award from existing behavior so the grid is live on day one. Extend the OpenSpec change's tasks.md with this group during implementation.

### Badge list (8 one-time, 1 repeatable)

| slug | badge_type | name | award condition | is_repeatable |
|---|---|---|---|---|
| `first-steps` | habit | First Steps from Bag End | first logged distance entry | 0 |
| `buckleberry-ferry` | journey | Across the Buckleberry Ferry | ≥ 112.65 km (70 mi) | 0 |
| `weathertop-survivor` | journey | Survivor of Weathertop | ≥ 387.85 km (241 mi) | 0 |
| `through-khazad-dum` | journey | Through Khazad-dûm | ≥ 1284.25 km (798 mi) | 0 |
| `lothlorien-guest` | journey | Guest of the Golden Wood | ≥ 1375.98 km (855 mi) | 0 |
| `rauros-parting` | journey | The Breaking of the Fellowship | ≥ 2106.63 km (1309 mi) | 0 |
| `mordor-threshold` | journey | Standing at Mount Doom | ≥ 2863.01 km (1779 mi) | 0 |
| `home-at-sunset` | journey | Home Again at Sunset | ≥ 6422.49 km (3991 mi — Sam returns to Bag End, the story's true end) | 0 |
| `faithful-walker` | habit | Faithful Walker | 7 days with logged distance in a 7-day window | 1 (per window) |

Distances match `migrations/0003_init_goals.sql` exactly: miles × 1.60934 (Buckleberry Ferry 70 mi, Weathertop 241 mi, Gates of Khazad-dûm 798 mi, Lothlórien 855 mi, Parth Galen/Rauros 1309 mi, Mount Doom 1779 mi, Sam home 3991 mi). No Grey Havens badge — Grey Havens is not the end of the story; the final badge is Sam's return home (3991 mi, "Closing Credits").

Award hook: `checkAndAwardJourneyBadges(db, userId, totalKm)` in `src/achievement-utils.ts`, called from `handleProgressPost`/`handleProgressPut` (`src/progress-handlers.ts`) after a successful log; idempotent via `awardAchievement` instance logic. `faithful-walker` derived from existing progress entries (date-windowed count). Backfill: on first log after deploy each user earns all qualifying journey badges at once (no separate backfill migration needed — recompute-on-log covers it; note: users who never log again see nothing, acceptable for one-time habit).

Seed via `migrations/0XXX_seed_initial_badges.sql` — `INSERT INTO achievement_definitions` with slugs above + `image_slug` = same slug.

### Badge image prompts (watercolour, per Goal-Image-Generation skill style)

Generate at 1024×1024 → optimize into `public/img/achievements/<slug>.webp` (512×512, quality ~75 via `.github/skills/goal-image-generation/resources/resize-webp.js`) + `<slug>-thumb.webp` (200px, <20KB). No highres needed for 80px cards. Prompts follow the skill's structure (style prefix → scene → atmosphere → small figures → technical suffix); each <200 words, validated sub-agent pass as in the skill.

1. **first-steps** — Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe — a round green door set into a hobbit-hole bank, early morning golden light, dew on the hillside pathway leading east, a tiny cloaked figure with a walking stick and laden pack standing at the door taking a first step, distant misty hills, hopeful warm palette. High detail, museum quality, square format, no text, no watermarks, no borders.
2. **buckleberry-ferry** — …a small wooden ferry on a slow brown river at dusk, tiny hobbit figures poling across, warm lantern light on the water, reeds and willows on the far bank, cool twilight sky…
3. **weathertop-survivor** — …ruined summit ring of stone under a bruised purple night sky, five small cloaked figures huddled near embers of a fire, distant unseen threats below, cold wind and scattered clouds, deep blue/umber palette…
4. **through-khazad-dum** — …vast darkened dwarven pillared hall receding into blackness, a single hooded-lantern figure casting weak golden glow on carved stone, immense scale dwarfing tiny figures crossing a broken stair, gloom and echoing depth…
5. **lothlorien-guest** — …golden mallorn trees with silver trunks ascending into a soft golden haze, elven flet platform high among the branches, tiny figures climbing a pale ladder, filtered warm light, dreamlike serenity, gold and pale-green palette…
6. **rauros-parting** — …the great falls of Rauros roaring below a steep grassy hill, a small boat carrying three figures at the water's edge, two figures grieving on the shore at dawn, mist rising from the falls, cold light and loss…
7. **mordor-threshold** — …a jagged volcanic ridge overlooking a vast ash plain, sulphurous haze, a lone glowing fissure atop a distant mountain spilling dull red light, two tiny exhausted figures on the barren slopes, oppressive dark palette with a single ember accent…
8. **home-at-sunset** — …the round green door of Bag End seen from the garden path at golden sunset, a small weary figure with a pack walking up the hill toward home, long warm shadows across the tilled earth, roses on the trellis, gentle sorrow and peace, warm gold and soft green palette — the journey closes where it began…
9. **faithful-walker** (repeatable) — …a well-worn footpath through rolling green country, seven milestone stones spaced along the way, a small hooded figure walking steadily under a changing sky from dawn to dusk, quiet endurance, green and slate palette…

(Prompts 2–9 in full form during implementation, per the skill's sub-agent research/build/validate flow.)

### Changed tasks groups (add to change's tasks.md during implementation)
- **5. Badge catalog seeding** — migration with 9 definitions; Jest for seed idempotency.
- **6. Auto-award hook** — `checkAndAwardJourneyBadges` + progress-handler wiring + Jest (threshold crossing, idempotent repeat awards, faithful-walker window).
- **7. Badge image pipeline** — 9 images via skill process into `public/img/achievements/`.
- Follow `openspec-apply-change` skill; >90% coverage on new code.
- Next candidates after completion remain: storyline-books-core, personal-challenges, field-guide core.

## Todos
Tracked in the session SQL database (ids: `fix-tsc-env`, `tidy-branches`, `seed-badge-definitions`, `build-award-hook`, `generate-badge-images`, `implement-badge-island`).

## Notes
- Implementation follows OpenSpec skill workflow (`openspec-apply-change`) for whichever change is chosen.
- Health fix is tiny and independent of feature choice; do it regardless.
- No code changes made during assessment (plan mode).
