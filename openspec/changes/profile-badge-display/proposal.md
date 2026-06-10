## Why

The `shared-achievement-infrastructure` change provides domain services to award, store, and aggregate achievement badges, but no user-facing surface to display them. Users who earn badges through personal challenges, storyline books, or the Field Guide have no way to see their earned badges. This change builds the display layer — a badge grid on profile and friend profile pages — so earned badges are visible the moment any consuming feature awards them.

## What Changes

- Add a `GET /api/achievements` endpoint that returns the authenticated user's achievement summary via the shared `getUserAchievementSummary` domain service.
- Add a `GET /api/achievements?userId=<id>` query parameter variant for viewing a friend's achievement summary.
- Add a `BadgeDisplayIsland` Preact island that fetches achievement data and renders a badge grid with images, names, and repeat counts.
- Add the `BadgeDisplayIsland` to the profile page SSR shell (below existing profile controls) and the friend profile page SSR shell.
- Add focused CSS for the badge grid layout with no contamination of unrelated existing selector blocks.
- Gracefully render nothing when a user has no earned badges (empty state).

## Capabilities

### New Capabilities
- `profile-badge-display`: Authenticated and friend-scoped achievement summary endpoint plus Preact badge grid island for profile and friend profile surfaces.

### Modified Capabilities
- None.

## Impact

- Worker APIs: new `GET /api/achievements` route with optional `userId` query parameter, wired through `src/index.ts` with allowed-method metadata.
- Frontend: new `BadgeDisplayIsland` Preact island registered in `client/src/index.tsx`; new `data-island="BadgeDisplayIsland"` elements added to `renderProfilePage.ts` and `renderFriendProfilePage.ts` SSR shells.
- CSS: new `badge-display.css` stylesheet or additions to existing `profile.css` for badge grid layout.
- Depends on `shared-achievement-infrastructure` for `getUserAchievementSummary()`, `AchievementSummary` interface, and the underlying `achievement_definitions` / `user_achievement_instances` tables.
- Tests: Jest coverage for the achievements endpoint (auth, empty results, friend-scoped results); Vitest coverage for the badge island (rendering, repeat counts, empty state).
- Documentation: update `docs/api-reference.md` with the new endpoint.
