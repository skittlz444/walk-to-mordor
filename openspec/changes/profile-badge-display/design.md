## Context

Walk to Mordor's profile page (`/profile`) renders `ProfileIsland` and `PushPermissionIsland` Preact islands inside SSR shells from `renderProfilePage.ts`. The friend profile page (`/friends/:userId`) renders `FriendProfileIsland` inside an SSR shell from `renderFriendProfilePage.ts`. Both islands fetch their own data from authenticated API endpoints.

`src/index.ts` is a Hono app. Authenticated routes use `authGuard`, which validates the session once and sets `c.get('userId')`; API 405 responses are derived from `app.routes` in `app.notFound`, so no method registry needs editing when a route is added.

The `shared-achievement-infrastructure` change provides `getUserAchievementSummary(db, userId)`, which returns aggregated badge data as `AchievementSummary[]`. This change wires that data to the profile surfaces through a new endpoint and a new self-contained Preact island, seeds the first catalog, and awards those badges from walk logging.

The codebase uses auto-hydrated islands registered in `client/src/index.tsx` by name. SSR shells place `<div data-island="<IslandName>"></div>` placeholders that the island registry picks up at hydration time. Static assets are served from `public/` at the site root, so `public/img/achievements/x.webp` is reachable at `/img/achievements/x.webp`.

## Goals / Non-Goals

**Goals:**
- Add `GET /api/achievements` for the authenticated user, with an optional `?userId=` variant for accepted friends.
- Resolve badge presentation server-side: rank (1–4 + label), storyline scope, and collection position.
- Add a `BadgeDisplayIsland` that renders badges grouped by collection, with rank chrome, repeat counts, loading skeletons, and graceful image fallback.
- Add the island to the profile and friend-profile SSR shells with a dedicated stylesheet.
- Seed ten badge definitions and award them from progress writes, scoped to the user's active storyline.
- Produce and commit composited badge artwork from a reproducible ComfyUI + PhotoCraft pipeline.

**Non-Goals:**
- No badge detail modal or click-to-expand behaviour.
- No badge notification toasts (those fire from consuming changes at award time via `isNew`).
- No admin badge management UI.
- No runtime compositing of base art, frames, or rank bosses — badge chrome is baked at build time.
- No Pippin (or other storyline) badge set in this change; the model is storyline-aware, the seeded catalog is Frodo/Sam only.
- No pagination, filtering, or search; the grid renders every earned badge.
- No mutable counters or schema changes to the achievement tables.

## Decisions

### Add the route directly to the Hono app

`app.get('/api/achievements', authGuard, …)` is added beside `/api/total-distance` in `src/index.ts`. `authGuard` already validates the session and sets `userId`, so the handler receives `c.get('userId')!` and never calls `validateSession` itself. Adding the route is sufficient for 405 handling because `app.notFound` inspects `app.routes`.

Rationale: this is the current pattern for every authenticated endpoint. The old design text about an if/else chain and `getAllowedMethods` described a router that no longer exists.

### Return a named collection envelope

The endpoint returns `{ achievements: [...] }`, matching the `{ friends: [...] }` and `{ storylines: [...] }` convention. Each entry carries the existing summary fields plus a `presentation` block:

```json
{
  "achievement_id": 3,
  "slug": "journey-frodo-sam-buckleberry-ferry",
  "name": "Across the Buckleberry Ferry",
  "description": "…",
  "image_slug": "journey-frodo-sam-buckleberry-ferry",
  "badge_type": "journey",
  "is_repeatable": false,
  "earned_count": 1,
  "first_earned_at": "…",
  "last_earned_at": "…",
  "presentation": {
    "rank": 1,
    "rank_label": "bronze",
    "storyline": "frodo-sam",
    "collection": {
      "slug": "frodo-sam-journey",
      "label": "The Road to Mordor",
      "index": 1,
      "size": 8
    }
  }
}
```

Rationale: an envelope leaves room for later metadata (totals, per-collection progress) without breaking clients, and a server-resolved `presentation` block keeps threshold logic out of the island.

### Put rank, collection, and storyline in `achievement_definitions.metadata`

The table already has a nullable `metadata` TEXT column and no enum constraints on `badge_type`. Seeded definitions carry:

```json
{
  "storyline": "frodo-sam",
  "rank": 2,
  "rank_thresholds": [1, 4, 12, 26],
  "collection": {
    "slug": "frodo-sam-journey",
    "label": "The Road to Mordor",
    "index": 3,
    "size": 8
  }
}
```

All fields are optional. `storyline: null` or absent means global. `rank` is a fixed 1–4. `rank_thresholds` (ascending, four values) derives rank from `earned_count` for repeatable badges and takes precedence only when `rank` is absent. `collection` is absent for standalone badges.

Rationale: no migration and no schema churn; metadata is the documented extension point for consuming features. It also keeps rank/collection authoring next to the badge definition instead of in client code.

### Seed ten definitions: eight journey badges plus two habits

`migrations/0144_seed_journey_badges.sql` seeds the Frodo/Sam journey collection (`frodo-sam-journey`, "The Road to Mordor", positions 1–8 of 8) in journey order, with the return journey at Helm's Deep added before the final homecoming:

| # | Slug | Name | Rank | `threshold_km` |
|---|---|---|---|---|
| 1 | `journey-frodo-sam-buckleberry-ferry` | Across the Buckleberry Ferry | 1 | 112.65 |
| 2 | `journey-frodo-sam-weathertop-survivor` | Survivor of Weathertop | 1 | 387.85 |
| 3 | `journey-frodo-sam-through-khazad-dum` | Through Khazad-dûm | 2 | 1284.25 |
| 4 | `journey-frodo-sam-lothlorien-guest` | Guest of the Golden Wood | 2 | 1375.98 |
| 5 | `journey-frodo-sam-rauros-parting` | The Breaking of the Fellowship | 3 | 2106.63 |
| 6 | `journey-frodo-sam-mordor-threshold` | Standing at Mount Doom | 3 | 2863.01 |
| 7 | `journey-frodo-sam-glittering-caves` | The Glittering Caves | 4 | 3827.0 |
| 8 | `journey-frodo-sam-home-at-sunset` | Home Again at Sunset | 4 | 6422.49 |

The two global habit badges are `habit-first-steps` (rank 1, non-repeatable, criteria `first_walk`) and `habit-faithful-walker` (repeatable, `rank_thresholds` `[1,4,12,26]`, criteria `seven_day_streak`, unit `weeks`).

The Glittering Caves threshold matches the return-journey goal "Reach Helm's Deep" at 2378 miles (3827.0 km) in `migrations/0003_init_goals.sql`; its description follows the Glittering Caves goal text in `migrations/0016_update_goal_descriptions_06.sql`. Home remains the final badge at `6422.49` km.

### Resolve presentation in the API layer, not the island

`src/badge-presentation.ts` exposes pure functions that parse metadata and resolve rank/collection. `src/achievement-handlers.ts` maps each summary row through them. The island renders what it receives.

Rationale: threshold comparison and fallback rules are business logic with edge cases (malformed JSON, missing thresholds, out-of-range ranks). Jest covers pure functions cheaply; the island stays a view.

### Non-friends receive 404, not 403

The friend-scoped branch verifies an accepted `friendships` row in either direction and returns 404 when it is absent, matching `handleGetFriendProfile`. A `userId` equal to the caller resolves to the own-summary path with no friendship check. Non-integer or non-positive `userId` returns 400.

Rationale: the existing friend-profile surface already returns 404 to avoid leaking whether a user exists, and the client already treats 404 as "not a friend". Introducing 403 for the same condition would split the contract.

### Badge images are WebP, with a 1024 inspection path

Cards are constructed as `/img/achievements/<image_slug>.webp` at 512 px; inspection uses `/img/achievements/full/<name>.webp` at 1024 px. Repeatable badges use `<image_slug>--<rank>.webp`, selected from `presentation.rank`, with the base image as the no-boss fallback. There is no PNG→WebP fallback. A null `image_slug`, a load error, or a path that fails the slug pattern falls back to a CSS-drawn circular placeholder.

Rationale: `public/` has no `images/` directory, content images are WebP-only, and a fallback 404 costs a request to reach the same visual result. Keeping the placeholder in CSS means no extra asset.

### Borders encode two axes and are baked at build time

Badge chrome has two reusable layers:

1. **Family frame** — one master per `badge_type` (`journey`, `habit`, `challenge`, `book`, `community`, `field-guide`).
2. **Rank boss** — one handcrafted master per rank (`bronze`, `silver`, `gold`, `mithril`), mounted at 6 o'clock.

Both are generated once, composited over the base emblem in PhotoCraft, and exported as a single WebP per badge. The client never loads frames or bosses. Fixed-rank badges bake their single rank; repeatable habit badges ship four variants (`<slug>--<rank>.webp`) so the boss matches the earned rank.

Rationale: a shared boss per rank gives consistent rank semantics across families without a rank ring. Baking the composite avoids runtime layering, extra requests, and alpha-composition bugs in CSS.

### Generate a broad candidate pool, then narrow to two per asset

Single-seed sampling is noisy and prompt variants diverge sharply for stylised metalwork. Every asset is generated across multiple prompt variants and seeds — twelve candidates per emblem, eight per family frame and per rank boss — reviewed on a per-asset contact sheet, and narrowed to two finalists. Only those two finalists go to the user for the final pick.

Rationale: the review stays small and decisive while the selection is informed by enough samples to avoid settling for the best of four. Seeds stay configurable so one weak asset can be expanded without regenerating the whole set. Generation is a batch job; the review gate is the only blocking step.

### Collection numbering is typographic, not artwork

The badge card shows `index/size` and the rank label as text, sourced from the API. Numbers are never baked into images.

Rationale: text stays crisp at every size, is localizable, is readable by assistive technology, and avoids per-badge numeral assets.

### Group earned badges by collection

The island renders one section per collection when at least one enrolled badge is earned, ordered by `collection.index`, with a header showing `label · earned/size`. Global and standalone badges render in a trailing "Other" section ordered newest-earned first. Within a collection, cards sort by `index`; elsewhere the API order is preserved.

Rationale: a numbered set is only legible when its members sit together and the missing slots are obvious. Re-sorting inside a collection is deliberate; the API still returns newest-first for consumers that want recency.

### Award from progress writes against the displayed storyline distance

`src/achievement-awards.ts` exposes `checkAndAwardJourneyBadges(db, userId)`:

1. Resolve the active storyline and displayed distance once (`resolveUserStoryline`, `calculateTotalDistance`, `applyStorylineOffset`).
2. Load journey/habit definitions and parse their metadata.
3. Skip definitions whose `storyline` is set and does not match the active storyline.
4. Award each badge whose condition is met via `awardAchievement`, using a deterministic idempotency key.

`first-steps` qualifies on any progress row; journey badges on `threshold_km`; `faithful-walker` on seven distinct walk dates within the trailing seven-day window, keyed by window end date.

Rationale: badge thresholds are expressed in storyline distance, so awarding from raw distance would let a Pippin user earn Frodo/Sam badges. Awarding from the displayed distance and filtering on the definition's storyline keeps the catalog honest. Global habit badges use `storyline: null` and apply to every path.

### Award failures never fail a walk log

The hook is awaited after a successful write and wrapped so any error (missing definition, D1 failure, malformed metadata) is logged and swallowed. Awards are derived state; a walk log is user data and must not be lost to a badge bug.

### Loading, empty, and error states

Skeletons render only after a short delay to avoid flashing on fast responses. An empty summary removes the section entirely. A failed request removes the section and logs to the console. A missing image hides the `<img>` and leaves the name.

### CSS uses design-guide variables only

`public/css/badge-display.css` uses `var(--accent-gold)`, `var(--bg-surface)`, `var(--text-primary)`, and existing spacing variables. No hardcoded hex or rgb values. Circular geometry is shared by the skeleton and the fallback placeholder; real badge art supplies its own frame.

### No migrations beyond the seed

`migrations/0144_seed_journey_badges.sql` inserts definitions with `INSERT OR IGNORE`. No table, index, or column changes.

## Risks / Trade-offs

- [Artwork review blocks implementation] → Each asset is generated 8–12 times across variants and seeds, narrowed to two finalists on a contact sheet, and only then presented for the final pick. The pipeline stops at that review gate before compositing. Wiring can proceed against the CSS placeholder while art is approved.
- [Friend profile adds a second API call] → Badge data is small and indexed; the page already makes one profile call. If latency matters later, the friend profile response can embed achievements without changing the island contract.
- [Rank thresholds drift from seed data] → Thresholds live in `metadata` and are read by both the hook and the presentation resolver; a single seed migration is the source of truth. Tests assert the seeded values.
- [Award hook adds work to every walk write] → The hook loads only journey/habit definitions and exits early for non-matching storylines; most writes cross no threshold. It runs after the write, and failures are swallowed.
- [Baked borders require a rerun when a family changes] → Accepted: art changes are batch work, and the PhotoCraft template makes a rerun deterministic.
- [Metadata is free-form and can be malformed] → Parsing is defensive: invalid JSON or out-of-range values fall back to rank 1, no collection, and the active storyline.

## Migration Plan

1. Extend `AchievementSummary` and its query with `metadata`; update the shared-infra spec delta.
2. Add `src/badge-presentation.ts` and its tests.
3. Add `src/achievement-handlers.ts`, wire `app.get('/api/achievements', authGuard, …)`, and add handler and route tests.
4. Add `migrations/0144_seed_journey_badges.sql` with the ten seeded definitions.
5. Add `src/achievement-awards.ts` and call it from `handleProgressPost` and `handleProgressPut`.
6. Create `BadgeDisplayIsland`, register it, and add the SSR placeholders.
7. Create `public/css/badge-display.css` and reference it from both renderers.
8. Generate the broad candidate pool, narrow each asset to two finalists, collect the user's final picks, then composite and optimise into `public/img/achievements/`.
9. Update `docs/api-reference.md`, `docs/data-models.md`, and `docs/design-guide.md`.

Rollback strategy: remove the island placeholders, route, island registration, handler, award hook call, and stylesheet; drop migration 0144. Earned instances remain append-only and harmless if the display is rolled back.

## Open Questions

None. Resolved decisions:
- Hono route with `authGuard`; handler receives `userId`.
- `{ achievements: [...] }` envelope with a `presentation` block.
- Non-friend access returns 404.
- `/img/achievements/<image_slug>.webp`, single format.
- Family frame + 6 o'clock rank boss, baked in PhotoCraft; numbering is text.
- Storyline-scoped awarding from displayed distance; global habit badges.
- Grouped collection sections with per-collection progress.
- No new migrations beyond the seed.
