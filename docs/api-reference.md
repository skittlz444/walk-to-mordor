---
name: api-reference
description: Complete HTTP API route reference including public, authenticated, and admin endpoints with auth requirements.
---

# API Reference

Last updated: 2026-11-12

## Conventions

- All request/response bodies are JSON. Protected endpoints require `Authorization: Bearer <sessionToken>`.
- Missing/invalid token → `401`. Ownership/membership violations → `403`. Unknown path → `404`. Method mismatch → `405` with `Allow` header.
- Test mode: when `ALLOW_TEST_AUTH=true`, tokens prefixed `TEST_MOCK_TOKEN_` are accepted.

## Handler File Map

| Domain | File |
|---|---|
| Auth & Profile | `src/auth-handlers.ts` |
| Profile Overview | `src/profile-handlers.ts` |
| Push | `src/push-handlers.ts` |
| Progress | `src/progress-handlers.ts` |
| Goals | `src/goals-handlers.ts` |
| Goal Content | `src/goal-content-handlers.ts`, `src/goal-content-helpers.ts` |
| Goal Journals | `src/journal-handlers.ts` |
| Storylines | `src/storyline-handlers.ts`, `src/storyline-utils.ts` |
| Party (Fellowship) | `src/party-handlers.ts` |
| Fellowship Invites | `src/fellowship-invite-handlers.ts` |
| Friends | `src/friends-handlers.ts` |
| Achievements | `src/achievement-handlers.ts`, `src/badge-presentation.ts`, `src/achievement-utils.ts`, `src/achievement-awards.ts` |
| Events (personal challenges) | `src/event-handlers.ts`, `src/event-utils.ts` |
| Community campaigns | `src/campaign-handlers.ts`, `src/campaign-utils.ts` |
| Admin | `src/admin-handlers.ts` |
| Admin encounters | `src/encounter-admin-handlers.ts` |
| Route wiring | `src/index.ts` |

## Auth & Profile Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/register` | No | Creates user, triggers confirmation email |
| POST | `/api/login` | No | Returns session token |
| POST | `/api/logout` | Yes | Body requires `sessionId`; missing → `400` |
| GET | `/api/session` | Yes | camelCase fields: `userId`, `username`, `email`, `showFutureGoalsUnlocked`, `defaultViewMap`, `avatarId`, `activeStoryline`, `expiresAt` |
| GET | `/api/profile/overview` | Yes | Read-only profile-view payload: `{ username, avatarId, totalDistance, memberSince, currentGoalTitle, activeStoryline, fellowships }` |
| PUT | `/api/profile` | Yes | Updates username/email/password |
| PUT | `/api/user/preferences` | Yes | Body: any of `showFutureGoalsUnlocked`, `defaultViewMap`, `avatarId` (at least one) |
| GET | `/api/avatars` | Yes | Valid slugs from `src/avatar-slugs.ts` |
| POST | `/api/password-reset-request` | No | Sends reset email |
| POST | `/api/password-reset` | No | Completes reset via token |
| GET | `/api/auth/confirm-email` | No | Query param `token` |
| POST | `/api/auth/resend-confirmation` | No | Resends confirmation email |

- `avatarId` in preferences must be a valid slug or `null`. Invalid → `400 "Invalid avatar_id"`.
- Session response uses **camelCase** — differs from other endpoints that use snake_case.
- `GET /api/profile/overview` backs the read-only `/profile` view: `totalDistance` is the storyline-adjusted distance (same as `/api/total-distance`); `memberSince` is ISO 8601 UTC (e.g. `2024-08-15T18:30:00.000Z`, converted server-side — the raw SQLite `YYYY-MM-DD HH:MM:SS` is never returned); `currentGoalTitle` is the next unreached goal in the active storyline, the last goal's title once all are reached, and `null` when the storyline has no goals; `activeStoryline` uses the `/api/session` shape; `fellowships` lists active, non-dissolved memberships as `{ id, name }` with no sharing flag. Missing/invalid session → `401`.

## Page Routes

Page routes return SSR HTML. They are not auth-guarded: `public/js/main.js` redirects unauthenticated boots to `/login`, and islands handle their own `401` responses.

| Method | Path | Renderer | Islands (in order) |
|---|---|---|---|
| GET | `/profile` | `src/renderProfileViewPage.ts` | `ProfileViewIsland`, `BadgeDisplayIsland` inside `.party-page` |
| GET | `/profile/settings` | `src/renderProfileSettingsPage.ts` | SSR back row, then `ProfileSettingsIsland`, `PushPermissionIsland`, `ProfileAccountIsland` inside `.profile-page` |
| GET | `/friends/:id` | `src/renderFriendProfilePage.ts` | `FriendProfileIsland`, `BadgeDisplayIsland` (unchanged) |
| GET | `/events` | `src/renderEventsPage.ts` | `publicPage: true` (skips `main.js`; anonymous visitors are never redirected), `EventsIsland` |

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
| GET | `/api/goals` | Yes | Active user's storyline goals. Optional `storylineId` query selects another active storyline; admin-only storylines require an admin user. Each goal includes `has_content: boolean`, which is true when any `goal_content` rows exist, including locked goals for teaser UI. |

## Goal Content Endpoints

Goal content is authenticated and uses the same unlock semantics as goal viewing and journals. Without `partyId`, access is evaluated against the user's personal progress. With `partyId`, access is evaluated against the requesting user's active fellowship context.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/goals/:goalId/content` | Yes | Optional `partyId=N`. Returns `200 { entries: GoalContentEntry[] }` when the goal is unlocked in the requested context. Returns `403` when locked. Returns an empty `entries` array when unlocked but no content exists. |
| POST | `/api/goals/:goalId/content/events` | Yes | Body: `{ event_type: 'teaser_impression' | 'content_open', context_type: 'personal' | 'fellowship', content_id?, partyId? }`. Returns `202`. Event writes are best-effort and scheduled with `ExecutionContext.waitUntil`, so analytics failure does not block the user flow. |

`GoalContentEntry` shape:

```json
{
  "id": 1,
  "goal_id": 42,
  "type": "story",
  "title": "Campfire at the Crossroads",
  "body": "Markdown body",
  "author_attribution": null,
  "sort_order": 0,
  "created_at": "2026-07-17T00:00:00.000Z",
  "updated_at": "2026-07-17T00:00:00.000Z"
}
```

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

## Achievement Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/achievements` | Yes | Earned badges, newest-earned first. Optional `userId` query returns an accepted friend's summary; self-queries skip the friendship check. Invalid `userId` → `400`; non-friend or unknown user → `404` (existence is not leaked). |
| GET | `/api/achievements/pending` | Yes | Caller's earned-but-unacknowledged awards, oldest-earned first. Self-scoped; no `userId` parameter. |
| POST | `/api/achievements/acknowledge` | Yes | Body `{ instance_ids: number[] }`. Idempotent; foreign or stale IDs are ignored. Malformed body → `400`. |

- Response envelope is `{ achievements: [...] }`; a user with no earned instances gets `200` with an empty array.
- Each entry carries `achievement_id`, `slug`, `name`, `description`, `image_slug`, `badge_type`, `is_repeatable`, `earned_count`, `first_earned_at`, `last_earned_at`, and a server-resolved `presentation` block.
- `presentation` fields: `rank` (1–4), `rank_label` (`bronze` | `silver` | `gold` | `mithril`), `storyline` (string or `null`; `null` means global), and `collection` (`{ slug, label, index, size }` or `null`).
- The raw definition `metadata` string is never returned — only the resolved `presentation` block. Missing or malformed metadata falls back to rank 1, no collection, and a null storyline.
- Repeatable badges select their artwork variant with `presentation.rank_label`: `/img/achievements/<image_slug>--<rank_label>.webp` (e.g. `habit-faithful-walker--gold.webp`). Non-repeatable badges use `/img/achievements/<image_slug>.webp`.

### Pending awards

`GET /api/achievements/pending` returns `{ pending: [...] }` — the caller's earned instances with no acknowledgement row, ordered `earned_at ASC, id ASC`. A user with nothing outstanding gets `200` with an empty array.

- Each entry carries `instance_id`, `earned_at`, `earned_count`, `slug`, `name`, `description`, `image_slug`, `badge_type`, `is_repeatable`, and `presentation`.
- `earned_count` is the definition's current total for the user (repeat context). `presentation` is resolved with the **instance's awarding ordinal** — its 1-based position among the user's instances of that definition ordered by `(earned_at, id)` — not with `earned_count`. Queued instances that crossed a rank threshold therefore show the rank they earned (e.g. thresholds `[1,4,12,26]`: ordinals 1–3 resolve bronze, ordinal 4 silver).
- Pending is derived from earned instances minus acknowledgements, so backfilled awards are included. The raw definition `metadata` string is never returned.
- Without a valid session → `401`. A query failure → `500`.

```json
{
  "pending": [
    {
      "instance_id": 12,
      "earned_at": "2026-11-02T00:00:00.000Z",
      "earned_count": 4,
      "slug": "habit-faithful-walker",
      "name": "Faithful Walker",
      "description": "Walk every day for a full week.",
      "image_slug": "habit-faithful-walker",
      "badge_type": "habit",
      "is_repeatable": true,
      "presentation": { "rank": 2, "rank_label": "silver", "storyline": null, "collection": null }
    }
  ]
}
```

### Acknowledge awards

`POST /api/achievements/acknowledge` takes `{ "instance_ids": [12, 13] }` and returns `200` with `{ "acknowledged": n }`.

- `n` counts only rows newly inserted for the caller. Re-acknowledging, duplicate IDs in one request, IDs owned by another user, and nonexistent IDs all contribute `0` instead of erroring — the call is safe to replay.
- A request accepts at most 100 IDs; the per-ID inserts run as one atomic batch, so a failure cannot leave a partially acknowledged body.
- Acknowledgement never creates, updates, or deletes `user_achievement_instances` rows; it only writes to `user_achievement_acknowledgements`.
- Missing/non-array/empty/over-100 `instance_ids`, non-number, non-integer, non-safe-integer, zero, or negative entries, and malformed JSON → `400`. Without a valid session → `401`.

```json
{
  "achievements": [
    {
      "achievement_id": 1,
      "slug": "journey-frodo-sam-buckleberry-ferry",
      "name": "Across the Buckleberry Ferry",
      "description": "Cross the Buckleberry Ferry and leave the Shire behind.",
      "image_slug": "journey-frodo-sam-buckleberry-ferry",
      "badge_type": "journey",
      "is_repeatable": false,
      "earned_count": 1,
      "first_earned_at": "2026-11-02T00:00:00.000Z",
      "last_earned_at": "2026-11-02T00:00:00.000Z",
      "presentation": {
        "rank": 1,
        "rank_label": "bronze",
        "storyline": "frodo-sam",
        "collection": {
          "slug": "frodo-sam-journey",
          "label": "The Road to Mordor",
          "index": 1,
          "size": 8
        }
      }
    }
  ]
}
```

## Event Endpoints

Personal challenge encounters. All three are `POST`, protected by `authGuard` (`401` without a valid session), and therefore network-only in the service worker.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/events/daily-roll` | Yes | Idempotent per UTC day. Returns `{ offer: null }` or one offer |
| POST | `/api/events/daily-roll/accept` | Yes | Body: `{ encounter_definition_id }`. Creates the occurrence or returns the existing one |
| POST | `/api/events/daily-roll/decline` | Yes | Optional body: `{ encounter_definition_id }`. Hides the modal for the rest of the UTC day |

### Daily roll

`POST /api/events/daily-roll`

- One roll per user per UTC day (`UNIQUE(user_id, roll_date)`). Repeated calls return the stored result without re-rolling.
- `{ offer: null }` is returned for an accepted or declined roll, a user below the activity threshold, or a user with an active challenge.
- Offer fields are camelCase; the definition block matches the `personal_encounter_definitions` columns.
- `force_offer` in the body is **test-only**: honored only when `ALLOW_TEST_AUTH=true`.

```json
{ "offer": null }
```

```json
{
  "offer": {
    "status": "offered",
    "target": 12.4,
    "coverageStart": "2026-11-05",
    "coverageEnd": "2026-11-07",
    "graceDeadline": "2026-11-10",
    "definition": {
      "id": 1,
      "slug": "nazgul-pursuit",
      "name": "Outrun the Nazgûl",
      "description": "The Black Riders have caught your scent on the road.",
      "image_slug": "nazgul-pursuit",
      "badge_slug": "challenge-nazgul-outrun",
      "duration_days": 3
    }
  }
}
```

### Accept encounter

`POST /api/events/daily-roll/accept` with `{ "encounter_definition_id": 1 }`.

- Validates that today's roll is still `offered` and its definition matches. Stale (different UTC day), declined, or mismatched rolls → `409`; missing or invalid body → `400`.
- Writes the occurrence, participant, and roll status atomically. A repeated accept for the same roll returns the existing occurrence (`200`) instead of creating a second one.
- Acceptance immediately reconciles any walk already logged for the accept date, so a challenge can complete on its first day.
- Response: the occurrence's `id`, `status` (`active`), `personalized_target`, `started_at`, `coverage_end_date`, and `grace_deadline`.

### Decline encounter

`POST /api/events/daily-roll/decline` with an optional `{ "encounter_definition_id": 1 }`.

- Idempotent: marks today's roll `declined` and creates no challenge. Repeated declines are no-ops.
- The declined roll returns `{ offer: null }` on later roll calls, so refreshing the page on the same UTC day does not re-show the modal.

## Community Campaign Endpoints

Public discovery plus one authenticated action (`src/campaign-handlers.ts`, `src/campaign-utils.ts`). `GET`s are auth-optional: a missing/invalid `Authorization` header means anonymous (never `401`); a valid one adds the caller's overlay. camelCase; distances in km.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/events` | No | Enabled campaigns with current and past-run summaries |
| GET | `/api/events/:id` | No | One campaign with every run summary; unknown/disabled → `404` |
| GET | `/api/events/:id/community-progress` | No | Current-run totals and ranked contributors; unknown/disabled → `404` |
| POST | `/api/events/:id/join` | Yes | Opt into the current run; `401` without a session |

### Campaign payloads
- `GET /api/events` → `{ campaigns: CampaignSummary[] }`, ordered by run status then start date. Summary: `{ id, slug, name, description, imageSlug, badgeSlug, enabled, activeRun, pastRuns, participation }`.
- Run summary: `{ id, runNumber, targetDistance, startDate, endDate, status, completedAt, announcedAt, participantCount, contributorCount, totalDistance, fromSnapshot }`. `activeRun` is the upcoming/active run or `null`; `pastRuns` are terminal runs (snapshot values when `fromSnapshot: true`).
- `participation` (valid session only, else `null`): `{ participantId, status: 'active'|'removed', joinedAt, contributionDistance }`.
- `GET /api/events/:id` returns the summary plus `runs` (all runs). Unknown id or `enabled = 0` → `404`. `imageSlug` → `/img/highres/<slug>.webp` + `/img/thumbs/<slug>-thumb.webp`; `null` = copy-only.

### Community progress
`GET /api/events/:id/community-progress` → `{ campaignId, campaignSlug, runId, runNumber, targetDistance, startDate, endDate, status, daysRemaining, totalDistance, participantCount, contributorCount, contributors[], you }`.

- `totalDistance` is `SUM(campaign_progress_ledger.distance)` across active participants; `participantCount` includes zero-distance joiners, while `contributorCount`/`contributors` include only distances > 0.
- Ranking is `distance DESC, username ASC`, capped at 50, competition-ranked for ties (1, 2, 2, 4, …). `you` appears only for a valid session with contribution > 0; no current run → zeros with null run fields.

### Join a campaign run
`POST /api/events/:id/join` (session required)

- Rejects disabled campaigns, no current run, or a passed end date (UTC). Creates a per-run participant and backfills existing in-window walks through the idempotent ledger upsert; prior-run participation never blocks a new run.
- `201` → `{ joined: true, campaignId, campaignSlug, runId, runNumber, participation: { participantId, status, joinedAt, contributionDistance } }`.
- Errors: `401` unauthenticated · `404` unknown campaign · `409` already joined this run · `400` ended/not joinable · `500` unexpected. No leave action; username and contribution distance are public via the progress endpoint.

> `/api/events/daily-roll*` is the separate personal-challenges API; Hono resolves static segments before `:id`.

## Admin Endpoints

All admin endpoints require a user with `is_admin = 1`. Non-admin → `403`. Every mutating action is audit-logged via `logAdminAction`.

**Audit action strings:** `update_goal`, `create_goal`, `create_storyline`, `update_storyline`, `update_storyline_goals`, `create_encounter`, `update_encounter`, `enable_encounter`, `disable_encounter`, `cancel_active_occurrences`, `create_campaign`, `update_campaign`, `enable_campaign`, `disable_campaign`, `cancel_campaign_participants`, `retrigger_campaign`, `verify_user_email`, `trigger_password_reset`, `toggle_admin_access`, `delete_user`.

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
| GET | `/api/admin/goals/:goalId/content` | Lists ordered goal-content entries. Response: `{ entries: GoalContentEntry[] }` |
| POST | `/api/admin/goals/:goalId/content` | Creates goal content. Body: `{ type, title, body, author_attribution?, sort_order }`. Returns `201 GoalContentEntry`; `400` validation, `404` missing goal, `409` duplicate `sort_order`. |
| PUT | `/api/admin/goals/:goalId/content/:contentId` | Updates goal content. Returns `200 GoalContentEntry`; `400` validation, `404` missing goal/content, `409` duplicate `sort_order`. |
| DELETE | `/api/admin/goals/:goalId/content/:contentId` | Deletes goal content. Returns `200 { message }`; `404` if missing. |

- `image_id` must match `/^[a-z0-9]+(-[a-z0-9]+)*$/` or be null/empty. References static assets in `public/img/`.
- POST uses `distance_miles` (converted to km); PUT uses `distance` (already km).
- Empty `special` and `image_id` strings normalized to `null`. Goal IDs must be positive integers.
- Goal content validation limits: `type` must be `story`, `poetry`, or `appendix`; `title` ≤ 120 characters; `author_attribution` ≤ 255 characters; `body` ≤ 20,000 characters; `sort_order` from `0` to `999`.

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

### Personal Encounter Management

Handlers live in `src/encounter-admin-handlers.ts`. Every route is wrapped by `adminGuard`: missing/invalid session → `401`, authenticated non-admin → `403`. All mutations are audit-logged.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/encounters` | All definitions ordered by `id ASC`. Response: `{ encounters: AdminEncounterDefinition[] }` |
| POST | `/api/admin/encounters` | Creates a definition, always with `enabled: false` regardless of body. Returns `201 { encounter }` |
| GET | `/api/admin/encounters/:id` | Single definition plus linked badge metadata. Returns `{ encounter }`; unknown ID → `404` |
| PUT | `/api/admin/encounters/:id` | Updates fields and the linked badge; never changes `enabled`. Returns `{ encounter }` |
| PUT | `/api/admin/encounters/:id/enable` | Sets `enabled = true`. Returns `{ encounter }` |
| PUT | `/api/admin/encounters/:id/disable` | Sets `enabled = false`; may require a confirmation body (below). Returns `{ encounter }` |

- `:id` must be a positive canonical integer (no sign, no leading zeros). Otherwise `400 { "error": "Invalid encounter ID" }`.
- Missing definition on get/update/enable/disable → `404 { "error": "Encounter definition not found" }`.

#### Definition body (POST/PUT)

| Field | Type | Rules |
|---|---|---|
| `slug` | string | Required; ≤80; kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`); unique across definitions |
| `name` | string | Required; ≤120 |
| `description` | string | Required; ≤2,000 |
| `image_slug` | string | Required by the API; ≤120 |
| `badge_slug` | string | Required; ≤120; kebab-case; links to `achievement_definitions.slug` |
| `duration_days` | integer | Required; 1–30 |
| `target_stretch_multiplier` | number | Required; 1.0–5.0 |
| `target_min_distance` | number | Required; > 0 |
| `target_max_distance` | number | Required; ≥ `target_min_distance` (equal is valid) |
| `is_repeatable` | boolean | Optional; defaults to `true` |
| `badge_name`, `badge_description`, `badge_image_slug` | string | Required only when `badge_slug` does not yet exist |
| `enabled` | boolean | Ignored on create (forced `false`) and not changed on update; use enable/disable |

- Validation failure → `400 { "error": "validation", "fields": { "<field>": "<message>" } }` and no rows are written. Slug collisions return `fields.slug = "Slug is already in use"`.
- POST/PUT with an unknown `badge_slug` requires all three inline badge fields. The handler creates a `badge_type = 'challenge'` achievement with metadata `{ storyline: null, rank_thresholds: [1, 3, 7, 15] | [1], unit: "completions", criteria: "personal_encounter_completed" }`; `[1]` is used when `is_repeatable` is false.
- PUT rewrites an existing linked badge only when inline badge fields are supplied, or when `is_repeatable` changed and that badge has `metadata.criteria = "personal_encounter_completed"`. The previous badge definition is never deleted, so earned achievements keep their history.
- Responses return the definition fields (`id`, `slug`, `name`, `description`, `image_slug`, `badge_slug`, `duration_days`, `target_stretch_multiplier`, `target_min_distance`, `target_max_distance`, `is_repeatable`, `enabled`, `created_at`, `updated_at`) plus `badge` (the full linked achievement: `id`, `slug`, `name`, `description`, `image_slug`, `badge_type`, `is_repeatable`, `metadata`) or `null`, and a convenience `badge_name`.

#### Disable confirmation

`PUT /api/admin/encounters/:id/disable` with no body (or without a boolean `cancelActive`):

- No `active` occurrences → disables immediately and returns `200 { encounter }`.
- Active occurrences → mutates nothing and returns `400 { "activeOccurrences": N, "requiresConfirmation": true }`.
- Re-send with `{ "cancelActive": false }` → disables future rolls only; active occurrences keep running.
- Re-send with `{ "cancelActive": true }` → marks every `active` occurrence for the definition `failed` without settlement or badge award, then disables it. Audit entries `disable_encounter` and `cancel_active_occurrences` record the affected count.

#### Audit

Actions: `create_encounter`, `update_encounter`, `enable_encounter`, `disable_encounter`, `cancel_active_occurrences`. Rows use `targetType = 'personal_encounter'`, `targetId` = definition ID, and JSON `details` with changed fields, badge create/update flags, and active/cancelled occurrence counts.

### Community Campaign Management

Handlers live in `src/campaign-admin-handlers.ts`. All routes sit behind `adminGuard` (`401` unauthenticated, `403` non-admin) and every mutation is audit-logged with `targetType = 'community_campaign'`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/campaigns/suggestions` | Metric suggestions from the last 30 days of walks |
| GET | `/api/admin/campaigns` | `{ campaigns }`; each has `activeRun`, `latestRun`, `badge`, `activeParticipantCount` |
| POST | `/api/admin/campaigns` | Creates the definition (`enabled: false`), run 1 (`upcoming`, `announced_at null`), and a missing badge. `201 { campaign }` |
| GET | `/api/admin/campaigns/:id` | `{ campaign }` with `runs` (all run history); unknown → `404` |
| PUT | `/api/admin/campaigns/:id` | Updates copy, linked badge, and run fields while upcoming. Never changes `enabled` |
| PUT | `/api/admin/campaigns/:id/enable` | Sets `enabled = 1` and backfills active participants' in-window walks |
| PUT | `/api/admin/campaigns/:id/disable` | Sets `enabled = 0`; may require `cancelActive` confirmation |
| POST | `/api/admin/campaigns/:id/retrigger` | Appends the next run; terminal latest run plus enabled campaign only |

#### Definition body (POST/PUT)

`slug` (≤80, kebab-case, unique), `name` (≤120), `description` (≤2000), `image_slug` (≤120), `badge_slug` (≤120), `target_distance` (> 0), `start_date` (ISO), `end_date` (ISO, after start). `start_date` must be today or later **on create only**; updates accept a past start while the run is still upcoming. Inline badge fields: `badge_name`, `badge_description`, `badge_image_slug`, `repeatable`, `rank_thresholds` (ascending positive integers). Validation failure → `400 { "error": "validation", "fields": { ... } }` with no writes.

- A missing `badge_slug` requires all three inline badge fields. The handler creates a `badge_type = 'community'` achievement; repeatable badges store the supplied `metadata.rank_thresholds` (default `[1, 3, 7, 15]`), non-repeatable store `[1]`, and `metadata.rank` is never written.
- Updates touch an existing linked community badge only when inline fields, repeatability, or thresholds changed; other badge types are never modified (attempts → `fields.badge_slug`).
- Once the current run leaves `upcoming`, `target_distance`, `start_date`, and `badge_slug` are frozen. An active run's `end_date` may be extended only; a terminal run's window is immutable.
- PUT on a definition with no runs creates run 1 from the supplied run fields (recovery path; create always inserts it).

#### Suggestions

`GET /api/admin/campaigns/suggestions?durationDays=<n>` → `{ suggestedTargetDistance, suggestedDurationDays, suggestedParticipantCount, thirtyDayTotalDistance, thirtyDayActiveUsers }`.
`suggestedTargetDistance = round(total30d / max(activeUsers, 1) * durationDays * 0.25)`; `durationDays` defaults to 14 and is clamped to 7–30. The 0.25 opt-in rate is a documented handler constant.

#### Disable confirmation

- No active participants → disables immediately, `200 { campaign }`.
- Active participants and no boolean `cancelActive` → mutates nothing, `400 { activeParticipants, requiresConfirmation: true }`.
- `{ "cancelActive": false }` → disables, leaves participant rows untouched.
- `{ "cancelActive": true }` → disables and marks active participants `status = 'removed'` with `removed_at`; ledger rows and earned badges are retained. Audit entries `disable_campaign` and `cancel_campaign_participants` share the action.

#### Retrigger

Allowed only when the latest run is `completed` or `expired` **and** `enabled = 1`; otherwise `400 { "error": ... }` (disabled campaigns direct the admin to enable first). Defaults: target from the suggestion formula clamped to ≥ 1 km, start tomorrow UTC, end `start + 13` (14-day inclusive window). `target_distance`, `start_date`, and `end_date` overrides use the create validation rules. The next run uses `run_number = max + 1`, `status = 'upcoming'`, `announced_at = NULL`, and is inserted together with its audit row in one D1 batch; previous runs, participants, ledger rows, and badges are never modified. Response `201 { campaign, run }`.

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
