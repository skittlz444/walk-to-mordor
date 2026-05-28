---
name: storyline-add-or-update
description: "Use when adding, updating, auditing, or repairing a Walk to Mordor storyline, route path, storyline goals, goal order, book-accurate goal descriptions, image slugs, or missing-image prompts. Supersedes bmad-quick-dev for storyline work."
argument-hint: "Storyline name, route, branch, or goals to add/update/audit"
---

# Storyline Add Or Update

## Outcome

Produce or repair a complete book-accurate storyline plan and implementation for Walk to Mordor. This includes storyline metadata, path data, reused and new goals, correct goal order, distance placement, descriptions, image slugs, image prompts, migrations, docs, and focused tests.

This skill combines the recurring workflows for adding a storyline, auditing storyline goal order, and creating a map path dataset.

Use this skill instead of broad implementation workflows for storyline tasks. General coding skills do not include the route placement table, goal reuse audit, book-accuracy gates, image prompt planning, or storyline-specific validation needed here.

## When To Use

Use this skill when asked to:

- Add a new storyline, route, character path, or alternate journey.
- Update an existing storyline's goals, distances, sort order, path key, or visibility.
- Fix missing, duplicated, out-of-order, or book-inaccurate storyline goals.
- Create path data under `client/src/data/paths/` for a storyline.
- Prepare image slugs and image prompts for a storyline's goals.
- Validate whether a storyline follows Tolkien book chronology unless the user explicitly requests a non-book or adaptation-specific route.

Do not route storyline tasks through `bmad-quick-dev` unless the user explicitly asks for that agent. Start here, then use narrower skills such as `goal-description-update` or `goal-image-generation` for their sub-steps.

Do not use this skill for generating the final image files unless the user specifically asks to create assets now. This workflow creates the prompt and slug plan up front; final image generation and optimization can happen later via `goal-image-generation` and `npm run optimize:images`.

## Source Of Truth Order

Use this priority when sources disagree:

1. User's explicit instruction for intentional deviations.
2. Primary Tolkien book narrative and chronology.
3. Existing `frodo-sam` goal distances and milestone spacing as the baseline distance model.
4. Existing app schema and docs: `docs/data-models.md`, `docs/api-reference.md`, `docs/frontend-guide.md`, `docs/asset-workflow.md`.
5. Existing migrations and path data.

If accuracy is uncertain, mark the point as uncertain and ask for confirmation before encoding it into goals, descriptions, or prompts.

## Key Files

| Concern | Files |
|---|---|
| Storyline schema and invariants | `migrations/`, `docs/data-models.md` |
| Storyline APIs | `src/storyline-handlers.ts`, `src/storyline-utils.ts`, `src/goals-handlers.ts`, `src/party-handlers.ts`, `src/stats-handlers.ts` |
| Admin storyline UI | `client/src/islands/AdminStorylinesIsland.tsx`, `src/renderAdminStorylinesPage.ts`, `public/css/admin.css` |
| User and fellowship selectors | `client/src/islands/ProfileIsland.tsx`, `client/src/islands/PartyManageIsland.tsx`, `client/src/islands/PartyListIsland.tsx` |
| Map path data | `client/src/data/paths/`, `client/src/data/paths/registry.ts`, `client/src/utils/map-utils.ts` |
| Map rendering | `client/src/islands/MapIsland.tsx`, `client/src/components/map/JourneyPath.ts`, `client/src/components/map/MemberPaths.ts` |
| Goal descriptions | `.github/skills/goal-description-update/resources/goal-description-reference.md`, migration description updates |
| Image workflow | `.github/skills/goal-image-generation/SKILL.md`, `docs/asset-workflow.md`, `raw_assets/`, `public/img/` |

## Procedure

### 1. Define The Storyline Contract

Capture the route before editing code:

- Storyline slug, title, description, `path_key`, `sort_order`, `active`, and `admin_only` draft status.
- Main viewpoint or party, such as Pippin, Merry, Aragorn, or Frodo/Sam.
- Start and end narrative boundaries.
- Whether the route must be strictly book-accurate. Default to book-accurate.
- Whether it reuses the default `frodo-sam` path before the Breaking of the Fellowship.
- Whether any goals are intentionally non-canonical, compressed, omitted, or merged.
- Whether image slugs and prompts will be produced in this session or deferred.
- Whether the work requires separate schema, data, or follow-up publication migrations.

Set `admin_only = 1` in the data migration if any new or reused mapped goal has `image_id = NULL`, any descriptions are draft, path coordinates are estimated, prompts are deferred, or final verification is incomplete. Only set `admin_only = 0` in a separate follow-up migration after images exist in `public/img/`, descriptions and path data are production-ready, and the final checklist passes.

### 2. Research Book Chronology

Build a chronology before writing migrations or path data.

For each proposed milestone, record:

- Book, chapter, and approximate narrative sequence.
- Event title.
- Characters actually present.
- Location and travel direction.
- Relationship to the nearest existing `frodo-sam` milestone.
- Whether an existing goal can be reused exactly, reused with a storyline-specific distance, or needs a new goal.
- Description/image requirements.

Use subagents for research when the route has many milestones. Keep research bounded to the target storyline and require uncertainty notes rather than guesses.

Use subagents for narrative research, path verification, and batch description drafting. Do not use a subagent just to locate known local files; use targeted file or text search for migrations, path files, and registry entries.

Before selecting shared milestones, query the primary route through `storyline_goals`; do not filter by `goals.distance` alone. `goals.distance` is default goal metadata and does not prove membership in `frodo-sam`.

```sql
SELECT sg.sort_order, ROUND(sg.distance * 0.621371, 1) AS miles, g.id, g.title, g.special
FROM storyline_goals sg
JOIN storylines s ON s.id = sg.storyline_id
JOIN goals g ON g.id = sg.goal_id
WHERE s.slug = 'frodo-sam'
ORDER BY sg.sort_order, sg.distance;
```

Subagent prompt template:

```text
Research a Walk to Mordor storyline route for book-accurate goal placement.

STORYLINE:
- Slug/title: [STORYLINE]
- Viewpoint or party: [VIEWPOINT]
- Start boundary: [START]
- End boundary: [END]
- Accuracy rule: Tolkien book canon unless explicitly noted

TASK:
Create a chronological list of milestone candidates. For each candidate include:
1. Book and chapter.
2. Event title.
3. Characters present.
4. Location and direction of travel.
5. Previous and next event in this route.
6. Whether it likely reuses an existing Walk to Mordor goal.
7. Placement relative to the primary Frodo/Sam path, if comparable.
8. Notes on uncertainty or alternate interpretations.

Return only structured findings. Do not invent distances.
```

### 3. Classify Goal Reuse And Uniqueness

For every milestone, choose exactly one classification:

| Classification | Use When | Action |
|---|---|---|
| Reuse existing goal | The same event/location already exists and the description remains accurate for this route | Reference existing `goals.id` in `storyline_goals` with storyline-specific distance and sort order |
| Reuse content with caution | The title fits but description, image, or `special` flag may mention wrong characters, perspective, or route importance | Do not mutate shared fields in this storyline task; create a new route-specific goal if the shared row is not already valid |
| New route-specific goal | The event is unique to this route or needs different characters/perspective | Insert a new `goals` row and map it in `storyline_goals` |
| Exclude | The event belongs to another route, return journey, adaptation, or non-viewpoint branch | Do not map it; mention exclusion reason in planning notes |

Never reuse a goal if its description or image would make the wrong characters present. Prefer a new goal over corrupting shared goal content.

Never mutate `goals.description`, `goals.image_id`, or `goals.special` on a shared goal to fix a single storyline. Shared goal mutation silently changes every storyline that references that row.

### 4. Place Distances Against The Primary Path

Storyline distances are route-local display distances in miles converted to kilometers in migrations. They should feel consistent with the primary `frodo-sam` route.

Distance placement rules:

- Use existing `frodo-sam` distances for shared events before route divergence.
- At divergence, keep continuity from the shared path's last common milestone.
- For separate branches, estimate distances from canonical geography and the primary path's pacing.
- Preserve strict chronological order: `sort_order` and distance must both increase unless there is a documented special case.
- Do not include return-story milestones in an outbound route unless explicitly requested.
- Do not let reused goals drag their default distance into a route where the event occurs at a different route-local distance.
- Keep gaps between consecutive goals at or below roughly 70 km unless the user approves a sparse section.
- Keep major `special` milestones separated by roughly 100 km or more unless the book event density makes that impossible and the user approves.
- Confirm no mapped goal distance exceeds the final anchor distance of the path file.
- Confirm every migration goal distance either matches a named path anchor or falls between two ordered path anchors.
- Store SQL distances as miles times `1.60934` when writing migrations.

Create a placement table before migration edits:

| Sort | Miles | Goal | Reuse/New | Book Reference | Distance Rationale | Image Slug |
|---|---:|---|---|---|---|---|

### 5. Validate Goal Order Before Editing

Run a written audit against the placement table:

- Every milestone belongs to the selected viewpoint/party.
- Every milestone is in book order.
- Every milestone has a predecessor and successor that make narrative sense.
- Shared pre-divergence milestones align with the primary `frodo-sam` path.
- New branch milestones do not accidentally include another storyline's return route.
- Return-narrative goals, such as return journey story events, are not added to an outbound route unless requested.
- Return path coordinate segments may still be included when the map path needs a full journey loop; path coordinates and story goals serve different purposes.
- No duplicate event appears under two names unless intentionally distinct.
- Distances and `sort_order` are monotonic.
- Gaps are intentional and not missing major book events.
- Admin-only status is set if images, descriptions, or path data are incomplete.

If any check fails, fix the table before editing migrations.

### 6. Write Or Update Descriptions

Descriptions must be valid for the exact goal and every storyline that reuses it.

For each new or changed goal description:

- Use `.github/skills/goal-description-update/resources/goal-description-reference.md` for examples and book milestone context.
- Use 3-5 sentences.
- Use third-person limited perspective.
- Use British English spelling.
- Mention only characters present at that point in the book.
- Avoid generic journey filler.
- Do not start with unsupported pronouns like "They" before establishing the subject.

Use a subagent per description when creating many descriptions to avoid repetitive phrasing.

### 7. Plan Image Slugs And Prompts Up Front

Prepare image metadata while creating the storyline, even if asset generation will happen later.

For every new goal and every reused goal with no suitable image:

- Create a lowercase hyphenated slug matching `/^[a-z0-9]+(-[a-z0-9]+)*$/`.
- Ensure the slug is unique across `public/img/highres/`, `public/img/thumbs/`, and existing `goals.image_id` values.
- Draft an image prompt using the research, description, and neighboring milestones.
- Validate the prompt for character, geographic, temporal, mood, and anachronism accuracy.
- Store prompts in an implementation artifact or planning document if generation is not happening in the same task.

Image slugs and prompts are not optional for new storyline goals. If prompt drafting is deferred, set `admin_only = 1` and record the deferred prompt work in a planning artifact or migration comment before finishing.

Use the prompt-building and validation steps from `.github/skills/goal-image-generation/SKILL.md`, but stop before calling image generation unless requested.

Prompt constraints:

- Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper.
- Book-accurate terrain, time, weather, mood, and characters.
- Small figures in landscape, not portraits.
- No text, no watermarks, no borders.
- Avoid mentioning characters who are not present.

### 8. Implement The Storyline

Make the smallest coherent implementation slice.

Scope discipline: if you notice unrelated admin tooling, image inventory, or UI improvements while implementing a storyline, record them as follow-up observations. Do not implement them as part of this skill unless the user explicitly asks.

Typical edits:

1. Add or update a migration:
   - Confirm the latest migration number mechanically with a sorted directory listing before choosing `NNNN`.
   - `storylines` row.
   - `goals` rows for new milestones.
   - `storyline_goals` rows with storyline-specific distances and sort orders.
   - `image_id` values for slugs that are planned or already generated.
   - Follow `migrations/NNNN_descriptive_name.sql` numbering.
2. Add or update path data under `client/src/data/paths/`.
3. Register the `path_key` in `client/src/data/paths/registry.ts`.
4. Update map utilities only if the new path exposes a real missing abstraction.
5. Update admin/user/fellowship UI only if the storyline contract changes.
6. Update docs when schema, API, or workflow rules change.

Avoid rewriting legacy `public/js/` unless the storyline behavior is controlled there and no island path exists.

### 9. Implement Path Data

For a unique path:

- Before writing path data, search `client/src/` for hardcoded total-distance or fellowship-only path assumptions. Any total length used for visibility or marker placement must be computed from the active path, not a fixed fellowship constant.
- Create a named path file in `client/src/data/paths/` using the existing path style.
- Keep coordinates and waypoint order consistent with the story route.
- Reuse shared path segments where the route follows an existing path.
- Ensure unknown or incomplete `path_key` values still fall back safely to the fellowship path.
- Add or update path tests for registry lookup, fallback behavior, and route-specific coordinates.

For routes that share a prefix with `fellowshipPath` and then diverge, use the established branching pattern:

1. Declare named distance constants for splice anchors.
2. Copy shared fellowship nodes through the divergence point.
3. Add a route-specific branch array for unique coordinates.
4. Re-map any shared later path segment to the new route-local cumulative distance.
5. Compose the exported path from shared prefix, unique branch, and any shifted shared segment.

Ground invented branch coordinates against nearby named fellowship anchors so the visual scale stays consistent. Add tests for shared prefix equality, strictly increasing distances, key branch anchors, final path distance, and registry lookup.

### 10. Add Tests

Choose focused tests based on the touched slice:

| Change | Checks |
|---|---|
| Storyline migration/data | API or utility tests that confirm available storylines and mapped goals |
| Goal order repair | Test that returned goals are sorted and exclude wrong-route milestones |
| Admin-only visibility | Admin sees draft storyline; regular users do not |
| User/fellowship switching | Carry/reset offset behavior and permissions |
| Path dataset | `client/src/data/paths/*` tests and `client/src/utils/map-utils.test.ts` |
| Description/image slug updates | Migration review plus API/admin image inventory checks when applicable |

Prefer narrow commands first:

```bash
npm test -- tests/api/storyline-utils.test.ts tests/api/storyline-handlers.test.ts
npm run test:client -- client/src/data/paths/[path].test.ts client/src/utils/map-utils.test.ts
npm run build:client
npm run lint
```

Use `npm run seedLocalD1` when local D1 migration application is the cheapest way to validate SQL.

For Vitest files under `client/`, use `npm run test:client -- <path>`. Do not rely on the VS Code `runTests` tool for `client/` tests; it may only discover root Jest tests in this workspace.

### 11. Validate Assets Later When Generated

When the user asks to generate or add the image files later:

1. Use `.github/skills/goal-image-generation/SKILL.md` for actual generation.
2. Put raw source files in `raw_assets/`.
3. Run `npm run optimize:images` to create WebP high-res and thumbnail files and rebuild the image manifest.
4. Confirm `public/img/highres/[slug].webp`, `public/img/thumbs/[slug]-thumb.webp`, and `public/img/image-manifest.json` are updated.
5. Run `npm run check:assets` if many images were added.

Do not commit raw source files from `raw_assets/`.

## Final Verification Checklist

Before finishing a storyline task, confirm:

- The storyline is book-accurate or deviations are explicitly documented.
- Reused goals are semantically valid for the new route.
- New goals have book-accurate titles, descriptions, and image slugs.
- Goal order and route distances are monotonic and match the narrative.
- Consecutive goal gaps are at or below roughly 70 km unless explicitly approved.
- Shared goals were not mutated to fix route-specific description, image, or `special` issues.
- Path data and `path_key` registration agree.
- No mapped goal distance exceeds the path's final distance.
- Admin-only visibility protects incomplete or draft storylines.
- Tests cover ordering, visibility, switching, and path behavior as applicable.
- Docs are updated when API, schema, or workflow rules changed.
- Image prompts and slugs are ready. If they are deferred, `admin_only = 1` and the deferred work is documented.
