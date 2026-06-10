## Context

Walk to Mordor's profile page (`/profile`) renders `ProfileIsland` and `PushPermissionIsland` Preact islands inside SSR shells from `renderProfilePage.ts`. The friend profile page (`/friends/:userId`) renders `FriendProfileIsland` inside an SSR shell from `renderFriendProfilePage.ts`. Both islands fetch their own data from authenticated API endpoints.

The `shared-achievement-infrastructure` change (already proposed) provides `getUserAchievementSummary(db, userId)` which returns aggregated badge data as `AchievementSummary[]`. This change wires that data to the profile surfaces through a new endpoint and a new self-contained Preact island.

The codebase uses auto-hydrated islands registered in `client/src/index.tsx` by name. SSR shells place `<div data-island="<IslandName>"></div>` placeholders that the island registry picks up at hydration time.

## Goals / Non-Goals

**Goals:**
- Add a `GET /api/achievements` endpoint that returns the authenticated user's badge summary using the shared achievement infrastructure.
- Support an optional `?userId=<id>` query parameter so the friend profile page can fetch a specific user's badges, with friendship verification before returning data.
- Add a `BadgeDisplayIsland` Preact island that fetches from the achievements endpoint, renders a badge grid (image, name, repeat count), and handles loading, error, and empty states.
- Add the island to the profile page and friend profile page SSR shells without modifying existing island internals.
- Add focused CSS for badge grid layout.

**Non-Goals:**
- No badge detail modal or click-to-expand behavior (earned badges are simple display items).
- No badge notification toasts (those fire from consuming changes at award time via `isNew`).
- No badge sorting, filtering, or categorization in this change (badges render in the order returned by the endpoint).
- No admin badge management UI.

## Decisions

### Use a standalone BadgeDisplayIsland rather than embedding badges in existing islands

Create `BadgeDisplayIsland` as a self-contained Preact island that fetches its own data and renders independently. Add `<div data-island="BadgeDisplayIsland"></div>` to both profile and friend profile SSR shells. A single island handles both contexts by detecting the page from `window.location.pathname`:

- On `/profile`: fetches `GET /api/achievements` (own badges, no query parameter).
- On `/friends/:id`: extracts the user ID from the URL pathname and fetches `GET /api/achievements?userId=<id>`.

Rationale: existing `ProfileIsland` and `FriendProfileIsland` already manage their own data fetching, form state, and error handling. Adding badge rendering logic to both would duplicate code and couple display concerns. A standalone island is registered once and placed wherever badges should appear. URL-based detection follows the same pattern as `FriendProfileIsland`, which extracts its user ID from `window.location.pathname` rather than relying on SSR-injected data attributes.

Alternative considered: injecting `data-user-id` from the SSR renderer. Rejected because the renderer functions are static (no parameters), and the existing friend profile island already demonstrates the URL-based pattern works correctly.

### Place the achievements route near /api/total-distance in the fetch handler

The `GET /api/achievements` route will be added in the authenticated utility section of `src/index.ts`, right before or after the `/api/total-distance` handler. This section already validates sessions inline and handles simple GET requests. The route must be placed before the final fallback `Unknown API endpoint` 404 return.

Rationale: `/api/achievements` is an authenticated data endpoint like `/api/total-distance` and `/api/goals`. Grouping them together keeps the if/else chain organized. The existing monolithic if/else chain is not ideal, but restructuring it into a proper router is a separate concern — this change follows the established pattern.

Alternative considered: adding a router abstraction. Rejected as out of scope — touching every route in `src/index.ts` would make this change far larger than intended. A follow-on change could refactor the routing.

### Register the endpoint in getAllowedMethods

Add `case "/api/achievements":` to the `['GET']` return group in `getAllowedMethods`. The `?userId=` query parameter does not affect method routing — `getAllowedMethods` operates on pathname only, which is always `/api/achievements` regardless of query string.

### Use URL-based image paths with extension fallback

`BadgeDisplayIsland` constructs image URLs as `/images/achievements/<image_slug>.png`. If the image fails to load, the island tries `/images/achievements/<image_slug>.webp` as a fallback. If both fail, the image is hidden (the badge card shows only the name).

Rationale: this matches the existing asset pattern where images are served via the Assets binding under `/images/`. Supporting both PNG and WebP gives content authors flexibility. The onerror fallback prevents broken layout from missing images.

### Use hexagonal shadow placeholders during loading

The `BadgeDisplayIsland` shows hexagonal skeleton/shadow shapes while the API request is in-flight. These are rendered as CSS-drawn hexagons (using `clip-path: polygon(...)`) with a subtle shimmer or pulse animation. The number of placeholder shapes matches a reasonable column count (e.g., 3-5 hexagons) rather than attempting to predict how many badges the user has.

Rationale: an empty space during loading looks like a bug or missing feature. Hexagonal shadows signal "something unlockable lives here" which aligns with the motivational intent of the badge system. CSS-only hexagons have zero JavaScript cost and no additional network requests.

Alternative considered: showing nothing during load (the simplest option). Rejected because a blank space on first paint followed by badges appearing would look like a layout glitch.

### Add badge-display.css to both profile and friend profile renderers

`renderProfilePage.ts` and `renderFriendProfilePage.ts` will each include `'/css/badge-display.css'` in their stylesheet arrays. This is the established pattern — each page declares its own stylesheet dependencies.

Rationale: badges render on both pages, and each page is responsible for declaring its own CSS. Adding to an existing file (e.g., `profile.css`) would couple badge rendering to profile-specific layout concerns and create confusion when badges also render on the friend profile page.

### Do not add migrations or schema changes

This change uses only the tables created by `shared-achievement-infrastructure`. No new D1 migrations are needed.

Rationale: the achievement data model is already handled. This change is purely an API + UI layer.

## Risks / Trade-offs

- [Badge images not yet created] → The `achievement_definitions.image_slug` column stores a slug referencing an image asset. If the image file doesn't exist, the badge renders a broken image. Mitigation: the `BadgeDisplayIsland` should handle image load errors gracefully (e.g., fallback to a placeholder or hide the image).
- [Friend profile badge fetch adds a second API call] → The friend profile page already loads friend data from `GET /api/friends/:userId/profile`. Adding a separate badge fetch doubles the API calls for that page. Mitigation: this is acceptable for MVP — badge data is small and the endpoint is a single indexed query. If latency becomes an issue later, the friend profile endpoint can include `achievements` in its response without changing the badge display island.
- [No authorization for own-badge access beyond session] → The endpoint relies on the standard `Authorization: Bearer` header validated through `validateSession`. No additional ownership check is needed for the default (no `userId`) path. Mitigation: this matches all other authenticated endpoints in the app.

## Migration Plan

1. Add `GET /api/achievements` handler in a new `src/achievement-handlers.ts` file, importing `getUserAchievementSummary` from `src/achievement-utils.ts`.
2. Wire the route and allowed methods into `src/index.ts`.
3. Create `BadgeDisplayIsland` in `client/src/islands/BadgeDisplayIsland.tsx`.
4. Register `BadgeDisplayIsland` in `client/src/index.tsx` auto-hydrated islands.
5. Add `<div data-island="BadgeDisplayIsland"></div>` to `renderProfilePage.ts` SSR shell.
6. Add `<div data-island="BadgeDisplayIsland" data-user-id="<friend-id>"></div>` to `renderFriendProfilePage.ts` SSR shell (injected server-side from the URL param).
7. Create `public/css/badge-display.css` and reference from both page renderers.
8. Add Jest coverage for the endpoint and Vitest coverage for the island.
9. Update `docs/api-reference.md`.

Rollback strategy: remove the island placeholder divs from the SSR shells, remove the route and island registration, and delete the handler and island files. No data migration to reverse.

## Open Questions

None. All design decisions are resolved:
- Standalone `BadgeDisplayIsland` island, not embedded in existing islands
- Single `GET /api/achievements` endpoint with optional `?userId=` query param
- Friendship verification for friend-scoped access
- Empty grid (no message) when no badges exist
- New `badge-display.css` stylesheet, not extending existing CSS
- No new migrations
