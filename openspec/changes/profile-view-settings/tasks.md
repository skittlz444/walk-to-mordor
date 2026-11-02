# Implementation Tasks: Profile View / Settings Split

> Planning-first change. Mockup + review tasks come first; nothing is marked complete. No D1 migration exists in this change. Badge display (`BadgeDisplayIsland`, achievements API, `/friends/:id`) is untouched — its zero-badge render-nothing behaviour stays as `profile-badge-display` specifies.

## 1. Design Review Artifacts (this change, planning only)

- [ ] 1.1 Tracked mockups in `openspec/changes/profile-view-settings/mockups/`: `view.html`, `settings.html`, `avatar-modal.html`, `mockups.css` (proposed styles draft of `profile-view.css`), `README.md` linking each mockup to the screenshots. Only the mockup sources are tracked — the PNG screenshots are gitignored review outputs regenerable from them.
- [ ] 1.2 Screenshots under gitignored `_inspection-screenshots/profile-view-settings/` at 2× DPR: view @390, view @360, settings @390, settings @360, avatar modal open @390; harness verifies `documentElement.scrollWidth === viewport` at 360/390 and exact PNG widths (720/780); README explains regeneration.
- [ ] 1.3 **Review gate:** walk the user through view/settings/modal mockups; record approved changes before implementation starts.

## 2. Self-Overview API

- [ ] 2.1 Create `src/profile-handlers.ts` with `handleGetProfileOverview(request, db, userId)`: session guard passthrough, `resolveUserStoryline` + `toStorylineResponse` for `activeStoryline`, `calculateUserStorylineDistance` for `totalDistance`, `users.created_at` converted to ISO 8601 UTC for `memberSince` (`new Date(raw.replace(' ', 'T') + 'Z').toISOString()`; raw SQLite `YYYY-MM-DD HH:MM:SS` never leaks), `listStorylineGoals(storylineId)` for `currentGoalTitle` (first goal with `distance > totalDistance`, else last title, `null` when no goals), and the active-non-dissolved fellowship list (`{ id, name }`, no sharing flag). Return `{ username, avatarId, totalDistance, memberSince, currentGoalTitle, activeStoryline, fellowships }` via `createSuccessResponse`.
- [ ] 2.2 Wire `app.get('/api/profile/overview', authGuard, (c) => handleGetProfileOverview(c.req.raw, c.get('db'), c.get('userId')!))` beside the other self-facing GETs (`src/index.ts` near `/api/total-distance`). No method-registry entry (405s come from `app.routes`).
- [ ] 2.3 Add `tests/api/profile-overview.test.ts` (Jest, modeled on `tests/api/achievement-handlers.test.ts`): 200 shape, storyline-adjusted distance (offset applied), next-unreached goal, final-goal fallback, `currentGoalTitle === null` on a goal-less storyline, exact ISO `memberSince` string from a SQLite `created_at` fixture, fellowships list (active only, dissolved excluded, name-ordered), empty fellowships, 401, and 500 on DB error.
- [ ] 2.4 Add `tests/api/profile-overview-routes.test.ts` (modeled on `tests/api/push-routes.test.ts`): `app.request` dispatches with the guard-provided user id; `POST /api/profile/overview` returns 405 with `Allow`.

## 3. AvatarPickerModal Component

- [ ] 3.1 Create `client/src/components/AvatarPickerModal.tsx`, a lift-and-move of `ProfileIsland`'s avatar logic: radiogroup gallery (`aria-checked`, arrow-key cycling `ProfileIsland.tsx:323-340`), "Use initials" → `avatarId` null, per-click `PUT /api/user/preferences { avatarId }`, status line (`saving`/`saved`/`error`), SW cache clear + `preferenceChanged` dispatch, `role="dialog"` `aria-modal="true"` `aria-labelledby`, focus trap + Escape/backdrop close + focus return to trigger. Structure: current-avatar preview row **outside** the gallery grid (visible immediately, including during the gallery fetch), then gallery, then status + actions. Props: `username`, `avatarId`, `onChange(slug | null)`, `onClose()`.
- [ ] 3.2 Modal fetch/error branches: gallery load failure (network/5xx) → error state with Retry inside the gallery area (current preview stays); any 401 (gallery fetch or save) → close the modal and redirect the browser to `/login` (matching `FriendProfileIsland`); other save errors → status line, modal stays open, prior selection intact.
- [ ] 3.3 Add `client/src/components/AvatarPickerModal.test.tsx` (Vitest): gallery fetch + render, current preview visible while gallery loads, gallery error + Retry, immediate save-on-select (PUT body + parent `onChange` called), initials reset, saved-status timeout, non-401 error keeps modal open with prior selection, escape/backdrop close with focus return, Tab wrap focus trap, 401 closes modal + redirect stub.

## 4. View Page

- [ ] 4.1 Create `src/renderProfileViewPage.ts`: h1 "Profile"; stylesheets `['/css/party.css', '/css/friends.css', '/css/badge-display.css', '/css/profile-view.css']`; main content `<div class="party-page">` wrapping `ProfileViewIsland` + `BadgeDisplayIsland` placeholders (renderer owns the wrapper).
- [ ] 4.2 Create `client/src/islands/ProfileViewIsland.tsx` (no page wrapper of its own): fetch `/api/profile/overview`; hero card (`party-card friend-profile-header` classes) with avatar **button** wrapping `Avatar` (128 px) labelled "Change avatar for <username>", username h2, stats grid (`friend-profile-stats`): Total Distance (adjusted, 2-dec km) + Member Since (formatted from ISO `memberSince`), "Heading to" goal line **hidden when `currentGoalTitle` is null**, active journey (`activeStoryline.title`), full-width Settings CTA linking `/profile/settings` (`box-sizing: border-box`); Fellowships `party-card` (reuse `friend-fellowship-item` markup, no sharing flag) only when non-empty. On 401 redirect `/login`; on render skeleton for hero/stats; on error an error card with Retry.
- [ ] 4.3 Wire the avatar modal into `ProfileViewIsland`: clicking the avatar opens `AvatarPickerModal`; `onChange` updates the displayed avatar live.
- [ ] 4.4 Create `public/css/profile-view.css`: avatar button affordance (gold ring + edit badge, hover/focus-visible states), `.profile-view-skeleton` shimmer blocks (template from `badge-display.css`), Settings CTA row, back-row link + "Change avatar" trigger + avatar picker modal styles shared with the settings page (see §5), ≤480 px single-column stats (inherited from `friends.css`) and stacked full-width settings footer buttons; no new keyframes, reduced-motion already covered.
- [ ] 4.5 Add `client/src/islands/ProfileViewIsland.test.tsx` (Vitest): overview render (username, distance formatting, member-since date, goal line, journey title), goal-line hidden when `currentGoalTitle` null, skeleton while loading, 401 redirect, error + Retry re-fetch, settings CTA href, fellowships card presence/absence without a shared marker, avatar click opens modal, live avatar update after save, badge island placeholder alignment not broken by the island (no duplicated wrapper).

## 5. Settings Page

- [ ] 5.1 Create `src/renderProfileSettingsPage.ts`: h1 "Profile Settings"; stylesheets `['/css/profile.css', '/css/profile-view.css']` (profile-view.css owns the back row + avatar modal/styles shared with the view); main content `<div class="profile-page">` wrapping `ProfileSettingsIsland` + `PushPermissionIsland` placeholders (order mirrors today's profile page; renderer owns the wrapper).
- [ ] 5.2 Create `client/src/islands/ProfileSettingsIsland.tsx` (no page wrapper of its own) from `ProfileIsland`: identical fetch trio and handlers; avatar section becomes current `Avatar` preview + "Change avatar" button opening `AvatarPickerModal` (drop the inline gallery); add top "← Back to profile" row linking `/profile` and a `Back to profile` footer button; remove `history.back()`; drop load-time username autofocus; keep Save/Logout, toggles, journey select + carry/reset dialog, error/success and status messaging, `preferenceChanged`/`storylineChanged` events, `clearMapCache()` on storyline switch, and SW cache clears. **New behaviour**: when the `GET /api/session` fetch returns 401, redirect to `/login` instead of rendering the blank form.
- [ ] 5.3 Delete `client/src/islands/ProfileIsland.tsx`; remove its registry entries in `client/src/index.tsx`; register `ProfileViewIsland` and `ProfileSettingsIsland` in both `autoHydratedIslands` and `allIslands` (alphabetical).
- [ ] 5.4 Replace routes in `src/index.ts`: `app.get('/profile', (c) => c.html(renderProfileViewPage()))` and `app.get('/profile/settings', (c) => c.html(renderProfileSettingsPage()))`; delete `src/renderProfilePage.ts`. `/friends/:id` untouched.
- [ ] 5.5 Rename/migrate `client/src/islands/ProfileIsland.test.tsx` → `ProfileSettingsIsland.test.tsx` (Vitest): preserve username/email save (both-fields error, success path), preference toggles + rollback-on-failure, storyline change dialog + carry/reset PUT + `storylineChanged` + `clearMapCache` assertion, avatar modal open + selection reflected in preview, back-link target, loading state, and the new 401 → `/login` redirect. Tests are rewritten against the new island name; no behavioural loosening.

## 6. Playwright Migration (tests/ui)

- [ ] 6.1 `tests/ui/profile.spec.js`: `/profile` now waits for `ProfileViewIsland` and asserts the view pieces (hero, Settings CTA → `/profile/settings`, badge island); move the form/update/error/logout/back assertions and `#profile-username`/`#profile-email` selectors to `/profile/settings`, updating `waitForProfileFormReady` to the settings island.
- [ ] 6.2 `tests/ui/preference-toggle.spec.js`: retarget the toggle rows to `/profile/settings` (`ProfileSettingsIsland` hydration wait replaces the `ProfileIsland` one).
- [ ] 6.3 `tests/ui/map-shell.spec.js`: replace the `ProfileIsland` wait with the island it actually needs on the new pages (view island on `/profile`; keep `/friends/:id` unaffected).
- [ ] 6.4 `tests/ui/email-confirmation.spec.js`: retarget its `ProfileIsland` hydration wait to the new island it visits (settings, `/profile/settings`).
- [ ] 6.5 **Mandatory:** `npm run test:ui` builds the client and runs the migrated Playwright suites; no suite skips on route changes (added to §8 validation).

## 7. Jest Migration

- [ ] 7.1 `tests/api/renderBadgePages.test.ts`: split the per-page assertions to cover **both** `renderProfileViewPage()` (ProfileViewIsland + BadgeDisplayIsland on `/profile`, stylesheets incl. `profile-view.css`) and `renderProfileSettingsPage()` (ProfileSettingsIsland + PushPermissionIsland on `/profile/settings`, stylesheets `profile.css` + `profile-view.css`, no badge island); friend-page assertions unchanged.
- [ ] 7.2 `tests/api/index.test.ts`: update the page-route mocks (`renderProfileViewPage`, `renderProfileSettingsPage` instead of `renderProfilePage`) and the SSR-page cases: `/profile` (new mock), `/profile/settings` (new case), friend-page mock untouched; keep the `/api/profile` PUT route cases as-is.

## 8. Documentation

- [ ] 8.1 `docs/api-reference.md`: add an "Overview Endpoints" (or Auth & Profile-adjacent) entry for `GET /api/profile/overview` (auth yes; purpose; shape incl. ISO `memberSince`; 401); add a **Page routes** section (or a pointer to `docs/frontend-guide.md`) covering `GET /profile` (view) and `GET /profile/settings`; add a `src/profile-handlers.ts` row to the **Handler File Map**.
- [ ] 8.2 `docs/frontend-guide.md`: update the island table — `ProfileIsland` row becomes `ProfileViewIsland` (view) + `ProfileSettingsIsland` (settings) + `AvatarPickerModal` (component); replace the stale "Profile/preferences is now a Preact island at `/profile` (`ProfileIsland`)" legacy note; update the `storylineChanged` emitter reference to `ProfileSettingsIsland`.
- [ ] 8.3 `docs/design-guide.md`: add the profile-view hero components (avatar-as-button, skeleton, picker modal) with the `profile-view.css` ownership note (shared by both profile pages).
- [ ] 8.4 No DB docs: `docs/data-models.md` untouched (no schema change).

## 9. Validation

- [ ] 9.1 Run `npm test` (Jest) — overview handler/routes, both page renderers, and the migrated `index`/`renderBadgePages` suites pass; existing suites stay green.
- [ ] 9.2 Run `npm run test:client` (Vitest) — new islands and modal pass; migrated settings tests match old behaviour one-for-one (incl. `clearMapCache` on storyline switch).
- [ ] 9.3 Run `npm run check` — TypeScript clean, `wrangler` dry-run passes.
- [ ] 9.4 **Mandatory:** run `npm run test:ui` (builds client, resets cache version, runs migrated Playwright suites against the local dev server).
- [ ] 9.5 Manual QA on the production Worker (`npm run dev`): drawer → view → settings → back loop; avatar open/save/reset on both pages; journey switch dialog; deep-link `/profile/settings` signed in and signed out; no horizontal overflow at 360/390; `/friends/:id` regression pass over hero, badges, remove-friend dialog.
