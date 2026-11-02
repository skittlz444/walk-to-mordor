## Why

`profile-badge-display` renders the badge grid and awards badges from walk logging, but a newly earned badge becomes visible only if the user happens to open the profile grid afterwards. A user who crosses a threshold mid-walk gets no moment of recognition, and backfilled badges (awarded before the display shipped) surface silently. The artwork contract already commits 1024 px full images that no UI references yet. This change adds the award modal: a queued presentation of newly earned — including backfilled — awards the next time the user opens the app, and the same modal re-opened later by clicking any badge in the profile or friend badge grid.

## What Changes

- Add a `user_achievement_acknowledgements` table (new migration): one acknowledgement row per user per earned instance. Earned instances stay append-only and are never mutated; acknowledgements are a separate projection.
- Add `GET /api/achievements/pending`: the authenticated user's earned-but-unacknowledged awards, ordered oldest-earned first, carrying the same server-resolved `presentation` block as the summary endpoint plus the instance `earned_at`.
- Add `POST /api/achievements/acknowledge`: idempotently acknowledges a list of pending instance IDs for the caller.
- Add `BadgeAwardModal`, a Preact island mounted globally in the layout: on page open with awarded-but-unacknowledged badges it opens in acknowledge mode and queues the awards one at a time; clicking "Continue" acknowledges the shown award and advances, closing without acknowledging leaves the award pending for the next visit.
- Wire the profile and friend badge grids to open the same modal in view-only mode when a badge card is clicked; view-only mode never acknowledges and friend-profile badges are always view-only for the viewer.
- Use the 1024 px full badge image at `/img/achievements/full/<name>.webp` (repeatables use `<image_slug>--<rank_label>.webp`) with progressive thumbnail loading and the grid's existing slug-validation and image-fallback rules.
- Add `badge-award.css` using design-guide variables only, with escape/overlay closing, focus movement into and restoration out of the dialog, reduced-motion handling, and a mobile-adaptive layout.

## Capabilities

### New Capabilities

- `badge-award-modal`: acknowledgement storage, the pending and acknowledge endpoints, the globally mounted award modal (acknowledge mode and view-only mode), grid-click triggers, and the full-image presentation contract.

### Modified Capabilities

- None. `profile-badge-display`'s grid and summary contracts are unchanged; the modal consumes them through a client-side event instead of a spec change. `shared-achievement-infra` storage stays append-only; acknowledgements are a new, separate concern defined inside this capability.

## Impact

- Worker APIs: `src/achievement-acknowledgements.ts` (pending query, idempotent acknowledgement), handlers appended to `src/achievement-handlers.ts`, and two `authGuard` routes beside `/api/achievements` in `src/index.ts`; 405 handling stays automatic through `app.routes`.
- D1: `migrations/0147_create_user_achievement_acknowledgements.sql`. No table, index, or column changes to `achievement_definitions` or `user_achievement_instances`.
- Frontend: new `BadgeAwardModal` island and `badgeAwardModalStore` registered in `client/src/index.tsx`; layout-global mount and stylesheet wiring in `src/renderLayout.ts`; `BadgeDisplayIsland` cards fire an open event in both profile and friend modes.
- Dependencies: consumes `resolveBadgePresentation` and the `GET /api/achievements` contract added by `profile-badge-display` (`migrations/0144` schema, `src/badge-presentation.ts`). Spec-level independent; implementation lands after that change so handlers and the presentation resolver exist.
- `awardAchievement`'s `isNew` return is unchanged and intentionally NOT used by this modal: the modal derives pending state from earned instances minus acknowledgements, so backfilled awards greet the user even though no award-time signal fired.
- Tests: Jest for the migration, acknowledgement domain logic, pending/acknowledge handlers, and route dispatch; Vitest for the modal island and the grid-click integration.
- Docs: `docs/api-reference.md` (two endpoints), `docs/data-models.md` (acknowledgement table), `docs/design-guide.md` (modal pattern).
