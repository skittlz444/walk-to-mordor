## 1. Shared Summary Metadata

- [ ] 1.1 Add `metadata: string | null` to `AchievementSummary` in `src/achievement-utils.ts`, select `ad.metadata` in `getUserAchievementSummary`, and map it in `toSummary`.
- [ ] 1.2 Extend the existing `getUserAchievementSummary` tests: metadata is returned verbatim, null stays null, and grouping/count behaviour is unchanged.

## 2. Presentation Resolution

- [ ] 2.1 Create `src/badge-presentation.ts` with `parseBadgeMetadata(raw)`, `resolveBadgeRank(metadata, earnedCount)`, and `resolveBadgePresentation(metadata, earnedCount)` returning `{ rank, rank_label, storyline, collection }`. Accept fixed `rank` 1–4 or `rank_thresholds` (four ascending counts); default to rank 1. Accept an optional `collection` object with `slug`, `label`, `index`, `size`. Treat null, invalid JSON, wrong types, and out-of-range values as absent.
- [ ] 2.2 Add Jest coverage for `src/badge-presentation.ts`: fixed rank, threshold boundaries (below first, exact match, between, above last), default/malformed metadata, valid and invalid collections, and storyline passthrough.

## 3. Achievements API

- [ ] 3.1 Create `src/achievement-handlers.ts` with `handleGetAchievements(request, db, currentUserId)`. Parse the optional `userId` query parameter (positive integer or 400). Self or absent resolves to `currentUserId`. Otherwise verify an accepted friendship in either direction via `friendships`; missing returns 404. Call `getUserAchievementSummary(db, targetUserId)` and return `{ achievements: [...] }` with each entry mapped through `resolveBadgePresentation`.
- [ ] 3.2 Wire `app.get('/api/achievements', authGuard, (c) => handleGetAchievements(c.req.raw, c.get('db'), c.get('userId')!))` beside `/api/total-distance` in `src/index.ts`. Do not add a method registry entry; 405s come from `app.routes`.
- [ ] 3.3 Add `tests/api/achievement-handlers.test.ts`: own summary with data, empty summary, 401, friend allowed, non-friend 404, unknown user 404, self query, invalid `userId` 400, newest-first ordering, and presentation mapping.
- [ ] 3.4 Add `tests/api/achievement-routes.test.ts` modeled on `tests/api/push-routes.test.ts`: `app.request` dispatches to the handler with the guard-provided user id, and `POST /api/achievements` returns 405 with an `Allow` header.

## 4. Seed Catalog

- [ ] 4.1 Add `migrations/0144_seed_journey_badges.sql` using `INSERT OR IGNORE` into `achievement_definitions`. Seed `habit-first-steps` (rank 1), `habit-faithful-walker` (repeatable, `rank_thresholds` `[1,4,12,26]`), and seven `journey-frodo-sam-*` badges with `badge_type='journey'`, `storyline='frodo-sam'`, fixed ranks 1,1,2,2,3,3,4, thresholds 112.65, 387.85, 1284.25, 1375.98, 2106.63, 2863.01, 6422.49 km, and collection `frodo-sam-journey` ("The Road to Mordor") positions 1–7 of 7. Set `image_slug` equal to `slug`.
- [ ] 4.2 Add a Jest migration test that applies the seed twice and asserts nine definitions, unique slugs, collection positions 1–7, storyline values, fixed ranks, and the repeatable threshold array.

## 5. Award Hook

- [ ] 5.1 Create `src/achievement-awards.ts` with `checkAndAwardJourneyBadges(db, userId)`. Resolve the active storyline and displayed distance once, load journey/habit definitions, parse metadata defensively, skip definitions whose `storyline` is set and differs from the active slug, and award qualifying badges through `awardAchievement`. Conditions: any progress row for `habit-first-steps`; `threshold_km <= displayedDistance` for journey badges; seven distinct walk dates within the trailing seven-day window for `habit-faithful-walker`, keyed by window end date. Wrap every award so one failure cannot abort the rest.
- [ ] 5.2 Call the hook from `handleProgressPost` and `handleProgressPut` after the write succeeds, before returning. Catch and log all errors so the progress response is never changed by an award failure. Do not hook delete paths.
- [ ] 5.3 Add `tests/api/achievement-awards.test.ts`: threshold crossing, already-earned no-op, other-storyline skip, global habit applies on any storyline, 7-day window award and same-window repeat suppression, multi-threshold backfill in one call, missing definition isolation, and thrown-error isolation.

## 6. Badge Display Island

- [ ] 6.1 Create `client/src/islands/BadgeDisplayIsland.tsx`. Detect `/profile` versus `/friends/<id>` from `window.location.pathname`; fetch `/api/achievements` or `/api/achievements?userId=<id>` with `getAuthHeaders` from `client/src/utils/auth.ts`. Manage loading, data, and error states. On 401 render nothing; on 404 or other failure log and render nothing.
- [ ] 6.2 Render grouped sections: one per collection containing at least one earned badge, ordered by `collection.index` and headed `label · earned/size`; remaining badges in a trailing section in API order. Show a delayed hexagonal skeleton state while loading, and render nothing when the summary is empty.
- [ ] 6.3 Render each card with the composited image, name, rank label, collection position, and a repeat-count chip when `earned_count > 1`. Validate `image_slug` against `^[a-z0-9-]+(/[a-z0-9-]+)*$` before building `/img/achievements/<slug>.webp`; hide the image on load error and show a CSS placeholder when the slug is null or invalid. Provide accessible names for rank, collection position, and repeat count.
- [ ] 6.4 Register `BadgeDisplayIsland` in `client/src/index.tsx` in both `autoHydratedIslands` and `allIslands`, following alphabetical placement.
- [ ] 6.5 Add `client/src/islands/BadgeDisplayIsland.test.tsx` with Vitest: profile and friend modes, collection grouping and ordering, `index/size` header text, rank label, repeat count, delayed skeletons, empty summary, error handling, null/invalid slug placeholder, image error fallback, and accessible labels.

## 7. SSR Shell and Styles

- [ ] 7.1 Add `<div data-island="BadgeDisplayIsland"></div>` to `src/renderProfilePage.ts` inside the `profile-islands` container, after the existing islands, and add `/css/badge-display.css` to its stylesheet list.
- [ ] 7.2 Add `<div data-island="BadgeDisplayIsland"></div>` to `src/renderFriendProfilePage.ts` below `FriendProfileIsland` and add `/css/badge-display.css` to its stylesheet list.
- [ ] 7.3 Create `public/css/badge-display.css`: responsive grid (`repeat(auto-fill, minmax(96px, 1fr))`), collection section headers and progress text, card sizing and image containment, rank and repeat chips, hexagon skeleton shimmer, and the CSS placeholder. Use design-guide variables only; no hardcoded colors.
- [ ] 7.4 Extend the page-renderer tests to assert the island placeholder and stylesheet appear on both pages, and that existing islands are unchanged.

## 8. Badge Artwork Pipeline

- [ ] 8.1 Author `scripts/badge-art/prompts.json`: nine emblem prompts (one per seeded badge, non-watercolour collectible-medallion style, centered, no text, no scene, no characters, dark field, single motif) plus six family-frame prompts (`journey`, `habit`, `challenge`, `book`, `community`, `field-guide`) and four rank-ring prompts (`bronze`, `silver`, `gold`, `mithril`). Each asset gets two prompt variants.
- [ ] 8.2 Add `scripts/badge-art/generate.py`, adapted from `comfyui/user/flux3-klein-tests/run_matrix.py`. Use FLUX.3 Klein with no LoRA, 1024×1024, 16 steps, cfg 1.0, `er_sde`/`simple`, and write to `comfyui/output/badges/<asset>/<variant>-<seed>.png`. Support `--only`, `--variants`, and `--seeds`.
- [ ] 8.3 Generate a broad candidate pool per asset: twelve candidates per emblem (two prompt variants × six seeds) and eight per frame or rank ring (two variants × four seeds). Keep the seed count configurable so a weak asset can be expanded without rerunning the whole set. Log every run (asset, variant, seed, file, wall time) to `reports/badge-art/candidates.jsonl`, and cut out frame/ring candidates with BiRefNet to transparent PNG.
- [ ] 8.4 Build a per-asset contact sheet under `reports/badge-art/sheets/` showing every candidate labelled with its variant and seed, then narrow each asset to the best two and copy them to `raw_assets/badges/shortlist/`. Record scores and reasoning in `reports/badge-art/shortlist.md`.
- [ ] 8.5 **Review gate:** present the two shortlisted candidates per asset alongside its contact sheet, and wait for the user's final pick. Record selections in `reports/badge-art/selections.md`. Do not composite before sign-off.
- [ ] 8.6 Build the PhotoCraft template `raw_assets/badges/badge-template.pcraft`: 1024×1024 transparent canvas, `base` smart object plus `frame` and `rank` smart objects on shared geometry. Drive it headless with `photocraft-cli mcp --automation-read-root … --automation-write-root …`, replacing smart objects per badge and exporting WebP with alpha.
- [ ] 8.7 Composite the nine selected badges into `raw_assets/badges/final/`, then optimize to `public/img/achievements/<slug>.webp` at 512 px (`--targetKB 0`) and `<slug>-thumb.webp` at 200 px using `resize-webp.js`.
- [ ] 8.8 Verify each committed asset: 512×512 and 200×200, alpha preserved, main image under ~120 KB, thumb under 20 KB, no text baked into art. Commit only `public/img/achievements/`; `raw_assets/` stays gitignored.

## 9. Validation and Documentation

- [ ] 9.1 Run `npm test` and fix regressions in the shared summary, presentation, handler, seed, award hook, and page renderers.
- [ ] 9.2 Run `npm run test:client` and fix regressions in the new island and registration.
- [ ] 9.3 Run `npm run check` and resolve TypeScript or Wrangler dry-run issues.
- [ ] 9.4 Update `docs/api-reference.md` with `GET /api/achievements`, the `userId` parameter, the `{ achievements: [...] }` envelope, the `presentation` block, and 400/401/404 behaviour.
- [ ] 9.5 Update `docs/data-models.md` with the `metadata` conventions (`storyline`, `rank`, `rank_thresholds`, `collection`) and the rule that display metadata is optional and defensively parsed.
- [ ] 9.6 Update `docs/design-guide.md` with the badge card anatomy, rank palette, collection header pattern, and the rule that rank/collection numbers are text, not artwork.
- [ ] 9.7 Run `openspec validate profile-badge-display` and resolve any spec-format errors.
