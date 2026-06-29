---
name: api-reference
description: Complete HTTP API route reference including public, authenticated, and admin endpoints with auth requirements.
---

# API Reference

Last updated: 2026-05-20

## Conventions

- All request/response bodies are JSON. Protected endpoints require `Authorization: Bearer <sessionToken>`.
- Missing/invalid token → `401`. Ownership/membership violations → `403`. Unknown path → `404`. Method mismatch → `405` with `Allow` header.
- Test mode: when `ALLOW_TEST_AUTH=true`, tokens prefixed `TEST_MOCK_TOKEN_` are accepted.

## Handler File Map

| Domain | File |
|---|---|
| Auth & Profile | `src/auth-handlers.ts` |
| Push | `src/push-handlers.ts` |
| Progress | `src/progress-handlers.ts` |
| Goals | `src/goals-handlers.ts` |
| Goal Journals | `src/journal-handlers.ts` |
| Storylines | `src/storyline-handlers.ts`, `src/storyline-utils.ts` |
| Party (Fellowship) | `src/party-handlers.ts` |
| Fellowship Invites | `src/fellowship-invite-handlers.ts` |
| Friends | `src/friends-handlers.ts` |
| Admin | `src/admin-handlers.ts` |
| Route wiring | `src/index.ts` |

## Auth & Profile Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/register` | No | Creates user, triggers confirmation email |
| POST | `/api/login` | No | Returns session token |
| POST | `/api/logout` | Yes | Body requires `sessionId`; missing → `400` |
| GET | `/api/session` | Yes | camelCase fields: `userId`, `username`, `email`, `showFutureGoalsUnlocked`, `defaultViewMap`, `avatarId`, `activeStoryline`, `expiresAt` |
| PUT | `/api/profile` | Yes | Updates username/email/password |
| PUT | `/api/user/preferences` | Yes | Body: any of `showFutureGoalsUnlocked`, `defaultViewMap`, `avatarId` (at least one) |
| GET | `/api/avatars` | Yes | Valid slugs from `src/avatar-slugs.ts` |
| POST | `/api/password-reset-request` | No | Sends reset email |
| POST | `/api/password-reset` | No | Completes reset via token |
| GET | `/api/auth/confirm-email` | No | Query param `token` |
| POST | `/api/auth/resend-confirmation` | No | Resends confirmation email |

- `avatarId` in preferences must be a valid slug or `null`. Invalid → `400 "Invalid avatar_id"`.
- Session response uses **camelCase** — differs from other endpoints that use snake_case.

## Push Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/push/vapid-key` | No | Returns `{ status: 'success', data: { vapidPublicKey } }` when configured |
| POST | `/api/push/subscribe` | Yes | Body: `{ endpoint, keys: { p256dh, auth } }`. Same-user endpoint updates in place; different-user endpoint → `409` |
| DELETE | `/api/push/subscribe` | Yes | Body: `{ endpoint }`. Removes only the current user's matching device subscription |
| GET | `/api/push/status` | Yes | Returns `{ status: 'success', data: { hasSubscriptions, subscriptionCount, notificationsEnabled, oneMoreMileEnabled, inactivityNudgeEnabled } }` |
| PUT | `/api/push/settings` | Yes | Body: `{ notificationsEnabled?: boolean, oneMoreMileEnabled?: boolean, inactivityNudgeEnabled?: boolean }`. At least one field required. Updates global delivery toggle and/or per-feature toggles |

- Subscription endpoints must be valid `https://` URLs.
- `notificationsEnabled` controls whether server-side jobs send push notifications to the user. It does not change browser permission state or remove stored subscriptions.
- `oneMoreMileEnabled` controls the "One More Mile" milestone nudge notification. When enabled, users within 2 km of their next goal who haven't walked in 3 days receive a one-time push notification.
- `inactivityNudgeEnabled` controls the "Gandalf's Absence Arc" re-engagement notification series. When enabled, inactive users receive up to 4 themed notifications at escalating intervals (days 6, 10, 15, 25+).
- Invalid or expired subscriptions are cleaned up when a push send later receives `404` or `410` from the push service.

### Scheduled Handlers (Cron)

| Cron | Handler | Notes |
|---|---|---|
| `0 9 * * *` (daily 09:00 UTC) | `handleOneMoreMileCron` | Sends "One More Mile" push notifications to eligible users. Criteria: within 2 km of next goal, no walks in 3 days, not already notified for this goal, journey not completed, both `notifications_enabled` and `one_more_mile_enabled` are on. Users processed in batches of 100. |
| `0 9 * * *` (daily 09:00 UTC) | `handleReengagementCron` | Sends "Gandalf's Absence Arc" re-engagement push notifications to lapsed users. Tiered system: Tier 1 (day 6–9, gentle), Tier 2 (day 10–14, concerned), Tier 3 (day 15–24, urgent), Tier 4 (day 25+, dramatic final). Requires `notifications_enabled`, `inactivity_nudge_enabled`, at least one walk ever, journey not completed, active push subscription. Runs after `handleOneMoreMileCron` in same cron invocation. Users processed in batches of 100. |

## Progress Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/calendar-progress` | Yes | User's logged distance entries |
| POST | `/api/calendar-progress` | Yes | Body: `{ date, distance }` |
| PUT | `/api/calendar-progress` | Yes | Body: `{ id, date, distance }` |
| DELETE | `/api/calendar-progress` | Yes | Body: `{ id }` |
| GET | `/api/total-distance` | Yes | Returns displayed storyline distance: `{ totalDistance, rawTotalDistance, activeStoryline }` |

## Goal Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/goals` | Yes | Active user's storyline goals. Optional `storylineId` query selects another active storyline; admin-only storylines require an admin user. |

## Goal Journal Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/goals/:goalId/journals` | Yes | Returns goal-scoped journal state. Optional `partyId` query for fellowship context. Response: `{ ownEntry, friendEntries, permissions: { canWrite, canEditOwn, canDeleteOwn, canReadFriends } }` |
| PUT | `/api/goals/:goalId/journal` | Yes | Creates or updates the viewer's journal entry. Body: `{ body: string, partyId?: number }`. `body` must be non-empty plain text ≤ 2000 characters. Returns `201` on create, `200` on update. |
| DELETE | `/api/goals/:goalId/journal` | Yes | Deletes the viewer's journal entry for the goal. Returns `404` if no entry exists. |

### Journal Access Rules

- **Write access:** User must have personally reached the goal in their active storyline, OR be an active member of a fellowship that has reached the goal (via `partyId`).
- **Friend read access:** Only entries from accepted friends are returned. If milestone previews are locked, the viewer must also have reached the goal before friend entries are shown.
- **Journal identity:** One entry per user per canonical `goal_id`, shared across all storylines that reuse that goal.

## Storyline Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/storylines` | Yes | Active storylines available for user/fellowship selection. Admin users also receive admin-only storylines. |
| PUT | `/api/user/storyline` | Yes | Body: `{ storylineId, mode: 'carry' | 'reset' }`. Updates active user storyline and offset. Admin-only targets require an admin user. |
| PUT | `/api/party/:id/storyline` | Yes | Leader-only. Same body as user endpoint. Updates party storyline and active members' viewed distance baseline. Admin-only targets require an admin leader. |

- Raw walking progress remains the source of truth. Displayed storyline distance is `max(0, rawTotalDistance + distanceOffset)`.
- `carry` preserves the currently displayed distance on the new storyline. `reset` sets displayed distance to 0 without deleting progress.

## Party (Fellowship) Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/party` | Yes | Body: `{ name, distance_mode, leave_distance_behavior, storylineId? }`. Returns `201` with `invite_code` |
| GET | `/api/user/parties` | Yes | Query: `include_dissolved=true` optional |
| GET | `/api/party/join/:inviteCode` | **No** | Public invite preview |
| POST | `/api/party/join/:inviteCode` | Yes | Joins or rejoins a party |
| POST | `/api/party/:id/invite` | Yes | Leader-only invite code regeneration |
| GET | `/api/party/:id/progress` | Yes | Aggregated progress, member contributions, milestones |
| GET | `/api/party/:id/activity` | Yes | Unified feed. Query: `type=all|walk|message` (default `all`). Max 20 entries |
| POST | `/api/party/:id/messages` | Yes | Body: `{ content }` (1–200 chars after trim). Returns `201` |
| POST | `/api/party/:id/leave` | Yes | Applies leave-distance policy |
| POST | `/api/party/:id/kick/:userId` | Yes | Leader-only. Optional: `{ removeDistance: true }` |
| PUT | `/api/party/:id/settings` | Yes | Leader-only. Mutable: `name`, `leave_distance_behavior` |
| PUT | `/api/party/:id/storyline` | Yes | Leader-only. Mutable: active storyline and display offset |
| POST | `/api/party/:id/transfer-leadership` | Yes | Leader-only. Body: `{ new_leader_id }` |

- `distance_mode` is **immutable** after creation — rejected if sent to `PUT settings`.
- `storylineId` is optional at creation. If provided, it must reference an active storyline visible to the creator; admin-only storylines can only be selected by admins.
- Activity and messages require active membership (`403` if not a member).
- Party progress returns `total_distance` as displayed storyline distance and `raw_total_distance` as contribution sum before offset. Member `contribution` values remain raw.

## Fellowship Invite Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/party/:id/invite-friend` | Yes | Body: `{ user_id }`. Must be accepted friend. Self-invite → `400`; duplicate → `400`; race → `409` |
| GET | `/api/user/fellowship-invites` | Yes | Pending incoming invites |
| POST | `/api/user/fellowship-invites/:inviteId/accept` | Yes | Must be invitee |
| POST | `/api/user/fellowship-invites/:inviteId/reject` | Yes | Must be invitee |

## Friends Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/friends` | Yes | Accepted friends with `last_progressed` date |
| GET | `/api/friends/pending` | Yes | Incoming pending requests |
| GET | `/api/friends/search?q=<username>` | Yes | Min 3 chars, limit 10, wildcards escaped |
| GET | `/api/friends/resolve/:friendCode` | **No** | Public — resolves friend code to user preview |
| GET | `/api/friends/positions` | Yes | Each friend's `total_distance` for map. Client cache: 5 min |
| POST | `/api/friends/request` | Yes | Body: `{ user_id }`. Max 20 pending outgoing. Bidirectional duplicate check |
| POST | `/api/friends/request/code` | Yes | Body: `{ friend_code }`. Same validation as `/request` |
| POST | `/api/friends/:friendshipId/accept` | Yes | Addressee only |
| POST | `/api/friends/:friendshipId/reject` | Yes | Addressee only. Deletes record |
| DELETE | `/api/friends/:friendshipId` | Yes | Mutual unfriend. Either party can remove |
| GET | `/api/friends/:userId/profile` | Yes | Accepted friends only. Returns `404` for non-friends (prevents enumeration) |

- **IDOR prevention**: all friendship operations validate current user is a party to the record.
- `friendship_status` in search: `null` (none), `"pending"`, or `"accepted"`.
- Friend profile `fellowships[].is_shared` indicates mutual party membership.

## Admin Endpoints

All admin endpoints require a user with `is_admin = 1`. Non-admin → `403`. Every mutating action is audit-logged via `logAdminAction`.

**Audit action strings:** `update_goal`, `create_goal`, `create_storyline`, `update_storyline`, `update_storyline_goals`, `verify_user_email`, `trigger_password_reset`, `toggle_admin_access`, `delete_user`.

### Dashboard & Metrics

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/dashboard` | Live system stats (no caching). Counts verified users, total distance, active parties, goals |
| GET | `/api/admin/metrics` | Community summary: total distance, active walkers (7-day window), milestones unlocked |
| GET | `/api/admin/metrics/leaderboard` | Per-user distance. Optional `start`/`end` (`YYYY-MM-DD`, must be paired or both absent). Ordered `distance_km DESC` |
| GET | `/api/admin/metrics/timeline` | Fixed 30-day daily chart. Always 30 points, ascending. No params |

### Goal Management

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/goals` | Paginated + searchable. Params: `page`, `pageSize` (max 100), `search`, `order` (asc/desc by distance) |
| GET | `/api/admin/goals/:id` | Single goal detail |
| POST | `/api/admin/goals` | Create. Accepts `distance_miles` — stored as `miles × 1.60934` km |
| PUT | `/api/admin/goals/:id` | Update. All fields validated server-side |

- `image_id` must match `/^[a-z0-9]+(-[a-z0-9]+)*$/` or be null/empty. References static assets in `public/img/`.
- POST uses `distance_miles` (converted to km); PUT uses `distance` (already km).
- Empty `special` and `image_id` strings normalized to `null`. Goal IDs must be positive integers.

### Storyline Management

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/storylines` | Lists all storylines with goal counts and distance range |
| GET | `/api/admin/storylines/:id` | Storyline metadata plus mapped goal distances |
| POST | `/api/admin/storylines` | Creates a storyline and optionally copies goal mappings from an existing storyline. Supports `adminOnly` for draft visibility. |
| PUT | `/api/admin/storylines/:id` | Updates slug, title, description, path key, sort order, active flag, and admin-only flag |
| PUT | `/api/admin/storylines/:id/goals` | Upserts per-goal storyline distances and sort orders |

- Slugs and path keys use lowercase hyphenated format.
- `adminOnly: true` keeps the storyline out of regular user/fellowship selectors while admins build and test it.
- Admin UI is available at `/admin/storylines`.

### Image Inventory

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/images` | Cross-references build-time manifest vs goal `image_id`. Returns `orphaned`/`missing` slugs. `503` if manifest unavailable (`npm run build:manifest`) |

### User Management

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/users` | Paginated + searchable. `search` matches username, email, active fellowship names. Ordered `created_at DESC` |
| PUT | `/api/admin/users/:id/verify` | Manually verify email. Idempotent |
| PUT | `/api/admin/users/:id/reset` | Send password reset email. On email failure: token deleted, logged, returns `502` |
| PUT | `/api/admin/users/:id/admin` | Toggle `is_admin`. Cannot remove own admin access |
| DELETE | `/api/admin/users/:id` | **Hard-delete. Irreversible.** Cascades via FK. Body: `{ "confirmation": "<exact username>" }`. Cannot self-delete |

- `last_active_date` is null if user has no progress. `fellowship_names` contains only active parties.
- `pageSize` clamped to 1–100 server-side. Leaderboard date params must both be present or both absent.
