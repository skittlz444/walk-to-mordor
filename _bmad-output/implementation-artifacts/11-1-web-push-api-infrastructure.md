# Story 11.1: Web Push API Infrastructure

Status: ready-for-dev

## Story

As a user,
I want to be able to opt-in to push notifications from the app,
so that I can receive timely walking reminders and engagement nudges.

## Acceptance Criteria

1. **Given** the app has no push notification capability,
   **When** the Web Push infrastructure is implemented,
   **Then** VAPID key pair is generated and stored as Worker secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).

2. **Given** the database has no push subscription storage,
   **When** migration `0126_create_push_subscriptions.sql` is applied,
   **Then** a `push_subscriptions` table exists with columns: `id` (INTEGER PK), `user_id` (INTEGER FK → users.id ON DELETE CASCADE), `endpoint` (TEXT UNIQUE NOT NULL), `keys_p256dh` (TEXT NOT NULL), `keys_auth` (TEXT NOT NULL), `created_at` (TEXT DEFAULT CURRENT_TIMESTAMP), `last_used_at` (TEXT).

3. **Given** the database has no notification preferences storage,
   **When** migration `0127_add_notifications_enabled.sql` is applied,
   **Then** the `users` table has a new `notifications_enabled` column (INTEGER DEFAULT 1 — enabled by default).

4. **Given** an authenticated user wants to subscribe to push notifications,
   **When** `POST /api/push/subscribe` is called with body `{ endpoint, keys: { p256dh, auth } }`,
   **Then** the subscription is upserted by endpoint for the authenticated user and returns `{ status: 'success' }`.

5. **Given** an authenticated user wants to unsubscribe from push notifications on the current device,
   **When** `DELETE /api/push/subscribe` is called with body `{ endpoint }`,
   **Then** the matching subscription is removed and returns `{ status: 'success' }`.

6. **Given** an authenticated user wants to check their push notification status,
   **When** `GET /api/push/status` is called,
   **Then** it returns `{ status: 'success', data: { hasSubscriptions: boolean, subscriptionCount: number, notificationsEnabled: boolean } }`.

7. **Given** an authenticated user wants to toggle their global notification preference,
   **When** `PUT /api/push/settings` is called with body `{ notificationsEnabled: boolean }`,
   **Then** the `users.notifications_enabled` column is updated and returns `{ status: 'success' }`.
   **And** this controls whether cron jobs / scheduled workers send notifications to this user, but does NOT affect the browser push permission grants or stored subscriptions.

8. **Given** the client needs to register for push,
   **When** the `PushPermissionIsland` Preact component renders on the profile/settings page,
   **Then** it checks `'PushManager' in window` and `'Notification' in window` for browser support,
   **And** shows current permission state and a toggle to enable/disable notifications globally,
   **And** on "Enable" click: calls `Notification.requestPermission()`, then on `'granted'` subscribes via `serviceWorkerRegistration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` with the VAPID public key,
   **And** sends the resulting subscription to `POST /api/push/subscribe`,
   **And** if the user uses multiple devices, each device must independently grant permission, but the global enable/disable toggle affects all devices.

9. **Given** the Service Worker receives a `push` event,
   **When** the push payload is parsed as JSON `{ title, body, url, icon? }`,
   **Then** `self.registration.showNotification(title, { body, icon, data: { url } })` is called.

10. **Given** the user clicks a push notification,
    **When** the `notificationclick` event fires in the Service Worker,
    **Then** the notification closes, and the app opens to `event.notification.data.url` (or `/journey` as fallback).

11. **Given** a push send attempt receives HTTP 404 or 410 (Gone/Not Found) from the push service,
    **When** the `sendPushNotification` utility processes the response,
    **Then** the expired/invalid subscription is automatically deleted from `push_subscriptions`.

12. **Given** any push API endpoint is called without authentication,
    **When** the request lacks a valid `Authorization: Bearer <token>` header,
    **Then** a 401 response is returned.

## Tasks / Subtasks

- [ ] Task 1: Database migrations (AC: #1, #2, #3)
  - [ ] 1.1: Create `migrations/0126_create_push_subscriptions.sql` with `push_subscriptions` table
  - [ ] 1.2: Create `migrations/0127_add_notifications_enabled.sql` adding `notifications_enabled` column to `users`
  - [ ] 1.3: Update `docs/data-models.md` with new table and column

- [ ] Task 2: VAPID key generation and secrets setup (AC: #1)
  - [ ] 2.1: Generate VAPID key pair using `npx web-push generate-vapid-keys`
  - [ ] 2.2: Store keys as Wrangler secrets: `npx wrangler secret put VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (should be `mailto:` URI)
  - [ ] 2.3: Update `worker-configuration.d.ts` to declare `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` on the `Env` interface
  - [ ] 2.4: Add a `GET /api/push/vapid-key` public endpoint that returns the VAPID public key (needed by client for `pushManager.subscribe()`)

- [ ] Task 3: Push utility module — `src/push-utils.ts` (AC: #11)
  - [ ] 3.1: Implement `sendPushNotification(db, endpoint, keys, payload, env)` — constructs VAPID JWT, encrypts payload per RFC 8291/8188, POSTs to subscription endpoint
  - [ ] 3.2: Implement `sendPushToUser(db, userId, payload, env)` — queries all active subscriptions for user where `users.notifications_enabled = 1`, calls `sendPushNotification` for each, cleans up 404/410 responses
  - [ ] 3.3: Implement `cleanupExpiredSubscription(db, endpoint)` — deletes subscription by endpoint
  - [ ] 3.4: Define `PushPayload` interface: `{ title: string; body: string; url?: string; icon?: string }`

- [ ] Task 4: Push API handlers — `src/push-handlers.ts` (AC: #4, #5, #6, #7, #12)
  - [ ] 4.1: `handlePushSubscribe(request, db, body, allowTestAuth)` — validate session, validate body shape, upsert subscription
  - [ ] 4.2: `handlePushUnsubscribe(request, db, body, allowTestAuth)` — validate session, validate body has `endpoint`, delete matching subscription
  - [ ] 4.3: `handlePushStatus(request, db, allowTestAuth)` — validate session, query subscription count + `notifications_enabled` flag
  - [ ] 4.4: `handlePushSettings(request, db, body, allowTestAuth)` — validate session, validate `notificationsEnabled` is boolean, update `users.notifications_enabled`
  - [ ] 4.5: `handleVapidKey(env)` — public endpoint, returns `{ status: 'success', data: { vapidPublicKey: env.VAPID_PUBLIC_KEY } }`

- [ ] Task 5: Wire routes in `src/index.ts` (AC: #4, #5, #6, #7, #12)
  - [ ] 5.1: Import push handlers
  - [ ] 5.2: Add route matching for `POST /api/push/subscribe`, `DELETE /api/push/subscribe`, `GET /api/push/status`, `PUT /api/push/settings`, `GET /api/push/vapid-key`
  - [ ] 5.3: Update `getAllowedMethods()` for each push endpoint
  - [ ] 5.4: `GET /api/push/vapid-key` is public (no auth), all others require `validateSession()`

- [ ] Task 6: Service Worker push handlers — `public/sw.js` (AC: #9, #10)
  - [ ] 6.1: Add `self.addEventListener('push', ...)` — parse `event.data.json()`, call `self.registration.showNotification()`
  - [ ] 6.2: Add `self.addEventListener('notificationclick', ...)` — close notification, `clients.openWindow(url)` or focus existing tab
  - [ ] 6.3: Add `self.addEventListener('pushsubscriptionchange', ...)` — re-subscribe and POST new subscription to server (handles browser-side subscription rotation)

- [ ] Task 7: Client-side push utilities — `client/src/utils/push-client.ts` (AC: #8)
  - [ ] 7.1: `urlBase64ToUint8Array(base64String)` — convert VAPID public key for `applicationServerKey`
  - [ ] 7.2: `subscribeToPush(sessionToken)` — full subscribe flow: get SW registration, call `pushManager.subscribe()`, POST to API
  - [ ] 7.3: `unsubscribeFromPush(sessionToken)` — get existing subscription, call `.unsubscribe()`, DELETE from API
  - [ ] 7.4: `getPushStatus(sessionToken)` — fetch `GET /api/push/status`
  - [ ] 7.5: `updateNotificationSettings(sessionToken, enabled)` — PUT to `/api/push/settings`
  - [ ] 7.6: `fetchVapidKey()` — GET `/api/push/vapid-key` (cached after first fetch)

- [ ] Task 8: PushPermission Preact island — `client/src/islands/PushPermissionIsland.tsx` (AC: #8)
  - [ ] 8.1: Check browser support (`'PushManager' in window`, `'Notification' in window`)
  - [ ] 8.2: Display current notification permission state (`Notification.permission`)
  - [ ] 8.3: Global enable/disable toggle — calls `PUT /api/push/settings` (this controls server-side cron delivery for ALL devices, not per-device permission)
  - [ ] 8.4: "Enable on this device" button — triggers permission request + subscription flow
  - [ ] 8.5: "Disable on this device" button — unsubscribes this browser's push subscription
  - [ ] 8.6: Show subscription count ("Enabled on N devices")
  - [ ] 8.7: Show unsupported browser message gracefully
  - [ ] 8.8: Read `sessionToken` from `appStore` signals
  - [ ] 8.9: Register island in `client/src/index.tsx` auto-hydration map

- [ ] Task 9: Integrate into profile/settings page
  - [ ] 9.1: Add `PushPermissionIsland` mount point (`<div data-island="PushPermissionIsland"></div>`) to the profile page render (`src/renderProfilePage.ts`)
  - [ ] 9.2: Add CSS for the push permission component in `public/css/profile.css` (or existing stylesheet for profile)

- [ ] Task 10: Tests (AC: all)
  - [ ] 10.1: Backend tests in `tests/api/push-handlers.test.ts` — subscribe, unsubscribe, status, settings, vapid-key, auth rejection, upsert logic, cleanup
  - [ ] 10.2: Client unit tests in `client/src/islands/PushPermissionIsland.test.tsx` — all permission states, toggle behavior, browser support detection
  - [ ] 10.3: Client utility tests in `client/src/utils/push-client.test.ts` — all utility functions, error handling
  - [ ] 10.4: Service worker push handler tests (if feasible with current test setup — mock `PushEvent` in jest)

## Dev Notes

### Architecture & Patterns

- **Handler pattern**: Follow the established pattern from `src/stats-handlers.ts` / `src/friends-handlers.ts`. Each exported handler receives `(request, db, body?, allowTestAuth?)` and returns a `Response`.
- **Route wiring**: Add exact routes in `src/index.ts` within the existing `if/else if` chain. Push endpoints are `/api/push/*`. The VAPID key endpoint is public; all others require `validateSession()`.
- **DB access**: Use `db.read` for SELECT, `db.write` for INSERT/UPDATE/DELETE via the `DbClient` from `src/db.ts`.
- **Response format**: Use `createSuccessResponse(data)` and `createErrorResponse(message, statusCode)` from `src/validators.ts`.
- **Auth validation**: `validateSession(request, db, allowTestAuth)` — pattern returns `{ valid: true, userId }` or `{ valid: false, error: Response }`.

### Multi-Device & Global Settings Design

- **Per-device subscriptions**: A user can have multiple rows in `push_subscriptions` — one per device/browser. Each device must independently grant `Notification.requestPermission()` and call `pushManager.subscribe()`.
- **Global toggle**: The `users.notifications_enabled` column (INTEGER 0/1) controls whether the **server** sends push notifications to the user via cron/scheduled jobs. When disabled, `sendPushToUser()` short-circuits and sends nothing.
- **Global toggle does NOT**:
  - Revoke browser-level notification permissions (that's browser-controlled)
  - Delete push subscriptions from the database (so re-enabling is instant)
  - Affect the `Notification.permission` state on any device
- **Re-enabling**: When the user toggles notifications back on, all existing subscriptions immediately become active for delivery again — no need to re-grant permissions on each device.

### Web Push Encryption (RFC 8291 + RFC 8188)

- **CRITICAL**: Web Push payloads MUST be encrypted. The `web-push` npm library handles this, BUT it uses Node.js crypto APIs that are NOT available in Cloudflare Workers.
- **Cloudflare Workers approach**: Use the Web Crypto API (`crypto.subtle`) directly to implement:
  1. ECDH key agreement (using the subscription's `p256dh` key)
  2. HKDF key derivation
  3. AES-128-GCM content encryption (RFC 8188)
  4. VAPID JWT signing (ES256 / ECDSA P-256 with SHA-256)
- **Alternative**: Use a Workers-compatible library or implement the encryption inline in `src/push-utils.ts`. The encryption logic is ~100 lines. Reference implementations exist for Cloudflare Workers.
- **VAPID JWT**: Self-signed JWT with `{ aud: <push service origin>, exp: <24h>, sub: <VAPID_SUBJECT> }` signed with the VAPID private key using ES256.
- **Headers on push POST**: `Authorization: vapid t=<JWT>,k=<VAPID_PUBLIC_KEY_BASE64URL>`, `Content-Encoding: aes128gcm`, `Content-Type: application/octet-stream`, `TTL: 86400`.

### Service Worker Integration

- **File**: `public/sw.js` (vanilla JS, NOT TypeScript)
- **Existing handlers**: `install`, `activate`, `fetch` (SWR caching), `message` — do NOT modify these.
- **Add new handlers**:
  - `push` event: `event.waitUntil(self.registration.showNotification(...))`
  - `notificationclick` event: `clients.openWindow(url)` or focus existing client
  - `pushsubscriptionchange` event: re-subscribe and POST new subscription to server
- **Push payload JSON format**: `{ title: string, body: string, url?: string, icon?: string }`
- **Default icon**: Use `/img/icon-192.png` or similar app icon if the payload omits `icon`.
- **Notification click URL**: Default to `/journey` if `url` not in payload.

### Migration Details

- **Next migration number**: `0126` (after existing `0125_add_party_avatar_id.sql`)
- **0126_create_push_subscriptions.sql**:
  ```sql
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    keys_p256dh TEXT NOT NULL,
    keys_auth TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT
  );
  CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
  ```
- **0127_add_notifications_enabled.sql**:
  ```sql
  ALTER TABLE users ADD COLUMN notifications_enabled INTEGER NOT NULL DEFAULT 1;
  ```

### Env / Secrets

- `VAPID_PUBLIC_KEY`: Base64url-encoded public key (safe to expose to client)
- `VAPID_PRIVATE_KEY`: Base64url-encoded private key (secret, never sent to client)
- `VAPID_SUBJECT`: `mailto:` URI identifying the application server (e.g., `mailto:admin@wtm.haydencarson.com`)
- These are Wrangler **secrets** (not vars) — added via `npx wrangler secret put <NAME>`
- The `worker-configuration.d.ts` `Env` interface must declare: `VAPID_PUBLIC_KEY: string`, `VAPID_PRIVATE_KEY: string`, `VAPID_SUBJECT: string`
- For local dev, set these in `.dev.vars` (already gitignored)

### Client Island Registration

- Register `PushPermissionIsland` in `client/src/index.tsx` alongside the other 20+ islands.
- Mount point: `<div id="preact-root" data-island="PushPermissionIsland"></div>` or use a dedicated container in the profile page.
- Read `sessionToken` from `appStore` signals (`import { sessionToken } from '../stores/appStore'`).

### CSRF / Security

- All push endpoints (except VAPID key) require `Authorization: Bearer <token>` — this is an anti-CSRF mechanism since the token is not sent automatically by the browser.
- Validate that `endpoint` in subscription requests is a valid HTTPS URL (push service endpoints are always HTTPS).
- Do NOT log or expose `keys_auth` or `keys_p256dh` values in error messages.
- The VAPID private key must NEVER appear in client-side code or API responses.

### Testing Considerations

- **Backend**: Mock `db.read`/`db.write` calls. Test upsert behavior (same endpoint, different user = reject; same user, same endpoint = update). Test cleanup on 410.
- **Client**: Mock `navigator.serviceWorker`, `PushManager`, `Notification` APIs. Test all permission states: `default`, `granted`, `denied`. Test browser support detection.
- **Service Worker**: If mocking `PushEvent` is complex, document manual testing steps for push event handling.
- **Test auth**: Use `TEST_MOCK_TOKEN_<username>` pattern like existing tests.

### Project Structure Notes

- New files:
  - `src/push-handlers.ts` — API route handlers
  - `src/push-utils.ts` — push notification delivery utility (VAPID JWT + encryption)
  - `client/src/islands/PushPermissionIsland.tsx` — Preact island
  - `client/src/utils/push-client.ts` — client-side push utility functions
  - `tests/api/push-handlers.test.ts` — backend tests
  - `client/src/islands/PushPermissionIsland.test.tsx` — island tests
  - `client/src/utils/push-client.test.ts` — utility tests
  - `migrations/0126_create_push_subscriptions.sql`
  - `migrations/0127_add_notifications_enabled.sql`
- Modified files:
  - `src/index.ts` — route wiring + imports
  - `worker-configuration.d.ts` — Env interface (VAPID secrets)
  - `public/sw.js` — push + notificationclick + pushsubscriptionchange handlers
  - `client/src/index.tsx` — register PushPermissionIsland
  - `src/renderProfilePage.ts` — add island mount point
  - `docs/data-models.md` — document new table + column
  - `docs/api-reference.md` — document new endpoints

### References

- Push subscription management pattern: [Source: docs/architecture.md#Authentication] (follows same validateSession pattern)
- DB migration convention: [Source: docs/data-models.md] — 0-padded 4-digit, descriptive name
- Route wiring: [Source: src/index.ts] — matchRoute + if/else chain
- Handler signature: [Source: src/auth-handlers.ts, src/stats-handlers.ts] — `(request, db, body?, allowTestAuth?)`
- Response utilities: [Source: src/validators.ts] — `createSuccessResponse`, `createErrorResponse`
- Service Worker: [Source: public/sw.js] — existing SWR + cache patterns
- Island registration: [Source: client/src/index.tsx] — auto-hydration map
- App store: [Source: client/src/stores/appStore.ts] — `sessionToken`, `userId` signals
- User preferences pattern: [Source: src/auth-handlers.ts#handleUpdatePreferences] — dynamic UPDATE column building
- Web Push API: https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- Cloudflare Scheduled Handler: https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
- RFC 8291 (Web Push Encryption): https://datatracker.ietf.org/doc/html/rfc8291
- RFC 8188 (Encrypted Content-Encoding): https://datatracker.ietf.org/doc/html/rfc8188
- RFC 8292 (VAPID): https://datatracker.ietf.org/doc/html/rfc8292

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (GitHub Copilot)

### Completion Notes List

- Story created: 2026-04-10
- Ultimate context engine analysis completed — comprehensive developer guide created
- Key design decision: Global notifications_enabled toggle on users table controls server-side delivery, NOT per-device browser permissions
- Key technical constraint: Cloudflare Workers cannot use `web-push` npm library (Node.js crypto) — must implement VAPID JWT + payload encryption using Web Crypto API
- This story is a P0 blocker for stories 11.2, 11.3, and 11.4
- No `scheduled()` handler is needed in this story — that comes in Story 11.2 for daily cron notifications

### File List

<!-- To be filled by dev agent -->
