# Proposal: Award badges where the walk was logged

## Why

Badges are awarded server-side during the progress write, but the award modal only checks `GET /api/achievements/pending` once per page load (`claimPendingFetch()` in `client/src/stores/badgeAwardModalStore.ts`). The map, the journey calendar, and the legacy distance modal all save a walk **without reloading the page**, so a badge earned there is not celebrated until the user happens to navigate somewhere else.

Live testing showed the failure mode clearly: a walk logged on the map (in fellowship view) awarded its badges immediately, but nothing appeared. The queue only surfaced after navigating to the journey page, where the whole pending list — including older, never-acknowledged badges from the `0148` backfill — opened at once. It looked like badges were missing, then like the queue was re-showing old ones.

## What Changes

- The shared distance modal (`public/js/progress.js`, used by the map and both calendar flows) dispatches a `wtm:walk-saved` document event after a **successful** create or update.
- `BadgeAwardModal` listens for that event and runs one event-driven pending check, merges unseen awards into the in-memory queue by `instance_id`, and opens the modal when nothing else is open.
- Refreshes coalesce: one in flight at a time, with at most one re-run queued, so a save during a check is not lost.
- A failed or empty refresh renders nothing, never retries in a loop, and never affects the walk save.
- Deletes do not refresh.
- No API, schema, migration, or server-behavior change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `badge-award-modal`: adds an event-driven pending check after a successful walk save, alongside the existing once-per-page-load hydration check.

## Impact

- `public/js/progress.js` — dispatch the event only when `response.ok`, so rejected saves (for example a duplicate date returning 409) never celebrate.
- `client/src/stores/badgeAwardModalStore.ts` — merge-by-instance-id and refresh coordination.
- `client/src/islands/BadgeAwardModal.tsx` — event listener and shared fetch path.
- Tests: `client/src/islands/BadgeAwardModal.test.tsx` (Vitest) plus the map walk-logging Playwright flow.
- No change to awarding rules, the pending endpoint, the acknowledge endpoint, or dismiss semantics.
