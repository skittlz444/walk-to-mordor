# Story 11.1: Web Push API Infrastructure

Status: done

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

- [x] Task 1: Database migrations (AC: #1, #2, #3)
  - [x] 1.1: Create `migrations/0126_create_push_subscriptions.sql` with `push_subscriptions` table
  - [x] 1.2: Create `migrations/0127_add_notifications_enabled.sql` adding `notifications_enabled` column to `users`
  - [x] 1.3: Update `docs/data-models.md` with new table and column

- [x] Task 2: VAPID key generation and secrets setup (AC: #1)
  - [x] 2.1: Generate VAPID key pair using `npx web-push generate-vapid-keys`
  - [x] 2.2: Store keys as Wrangler secrets: `npx wrangler secret put VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (should be `mailto:` URI)
  - [x] 2.3: Update `worker-configuration.d.ts` to declare `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` on the `Env` interface
  - [x] 2.4: Add a `GET /api/push/vapid-key` public endpoint that returns the VAPID public key (needed by client for `pushManager.subscribe()`)

- [x] Task 3: Push utility module — `src/push-utils.ts` (AC: #11)
  - [x] 3.1: Implement `sendPushNotification(db, endpoint, keys, payload, env)` — constructs VAPID JWT, encrypts payload per RFC 8291/8188, POSTs to subscription endpoint
  - [x] 3.2: Implement `sendPushToUser(db, userId, payload, env)` — queries all active subscriptions for user where `users.notifications_enabled = 1`, calls `sendPushNotification` for each, cleans up 404/410 responses
  - [x] 3.3: Implement `cleanupExpiredSubscription(db, endpoint)` — deletes subscription by endpoint
  - [x] 3.4: Define `PushPayload` interface: `{ title: string; body: string; url?: string; icon?: string }`

- [x] Task 4: Push API handlers — `src/push-handlers.ts` (AC: #4, #5, #6, #7, #12)
  - [x] 4.1: `handlePushSubscribe(request, db, body, allowTestAuth)` — validate session, validate body shape, upsert subscription
  - [x] 4.2: `handlePushUnsubscribe(request, db, body, allowTestAuth)` — validate session, validate body has `endpoint`, delete matching subscription
  - [x] 4.3: `handlePushStatus(request, db, allowTestAuth)` — validate session, query subscription count + `notifications_enabled` flag
  - [x] 4.4: `handlePushSettings(request, db, body, allowTestAuth)` — validate session, validate `notificationsEnabled` is boolean, update `users.notifications_enabled`
  - [x] 4.5: `handleVapidKey(env)` — public endpoint, returns `{ status: 'success', data: { vapidPublicKey: env.VAPID_PUBLIC_KEY } }`

- [x] Task 5: Wire routes in `src/index.ts` (AC: #4, #5, #6, #7, #12)
  - [x] 5.1: Import push handlers
  - [x] 5.2: Add route matching for `POST /api/push/subscribe`, `DELETE /api/push/subscribe`, `GET /api/push/status`, `PUT /api/push/settings`, `GET /api/push/vapid-key`
  - [x] 5.3: Update `getAllowedMethods()` for each push endpoint
  - [x] 5.4: `GET /api/push/vapid-key` is public (no auth), all others require `validateSession()`

- [x] Task 6: Service Worker push handlers — `public/sw.js` (AC: #9, #10)
  - [x] 6.1: Add `self.addEventListener('push', ...)` — parse `event.data.json()`, call `self.registration.showNotification()`
  - [x] 6.2: Add `self.addEventListener('notificationclick', ...)` — close notification, `clients.openWindow(url)` or focus existing tab
  - [x] 6.3: Add `self.addEventListener('pushsubscriptionchange', ...)` — re-subscribe and POST new subscription to server; clears stale auth on 401/403 response

- [x] Task 7: Client-side push utilities — `client/src/utils/push-client.ts` (AC: #8)
  - [x] 7.1: `urlBase64ToUint8Array(base64String)` — convert VAPID public key for `applicationServerKey`
  - [x] 7.2: `subscribeToPush(sessionToken)` — full subscribe flow: get SW registration, call `pushManager.subscribe()`, POST to API
  - [x] 7.3: `unsubscribeFromPush(sessionToken)` — get existing subscription, call `.unsubscribe()`, DELETE from API
  - [x] 7.4: `getPushStatus(sessionToken)` — fetch `GET /api/push/status`
  - [x] 7.5: `updateNotificationSettings(sessionToken, enabled)` — PUT to `/api/push/settings`
  - [x] 7.6: `fetchVapidKey()` — GET `/api/push/vapid-key` (cached after first fetch)

- [x] Task 8: PushPermission Preact island — `client/src/islands/PushPermissionIsland.tsx` (AC: #8)
  - [x] 8.1: Check browser support (`'PushManager' in window`, `'Notification' in window`)
  - [x] 8.2: Display current notification permission state (`Notification.permission`)
  - [x] 8.3: Global enable/disable toggle — calls `PUT /api/push/settings` (this controls server-side cron delivery for ALL devices, not per-device permission)
  - [x] 8.4: "Enable on this device" button — triggers permission request + subscription flow
  - [x] 8.5: "Disable on this device" button — unsubscribes this browser's push subscription
  - [x] 8.6: Show subscription count ("Enabled on N devices")
  - [x] 8.7: Show unsupported browser message gracefully
  - [x] 8.8: Read `sessionToken` from `appStore` signals
  - [x] 8.9: Register island in `client/src/index.tsx` auto-hydration map
  - [x] 8.10: Call `clearPushAuthContext()` when session token goes falsy to evict stale SW bearer token

- [x] Task 9: Integrate into profile/settings page
  - [x] 9.1: Add `PushPermissionIsland` mount point (`<div data-island="PushPermissionIsland"></div>`) to the profile page render (`src/renderProfilePage.ts`)
  - [x] 9.2: Add CSS for the push permission component in `public/css/profile.css`

- [x] Task 10: Tests (AC: all)
  - [x] 10.1: Backend tests in `tests/api/push-handlers.test.ts` — subscribe, unsubscribe, status, settings, vapid-key, auth rejection, upsert logic, cleanup
  - [x] 10.2: Client unit tests in `client/src/islands/PushPermissionIsland.test.tsx` — all permission states, toggle behavior, browser support detection, stale-auth clearing
  - [x] 10.3: Client utility tests in `client/src/utils/push-client.test.ts` — all utility functions, error handling
  - [x] 10.4: Service worker push handler tests in `tests/api/sw-push.test.js` — push event, notificationclick, pushsubscriptionchange, auth clearing on 401/403

- [x] Task 11: Push notification nudge banner
  - [x] 11.1: `PushNudgeBanner` Preact island — bottom banner styled identically to `PwaInstallBanner`
  - [x] 11.2: Gate: standalone/installed-PWA only (`isStandaloneMode()`), push supported, permission not denied, not already subscribed, 2-week dismiss cooldown (`wtm_push_nudge_dismissed` in localStorage)
  - [x] 11.3: "Enable" triggers `Notification.requestPermission()` → `subscribeToPush()`, banner hides on success or denied
  - [x] 11.4: "Dismiss" stores 2-week cooldown timestamp in localStorage
  - [x] 11.5: Register in `client/src/index.tsx` and add mount point in `src/renderLayout.ts`
  - [x] 11.6: 22 Vitest tests covering all gate conditions and flows

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
- Key technical constraint: Cloudflare Workers cannot use `web-push` npm library (Node.js crypto) — implemented VAPID JWT + payload encryption using Web Crypto API in `src/push-utils.ts`
- **Implementation complete**: 2026-04-15 — all tasks delivered, 779 client tests + backend tests passing
- AC #8 extended: `clearPushAuthContext()` called from `PushPermissionIsland` whenever session token goes falsy, preventing stale bearer token from being used in SW `pushsubscriptionchange` retries
- AC #9/10 extended: SW clears persisted push auth on 401/403 responses during `pushsubscriptionchange` re-sync (stops retrying with revoked/expired tokens)
- Task 11 added post-spec: `PushNudgeBanner` — contextual opt-in nudge for installed-PWA users only, 2-week dismiss cooldown, same UX pattern as `PwaInstallBanner`
- This story is a P0 blocker for stories 11.2, 11.3, and 11.4

### File List

**New files:**
- `migrations/0126_create_push_subscriptions.sql`
- `migrations/0127_add_notifications_enabled.sql`
- `src/push-handlers.ts`
- `src/push-utils.ts`
- `client/src/islands/PushPermissionIsland.tsx`
- `client/src/islands/PushPermissionIsland.test.tsx`
- `client/src/islands/PushNudgeBanner.tsx`
- `client/src/islands/PushNudgeBanner.test.tsx`
- `client/src/utils/push-client.ts`
- `client/src/utils/push-client.test.ts`
- `tests/api/push-handlers.test.ts`
- `tests/api/push-routes.test.ts`
- `tests/api/push-utils.test.ts`
- `tests/api/sw-push.test.js`

**Modified files:**
- `src/index.ts` — route wiring + imports
- `src/renderProfilePage.ts` — `PushPermissionIsland` mount point
- `src/renderLayout.ts` — `PushNudgeBanner` mount point
- `public/sw.js` — push, notificationclick, pushsubscriptionchange, message handlers
- `public/css/profile.css` — push permission component styles
- `worker-configuration.d.ts` — VAPID secrets on Env interface
- `client/src/index.tsx` — register `PushPermissionIsland` and `PushNudgeBanner`
- `docs/data-models.md` — `push_subscriptions` table + `notifications_enabled` column
- `docs/api-reference.md` — push API endpoints
- `eslint.config.mjs` — eslint ignore for push test helper
- `package.json` / `package-lock.json` — added `@types/web-push` dev dependency
- `tests/ui/preference-toggle.spec.js` — updated E2E test for new profile card layout
