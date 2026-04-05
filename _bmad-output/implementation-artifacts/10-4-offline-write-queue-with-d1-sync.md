# Story 10.4: Offline Write Queue with D1 Sync

Status: ready-for-dev

## Story

As a user,
I want to log my walks even when I'm offline and always see the distance I just entered immediately,
so that I never lose a walk entry due to poor connectivity, never see stale data after saving, and am never tempted to re-enter a distance because it didn't appear.

## Key UX Principle

**Optimistic-first, no stale data.** The user's number-one frustration is: "I just typed in 5 km, hit save, and the calendar still shows the old value — did it work?" This story must guarantee:

1. The distance the user just entered appears in the calendar **instantly** — before any network round-trip.
2. If offline, the entry persists locally and displays with a subtle "pending sync" indicator.
3. When the entry syncs, the indicator silently disappears — no jarring reload.
4. If sync fails, the user is clearly told why and the entry stays visible with an error badge.
5. The user must **never** see the old total/calendar re-fetched from cache overwrite what they just entered.

## Acceptance Criteria (BDD)

### AC1: Optimistic local-first save
**Given** the user submits a new walk log entry via the DistanceModal  
**When** they click Save  
**Then** the calendar cell and total distance update **immediately** from local state (before fetch resolves)  
**And** the modal closes  
**And** the entry is added to the local events array so any subsequent calendar re-render preserves it  

### AC2: Offline queue capture
**Given** the user is offline or the POST to `/api/calendar-progress` fails with a network/timeout error  
**When** the Service Worker intercepts the failed POST  
**Then** the request body is stored in an IndexedDB queue (`offline-walk-queue`)  
**And** the SW returns a synthetic `202 Accepted` response with `{ offline: true, date, distance }`  
**And** the client receives this response and treats it as a successful save (calendar already updated optimistically)  

### AC3: Pending sync visual indicator
**Given** there are queued entries in IndexedDB  
**When** the calendar renders  
**Then** each day cell with a pending entry shows a small "pending sync" dot/icon (e.g., a subtle cloud icon or pulsing dot)  
**And** a non-intrusive banner or badge appears indicating "X walk(s) waiting to sync"  

### AC4: Background Sync replay
**Given** queued entries exist and connectivity is restored  
**When** the Background Sync API fires the `sync-walks` event (or the fallback `online` event triggers)  
**Then** all queued entries are replayed to `POST /api/calendar-progress` in chronological order (oldest first)  
**And** each entry uses the auth header captured at queue time  
**And** the SWR cache for `GET /api/calendar-progress` and `GET /api/total-distance` is invalidated after replay  

### AC5: Successful sync clears indicator
**Given** all queued entries sync successfully  
**When** the SW posts `{ type: 'sw-sync-complete' }` to the client  
**Then** all pending sync indicators are removed from the calendar  
**And** `updateCalendarAndTotal()` is called to refresh from the server (but only AFTER the sync — not during the optimistic window)  

### AC6: Duplicate prevention on sync
**Given** an entry for `(date, user_id)` already exists server-side (409 response)  
**When** the SW attempts to replay a queued entry  
**Then** the entry is marked as `synced` (not `error`) and removed from the queue  
**And** no error is shown to the user — this is expected when optimistic local + server raced  

### AC7: Sync failure handling
**Given** a queued entry fails with a server validation error (400/500, not 409)  
**When** the SW receives the error response  
**Then** the entry status is set to `error` with the error reason  
**And** the SW posts `{ type: 'sw-sync-error', date, errorReason }` to the client  
**And** the calendar cell shows an error indicator for that day  
**And** the user is notified (toast or banner) with the error reason  

### AC8: SWR cache guard — no stale overwrites after save
**Given** the user has just saved a new entry (optimistically in local state)  
**When** the SWR background revalidation for `GET /api/calendar-progress` fires  
**Then** if a local optimistic entry exists that is newer than the SWR cached response, the local entry takes precedence  
**And** the stale cached version does NOT overwrite what the user just entered  
**And** this guard is released once the entry is confirmed synced (from server response or sync-complete message)  

### AC9: Edit and delete excluded from offline queue
**Given** the user is offline  
**When** they attempt to edit (PUT) or delete (DELETE) an existing entry  
**Then** the operation is NOT queued — it falls through to the network and fails naturally  
**And** the user sees an appropriate error ("You need to be online to edit/delete entries")  

### AC10: Queue size cap
**Given** the offline queue already contains 100 entries  
**When** the user tries to log another walk offline  
**Then** the new entry is rejected  
**And** the user sees a message: "Offline queue is full — please connect to sync your walks first"  

### AC11: Tests
**Given** the offline queue implementation is complete  
**Then** unit tests cover: IndexedDB queue CRUD, replay logic, duplicate (409) handling, error handling, queue cap  
**And** client-side tests cover: optimistic update, pending indicator display, stale-cache guard  
**And** integration test covers: save while offline → go online → verify sync → verify indicator cleared  

## Tasks / Subtasks

- [ ] **Task 1: IndexedDB queue module in SW** (AC: #2, #10)
  - [ ] 1.1 Create `openOfflineQueue()` helper in `public/sw.js` — promisified IndexedDB wrapper for `offline-walk-queue` object store
  - [ ] 1.2 Schema: `{ id: autoIncrement, date: string, distance: number, authHeader: string, createdAt: number, status: 'pending'|'synced'|'error', errorReason?: string }`
  - [ ] 1.3 Implement `enqueueWalk(entry)` — validates cap of 100, stores entry, returns stored entry
  - [ ] 1.4 Implement `getPendingWalks()` — returns all entries where status === 'pending', ordered by createdAt ASC
  - [ ] 1.5 Implement `updateWalkStatus(id, status, errorReason?)` — updates entry status
  - [ ] 1.6 Implement `clearSyncedWalks()` — deletes all entries where status === 'synced'

- [ ] **Task 2: SW fetch intercept for POST /api/calendar-progress** (AC: #2, #6, #7)
  - [ ] 2.1 In the SW `fetch` event handler, before the generic mutation block, add a specific check for `POST /api/calendar-progress`
  - [ ] 2.2 Clone the request, attempt `fetch()` — if successful, pass through the real response (plus trigger SWR cache bump as existing)
  - [ ] 2.3 On network error (TypeError from fetch), clone the request body, extract `start` and `title` fields, capture `Authorization` header
  - [ ] 2.4 Store in IndexedDB as `{ date: body.start, distance: Number(body.title), authHeader, createdAt: Date.now(), status: 'pending' }`
  - [ ] 2.5 Return synthetic `new Response(JSON.stringify({ message: 'Queued offline', offline: true, date: body.start, distance: Number(body.title) }), { status: 202 })`
  - [ ] 2.6 If queue is full (100 entries), return `new Response(JSON.stringify({ error: 'Offline queue full' }), { status: 507 })`

- [ ] **Task 3: Background Sync replay** (AC: #4, #5, #6, #7)
  - [ ] 3.1 Register `self.addEventListener('sync', ...)` for tag `'sync-walks'`
  - [ ] 3.2 In sync handler: get all pending walks, replay each sequentially via `fetch(POST /api/calendar-progress, { body: { start: entry.date, title: String(entry.distance) }, headers: { Authorization: entry.authHeader, Content-Type: application/json } })`
  - [ ] 3.3 On 201 response: mark entry as `synced`
  - [ ] 3.4 On 409 response: mark entry as `synced` (duplicate — expected)
  - [ ] 3.5 On 4xx/5xx response: mark entry as `error` with response body as errorReason
  - [ ] 3.6 After all entries processed: call `clearSyncedWalks()`, invalidate SWR cache, notify clients
  - [ ] 3.7 Notify clients: `notifyClients({ type: 'sw-sync-complete' })` on success, `notifyClients({ type: 'sw-sync-error', date, errorReason })` on failures

- [ ] **Task 4: Fallback online detection** (AC: #4)
  - [ ] 4.1 In SW, listen for `message` event type `'sw-retry-sync'` — triggers replay manually (for browsers without Background Sync)
  - [ ] 4.2 In client JS (`public/js/progress.js` or `calendar.js`), add `window.addEventListener('online', ...)` that posts `{ type: 'sw-retry-sync' }` to `navigator.serviceWorker.controller`
  - [ ] 4.3 Debounce with 2-second delay to avoid rapid-fire on flaky connections

- [ ] **Task 5: Optimistic UI in progress.js** (AC: #1, #8)
  - [ ] 5.1 In `handleSaveDistance()`, KEEP the existing optimistic local events array update (already pushes `{ start, title }` before fetch)
  - [ ] 5.2 Add a `window._pendingOptimisticSaves` Map (keyed by date string → distance) to track entries not yet confirmed by server
  - [ ] 5.3 After fetch resolves (200/201/202), remove from `_pendingOptimisticSaves` for 200/201 only; for 202 (offline) keep it until sync-complete
  - [ ] 5.4 In `updateCalendarAndTotal()`, AFTER fetching server data, merge `_pendingOptimisticSaves` entries on top — so stale SWR cache never overwrites just-entered values
  - [ ] 5.5 On receiving `sw-sync-complete` message: clear all `_pendingOptimisticSaves`, then call `updateCalendarAndTotal()` to pull confirmed data

- [ ] **Task 6: Pending sync indicators in calendar UI** (AC: #3, #5, #7)
  - [ ] 6.1 Add CSS class `.pending-sync` on calendar day cells that have entries in `_pendingOptimisticSaves` — style with a small pulsing dot overlay
  - [ ] 6.2 Add CSS class `.sync-error` on calendar day cells that received `sw-sync-error` — style with red error dot
  - [ ] 6.3 Optional: Add a small banner/badge below the calendar header: "⏳ X walk(s) waiting to sync" (only visible when pending count > 0)
  - [ ] 6.4 On `sw-sync-complete`, remove `.pending-sync` class from all cells
  - [ ] 6.5 On `sw-sync-error`, update the specific cell with `.sync-error`

- [ ] **Task 7: Edit/Delete offline guard** (AC: #9)
  - [ ] 7.1 In `handleSaveDistance()` (edit path) and `handleDeleteDistance()`, check `navigator.onLine` before making the request
  - [ ] 7.2 If offline, show an alert/toast: "You need to be online to edit/delete entries"
  - [ ] 7.3 Do NOT modify the SW mutation handler for PUT/DELETE — they remain passthrough

- [ ] **Task 8: SW message listener setup in client** (AC: #5, #7)
  - [ ] 8.1 In `public/js/progress.js` (or `calendar.js`), register `navigator.serviceWorker.addEventListener('message', handler)` on module init
  - [ ] 8.2 Handle `sw-sync-complete`: clear pendingOptimisticSaves, remove .pending-sync CSS, call updateCalendarAndTotal
  - [ ] 8.3 Handle `sw-sync-error`: mark specific date cell with .sync-error, show toast notification
  - [ ] 8.4 Handle existing `sw-cache-updated` for `/api/calendar-progress`: ONLY update calendar if no pending optimistic saves exist for that endpoint (stale guard)

- [ ] **Task 9: Tests** (AC: #11)
  - [ ] 9.1 Unit tests for IndexedDB queue helpers (mock indexedDB or use `fake-indexeddb`): enqueue, getPending, updateStatus, clearSynced, cap enforcement
  - [ ] 9.2 Unit tests for SW fetch intercept: online success passthrough, offline queue+synthetic response, queue full rejection
  - [ ] 9.3 Unit tests for replay logic: successful sync, 409 duplicate handling, error handling, SWR cache invalidation
  - [ ] 9.4 Client tests for optimistic merge in updateCalendarAndTotal: pendingOptimisticSaves not overwritten by stale cache
  - [ ] 9.5 Playwright E2E (if feasible): mock offline → save → verify pending indicator → restore online → verify sync

- [ ] **Task 10: CSS styles** (AC: #3)
  - [ ] 10.1 Add `.pending-sync` and `.sync-error` styles to `public/css/calendar.css` (or appropriate CSS file)
  - [ ] 10.2 Pending: small pulsing gold dot overlay (top-right of day cell), subtle animation
  - [ ] 10.3 Error: small red dot overlay, static

## Dev Notes

### Critical Architecture Context

#### Service Worker Intercept Point
The exact location to hook into is in [public/sw.js](public/sw.js) around line 165, in the fetch event handler. The current mutation block:
```js
if (requestUrl.origin === self.location.origin && requestUrl.pathname.startsWith('/api/') && event.request.method !== 'GET') {
  bumpSWRMutationVersion();
  event.waitUntil(caches.open(SWR_CACHE_NAME).then(...));
  return;  // ← passthrough to network
}
```
**Story 10.4 inserts a specific intercept BEFORE this generic block** for `POST /api/calendar-progress`. The new code must use `event.respondWith()` (which means it replaces the `return`), wrapping the fetch in a try/catch. All other mutations continue through the existing generic block unchanged.

#### API Body Format Mismatch — CRITICAL
The epic spec uses `{ date, distance }` for the IndexedDB schema. The actual API uses `{ start, title }`:
- **Wire format sent to API:** `{ start: "YYYY-MM-DD", title: "5.2" }` (title is distance as string)
- **IndexedDB stored format:** `{ date: "YYYY-MM-DD", distance: 5.2 }` (human-readable)
- **On replay, translate:** `{ start: entry.date, title: String(entry.distance) }`

[Source: src/progress-handlers.ts — handleProgressPost reads `body.start` and `body.title`]
[Source: public/js/progress.js — sends `{ start: selectedDate, title: distance }`]

#### Auth Header Capture
When queuing an offline entry, the SW must capture `event.request.headers.get('Authorization')` and store it alongside the entry — this header is needed for replay. Current auth header format: `Bearer <token>`.

[Source: public/js/progress.js ~line 240 uses `...window.getAuthHeaders()`]

#### Current UX Bug: No Error Handling on Save
The existing `handleSaveDistance()` in [public/js/progress.js](public/js/progress.js) closes the modal BEFORE the fetch resolves and has **no `.catch()`**. This means:
- Offline saves silently disappear (modal closes, fetch fails, no notification)
- The local events array IS updated optimistically (line ~235), but `updateCalendarAndTotal()` immediately re-fetches from server, which often returns stale SWR cache data → **overwrites the optimistic entry**

This is the root cause of the user's frustration: "I entered 5 km but it still shows the old data."

**Fix strategy:** Make `updateCalendarAndTotal()` respect `_pendingOptimisticSaves` — merge local entries on top of server-fetched data so they're never lost. Handle the fetch response (including 202 offline) in the `.then()` chain.

#### SWR Cache Race Condition
After a POST, the SW's generic mutation block clears the SWR cache. Then `updateCalendarAndTotal()` calls `GET /api/calendar-progress`, which hits the SW's SWR path. If the server hasn't processed the POST yet (or the user is offline), the SWR response won't include the new entry. The `_pendingOptimisticSaves` merge in `updateCalendarAndTotal()` prevents this stale data from overwriting the user's optimistic entry.

#### notifyClients() Helper — Reuse Existing
[public/sw.js](public/sw.js) already has `notifyClients(url)` that broadcasts `{ type: 'sw-cache-updated', url }` to all window clients. Extend this to also support sync events:
```js
// Extend notifyClients to accept arbitrary message objects
function notifyClients(message) {
  self.clients.matchAll({ type: 'window' }).then(function(clients) {
    clients.forEach(function(client) { client.postMessage(message); });
  });
}
```
Note: the existing `notifyClients(url)` passes a URL string. The new signature needs to support objects. Refactor to detect type: if argument is a string, wrap as `{ type: 'sw-cache-updated', url }` for backward compatibility; if object, pass through.

#### Background Sync API Availability
Background Sync (`self.registration.sync`) is supported in Chrome/Edge but NOT Firefox/Safari. The fallback `online` event listener in the client is essential for cross-browser support.

#### No New Dependencies
Do NOT add new runtime/client dependencies such as `idb`, `workbox`, or any IndexedDB wrapper/offline helper library. Use raw `indexedDB` API with a small promisified helper (~30 lines) inline in `sw.js`. Dev-only test dependencies are acceptable if needed for testing (for example, `fake-indexeddb`), because they do not ship in production. This matches the project's lightweight runtime dependency philosophy.

[Source: package.json runtime dependencies — no IndexedDB or offline libraries present]

### Project Structure Notes

All changes for this story are **client-side only** — no server-side (Cloudflare Worker) changes needed:

| File | Action | Purpose |
|---|---|---|
| `public/sw.js` | MODIFY | Add IndexedDB queue, POST intercept, sync replay, extended notifyClients |
| `public/js/progress.js` | MODIFY | Add optimistic save tracking, SW message listener, pending state management |
| `public/js/calendar.js` | MODIFY | Add pending/error indicator rendering in `updateCalendarAndTotal()` |
| `public/css/calendar.css` (or inline) | MODIFY | Add `.pending-sync` and `.sync-error` CSS classes |
| `tests/` (new files) | CREATE | Tests for queue, intercept, replay, optimistic merge |

**No new Preact components needed.** The calendar is legacy vanilla JS. Per the Islands Rule, do not rewrite it — add the offline logic to the existing vanilla JS modules.

**No server-side changes.** The 409 duplicate handling already exists in `handleProgressPost` via the `UNIQUE(date, user_id)` constraint. The SW interprets 409 as "already synced."

### Testing Standards

- **SW tests:** Jest with mocked `indexedDB` (use `fake-indexeddb` as dev dependency if needed, or write minimal mock). Test queue operations and replay logic as pure functions extracted from SW.
- **Client tests:** Vitest for any new utility functions. For DOM integration, Playwright E2E if feasible.
- **Coverage target:** >90% for new code in the queue module and replay logic.
- **Edge cases to test:**
  - Queue exactly at 100, try to add 101st
  - Replay with a mix of 201, 409, and 500 responses
  - `_pendingOptimisticSaves` merge doesn't duplicate entries when server returns the entry too
  - Auth token expired during replay (401) — entry stays pending, user re-authenticates
  - Multiple tabs: sync-complete should update all open tabs

### References

- [Source: public/sw.js — SWR caching, mutation handler, notifyClients helper]
- [Source: public/js/progress.js — handleSaveDistance, handleDeleteDistance, fetchAndUpdateTotalDistance]
- [Source: public/js/calendar.js — updateCalendarAndTotal, renderCalendar, events array]
- [Source: src/progress-handlers.ts — handleProgressPost validation, 409 duplicate, body format { start, title }]
- [Source: client/src/islands/DistanceModal.tsx — dumb UI shell, no fetch logic]
- [Source: docs/architecture.md — SW strategies, postMessage protocol, db.read/db.write pattern]
- [Source: src/renderLayout.ts lines 75-85 — SW registration in SSR shell]
- [Source: epics-phases-4-15.md — Story 10.4 original spec, FR_OFFLINE_01, NFR_OFFLINE_01]
- [Source: migrations/0005_add_unique_date_constraint.sql — UNIQUE(date, user_id) constraint]
- [MDN: Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
- [MDN: IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (via GitHub Copilot)

### Completion Notes List

- Story emphasizes UX-first approach per user request: optimistic updates, stale-cache guard, never lose entered data
- API body format mismatch (`start`/`title` vs `date`/`distance`) documented explicitly to prevent implementation bugs
- Existing `handleSaveDistance()` already has partial optimistic update (pushes to local events array) but `updateCalendarAndTotal()` immediately overwrites with server fetch — this is the core stale-data bug to fix
- No new dependencies — raw IndexedDB API, matching project philosophy
- Background Sync fallback is critical for Firefox/Safari support
- All changes are vanilla JS (legacy modules) — no Preact island needed per Islands Rule
- Server code already handles duplicates (409) — SW treats as "synced successfully"

### File List

- `public/sw.js` (modify)
- `public/js/progress.js` (modify)
- `public/js/calendar.js` (modify)
- `public/css/calendar.css` (modify — or whichever CSS file styles the calendar)
- `tests/sw-offline-queue.test.js` (create)
- `tests/optimistic-save.test.js` (create)
