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
- `renderProfileSettingsPage` main content: `<div class="profile-page">` containing the SSR back row (styled Back to profile button + "Changes save automatically" note — rendered by the shell so they exist during loading and on 401), then the `ProfileSettingsIsland`, `PushPermissionIsland`, and `ProfileAccountIsland` placeholders; the settings islands render their own cards directly. No bottom action bar or reserved bottom padding.
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
| `ProfileViewIsland` (new) | view | hero (avatar button, username, stat grid, goal + journey lines), Settings CTA, Fellowships card (the badge island follows it); hosts `AvatarPickerModal`; no page wrapper (renderer owns it) |
| `ProfileSettingsIsland` (new) | settings | username/email auto-save-on-blur fields with inline status (fetches `/api/session` + `/api/storylines` only — the avatar list belongs to the modal), avatar preview + "Change avatar" trigger, preference toggles, journey select + confirm dialog; no Save bar; no Back button (the SSR shell renders it); no page wrapper (renderer owns it) |
| `PushPermissionIsland` (unchanged) | settings | mount moves from view page to settings page |
| `ProfileAccountIsland` (new) | settings | Account card with the existing Logout action and confirmation; mounted after the push island so sign-out stays last on the page |
| `BadgeDisplayIsland` (unchanged) | view | zero-badge summary renders nothing, exactly as `profile-badge-display` specifies |
| `ProfileIsland` | — | **deleted** (replaced by the three islands above) |

**Shared components**

- `client/src/components/AvatarPickerModal.tsx` — extracted from `ProfileIsland`'s avatar section (`ProfileIsland.tsx:379-425` + `saveAvatarChoice`/`handleGalleryKeyDown`). Owns: the `/api/avatars` fetch, the radiogroup gallery with arrow-key cycling, "Use initials", the per-click `PUT /api/user/preferences`, its status line, and the SW-cache-clear + `preferenceChanged` dispatch. Props: `username`, `avatarId`, `onChange` (applies new avatar id to the parent), `onClose`. Same event/clear-cache behaviour is preserved exactly (a lift-and-move, not a rewrite).
- Modal internals: a **current-avatar preview row sits outside the gallery grid** (visible immediately and during the gallery fetch), then the scrollable gallery, then status + actions.
- Fetch behaviour: gallery load failure (network/5xx) → error state with Retry inside the gallery area; any 401 (gallery fetch or save) → modal closes and the browser redirects to `/login`; other save errors → status line, modal stays open, prior selection intact.
- Modal chrome follows the app's existing in-page dialog patterns (`profile-dialog-overlay`/`profile-dialog` from `profile.css` for the carry/reset dialog; `party-confirm-*` for friend removal) — no overlay portal or new dialog library.

**Not shared (deliberate):** no abstract `ProfileIdentity`/profile-header component across `ProfileViewIsland` and `FriendProfileIsland`. Two call sites with a ~20-line presentational hero each; they share the *CSS* (`friend-profile-header`, `friend-profile-stats`) but differ in data source and affordances (self: avatar-as-button, Settings CTA, journey line; friend: friendship controls). Extraction would couple the two islands for marginal dedup — per the repo's extract-on-third-copy rule, a shared component waits until a third profile-style surface (e.g. a party-member mini-profile) appears.

**ProfileIsland section disposition (exact)**

| Current section (`ProfileIsland.tsx`) | Goes to |
|---|---|
| Username + email fields, hints, Save handler (`:354-377`, `:272-310`) | `ProfileSettingsIsland`, auto-save on blur with per-field inline status; no Save button |
| Avatar preview/gallery/reset + save logic (`:134-169`, `:379-425`) | `AvatarPickerModal` (settings opens it via "Change avatar"; view via the avatar itself) |
| `showFutureGoalsUnlocked` toggle (`:427-445`) | `ProfileSettingsIsland` |
| `defaultViewMap` toggle (`:447-465`) | `ProfileSettingsIsland` |
| Journey select + description + status (`:471-490`) | `ProfileSettingsIsland` |
| Carry/reset confirm dialog (`:511-531`) | `ProfileSettingsIsland` |
| Save / Logout footer buttons (`:496-507`) | Save is removed (auto-save); Logout moves to the new `ProfileAccountIsland` (mounted after the push island), which keeps the existing logout flow and confirmation |
| `Back` button (`history.back()`, `:319-321`, `:504-506`) | replaced by a styled "Back to profile" button rendered by the SSR shell (deep-link friendly, visible before hydration) |
| Auto-focus username input on load (`:128-132`) | dropped — the settings page is no longer "the form page"; nothing forces focus |
| Fetch of `/api/session`, `/api/avatars`, `/api/storylines` in parallel (`:84-126`) | `ProfileSettingsIsland` fetches only `/api/session` + `/api/storylines`; the `/api/avatars` list moves entirely into `AvatarPickerModal`, and the 401 branch (redirect `/login` instead of a blank form) is added |
| Error/success message blocks (`:492-493`) | per-field inline status in `ProfileSettingsIsland`; no global success/error banner |
| `.profile-page` wrapper returned by the island (`:351`) | **removed** — wrapper moves to `renderProfileSettingsPage` |

What is removed vs changed shape: the page-level **Save Changes button and its footer bar are removed by design** (replaced by username/email auto-save on blur; every other setting already saved on change and keeps doing so); auto-focus-on-load, `history.back()`, the island-owned wrapper, and silent-on-401 change shape, and Logout leaves the settings island for its own island. `clearMapCache()` (imported in `ProfileIsland.tsx:4`, called in `switchStoryline`) moves with the journey logic and is covered by its test.

## Auto-save behaviour (username/email)

- **Validation reuses the server's exact predicates**: `isValidUsername` (`/^[a-zA-Z0-9_]{3,30}$/`) and `isValidEmail` (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) from `src/auth-utils.ts` are pure regex functions with no worker dependency. They move into `src/validators.ts` — the existing client-safe module already compiled to `public/js/validators.js` by `npm run build:validators` — and `src/auth-utils.ts` re-exports them so every worker call site (`src/auth-handlers.ts:60`, `:524`, `:529`) is unchanged. `ProfileSettingsIsland` imports the same module; no duplicate regex, and the client validation can never drift from the server's. Values are trimmed before validation.
- **Save sequencing per field**: each field has a monotonically increasing sequence counter (or a serialized per-field queue — one mechanism, decided at implementation). On blur, the request captures the current sequence; a response is applied only if it belongs to the newest sequence, so a stale response that resolves after a newer blur is ignored and the field always reflects the latest edit. The newest request wins; in-flight older requests are not cancelled, just discarded on arrival.
- **Field status lifecycle**: status starts empty on initial load — never a pre-rendered "Saved"; it is cleared as soon as the user edits the field, and it shows `Saving…` → `Saved`/error only per started save. The `keepalive: true` flag on the blur save keeps an in-flight request alive through Back navigation.
- **Errors stay local**: invalid (including empty/whitespace) values never send a request and show an inline error next to the field; `409` shows the server's duplicate message inline; `401` redirects to `/login`; other network errors set the field error status. No global banner, and other fields are unaffected.

## Stylesheet ownership

- **`public/css/profile-view.css` (new) owns the view chrome and the shared avatar picker modal only**: the avatar-as-button affordance, the Settings CTA, the stat skeleton, and the full picker modal (title row, current-avatar preview row, gallery grid, selection ring, status, actions). Both page renderers load it — the modal must style identically wherever it opens.
- **`public/css/profile.css` owns the settings-page styles**: the form/card/toggle/push rules it has today plus the new styled Back to profile button, the per-field auto-save status (`Saving…`/`Saved`/error with `role="status"`), the "Change avatar" trigger, and the Account/Logout card. It also drops the old Save/footer action-bar rules that die with the Save button.
- Renderer tests assert the stylesheet lists, including `profile-view.css` on the settings page and the ownership split above.

## State matrix

| State | View page | Settings page | Avatar modal |
|---|---|---|---|
| Loading | hero/stats skeleton (shimmer pattern from `badge-display.css`) | SSR shell (h1 + Back row) visible immediately; islands show the `.profile-page-loading` spinner | SSR shell visible; gallery-loading indicator; current-avatar preview stays visible |
| Error | error card + Retry; no fabricated stats | per-field inline status; no global save button/banner | gallery fetch error → Retry inside modal; save error → status line, modal stays open |
| Empty | no-fellowship card; `currentGoalTitle` null → no "Heading to" line; badges render nothing when summary empty | n/a | n/a |
| 401 | redirect `/login` | **new explicit branch:** session-fetch 401 → redirect `/login` (never the blank form) | close modal, then redirect `/login` |

## Accessibility & mobile

- Avatar trigger: `<button>` wrapping the `Avatar` at 128 px, `aria-label` "Change avatar for <username>"; the avatar itself is the ≥44 px target at every breakpoint (no compact variant is introduced).
- Modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on the title; focus moves in on open, Tab/Shift+Tab cycle inside, Escape and backdrop close, focus returns to the trigger. Arrow-key behaviour of the current gallery preserved (`ProfileIsland.tsx:323-340`).
- Headings: view h1 "Profile" → hero h2 username → h3 "Fellowships" / badge section h3s. Settings h1 "Profile Settings" → form groups labelled as today.
- Touch: the settings page has one page-level Back to profile button, rendered as a secondary control with an icon and label, 44 px minimum height, consistent padding, a border, and a visible focus ring. Username/email save on blur; their inline status uses `role="status"` + `aria-live="polite"` and announces "Saving…"/"Saved"/error. Outside the settings cards there is no Save control and no bottom action bar — Back is the only page-level navigation/commit control, while the cards keep their own interactive controls (Change avatar, toggles, journey select, push toggles, Logout).
- Motion: only the existing toggle/dropdown transitions and the skeleton shimmer; shimmer already respects `prefers-reduced-motion` (`badge-display.css:160`); no new keyframes.
- 360/390 px: page wrapper padding is the only gutter; nothing outside the wrapper may exceed the viewport (`documentElement.scrollWidth === viewport width` verified in the screenshot harness at 360 and 390; the Settings CTA uses `box-sizing: border-box` so `party-btn` padding cannot push it past the edge).
- Stat grid: two columns above 480 px, single column at ≤480 px — inherited unchanged from `friends.css` `@media (max-width: 480px)`.

## Navigation

- Drawer `/profile` → view (no drawer change).
- View: Settings CTA (primary, full-width on mobile) → `/profile/settings`. Settings: a styled Back to profile button rendered by the SSR shell above the islands → `/profile`. Explicit link, not `history.back()`, so deep links and new tabs never dead-end — the Back row is present even while the islands load or when a 401 redirects.
- Logout and journey switching stay settings-only; the view stays read-only (locked product decision). Logout lives in `ProfileAccountIsland` at the bottom of the settings page.
- Deep link & unauthenticated: page routes stay unguarded; `main.js` boot-redirect catches missing tokens; both new islands explicitly redirect on API 401 (matching `FriendProfileIsland.tsx:38`), fixing `ProfileIsland`'s current silent-blank-form behaviour.

## Trade-offs

1. **camelCase vs snake_case for the new endpoint** — the friend profile API already uses snake_case; mirroring it would ease a hypothetical shared component. Chosen: camelCase, matching the self-API family (`/api/session`, `/api/total-distance`) that this endpoint joins; the shared-component idea is explicitly deferred.
2. **Adjusted vs raw distance in the view** — the friend hero shows the raw all-storyline sum; the self view shows the storyline-adjusted headline the user sees everywhere else (locked decision). Consistency with the user's own mental model wins; the friend page stays untouched.
3. **Save-on-select modal vs explicit apply** — preserving save-on-click keeps current semantics (no data lost by accidental close, status visible). An explicit Apply/Cancel would be a nicer modal but changes a working behaviour; not this change's job.
4. **`memberSince` ISO conversion server-side** — the friend endpoint leaks the raw SQLite datetime string; the new endpoint converts to `...Z` ISO so the client can `new Date(...)` reliably. Slight asymmetry with the friend surface, but raw `YYYY-MM-DD HH:MM:SS` is not a documented contract worth propagating.
5. **Split stylesheets** — `profile-view.css` deliberately owns only view chrome + the shared picker modal, so the settings-only Back button/status/Account styles live beside the other `profile.css` form rules and the friend surfaces stay untouched; loaded by both renderers so the modal renders identically on both pages. The rejected alternative (one shared file owning all profile styles, or inlining per page) hides ownership and makes the modal diverge per page.
6. **Auto-save vs explicit Save** — avatar, preferences, journey, and push settings already save on change. Username/email now auto-save on blur with local validation, inline per-field status, and `keepalive` so an in-flight request survives Back navigation. This removes the page-level Save bar and leaves a single Back control. The trade-off is that username/email uniqueness and validation errors must be surfaced inline per field; those errors stay local and never block the rest of the settings page, and `keepalive` requests cannot be retried or awaited after navigation — acceptable because they are tiny single-field PUTs whose feedback is the inline status shown before the user leaves.
7. **No page-level action bar (previous draft reviewed and rejected)** — an earlier consideration floated a viewport-fixed Save/Back bar with reserved bottom padding so actions would be reachable at every scroll depth. Rejected: auto-save removes the need to "commit" anything from deep in the page, a fixed bar duplicates the single Back journey and costs viewport space on mobile, and reserved bottom padding no longer exists. Per-field inline status gives feedback where the edit happened; the single styled Back button at the top is the only page-level action.

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
