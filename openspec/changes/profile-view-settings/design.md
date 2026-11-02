# Design: Profile View / Settings Split

## Context

Today one page and one island serve both jobs:

- `GET /profile` → `src/renderProfilePage.ts` mounts **ProfileIsland + PushPermissionIsland + BadgeDisplayIsland**.
- `client/src/islands/ProfileIsland.tsx` (534 lines) is a settings form with an inline avatar gallery; it fetches `/api/session`, `/api/avatars`, `/api/storylines` in parallel and saves through `PUT /api/profile`, `PUT /api/user/preferences`, `PUT /api/user/storyline`. On 401 it silently renders blank fields — the new islands must fix that.
- `PushPermissionIsland` is already a standalone island — it can move pages untouched.
- `BadgeDisplayIsland` resolves its endpoint from `window.location.pathname` (`parseAchievementsTarget`, `/profile` → `/api/achievements`), so it keeps working wherever the badge grid lives, and renders *nothing* on unknown paths — `/profile/settings` cannot accidentally show badges. Its zero-badge behaviour (render nothing) is owned by `profile-badge-display` and is **not** modified here.
- The friend side already models the desired "look at a profile" surface: `FriendProfileIsland` + `party.css`/`friends.css` classes (`party-page`, `party-breadcrumb`, `party-card friend-profile-header`, `friend-profile-stats`, `friend-fellowship-item`), with 401 → `/login` handling.
- Page routes are not server-guarded; `public/js/main.js` redirects unauthenticated boots to `/login`; islands own their own 401 fallbacks.

## Goals / Non-Goals

**Goals**
- A read-only profile view that visually matches the friend profile hero.
- One clear navigation loop: view ⇄ settings, drawer → view.
- Settings keeps 100 % of current behaviour; nothing silently dropped (including `clearMapCache()` on storyline switch).
- Avatar picker as a modal, shared by both pages.
- One cheap backend addition (`overview`) instead of client-side composition.
- Mockups + screenshots to review the design before implementation.
- Migrating existing Jest and Playwright suites to the new pages — declared, not discovered later.

**Non-Goals**
- Avatar upload / image handling.
- In-app password change (does not exist today; separate change if wanted).
- Any change to `/friends/:id`, `FriendProfileIsland`, the achievements API, or `BadgeDisplayIsland` (its empty-summary behaviour stays render-nothing per `profile-badge-display`).
- New database tables or migrations.

## Route decision

- `GET /profile` → view page. Keeping `/profile` as the view (rather than moving the view to a new URL and settings to `/profile`) means the drawer link, existing bookmarks, and `BadgeDisplayIsland`'s `parseAchievementsTarget('/profile')` mapping all stay valid. The view is the *default* profile URL a user expects.
- `GET /profile/settings` → settings.
- Routing style stays Hono page-routes returning SSR HTML (pattern: `app.get('/friends', ...)`, `src/index.ts:196`). No client-side router is introduced.
- `renderProfilePage.ts` is deleted; `renderProfileViewPage.ts` and `renderProfileSettingsPage.ts` take over.

## Page structure decision: wrapper owned by the SSR renderer

Today the islands own their page wrapper (`ProfileIsland` renders `<div class="profile-page">` itself; `FriendProfileIsland` renders `<div class="party-page">` itself). When the view page hosts a second island (`BadgeDisplayIsland`), a self-wrapping island would leave that island full-width outside the hero. Decision:

- `renderProfileViewPage` main content: `<div class="party-page">` containing the `ProfileViewIsland` and `BadgeDisplayIsland` placeholders; the view island renders its hero/CTA/fellowships *content only*, no wrapper.
- `renderProfileSettingsPage` main content: `<div class="profile-page profile-settings-page">` containing the `ProfileSettingsIsland` and `PushPermissionIsland` placeholders; the settings island renders `.profile-card` blocks directly, and `.profile-settings-page` reserves the bottom padding for the fixed Save bar.
- Effect: hero, CTA, fellowships, badge grid, and push card all align to the same wrapper width at every viewport.
- Renderer tests assert both wrappers and the absence of self-wrapping.

## API decision: `GET /api/profile/overview`

**Composing existing endpoints client-side was rejected:**

| Needed by view | Available today |
|---|---|
| username, avatarId, activeStoryline | `/api/session` (camelCase) |
| totalDistance (storyline-adjusted) + rawTotal | `/api/total-distance` (exists) |
| goal titles | `/api/goals` (exists — the full catalog, per-storyline goals via `/api/goals` with storyline param) |
| fellowships (summary for profile) | `/api/user/parties` (management-oriented payload) |
| memberSince (`created_at`) | **nothing** |
| a server-resolved "next unreached goal" title | **nothing** (no endpoint does distance-vs-goal resolution for journey display) |

`/api/total-distance` and `/api/goals` already exist, so distance and the raw goal list are not gaps. The real gaps are: **`memberSince`** (`users.created_at` is not exposed by any self-facing API), a **server-resolved `currentGoalTitle`** (next unreached storyline goal), and a compact **fellowship summary** for a profile card. Four-plus client-side requests, duplicated goal math in the client, and `memberSince` still missing are why one handler wins. It mirrors what `handleGetFriendProfile` already does — without the friendship gate.

**Shape** (camelCase, following the `/api/session` family, deliberately *not* snake_case as in the friend endpoint — see Trade-offs):

```json
{
  "username": "FrodoBaggins",
  "avatarId": "frodo",
  "totalDistance": 2412.5,
  "memberSince": "2024-08-15T18:30:00.000Z",
  "currentGoalTitle": "Reach northern edge of Ithilien",
  "activeStoryline": { "id": 1, "slug": "frodo-sam", "title": "Frodo & Sam", "description": "...", "pathKey": "fellowship", "adminOnly": false, "distanceOffset": 0 },
  "fellowships": [{ "id": 3, "name": "Fellowship of the Ring" }]
}
```

Implementation composes existing helpers — no new SQL patterns:
- `resolveUserStoryline` + `toStorylineResponse` (`src/storyline-utils.ts`) for `activeStoryline`.
- `calculateUserStorylineDistance` (`src/goals-handlers.ts:61`) for adjusted `totalDistance` (matches the journey headline, unlike the friend endpoint's raw sum — discrepancy intentional and noted below).
- `listStorylineGoals(activeStoryline.id)` → first goal with `distance > totalDistance`, else the last goal's title; **null when the storyline has no goals**.
- `memberSince`: `users.created_at` is `DATETIME DEFAULT CURRENT_TIMESTAMP` (SQLite UTC `YYYY-MM-DD HH:MM:SS`). The handler converts to ISO 8601 UTC (`.000Z`, via `new Date(raw.replace(' ', 'T') + 'Z').toISOString()`); the raw SQLite format is never leaked. Jest asserts the exact string.
- The same party query `handleGetFriendProfile` uses (`party_members` joined `parties`, active, `dissolved_at IS NULL`, name-ordered) minus the `is_shared` decoration: relative to yourself every membership is shared, so the flag is meaningless. Returns `{ id, name }`.
- Auth handled by the existing `authGuard` middleware; 401 comes from `validateSession`.

No migration: needs only reads that already exist (`users`, `progress`, `storylines`, `storyline_goals`, `party_members`, `parties`).

## Component split

**Islands**

| Island | Page | Contents |
|---|---|---|
| `ProfileViewIsland` (new) | view | hero (avatar button, username, stat grid, goal + journey lines), Fellowships card, Settings CTA, hosts `AvatarPickerModal`; no page wrapper (renderer owns it) |
| `ProfileSettingsIsland` (new) | settings | username/email form, avatar preview + "Change avatar" trigger, preference toggles, journey select + confirm dialog, "Back to profile" breadcrumb, Account/Logout card, and a viewport-fixed Save/Back action bar; no page wrapper (renderer owns it) |
| `PushPermissionIsland` (unchanged) | settings | mount moves from view page to settings page |
| `BadgeDisplayIsland` (unchanged) | view | zero-badge summary renders nothing, exactly as `profile-badge-display` specifies |
| `ProfileIsland` | — | **deleted** (replaced by the two islands above) |

**Shared components**

- `client/src/components/AvatarPickerModal.tsx` — extracted from `ProfileIsland`'s avatar section (`ProfileIsland.tsx:379-425` + `saveAvatarChoice`/`handleGalleryKeyDown`). Owns: the `/api/avatars` fetch, the radiogroup gallery with arrow-key cycling, "Use initials", the per-click `PUT /api/user/preferences`, its status line, and the SW-cache-clear + `preferenceChanged` dispatch. Props: `username`, `avatarId`, `onChange` (applies new avatar id to the parent), `onClose`. Same event/clear-cache behaviour is preserved exactly (a lift-and-move, not a rewrite).
- Modal internals: a **current-avatar preview row sits outside the gallery grid** (visible immediately and during the gallery fetch), then the scrollable gallery, then status + actions.
- Fetch behaviour: gallery load failure (network/5xx) → error state with Retry inside the gallery area; any 401 (gallery fetch or save) → modal closes and the browser redirects to `/login`; other save errors → status line, modal stays open, prior selection intact.
- Modal chrome follows the app's existing in-page dialog patterns (`profile-dialog-overlay`/`profile-dialog` from `profile.css` for the carry/reset dialog; `party-confirm-*` for friend removal) — no overlay portal or new dialog library.

**Not shared (deliberate):** no abstract `ProfileIdentity`/profile-header component across `ProfileViewIsland` and `FriendProfileIsland`. Two call sites with a ~20-line presentational hero each; they share the *CSS* (`friend-profile-header`, `friend-profile-stats`) but differ in data source and affordances (self: avatar-as-button, Settings CTA, journey line; friend: friendship controls). Extraction would couple the two islands for marginal dedup — per the repo's extract-on-third-copy rule, a shared component waits until a third profile-style surface (e.g. a party-member mini-profile) appears.

**ProfileIsland section disposition (exact)**

| Current section (`ProfileIsland.tsx`) | Goes to |
|---|---|
| Username + email fields, hints, Save handler (`:354-377`, `:272-310`) | `ProfileSettingsIsland` |
| Avatar preview/gallery/reset + save logic (`:134-169`, `:379-425`) | `AvatarPickerModal` (settings opens it via "Change avatar"; view via the avatar itself) |
| `showFutureGoalsUnlocked` toggle (`:427-445`) | `ProfileSettingsIsland` |
| `defaultViewMap` toggle (`:447-465`) | `ProfileSettingsIsland` |
| Journey select + description + status (`:471-490`) | `ProfileSettingsIsland` |
| Carry/reset confirm dialog (`:511-531`) | `ProfileSettingsIsland` |
| Save / Logout footer buttons (`:496-507`) | Save/Back **viewport-fixed bottom action bar**; Logout moves to a separate Account card at the bottom |
| `Back` button (`history.back()`, `:319-321`, `:504-506`) | replaced by an explicit "Back to profile" link to `/profile` (deep-link friendly) |
| Auto-focus username input on load (`:128-132`) | dropped — the settings page is no longer "the form page"; nothing forces focus |
| Fetch of `/api/session`/`/api/storylines` (`:84-126`) | `ProfileSettingsIsland`, plus a new 401 branch (redirect `/login` instead of a blank form) |
| Error/success message blocks (`:492-493`) | `ProfileSettingsIsland` |
| `.profile-page` wrapper returned by the island (`:351`) | **removed** — wrapper moves to `renderProfileSettingsPage` |

Nothing in the current behaviour is removed; auto-focus-on-load, `history.back()`, the island-owned wrapper, and silent-on-401 are the only behaviours that change shape. `clearMapCache()` (imported in `ProfileIsland.tsx:4`, called in `switchStoryline`) moves with the journey logic and is covered by its test.

## Stylesheet ownership

- **`public/css/profile-view.css` (new)** owns every *shared* profile-page style: the avatar-as-button affordance, Settings CTA, stat skeleton, back-row link, "Change avatar" trigger, and the **avatar picker modal** (title row, gallery grid, current-selection ring, status, actions). Both page renderers load it: the view next to `party.css`/`friends.css`/`badge-display.css`, and the settings page next to `profile.css` — the modal and back row must style correctly wherever they mount.
- `profile.css` keeps the settings form/card/toggle/push styles plus the viewport-fixed Save/Back action bar and Account card.
- Renderer tests assert the stylesheet lists, including `profile-view.css` on the settings page.

## State matrix

| State | View page | Settings page | Avatar modal |
|---|---|---|---|
| Loading | hero/stats skeleton (shimmer pattern from `badge-display.css`) | existing `.profile-page-loading` spinner | gallery-loading indicator; current-avatar preview stays visible |
| Error | error card + Retry; no fabricated stats | per-field status + form error as today (`error-message`/`success-message`) | gallery fetch error → Retry inside modal; save error → status line, modal stays open |
| Empty | no-fellowship card; `currentGoalTitle` null → no "Heading to" line; badges render nothing when summary empty | n/a | n/a |
| 401 | redirect `/login` | **new explicit branch:** session-fetch 401 → redirect `/login` (never the blank form) | close modal, then redirect `/login` |

## Accessibility & mobile

- Avatar trigger: `<button>` wrapping the `Avatar` at 128 px, `aria-label` "Change avatar for <username>"; the avatar itself is the ≥44 px target at every breakpoint (no compact variant is introduced).
- Modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on the title; focus moves in on open, Tab/Shift+Tab cycle inside, Escape and backdrop close, focus returns to the trigger. Arrow-key behaviour of the current gallery preserved (`ProfileIsland.tsx:323-340`).
- Headings: view h1 "Profile" → hero h2 username → h3 "Fellowships" / badge section h3s. Settings h1 "Profile Settings" → form groups labelled as today.
- Touch: the settings page uses a viewport-fixed bottom action bar with Save Changes (primary, flexible width) and Back (secondary), both ≥44 px. It is centered to the 600 px page column, uses an opaque `--bg-secondary` background, safe-area padding, and a top border. Because the push card is a separate island below the settings island, the bar is fixed to the viewport rather than CSS-sticky (a sticky child would stop at the settings island boundary). The settings page reserves 6 rem bottom padding so the Account card and focused fields can scroll clear of the bar. Logout lives in the Account card above it, not in the bar.
- Motion: only the existing toggle/dropdown transitions and the skeleton shimmer; shimmer already respects `prefers-reduced-motion` (`badge-display.css:160`); no new keyframes.
- 360/390 px: page wrapper padding is the only gutter; nothing outside the wrapper may exceed the viewport (`documentElement.scrollWidth === viewport width` verified in the screenshot harness at 360 and 390; the Settings CTA uses `box-sizing: border-box` so `party-btn` padding cannot push it past the edge).
- Stat grid: two columns above 480 px, single column at ≤480 px — inherited unchanged from `friends.css` `@media (max-width: 480px)`.

## Navigation

- Drawer `/profile` → view (no drawer change).
- View: Settings CTA (primary, full-width on mobile) → `/profile/settings`. Settings: "← Back to profile" row (top) and a viewport-fixed Back control in the bottom action bar → `/profile`. Explicit links, not `history.back()`, so deep links and new tabs never dead-end.
- Logout and journey switching stay settings-only; the view stays read-only (locked product decision).
- Deep link & unauthenticated: page routes stay unguarded; `main.js` boot-redirect catches missing tokens; both new islands explicitly redirect on API 401 (matching `FriendProfileIsland.tsx:38`), fixing `ProfileIsland`'s current silent-blank-form behaviour.

## Trade-offs

1. **camelCase vs snake_case for the new endpoint** — the friend profile API already uses snake_case; mirroring it would ease a hypothetical shared component. Chosen: camelCase, matching the self-API family (`/api/session`, `/api/total-distance`) that this endpoint joins; the shared-component idea is explicitly deferred.
2. **Adjusted vs raw distance in the view** — the friend hero shows the raw all-storyline sum; the self view shows the storyline-adjusted headline the user sees everywhere else (locked decision). Consistency with the user's own mental model wins; the friend page stays untouched.
3. **Save-on-select modal vs explicit apply** — preserving save-on-click keeps current semantics (no data lost by accidental close, status visible). An explicit Apply/Cancel would be a nicer modal but changes a working behaviour; not this change's job.
4. **`memberSince` ISO conversion server-side** — the friend endpoint leaks the raw SQLite datetime string; the new endpoint converts to `...Z` ISO so the client can `new Date(...)` reliably. Slight asymmetry with the friend surface, but raw `YYYY-MM-DD HH:MM:SS` is not a documented contract worth propagating.
5. **New `profile-view.css`** — small shared file (view chrome + picker modal + back row) instead of growing `party.css`/`friends.css` (friend surfaces) or inlining; loaded by both renderers so the modal renders identically on both pages.
6. **Fixed Save bar vs bottom-only** — the settings page includes a tall push card mounted as a separate island below the settings island. A CSS-sticky bar inside `ProfileSettingsIsland` would be constrained to that island and stop sticking when the push card scrolls; a viewport-fixed bar stays reachable across the whole page. The page reserves bottom padding so the bar never covers the Account card or the focused field. Logout is deliberately separated into an Account card so a destructive action is never adjacent to Save.

## Migration plan

1. Land code: new renderers/handler/islands/CSS + tests + docs (one change, no migration files).
2. Land the Jest + Playwright migration in the same change (see tasks) — the suites must not break on deploy.
3. Deploy: `/profile` switches to the view; `/profile/settings` appears; no data involvement.
4. Communicate: drawer link unchanged; the only user-visible surprise is that "Profile" no longer shows the form in place.

## Rollback

- Revert the implementation commit(s): restores `renderProfilePage.ts`, `ProfileIsland.tsx`, registry mapping, `/api/profile/overview` removal, the original `/profile` behaviour, and the migrated test suites.
- No database rollback: no migration, no new rows.
- Session/SW caches unaffected (no useSWR keys change; `avatarId` preference flow identical).
- Residual risk: service-worker precache may briefly serve the old shell — the existing reset-cache-version flow used by `npm run test:ui` covers the same refresh path; no dedicated rollback script needed.
