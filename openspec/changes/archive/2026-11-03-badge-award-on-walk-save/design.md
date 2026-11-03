# Design

## Context

`BadgeAwardModal` is mounted once per SSR page by `src/renderLayout.ts:109`. On hydration it claims a single pending fetch (`claimPendingFetch`, `client/src/stores/badgeAwardModalStore.ts:91`) and opens the queue if `GET /api/achievements/pending` returns awards.

Walk logging does not reload the page. `public/js/progress.js` handles the shared distance modal for the map (`window.showDistanceModal`) and the calendar (`window.showProgressModal`), and posts to `POST`/`PUT /api/calendar-progress`. Awards are written inside that request, so by the time the response resolves the queue is already stale in memory.

The existing requirement "Award modal greets pending awards on page open" deliberately allows exactly one hydration check per page view. This change adds a second, event-driven trigger without turning the hydration check into a retry loop.

## Goals / Non-Goals

**Goals**

- Celebrate a badge on the screen where the walk was logged, with no navigation.
- Never queue the same award instance twice in one page view.
- Never let the celebration path affect the walk save.
- Cover every flow that saves through the shared distance modal, not just the map.

**Non-Goals**

- No change to awarding rules, idempotency keys, or the pending/acknowledge endpoints.
- No change to dismiss semantics (one-off awards still stay pending until collected).
- No polling, no websockets, no background refresh.
- No server-driven push of new awards in the progress response.

## Decisions

### One document event from the shared modal

`public/js/progress.js` dispatches:

```js
document.dispatchEvent(new CustomEvent('wtm:walk-saved', {
  detail: { action: 'save' | 'update' | 'delete', date, distance },
}));
```

after the response resolves **and** `response.ok` is true. Dispatching only on success keeps rejected writes (409 duplicate date, validation errors) from opening an empty celebration.

Alternatives rejected: wiring only `MapWalkIsland`'s `onWalkSaved` callback leaves the journey calendar silently broken; adding a per-page callback in each template duplicates the same three lines in more places.

### The modal owns the refresh

`BadgeAwardModal` listens for `wtm:walk-saved` and ignores `delete`. It calls the same pending fetch used on hydration, with two differences: it merges instead of replacing, and it may run more than once per page view.

Alternatives rejected: a global polling loop (wasteful), and having `progress.js` call the endpoint and render the modal itself (duplicates the modal's queue, focus, and deferral logic in legacy code).

### Merge by `instance_id`, never replace

The hydration check sets the queue to the server list. A save-triggered check **appends** awards whose `instance_id` is not already queued, preserving the current index and any open modal. The server already excludes acknowledged instances, so a badge collected earlier cannot come back; the merge guards the case where an award is still in the in-memory queue.

### Coalesce concurrent refreshes

A save while a check is in flight sets a "re-run once" flag rather than issuing a parallel request. When the in-flight request settles, the queued run executes once. This bounds requests at one at a time and two per save in the worst case, and guarantees a badge written during an in-flight check is not missed.

### Failure is silent

A non-OK response or network error logs at most a console error. It does not open UI, does not set the acknowledge error banner, and does not retry. The walk save has already succeeded and must not be affected.

## Risks / Trade-offs

- [One extra request per successful walk save] → Accepted; it is one small authenticated GET, and it replaces a user reload.
- [Queue can grow while the modal is open] → Appending is intentional; the position counter already reads the live length, so "Badge 2 of 4" stays accurate.
- [A dismissed one-off badge can re-open after a later save] → Follows the existing dismiss contract, which keeps one-off awards pending until explicitly collected; the next save legitimately re-reads them. It is not queued twice, because merging is keyed by instance id.
- [Legacy event name drift between plain JS and TS] → The literal is documented in both files; the unit test dispatches the same string the legacy file uses.
- [Modal opens over the map calendar sheet] → The existing `openWhenNoModalIsOpen` deferral observes dialog closure and waits, so the celebration appears after the sheet closes.

## Migration Plan

Client-only. Ship the bundle; no data or API change. Rollback is a revert of the three files.

## Open Questions

None.
