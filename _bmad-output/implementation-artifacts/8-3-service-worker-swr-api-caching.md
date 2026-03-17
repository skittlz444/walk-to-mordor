# Story 8.3: Service Worker SWR API Caching

**Status:** ready-for-dev

## Story

As a user,
I want pages to load instantly with cached API data and then silently refresh,
so that the app feels fast even on slow connections and I see my data immediately.

## Acceptance Criteria

1. **SWR cache intercept** — When the Service Worker intercepts a `GET` request to `/api/*` endpoints and a cached response exists, it returns the cached response immediately and simultaneously fetches a fresh response from the network in the background.
2. **Background cache update** — On fresh network response success, the Service Worker updates the SWR cache entry with the new response.
3. **Client notification** — After updating the cache, the Service Worker emits a `sw-cache-updated` message via `postMessage` to all clients, including `{ type: 'sw-cache-updated', url: <request-url> }` so islands can reactively update if data changed.
4. **Network-first on cold cache** — If no cached response exists for a `GET /api/*` request, the request goes directly to the network (network-first for first load), and the successful response is stored in the SWR cache.
5. **Write-through exclusion** — Write endpoints (`POST`, `PUT`, `DELETE`) are **never** cached and always go directly to the network.
6. **Endpoint allowlist** — Only these `GET` endpoints are SWR-cached: `/api/session`, `/api/goals`, `/api/calendar-progress`, `/api/total-distance`, `/api/user/parties`, `/api/friends`.
7. **Endpoint exclusion** — These endpoints are explicitly **not** SWR-cached: `/api/party/:id/activity` (real-time feed), `/api/friends/pending` (time-sensitive), any other `/api/*` endpoint not in the allowlist.
8. **Configurable TTL** — Cache entries have a configurable TTL (default: 5 minutes). Stale entries are still served but the background revalidation is always triggered.
9. **Separate cache** — The SWR API cache uses a **separate** Cache Storage name from the static asset cache (e.g., `walk-to-mordor-api-swr`). It is NOT versioned with `BUILD_TIMESTAMP` — it persists across deploys.
10. **Static asset caching unchanged** — Existing static asset caching (`CACHE_NAME` with `BUILD_TIMESTAMP`) continues to work exactly as before.
11. **Deploy-time SWR bust** — A `cacheVersion` constant in `sw.js` is incremented on deploys (alongside the static cache stamp) and clears the SWR cache when it changes, ensuring stale API shapes don't persist after schema migrations.
12. **Tests** — Unit/integration tests verify: SWR hit returns cached + background fetches, cold cache goes to network, write methods bypass cache, excluded endpoints bypass cache, TTL metadata stored, `postMessage` emitted on update, SWR cache cleared on `cacheVersion` change.

## Tasks / Subtasks

- [ ] **Task 1** — Extend `public/sw.js` with SWR fetch handler (AC: 1,2,4,5,6,7,8,9,10)
  - [ ] 1.1 Add `SWR_CACHE_NAME` constant and `SWR_CACHE_VERSION` constant
  - [ ] 1.2 Define `SWR_ENDPOINTS` allowlist array
  - [ ] 1.3 Define `SWR_TTL_MS` constant (default 300000 = 5 min)
  - [ ] 1.4 Implement `isSWREndpoint(pathname)` matcher helper
  - [ ] 1.5 Implement SWR fetch handler: check SWR cache → return cached + background fetch → update cache with TTL metadata → fall through to network-first on miss
  - [ ] 1.6 Store TTL metadata as a custom header (`x-swr-cached-at` timestamp) on cached responses
  - [ ] 1.7 Ensure `POST`/`PUT`/`DELETE` requests bypass SWR entirely (existing non-GET skip already in place)
- [ ] **Task 2** — Implement `postMessage` client notification (AC: 3)
  - [ ] 2.1 After successful background cache update, call `self.clients.matchAll()` and `postMessage({ type: 'sw-cache-updated', url })` to each client
- [ ] **Task 3** — Implement deploy-time SWR cache busting (AC: 11)
  - [ ] 3.1 Add `SWR_CACHE_VERSION` constant (string, e.g., `'1'`) to `sw.js`
  - [ ] 3.2 On activate event, check stored `swr-version` key in a dedicated cache; if mismatch → delete SWR cache → store new version
  - [ ] 3.3 Update `public/js/update-cache-version.js` to also bump `SWR_CACHE_VERSION` placeholder on build
  - [ ] 3.4 Update `public/js/reset-cache-version.js` to reset `SWR_CACHE_VERSION` placeholder
- [ ] **Task 4** — Write tests for SWR behavior (AC: 12)
  - [ ] 4.1 Create `tests/api/sw-swr.test.js` with Jest tests mocking Cache API and fetch
  - [ ] 4.2 Test: SWR hit returns cached response
  - [ ] 4.3 Test: SWR miss fetches from network and caches
  - [ ] 4.4 Test: Background revalidation updates cache
  - [ ] 4.5 Test: `postMessage` emitted on cache update
  - [ ] 4.6 Test: `POST`/`PUT`/`DELETE` bypass cache
  - [ ] 4.7 Test: Non-allowlisted GET endpoints bypass cache
  - [ ] 4.8 Test: TTL metadata stored and read correctly
  - [ ] 4.9 Test: `SWR_CACHE_VERSION` change clears SWR cache on activate
  - [ ] 4.10 Test: Static asset caching unchanged
- [ ] **Task 5** — Update `tests/api/cache-version.test.js` (AC: 11, 12)
  - [ ] 5.1 Add assertions for `SWR_CACHE_VERSION` placeholder handling in update/reset scripts
- [ ] **Task 6** — Update documentation (AC: all)
  - [ ] 6.1 Update `docs/architecture.md` — document SWR caching pattern, SWR_CACHE_NAME, postMessage protocol
  - [ ] 6.2 Update `docs/frontend-guide.md` if it mentions SW behavior

## Dev Notes

### Existing Service Worker (`public/sw.js`)

The current SW is ~125 lines of vanilla JS. Key structure:

```
BUILD_TIMESTAMP / CACHE_NAME constants
install → pre-cache urlsToCache array
activate → delete old caches (anything !== CACHE_NAME)
fetch →
  skip non-GET
  skip cross-origin
  API requests (/api/*) → network-only (fetch directly)
  HTML navigations → network-only with offline fallback
  everything else → cache-first with dynamic caching of static assets
```

**The SWR change replaces the existing "API requests → network-only" branch** with the SWR strategy for allowlisted endpoints only. Non-allowlisted API endpoints continue with network-only.

### SWR Implementation Pattern

```javascript
// Pseudocode for the SWR fetch handler
const SWR_ENDPOINTS = [
  '/api/session',
  '/api/goals',
  '/api/calendar-progress',
  '/api/total-distance',
  '/api/user/parties',
  '/api/friends'
];

function isSWREndpoint(pathname) {
  return SWR_ENDPOINTS.includes(pathname);
}

// In fetch handler, for GET /api/* requests:
if (isSWREndpoint(requestUrl.pathname)) {
  const swrCache = await caches.open(SWR_CACHE_NAME);
  const cached = await swrCache.match(event.request);

  if (cached) {
    // Return cached immediately, revalidate in background
    event.respondWith(cached);
    event.waitUntil(revalidateAndNotify(event.request, swrCache));
  } else {
    // Network-first on cold cache
    event.respondWith(fetchAndCache(event.request, swrCache));
  }
} else {
  // Non-SWR API endpoints: network-only (existing behavior)
  event.respondWith(fetch(event.request));
}
```

### TTL Metadata Strategy

Store cache timestamp as a custom header on the cached `Response` clone:

```javascript
async function cacheWithTimestamp(cache, request, response) {
  const headers = new Headers(response.headers);
  headers.set('x-swr-cached-at', Date.now().toString());
  const timestamped = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
  await cache.put(request, timestamped);
}
```

The TTL is informational — stale entries are still served (that's the "stale" in SWR), but the background revalidation always runs. Future story 10.4 may use TTL for offline queue decisions.

### postMessage Protocol

```javascript
async function notifyClients(url) {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({ type: 'sw-cache-updated', url });
  });
}
```

Islands or stores can listen:
```javascript
navigator.serviceWorker.addEventListener('message', (event) => {
  if (event.data?.type === 'sw-cache-updated') {
    // Re-fetch signal data for the updated URL
  }
});
```

**Note:** This story does NOT implement the client-side listener — that will be added by Story 8.1 (appStore) or incrementally per island. This story only establishes the SW-side `postMessage` contract.

### Deploy-time SWR Cache Busting

The `SWR_CACHE_VERSION` constant uses a placeholder pattern consistent with the existing `BUILD_TIMESTAMP`:

```javascript
const SWR_CACHE_VERSION = '{{SWR_CACHE_VERSION}}';
```

On activate:
```javascript
// Check if SWR cache version changed
const versionCache = await caches.open('walk-to-mordor-swr-version');
const storedVersion = await versionCache.match('version');
const storedVersionText = storedVersion ? await storedVersion.text() : null;

if (storedVersionText !== SWR_CACHE_VERSION) {
  await caches.delete(SWR_CACHE_NAME);
  await versionCache.put('version', new Response(SWR_CACHE_VERSION));
}
```

Update scripts (`update-cache-version.js`, `reset-cache-version.js`) already read/write `sw.js` — add handling for the `SWR_CACHE_VERSION` placeholder alongside `BUILD_TIMESTAMP`.

### Project Structure Notes

- **File modified:** `public/sw.js` — this is vanilla JS, NOT TypeScript. Keep it as plain JS.
- **File modified:** `public/js/update-cache-version.js` — Node.js script run at build time.
- **File modified:** `public/js/reset-cache-version.js` — Node.js script to reset for git.
- **Test file created:** `tests/api/sw-swr.test.js` — Jest test (module pattern matches existing `tests/api/cache-version.test.js`).
- **Test file modified:** `tests/api/cache-version.test.js` — add SWR_CACHE_VERSION assertions.
- **Doc file modified:** `docs/architecture.md` — document SWR pattern.
- Do NOT touch `client/` — no Preact/Vite changes needed for this story.
- Do NOT create TypeScript wrappers around the SW — it must remain vanilla JS for direct serving via Assets binding.

### Testing Strategy

The SW runs in a browser context with Cache API and `self.clients`. Jest tests will need to mock:

- `caches.open()`, `cache.match()`, `cache.put()`, `cache.delete()`
- `self.clients.matchAll()`, `client.postMessage()`
- `fetch()` for background revalidation
- `FetchEvent` with `respondWith()` and `waitUntil()`

Reference existing `tests/api/cache-version.test.js` for the pattern of testing SW-adjacent scripts. The new `sw-swr.test.js` tests the SW fetch handler logic directly — extract the logic into testable functions if needed, but keep the SW file itself as the source of truth.

### Critical Constraints

- **Do NOT break existing static asset caching** — the cache-first strategy for CSS/JS/images must remain untouched.
- **Do NOT SWR-cache HTML navigations** — the existing network-only + offline fallback for navigations must remain.
- **Do NOT add `import` statements to `sw.js`** — it's served as a classic script, not an ES module.
- **Do NOT change `CACHE_NAME` logic** — build-stamped cache versioning for static assets is a separate concern.
- **Do NOT implement client-side listeners** — this story establishes the SW-side contract only. Client listeners are a concern for Story 8.1 or individual islands.
- **Endpoint allowlist, not blocklist** — only explicitly listed endpoints get SWR. New endpoints added to the app default to network-only.

### Cross-Story Context

- **Story 8.1** (Unified Preact Signal Global Store) — will eventually consume `sw-cache-updated` postMessage to reactively refresh signals. The `appStore.ts` can add a `navigator.serviceWorker.addEventListener('message', ...)` listener.
- **Story 8.2** (D1 Read Replica Wrapper) — backend change, no impact on this story. API response shapes unchanged.
- **Story 10.4** (Offline Write Queue) — depends on this story establishing the SW API intercept infrastructure. Will extend SW with IndexedDB queue for `POST` requests.
- **Epic 7** (DX stories) — no interaction. ESLint/Vite/CI changes are orthogonal.

### References

- [Source: docs/architecture.md — Entry Points table, public/sw.js](docs/architecture.md)
- [Source: docs/architecture.md — Build & Deploy, npm run build](docs/architecture.md)
- [Source: _bmad-output/planning-artifacts/epics-phases-4-15.md — Story 8.3 ACs](docs/architecture.md)
- [Source: public/sw.js — existing SW implementation](public/sw.js)
- [Source: public/js/update-cache-version.js — build-time stamp script](public/js/update-cache-version.js)
- [Source: public/js/reset-cache-version.js — git reset script](public/js/reset-cache-version.js)
- [Source: tests/api/cache-version.test.js — existing SW test pattern](tests/api/cache-version.test.js)
- [Source: src/renderLayout.ts:74-87 — SW registration script](src/renderLayout.ts)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created
- SWR implementation pattern fully specified with pseudocode
- Existing SW structure mapped line-by-line
- postMessage contract defined for future island integration
- Deploy-time cache busting strategy aligned with existing build scripts
- Test strategy defined with mock requirements
- All critical constraints documented to prevent regressions
- Cross-story dependencies mapped for Epic 8 and 10.4

### File List

| Action | File | Purpose |
|--------|------|---------|
| Modified | `public/sw.js` | Add SWR fetch handler, constants, postMessage |
| Modified | `public/js/update-cache-version.js` | Add SWR_CACHE_VERSION placeholder handling |
| Modified | `public/js/reset-cache-version.js` | Add SWR_CACHE_VERSION reset handling |
| Created | `tests/api/sw-swr.test.js` | SWR behavior unit tests |
| Modified | `tests/api/cache-version.test.js` | SWR_CACHE_VERSION assertions |
| Modified | `docs/architecture.md` | Document SWR pattern |
| Modified | `docs/frontend-guide.md` | Update SW behavior notes (if applicable) |
