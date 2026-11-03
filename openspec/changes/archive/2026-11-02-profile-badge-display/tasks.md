## 1. Shared Summary Metadata

- [x] 1.1 Add `metadata: string | null` to `AchievementSummary` in `src/achievement-utils.ts`, select `ad.metadata` in `getUserAchievementSummary`, and map it in `toSummary`.
- [x] 1.2 Extend the existing `getUserAchievementSummary` tests: metadata is returned verbatim, null stays null, and grouping/count behaviour is unchanged.

## 2. Presentation Resolution

- [x] 2.1 Create `src/badge-presentation.ts` with `parseBadgeMetadata(raw)`, `resolveBadgeRank(metadata, earnedCount)`, and `resolveBadgePresentation(metadata, earnedCount)` returning `{ rank, rank_label, storyline, collection }`. Accept fixed `rank` 1–4 or `rank_thresholds` (four ascending counts); default to rank 1. Accept an optional `collection` object with `slug`, `label`, `index`, `size`. Treat null, invalid JSON, wrong types, and out-of-range values as absent.
- [x] 2.2 Add Jest coverage for `src/badge-presentation.ts`: fixed rank, threshold boundaries (below first, exact match, between, above last), default/malformed metadata, valid and invalid collections, and storyline passthrough.

## 3. Achievements API

- [x] 3.1 Create `src/achievement-handlers.ts` with `handleGetAchievements(request, db, currentUserId)`. Parse the optional `userId` query parameter (positive integer or 400). Self or absent resolves to `currentUserId`. Otherwise verify an accepted friendship in either direction via `friendships`; missing returns 404. Call `getUserAchievementSummary(db, targetUserId)` and return `{ achievements: [...] }` with each entry mapped through `resolveBadgePresentation`.
- [x] 3.2 Wire `app.get('/api/achievements', authGuard, (c) => handleGetAchievements(c.req.raw, c.get('db'), c.get('userId')!))` beside `/api/total-distance` in `src/index.ts`. Do not add a method registry entry; 405s come from `app.routes`.
- [x] 3.3 Add `tests/api/achievement-handlers.test.ts`: own summary with data, empty summary, 401, friend allowed, non-friend 404, unknown user 404, self query, invalid `userId` 400, newest-first ordering, and presentation mapping.
- [x] 3.4 Add `tests/api/achievement-routes.test.ts` modeled on `tests/api/push-routes.test.ts`: `app.request` dispatches to the handler with the guard-provided user id, and `POST /api/achievements` returns 405 with an `Allow` header.

## 4. Seed Catalog

- [x] 4.1 Add `migrations/0144_seed_journey_badges.sql` using `INSERT OR IGNORE` into `achievement_definitions`. Seed `habit-first-steps` (rank 1), `habit-faithful-walker` (repeatable, `rank_thresholds` `[1,4,12,26]`), and eight `journey-frodo-sam-*` badges with `badge_type='journey'`, `storyline='frodo-sam'`, fixed ranks 1,1,2,2,3,3,4,4, thresholds 112.65, 387.85, 1284.25, 1375.98, 2106.63, 2863.01, 3827.0, 6422.49 km, and collection `frodo-sam-journey` ("The Road to Mordor") positions 1–8 of 8. Set `image_slug` equal to `slug`.
- [x] 4.2 Add a Jest migration test that applies `0142`, `0144`, `0145`, and `0146` twice and asserts fifteen definitions (ten from 0144 plus five from 0145), unique slugs, collection positions 1–8, storyline values, fixed ranks, thresholds (including 3827.0), the five 0145 rows, and the repeatable threshold array.

## 5. Award Hook

- [x] 5.1 Create `src/achievement-awards.ts` with `checkAndAwardJourneyBadges(db, userId, loggedDate)`. Resolve the active storyline and displayed distance once, load journey/habit definitions, parse metadata defensively, skip definitions whose `storyline` is set and differs from the active slug, and award qualifying badges through `awardAchievement`. Conditions: any progress row for `habit-first-steps`; `threshold_km <= displayedDistance` for journey badges, including `journey-frodo-sam-glittering-caves` at 3827.0 km; for `habit-faithful-walker`, award only when `loggedDate` is a Sunday and all seven dates of that Monday–Sunday week have progress rows, keyed to the Sunday date. Wrap every award so one failure cannot abort the rest.
- [x] 5.2 Call the hook from `handleProgressPost` and `handleProgressPut` after the write succeeds, before returning, passing the logged `start` date. Catch and log all errors so the progress response is never changed by an award failure. Do not hook delete paths.
- [x] 5.3 Add `tests/api/achievement-awards.test.ts`: threshold crossing, already-earned no-op, other-storyline skip, global habit applies on any storyline, Sunday award, non-Sunday suppression, incomplete-week suppression, same-week repeat suppression, multi-threshold backfill in one call, missing definition isolation, and thrown-error isolation.

## 6. Badge Display Island

- [x] 6.1 Create `client/src/islands/BadgeDisplayIsland.tsx`. Detect `/profile` versus `/friends/<id>` from `window.location.pathname`; fetch `/api/achievements` or `/api/achievements?userId=<id>` with `getAuthHeaders` from `client/src/utils/auth.ts`. Manage loading, data, and error states. On 401 render nothing; on 404 or other failure log and render nothing.
- [x] 6.2 Render grouped sections: one per collection containing at least one earned badge, ordered by `collection.index` and headed `label · earned/size`; remaining badges in a trailing section in API order. Show a delayed circular skeleton state while loading, and render nothing when the summary is empty.
- [x] 6.3 Render each card with the composited image, name, rank label, collection position, and a repeat-count chip when `earned_count > 1`. Validate `image_slug` against `^[a-z0-9-]+(/[a-z0-9-]+)*$`, then build `<name>` as `<image_slug>--<rank_label>` for repeatables and `<image_slug>` otherwise. Use `/img/achievements/<name>.webp` for the card and retry `/img/achievements/<image_slug>.webp` if the rank variant fails. Hide the image when the card and fallback fail; show a CSS placeholder when the slug is null or invalid. Provide accessible names for rank, collection position, and repeat count. The 1024 full image stays asset-only in this change.
- [x] 6.4 Register `BadgeDisplayIsland` in `client/src/index.tsx` in both `autoHydratedIslands` and `allIslands`, following alphabetical placement.
- [x] 6.5 Add `client/src/islands/BadgeDisplayIsland.test.tsx` with Vitest: profile and friend modes, collection grouping and ordering, `index/size` header text, rank label, repeat count, delayed skeletons, empty summary, error handling, null/invalid slug placeholder, image error fallback, and accessible labels.

## 7. SSR Shell and Styles

- [x] 7.1 Add `<div data-island="BadgeDisplayIsland"></div>` to `src/renderProfilePage.ts` inside the `profile-islands` container, after the existing islands, and add `/css/badge-display.css` to its stylesheet list.
- [x] 7.2 Add `<div data-island="BadgeDisplayIsland"></div>` to `src/renderFriendProfilePage.ts` below `FriendProfileIsland` and add `/css/badge-display.css` to its stylesheet list.
- [x] 7.3 Create `public/css/badge-display.css`: responsive grid (`repeat(auto-fill, minmax(96px, 1fr))`), collection section headers and progress text, card sizing and image containment, rank and repeat chips, circular skeleton shimmer, and the CSS placeholder. Use design-guide variables only; no hardcoded colors.
- [x] 7.4 Extend the page-renderer tests to assert the island placeholder and stylesheet appear on both pages, and that existing islands are unchanged.

## 8. Badge Artwork Pipeline

- [x] 8.1 Author `scripts/badge-art/prompts.json`: ten emblem prompts (one per seeded badge, non-watercolour collectible-medallion style, centered, no text, no scene, no characters, dark field, single motif) plus six family-frame prompts (`journey`, `habit`, `challenge`, `book`, `community`, `field-guide`) and four rank-ring prompts (`bronze`, `silver`, `gold`, `mithril`). Each asset gets two prompt variants.
- [x] 8.2 Add `scripts/badge-art/generate.py`, adapted from `comfyui/user/flux3-klein-tests/run_matrix.py`. Use FLUX.3 Klein with no LoRA, 1024×1024, 16 steps, cfg 1.0, `er_sde`/`simple`, and write to `comfyui/output/badges/<asset>/<variant>-<seed>.png`. Support `--only`, `--variants`, and `--seeds`.
- [x] 8.3 Generate a broad candidate pool per asset: twelve candidates per emblem (ten emblems × two prompt variants × six seeds = 120), eight per family frame (six frames × two variants × four seeds = 48), and eight per rank ring (four rings × two variants × four seeds = 32), for 200 candidates total. Keep the seed count configurable so a weak asset can be expanded without rerunning the whole set. Log every run (asset, variant, seed, file, wall time) to `reports/badge-art/candidates.jsonl`, and cut out frame/ring candidates with BiRefNet to transparent PNG.
- [x] 8.4 Build a per-asset contact sheet under `reports/badge-art/sheets/` showing every candidate labelled with its variant and seed, then narrow each asset to the best two and copy them to `raw_assets/badges/shortlist/`. Record scores and reasoning in `reports/badge-art/shortlist.md`.
- [x] 8.5 **Review gate:** present the two shortlisted candidates per asset alongside its contact sheet, and wait for the user's final pick. Record selections in `docs/badge-art-decisions.md`. Do not composite before sign-off.
- [x] 8.6 Composite the selected badges in PhotoCraft through its MCP automation: open the base, place the frame, emblem, 6 o'clock boss and contact shadow, then export a 1024 px PNG with alpha. The shared `.pcraft` template was superseded.
- [x] 8.7 Bake the selected rank bosses: fixed-rank badges carry the boss in the final composite; the four repeatable habit badges carry four rank variants. Write `public/img/achievements/<slug>.webp` at 512 px, `<slug>-thumb.webp` at 200 px, and `full/<slug>.webp` at 1024 px; repeatable variants use `<slug>--<rank_label>`.
- [x] 8.8 Verify each committed asset: 512×512, 200×200 and 1024×1024, alpha preserved, card under ~120 KB, thumb under 20 KB, full under ~500 KB, no text baked into art. Commit `public/img/achievements/` and the reusable `assets/badge-art/` layers; `raw_assets/` stays gitignored.
- [x] 8.9 Retain the six family-frame masters and the four rank-boss masters, tiles, and shadows under `assets/badge-art/`; record the machine-readable picks in `scripts/badge-art/final-selections.json`.

## 9. Validation and Documentation

- [x] 9.1 Run `npm test` and fix regressions in the shared summary, presentation, handler, seed, award hook, and page renderers.
- [x] 9.2 Run `npm run test:client` and fix regressions in the new island and registration.
- [x] 9.3 Run `npm run check` and resolve TypeScript or Wrangler dry-run issues.
- [x] 9.4 Update `docs/api-reference.md` with `GET /api/achievements`, the `userId` parameter, the `{ achievements: [...] }` envelope, the `presentation` block, and 400/401/404 behaviour.
- [x] 9.5 Update `docs/data-models.md` with the `metadata` conventions (`storyline`, `rank`, `rank_thresholds`, `collection`) and the rule that display metadata is optional and defensively parsed.
- [x] 9.6 Update `docs/design-guide.md` with the badge card anatomy, rank palette, collection header pattern, and the rule that rank/collection numbers are text, not artwork.
- [x] 9.7 Run `openspec validate profile-badge-display` and resolve any spec-format errors.
- [x] 9.8 Document the badge art pipeline in `docs/asset-workflow.md`: ComfyUI generation, PhotoCraft MCP and `rebuild_finals.py` compositing, 512/200/1024 outputs, and the retained `assets/badge-art/` layers.
