## 1. Achievement API Endpoint

- [ ] 1.1 Create `src/achievement-handlers.ts` with `handleGetAchievements(request, db, userId?)`: imports `getUserAchievementSummary` from `src/achievement-utils.ts`, validates session via `validateSession`, resolves own-user vs friend-user based on optional `userId` query parameter, verifies accepted friendship for friend-scoped access by querying the `friendships` table, calls `getUserAchievementSummary(db, targetUserId)`, and returns the summary as JSON.
- [ ] 1.2 Wire `GET /api/achievements` route into `src/index.ts`: add `case "/api/achievements":` to the `['GET']` return group in `getAllowedMethods`; add a route handler in the authenticated utility section of the fetch handler (near `/api/total-distance`, before the fallback `Unknown API endpoint` 404 return) that calls `validateSession` and `handleGetAchievements`.
- [ ] 1.3 Add Jest coverage for: own achievements with data, own achievements empty, friend achievements with accepted friendship, friend achievements rejected when not friends (403), unauthenticated request rejected (401), and the route dispatch returns correct method metadata via `getAllowedMethods`.

## 2. Badge Display Island

- [ ] 2.1 Create `client/src/islands/BadgeDisplayIsland.tsx`: Preact functional component that detects context from `window.location.pathname` — on `/profile` fetches `GET /api/achievements` (own badges), on `/friends/:id` extracts the user ID from the URL and fetches `GET /api/achievements?userId=<id>`. Manages loading/error/data states.
- [ ] 2.2 Implement hexagonal skeleton loading state: while the API request is in-flight, render 4-6 CSS hexagon placeholder shapes (using `clip-path: polygon(...)`) with a subtle shimmer or pulse animation. Replace with real badge cards or nothing when data arrives.
- [ ] 2.3 Implement the badge grid rendering: each badge card shows the achievement image sourced from `/images/achievements/<slug>.png` (with `onerror` fallback to `/images/achievements/<slug>.webp`, then hide image on second failure), the badge name as a text label, and a small repeat-count overlay badge for badges where `earned_count > 1`. Render nothing when the summary is empty (no empty-state message).
- [ ] 2.4 Register `BadgeDisplayIsland` in `client/src/index.tsx`: add import, add to `autoHydratedIslands` and `allIslands` objects following existing naming conventions.

## 3. SSR Shell Integration

- [ ] 3.1 Add `<div data-island="BadgeDisplayIsland"></div>` to `renderProfilePage.ts` below the existing `ProfileIsland` and `PushPermissionIsland` islands, inside the `profile-islands` container.
- [ ] 3.2 Add `<div data-island="BadgeDisplayIsland"></div>` to `renderFriendProfilePage.ts` below `FriendProfileIsland`. The island detects the friend ID from the URL — no `data-user-id` attribute needed.
- [ ] 3.3 Create `public/css/badge-display.css` with styles for: responsive CSS grid badge layout (`grid-template-columns: repeat(auto-fill, minmax(80px, 1fr))`), badge card sizing and image containment, name styling, repeat-count overlay positioning, and hexagonal skeleton placeholder shapes with shimmer animation. Reference the stylesheet from `renderProfilePage.ts` and `renderFriendProfilePage.ts` by adding `'/css/badge-display.css'` to each renderer's existing stylesheet arrays.

## 4. Validation

- [ ] 4.1 Add Vitest coverage for `BadgeDisplayIsland`: renders badge grid with correct images and names sourced from `/images/achievements/`, renders repeat-count overlay for count > 1, renders hexagonal skeleton placeholders during loading, removes placeholders and shows nothing for empty summary, handles API error gracefully (removes placeholders, renders nothing), detects friend mode from URL pathname correctly, handles broken badge images via PNG→WebP→hide fallback without breaking layout.
- [ ] 4.2 Run `npm test` and fix regressions related to the new handler, route dispatch, `getAllowedMethods` entry, and endpoint behavior.
- [ ] 4.3 Run `npm run test:client` and fix regressions related to the new island and island registration.
- [ ] 4.4 Run `npm run check` and resolve any TypeScript or Wrangler dry-run issues.
- [ ] 4.5 Update `docs/api-reference.md` with the `GET /api/achievements` endpoint specification, query parameters, and response shape.
