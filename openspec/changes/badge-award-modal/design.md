## Context

`profile-badge-display` introduced `GET /api/achievements` (`src/achievement-handlers.ts`), a `presentation` resolver (`src/badge-presentation.ts`), the `GET /api/achievements` grid island (`BadgeDisplayIsland`), and the walk-log award hook (`src/achievement-awards.ts`). `awardAchievement` in `src/achievement-utils.ts` returns `{ instanceId, isNew }`, but that flag only exists in-process at award time: nothing persists it to a client-visible surface. The change deliberately stops short of "No badge detail modal or click-to-expand behaviour", leaving a follow-up for the 1024 px full artwork (`/img/achievements/full/<name>.webp`) that is committed but unreferenced.

Key patterns this change reuses:

- Routes: `app.get('...', authGuard, (c) => handler(...))` beside `/api/total-distance` and `/api/achievements` in `src/index.ts`; 405s are derived from `app.routes`, so no method registry edit is needed.
- Islands: auto-hydrated by name from `data-island` attributes via `client/src/index.tsx`; `renderLayout.ts` already mounts global islands on every page (`PwaInstallBanner`, `PushNudgeBanner`) and loads global stylesheets (`/css/drawer.css`) for them.
- Modals: `GoalModal` (`modal-overlay` / `modal-dialog` semantics, Escape handling, progressive thumb→high-resolution image loading with format fallback); `DrawerIsland` (focus-into-dialog and restore-to-trigger); `PalantirIsland` and `party.css` (`prefers-reduced-motion` handling, `role="dialog"` confirm dialogs).
- Seen-state: `PushNudgeBanner` and `PalantirIsland` persist dismissal in `localStorage`; that pattern is rejected here because awards must converge across devices.
- Queue semantics: `MapWalkIsland` shows milestone congratulations one at a time from a queue and advances on dismiss.
- Migrations: `CREATE TABLE IF NOT EXISTS`, header comment, commented per-index rationale (`0139`, `0143`).

## Goals / Non-Goals

**Goals:**
- Greet newly earned — including backfilled — awards with a queued modal the next time the user opens the app on any authenticated page, including the map.
- Persist acknowledgement per user per instance so multi-device state converges and awards are shown exactly once.
- Let the user re-open any earned badge from the profile or friend badge grid using the same modal, view-only.
- Show the 1024 px full badge artwork with the grid's display rules (slug validation, rank variants, fallbacks).
- Keep accessibility parity with the existing modal standards: Escape, focus management, reduced motion, mobile layout.

**Non-Goals:**
- No award-time toast, banner, email, or push message; awards are only surfaced by the modal on page open.
- No change to `POST`/`PUT` progress responses: `isNew` from `awardAchievement` is not surfaced to the client and the progress contract is untouched.
- No live mid-session reactivity: badging during an open session does not pop the modal before the next page open.
- No "NEW" chip or acknowledged flag in the badge grid; that requires a summary change and is deferred.
- No friend acknowledgement, no friend-scoped pending list, no sharing of award images.
- No user preference to disable the modal, and no sound.
- No schema or spec change to `profile-badge-display`'s grid: card activation is fire-and-forget UI wiring, not a contract change.
- No admin UI and no bulk acknowledge-all endpoint beyond the instance-ID array.

## Decisions

### Persist acknowledgements per instance in a new table

`migrations/0147_create_user_achievement_acknowledgements.sql` creates:

```sql
CREATE TABLE IF NOT EXISTS user_achievement_acknowledgements (
    user_id INTEGER NOT NULL,
    instance_id INTEGER NOT NULL,
    acknowledged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, instance_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (instance_id) REFERENCES user_achievement_instances(id) ON DELETE CASCADE
);
```

The composite primary key enforces "one acknowledgement per user per instance" and also serves as the join index for the pending query (prefix on `user_id`), so no secondary index is needed.

Rejected alternative — an `earned_at`-based client cursor (`acknowledged_until` timestamp per user): pending = instances with `earned_at > cursor`. Fewer rows overall, but it fails on the details that matter: repeatable badges (several instances per definition), awards in the same instant during a backfill batch, and a race where acknowledging on device A sets the cursor past an instance device B has not rendered yet. The instance-keyed table is precise, makes the pending list a simple anti-join, and stays trivially idempotent (`INSERT OR IGNORE`-equivalent upsert via `ON CONFLICT DO NOTHING`). Row volume stays trivial (roughly one row per earned award; even daily habit earning accumulates only weekly keyed instances).

Rejected alternative — mutating `user_achievement_instances` with a `seen` column: violates the shared-infra append-only guarantee and changes a contract three consuming features rely on.

The table is a projection, not a log: acknowledgements may be inserted (idempotently) but the append-only instance semantics are untouched, so the `shared-achievement-infra` spec needs no delta.

### Pending and acknowledge as the only two API additions

- `GET /api/achievements/pending` — `authGuard`, handler in `src/achievement-handlers.ts`, wrapping a new query in `src/achievement-acknowledgements.ts`: `user_achievement_instances` joined to `achievement_definitions`, anti-joined against `user_achievement_acknowledgements` on `(user_id, instance_id)`, ordered `earned_at ASC, id ASC`. Envelope `{ pending: [...] }` matches the `{ achievements: [...] }` convention. Each entry carries `instance_id`, `earned_at` (normalized to ISO 8601 UTC), `earned_count`, the definition display fields, and `presentation` resolved through `resolveBadgePresentation` with the instance's *awarding ordinal* — a correlated `COUNT(*)` of earlier instances for the same user and definition, ordered by `(earned_at, id)` to match the pending list. For a repeatable with thresholds `[1,4,12,26]`, ordinals 1–3 resolve to bronze, 4–11 to silver, and so on, so two queued instances that cross a threshold show different boss artwork. Fixed-rank definitions ignore the ordinal and use their fixed rank. The grid summary continues to use the current `earned_count`; only pending entries use the awarding ordinal.
- `POST /api/achievements/acknowledge` — body `{ instance_ids: number[] }`, validated as a non-empty array of positive integers (400 otherwise). Acknowledge is `INSERT ... ON CONFLICT DO NOTHING` per ID, capped at 100 IDs per request and executed as one atomic D1 batch; only rows that belong to `user_achievement_instances` of the caller are affected, so foreign or stale IDs are silently ignored, and the success response `{ acknowledged: n }` counts only newly inserted rows. This makes replay safe: clients may re-ack after a retry-success race without duplicating state.

Auth cases follow the existing conventions: missing/invalid token → 401 (`authGuard`); non-friend scoping is not needed because both routes are self-scoped and never accept a `userId` parameter — friend badges are only ever viewed from the summary the grid already holds.

### Deliberately not using `isNew`

`awardAchievement`'s `isNew` is an award-time, in-process signal; it cannot survive to "the next time the user opens the site", which is exactly when the modal fires. The pending endpoint derives state as *earned instances minus acknowledgements*, which handles both live awards (fired at walk-log time) and backfills (all earned before the acknowledgement table existed) uniformly: every backfilled badge is pending until it is acknowledged once. This is also why no push/toast path is coupled to the award hook.

### Oldest-first queue ordering

The pending list is chronological (oldest earned first) even though the summary endpoint is newest-first. The modal narrates an award ceremony: crossing into Khazad-dûm before the Golden Wood reads coherently, and a backfill batch replays the user's history in order. The acknowledge API takes IDs, so ordering is a presentation choice that costs nothing server-side.

### Acknowledge-on-advance; close semantics depend on repeatability

The modal acknowledges each award when the user actively advances ("Continue" / "Collect badge"). Closing, pressing Escape, or activating the overlay follows the award's repeatability:

- **Non-repeatable:** close without acknowledging, so the award remains pending and is required on a later visit.
- **Repeatable:** acknowledge the shown instance on close, so it does not re-trigger on the next page open. A failed close-acknowledgement holds the same badge with a retry control instead of closing silently. Any remaining queued awards stay pending.

Consequences:

- A one-off award can never be skipped by dismissal; only "Continue" clears it.
- A repeatable award does not nag forever after the user has seen it; close is an explicit acknowledgement.
- Force-closing the tab mid-queue leaves the remaining awards pending — they re-open next visit; nothing is silently swallowed.
- A failed acknowledge (network, 500, 401 mid-session) holds the same badge with retry; advancement and repeatable close are blocked until it succeeds.
- Repeat acknowledgements are idempotent, so a retry that lands twice is harmless.
- Multi-device: device B's stale pending list may still show an award that device A acknowledged. The fetch acknowledges-once model makes both devices converge: the next fetch on B returns the shorter list. No push continuity is attempted.

### One globally mounted island with two modes

`BadgeAwardModal` is registered in `client/src/index.tsx` and mounted once in `src/renderLayout.ts` next to `PwaInstallBanner`, with `/css/badge-award.css` added beside `/css/drawer.css` in the global stylesheet list. One island, one mount, two modes:

- **Acknowledge mode** — driven by the island's own pending fetch after hydration. Multiple pending awards may sit in the queue; one badge at a time, "Badge x of n" position text, primary action acknowledges and advances. Dismiss/Escape acknowledges repeatable awards and leaves non-repeatable awards pending. Because recognition should not interrupt an in-progress session unexpectedly, the open attempt waits only while another modal dialog is open (an actual `[role="dialog"][aria-modal="true"]` or `.modal-overlay` root, not the map), re-checking until it closes or the page is left. The map is a normal authenticated page and never blocks the award modal.
- **View-only mode** — driven by a `wtm:open-badge-modal` `CustomEvent` on `document`, with the full badge payload in `detail` (the summary entry plus `presentation` the grid already holds). Details: no acknowledge/continue control; no new fetch. Chosen over a shared signals store so `BadgeDisplayIsland` never imports the modal and the modal never imports the grid — either island failing must not break the other, and pages without the grid still get the pending queue.

The island respects the existing bootstrap order: islands hydrate after `initializeAppStore()` resolves (`client/src/index.tsx` awaits `initializeAppStore()` before hydrating, so the global `sessionToken` signal from `client/src/stores/appStore.ts` is already populated when the modal fetches). The pending fetch runs once per page view; with no `sessionToken` it performs no request, and 401/5xx/network failure renders nothing and does not retry on that page view, matching `BadgeDisplayIsland`'s error posture and `BadgeDisplayIsland`'s 401 behavior.

An edge case the event flow handles explicitly: activating a grid card while the acknowledge queue is open switches to view-only for that badge and defers the remaining queue after it closes, rather than losing the awards. The queue stays in memory; the next open continues from where it left off.

### Full artwork with existing fallback rules and progressive loading

- Artwork name follows the grid contract exactly: validate `image_slug` against the same `^[a-z0-9-]+(/[a-z0-9-]+)*$` pattern; `<name>` = `<image_slug>--<rank_label>` for repeatables else `<image_slug>`; full source `/img/achievements/full/<name>.webp`. In acknowledge mode `presentation.rank_label` is the pending instance's awarding rank; in view-only mode it is the grid's current rank.
- Loading mirrors `GoalModal`'s progressive pattern: the 200 px `<name>-thumb.webp` shows immediately; the 1024 full image overlays and crossfades in on load, so a slow or missing 1024 asset never blocks or flashes the modal.
- Fallback chain: repeatable rank-variant full image fails → retry base `full/<image_slug>.webp`; both fail → hide the image and keep name, rank label, earned date, and description. Null or malformed slug → never request, show the text without an image. (No PNG/other-format fallback exists in the artwork contract, and the modal follows that.)
- Repeat context comes from the pending entry's `earned_count` and `earned_at` or, in view-only mode, from the grid badge payload (`earned_count`, earned date).

### Dialog behavior, accessibility, and CSS

- Marker markup reuses the shared section: `modal-overlay` + `modal-dialog` with `role="dialog"`, `aria-modal="true"`, `aria-label="<Badge name>"`; class names live in a new `public/css/badge-award.css`, which uses `var(--bg-modal-overlay)`, `var(--bg-secondary)`, `var(--text-primary)`, `var(--accent-gold)`, and existing spacing variables — no hardcoded hex values (design-guide rule).
- Escape closes (with dismiss semantics in acknowledge mode); overlay activation closes; focus moves into the dialog on open (primary action first) and is restored to the activating card when mode came from the grid — mirroring `DrawerIsland`'s focus management.
- `@media (prefers-reduced-motion: reduce)` in `badge-award.css` disables the entrance/pop transitions entirely (`palantir.css` is the in-repo precedent). No animation-library dependency is introduced; small CSS transitions only.
- Mobile: dialog width caps at ~90% with artwork scaling to fit, content columns stack vertically, and `.modal-overlay` z-index conventions apply so the badge modal sits alongside existing modal layers rather than fighting them.

### Migration and rollback

`migrations/0147_create_user_achievement_acknowledgements.sql` creates the table and nothing else; no backfill is needed, since the semantics of "no acknowledgement row" is exactly "pending" — including earned-but-never-seen history. Apply order does not matter relative to data seeds; it goes after `profile-badge-display` in implementation because the pending handler needs `resolveBadgePresentation`.

Rollback: drop the table and remove the island mount, handlers, and routes. Earned instances remain append-only and intact; the modal simply stops being served. A later re-introduction re-shows all not-yet-acknowledged history — acceptable and expected, not data loss.

## Risks / Trade-offs

- [Backfills produce a long first queue] → A user crossing many thresholds receives all of them as pending; the queue shows them in chronological order. The queue is capped only by the user's history, and the acknowledge-on-advance loop lets them dismiss-and-return any time for one-off awards; repeatable awards are acknowledged on close. If this proves naggy in practice, a per-queue "collect all" control is a small follow-up off the same endpoint shape.
- [Pending fetch on every page adds a request] → One indexed anti-join per page load; empty for nearly all users once acknowledged. Same cost profile as `BadgeDisplayIsland`'s grid fetch, and it is skipped entirely without a session token.
- [CustomEvent coupling is stringly typed] → Event name and `detail` shape documented in `docs/frontend-guide.md` rules notes and asserted in Vitest for both islands, so a rename fails tests rather than silently no-op'ing.
- [Pending rank is derived from the instance ordinal] → Historical rank is computed at read time from the definition's current thresholds. If a definition's thresholds are edited later, historical ranks change. Accepted because definitions are effectively immutable after release; a future hardening could snapshot `rank_label` in the instance's `context_metadata` at award time.
- [Repeatable close acknowledges on dismissal] → A user who wants to re-read a repeatable award later can still open it from the grid; the close action is intentionally one-way so it does not nag. One-off awards keep the explicit acknowledge requirement.
- [Deferred-open while another modal dialog is open can delay the badge on one page] → The deferral re-checks while a dialog remains open, then gives up for that page view; awards stay pending and re-open on the next page. The map is not treated as a modal, so map users see the queue immediately.

## Migration Plan

1. Add `migrations/0147_create_user_achievement_acknowledgements.sql` and its Jest migration test.
2. Add `src/achievement-acknowledgements.ts` (`listPendingAchievements`, `acknowledgeAchievementInstances`) with Jest coverage. The pending query computes each instance's awarding ordinal and exposes it for `resolveBadgePresentation`.
3. Add `handleGetPendingAchievements` and `handleAcknowledgeAchievements` to `src/achievement-handlers.ts`; map pending presentation with the awarding ordinal, wire the two `authGuard` routes in `src/index.ts`; add handler and route tests (modeled on `tests/api/push-routes.test.ts`).
4. Create `BadgeAwardModal` + `badgeAwardModalStore`, register in `client/src/index.tsx`, mount in `src/renderLayout.ts`, create `public/css/badge-award.css` and wire it globally.
5. Extend `BadgeDisplayIsland` cards to fire the open event in own and friend modes with button semantics and Vitest coverage.
6. Update `docs/api-reference.md`, `docs/data-models.md`, and `docs/design-guide.md`.
7. Run `npm test`, `npm run test:client`, `npm run check`, and `openspec validate badge-award-modal --strict`.

Rollback strategy: remove the island mount/registration, event wiring, handlers, routes, stylesheet reference; drop the acknowledgement table. Instances are untouched; nothing else changes.

## Open Questions

None. Resolved decisions:

- Acknowledgements persist per user per instance in a new table; the `earned_at` cursor idea is rejected (fails repeatables, backfill batches, and multi-device races).
- `GET /api/achievements/pending` returns `{ pending: [...] }` oldest-first; `POST /api/achievements/acknowledge` takes `{ instance_ids: [...] }`, is idempotent, ignores foreign IDs, 400s malformed bodies, 401s unauthenticated calls; both routes are self-scoped (no `userId` parameter).
- `isNew` is unused by this change; pending is derived from instances minus acknowledgements so backfills are covered.
- One global island (`renderLayout` mount), custom-event open from the badge grids, two modes: acknowledge (own pending queue) and view-only (always for friend badges).
- Pending presentation uses the instance's awarding ordinal; view-only uses the grid's current rank.
- One-off awards require explicit acknowledgement; repeatable awards are acknowledged by close/Escape so they do not re-trigger.
- Mount on every authenticated page including the map; defer only while another modal dialog is open; multiple awards may queue at once.
- Artwork uses the 1024 px `full/<name>.webp` with thumbnail-first progressive loading and the grid's slug/fallback rules.
