## 1. Acknowledgement Storage

- [x] 1.1 Add `migrations/0147_create_user_achievement_acknowledgements.sql`: `CREATE TABLE IF NOT EXISTS user_achievement_acknowledgements` with `user_id`, `instance_id`, `acknowledged_at`, composite `PRIMARY KEY (user_id, instance_id)`, `ON DELETE CASCADE` foreign keys to `users` and `user_achievement_instances`, and the migration header comment. No changes to `achievement_definitions` or `user_achievement_instances`.
- [x] 1.2 Add a Jest migration test applying `0142`, `0143`, and `0147` twice in an in-memory SQLite database: table exists, duplicate application is a no-op, and `user_achievement_instances` columns are unchanged.

## 2. Acknowledgement Domain Service

- [x] 2.1 Create `src/achievement-acknowledgements.ts` with `listPendingAchievements(db, userId)` (instances anti-joined against acknowledgements, ordered `earned_at ASC, id ASC`, each row carrying its awarding ordinal within the definition) and `acknowledgeAchievementInstances(db, userId, instanceIds)` returning `{ acknowledged: n }` with per-ID `ON CONFLICT DO NOTHING`.
- [x] 2.2 Add Jest coverage: pending excludes acknowledged and foreign instances, ordering is oldest-first, acknowledge is idempotent, foreign IDs are ignored, instance rows are never mutated, and per-instance awarding ordinals cross rank thresholds correctly.

## 3. Pending and Acknowledge API

- [x] 3.1 Add `handleGetPendingAchievements(request, db, currentUserId)` and `handleAcknowledgeAchievements(request, db, currentUserId)` to `src/achievement-handlers.ts`. Pending returns `{ pending: [...] }` with each entry mapped through `resolveBadgePresentation` using the instance's awarding ordinal (not the definition's current `earned_count`), and includes the current `earned_count` for repeat context; acknowledge validates `instance_ids` as a non-empty array of at most 100 positive integers (400 otherwise) and returns `{ acknowledged: n }`.
- [x] 3.2 Wire `app.get('/api/achievements/pending', authGuard, …)` and `app.post('/api/achievements/acknowledge', authGuard, …)` beside `/api/achievements` in `src/index.ts`. No method-registry edits; 405s come from `app.routes`.
- [x] 3.3 Add `tests/api/achievement-pending-handlers.test.ts`: pending with data, acknowledged filtering, empty list, 401, ordering, today's entry shape, per-instance awarding rank across thresholds, and `presentation` mapping.
- [x] 3.4 Add `tests/api/achievement-acknowledge-handlers.test.ts`: success count, repeat acknowledge, foreign/stale IDs ignored, missing/empty/non-integer/over-100 `instance_ids` 400, and 401.
- [x] 3.5 Add route tests modeled on `tests/api/push-routes.test.ts`: `app.request` dispatches both routes with the guard-provided user id, and unsupported methods on both paths return 405 with an `Allow` header.

## 4. BadgeAwardModal Island

- [x] 4.1 Create `client/src/islands/BadgeAwardModal.tsx` and `client/src/stores/badgeAwardModalStore.ts` (signals for visibility, mode, and queue). Acknowledge mode: multiple awards may queue, one badge shown at a time with "Badge x of n" position, per-badge acknowledge-then-advance, retry control on failed acknowledge. Dismiss/Escape acknowledges a repeatable award and closes it, but leaves a one-off award pending; a failed repeatable close-acknowledgement holds the badge with retry. View-only mode: renders the badge payload from the event, no acknowledge control, current rank from the grid.
- [x] 4.2 Wire the pending fetch: once per page view, using `sessionToken` from `client/src/stores/appStore.ts` and `getAuthHeaders` from `client/src/utils/auth.ts`; no request without a token; 401, failure, and empty list render nothing with no retry in that page view.
- [x] 4.3 Wire image presentation: validate `image_slug` against the grid's pattern, build the full source as `/img/achievements/full/<name>.webp` (`<image_slug>--<rank_label>` for repeatables), progressive thumb-first loading with base-image retry, and text-only fallback when the slug is invalid or every image attempt fails.
- [x] 4.4 Wire dialog behavior: `role="dialog"`, `aria-modal`, `aria-label` from the badge name, Escape and overlay closing with repeatability-aware dismiss semantics in acknowledge mode, focus into the dialog on open, and focus restore to the triggering element when opened by a grid card. Defer the open attempt only while another modal dialog is open; the map page is not a modal and never blocks the award modal.
- [x] 4.5 Register the island in `client/src/index.tsx` (`autoHydratedIslands` and `allIslands`, alphabetical); add `<div data-island="BadgeAwardModal"></div>` beside the existing global islands in `src/renderLayout.ts` and add `/css/badge-award.css` to the global stylesheet list.
- [x] 4.6 Add `client/src/islands/BadgeAwardModal.test.tsx` (Vitest): acknowledge queue advance and position text, last-award close, one-off dismiss leaves the award pending, repeatable dismiss acknowledges it, failed repeatable close retry, failed acknowledge retry, view-only payload rendering with no acknowledge control and current rank, deferred open while another modal dialog is open, map page not deferred, pending/no-token/401/failure/empty branches, awarding-rank artwork for queued repeatables (same rank vs threshold crossing), malformed-slug fallback, image-error fallback, Escape/overlay close, and focus return.

## 5. Badge Grid Integration

- [x] 5.1 Extend `BadgeDisplayIsland` so each earned badge card is activatable (button semantics, accessible name including rank, collection position, and repeat count) and dispatches `wtm:open-badge-modal` with the badge's summary entry plus `presentation` in `detail`, in both profile and friend modes. No acknowledge logic in the grid.
- [x] 5.2 Extend `client/src/islands/BadgeDisplayIsland.test.tsx` (Vitest): card activation fires the event with the correct badge payload in profile and friend modes, keyboard activation opens identically, and view-only mode issues no acknowledge request.

## 6. Styles

- [x] 6.1 Create `public/css/badge-award.css`: overlay and dialog geometry consistent with the existing modal classes, queue position text, rank/repeat chips, artwork sizing (1024 full in a contained well, thumb crossfade), focus outlines, and the mobile-adaptive layout. Design-guide variables only; no hardcoded colors.
- [x] 6.2 Add `@media (prefers-reduced-motion: reduce)` rules disabling entrance and celebration transitions.

## 7. Documentation

- [x] 7.1 Update `docs/api-reference.md` with `GET /api/achievements/pending` and `POST /api/achievements/acknowledge` rows under the Achievements section: auth, request/response shapes, idempotency, and 400/401 behavior.
- [x] 7.2 Update `docs/data-models.md` with the `user_achievement_acknowledgements` table, the one-row-per-user-per-instance rule, and the pending-is-instances-minus-acks semantics.
- [x] 7.3 Update `docs/design-guide.md` with the award modal pattern (dialog semantics, repeatability-aware close behavior, queue behavior, awarding-rank artwork, reduced-motion rule, design-variable usage) without duplicating CSS specifics.

## 8. Validation

- [x] 8.1 Run `npm test` and fix regressions in the new storage, domain, handler, and route tests.
- [x] 8.2 Run `npm run test:client` and fix regressions in the modal and grid integration suites.
- [x] 8.3 Run `npm run check` and resolve TypeScript or Wrangler dry-run issues.
- [x] 8.4 Run `openspec validate badge-award-modal --strict` and resolve any spec-format errors.
