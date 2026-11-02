## Why

The `shared-achievement-infrastructure` change provides domain services to award, store, and aggregate achievement badges, but no user-facing surface to display them and no badges to display. Users who earn badges through personal challenges, storyline books, or the Field Guide have no way to see them. This change builds the display layer, seeds the first badge catalog — the Frodo/Sam journey set plus two habit badges — and awards those badges from existing walk logging so the grid is live on day one.

## What Changes

- Add a `GET /api/achievements` endpoint that returns the authenticated user's achievement summary, ordered newest-earned first.
- Add a `GET /api/achievements?userId=<id>` variant for viewing an accepted friend's summary.
- Add server-resolved `presentation` data per badge: rank (1–4 plus label), storyline scope, and collection position (`index`/`size`). Rank and collection live in the definition's `metadata`.
- Add a `BadgeDisplayIsland` Preact island that renders earned badges grouped by collection, with rank chrome, repeat counts, and accessible labels.
- Add the island to the profile page and friend-profile page SSR shells.
- Add focused `badge-display.css` styles using design-guide variables only.
- Seed the initial catalog: eight Frodo/Sam journey badges (one numbered, ranked collection, including The Glittering Caves return badge at Helm's Deep) and two global habit badges (one fixed rank, one ranked by repeat count).
- Award journey and habit badges from `POST`/`PUT` progress writes, scoped to the active storyline, idempotent, and isolated from walk-log failures.
- Add the badge artwork pipeline: FLUX.3 Klein emblems, reusable family frames and rank rings, composited in PhotoCraft and optimized to WebP.
- Extend the shared achievement summary so it includes the definition's `metadata`; rank, collection, and storyline resolution then needs no extra queries.

## Capabilities

### New Capabilities
- `profile-badge-display`: Achievement summary endpoint (own and friend-scoped), ranked and numbered badge presentation, grouped badge grid on profile and friend-profile surfaces, seeded first catalog, and storyline-aware awarding from walk logging.

### Modified Capabilities
- `shared-achievement-infrastructure`: Aggregated achievement summaries now include the definition's `metadata` so display concerns (rank, collection, storyline) can be resolved from the summary itself.

## Impact

- Worker APIs: `GET /api/achievements` wired through `src/index.ts` under the existing `authGuard`; new `src/achievement-handlers.ts` and `src/badge-presentation.ts`; `src/achievement-utils.ts` summary query gains `metadata`.
- Award hook: new `src/achievement-awards.ts`, called from `POST` and `PUT` progress writes in `src/progress-handlers.ts`.
- D1: `migrations/0144_seed_journey_badges.sql` inserts ten definitions. No schema change.
- Frontend: new `BadgeDisplayIsland` registered in `client/src/index.tsx`; new `data-island` placeholders in `renderProfilePage.ts` and `renderFriendProfilePage.ts`.
- Assets: ten composited badge images in `public/img/achievements/`; generation masters, frames, and rings under gitignored `raw_assets/badges/`; generator scripts and prompts under `scripts/badge-art/`.
- Documentation: `docs/api-reference.md` (endpoint), `docs/data-models.md` (metadata conventions), `docs/design-guide.md` (badge ranks and collection chrome).
- Tests: Jest for the shared summary change, presentation resolution, endpoint behavior, seed migration, and award hook; Vitest for the island and grouping.
