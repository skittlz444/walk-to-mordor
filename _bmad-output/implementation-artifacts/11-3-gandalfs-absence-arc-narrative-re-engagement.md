# Story 11.3: Gandalf's Absence Arc — Narrative Re-engagement

Status: in-progress

## Story

As an inactive user who has not logged a walk in 6 or more days,
I want to receive a sequence of Tolkien-themed narrative push notifications that escalate from gentle encouragement to dramatic urgency,
so that I'm drawn back to the app in a way that feels immersive and story-driven rather than nagging.

## Context & Design Intent

This is a **tiered narrative re-engagement sequence** — NOT a daily spam blast. Notifications follow a storytelling arc that escalates with increasing inactivity duration. Each tier fires **exactly once** per inactivity period. When the user logs a walk, the tier counter resets so the arc can restart if they go inactive again later.

Key design principles:
- **Narrative immersion**: Each tier is a story beat, not a generic "come back" message.
- **Respectful frequency**: At most 4 notifications across an entire inactivity period (days 6, 10, 15, 25+), not daily.
- **Opt-out respect**: Controlled by a new "Inactivity Notifications" toggle within the notification settings group.
- **Deeplink to `/`**: Clicking the notification opens `/` so the user's `default_view_map` preference determines the landing page (journey page or map).
- **Exclude finished users**: Users who have completed the entire journey (no remaining goals) receive no re-engagement notifications.
- **Exclude dormant accounts**: Users who have **never** logged a single walk are excluded (they never started the journey).

## Acceptance Criteria

1. **Given** a user has not logged a walk in 6+ consecutive days (no entry in `progress` with `date >= date('now', '-6 days')`),
   **And** they have at least one active push subscription,
   **And** they have `notifications_enabled = 1` (global toggle),
   **And** they have `inactivity_nudge_enabled = 1` (feature toggle),
   **And** they have logged at least one walk ever (`EXISTS progress row`),
   **And** they have not completed the full journey (a goal exists with `distance > totalDistance`),
   **When** the daily scheduled cron job runs,
   **Then** the system determines the correct tier based on days since last walk:
     - Days 6–9 → Tier 1 (Gentle)
     - Days 10–14 → Tier 2 (Concerned)
     - Days 15–24 → Tier 3 (Urgent)
     - Days 25+ → Tier 4 (Dramatic Final)
   **And** if the user's `reengage_tier_sent` is below the current tier, a push notification is sent for that tier,
   **And** `reengage_tier_sent` is updated to the sent tier value,
   **And** the notification payload includes a randomly selected message variant for that tier with the user's next goal name interpolated,
   **And** the notification's click-through URL is `/`.

2. **Given** a user is inactive for 10 days and has already received the Tier 1 (day 6) notification,
   **When** the cron job runs on day 10,
   **Then** a Tier 2 notification is sent **and** `reengage_tier_sent` is updated to 2.

3. **Given** a user has reached Tier 4 (`reengage_tier_sent = 4`),
   **When** the cron job runs and the user is still inactive,
   **Then** no further notifications are sent (Tier 4 is the final message).

4. **Given** a user has `reengage_tier_sent = 3` and logs a new walk,
   **When** the walk is saved via `POST /api/calendar-progress`,
   **Then** `reengage_tier_sent` is reset to 0,
   **And** the next time they go inactive for 6+ days, the arc restarts from Tier 1.

5. **Given** a user has never logged any walks (no rows in `progress` for their `user_id`),
   **When** the cron job runs,
   **Then** no re-engagement notification is sent (they're a dormant account, not a lapsed walker).

6. **Given** a user has completed the entire journey (their total distance ≥ the maximum goal distance),
   **When** the cron job runs,
   **Then** no re-engagement notification is sent.

7. **Given** an authenticated user views the notification settings on their profile,
   **When** the global notifications toggle is ON,
   **Then** the expanded settings group shows an "Inactivity Notifications" toggle with description: "Receive themed reminders if you haven't walked in a while",
   **And** the toggle defaults to ON for new users.

8. **Given** a user toggles the "Inactivity Notifications" setting,
   **When** `PUT /api/push/settings` is called with `{ inactivityNudgeEnabled: boolean }`,
   **Then** `users.inactivity_nudge_enabled` is updated and the response confirms success.

9. **Given** the cron job sends a notification and the push service returns 404 or 410 (Gone),
   **Then** the expired subscription is cleaned up (deleted from `push_subscriptions`),
   **And** nothing else changes — the `reengage_tier_sent` is still updated so the user isn't re-targeted at this tier if they re-subscribe.

10. **Given** there are multiple themed message variants per tier,
    **When** a notification is sent,
    **Then** the selected variant includes a `title` and `body` that reference the user's next goal name,
    **And** the variant is randomly chosen from the pool for that tier.

11. **Given** the `scheduled()` handler already runs daily (from Story 11.2),
    **When** the re-engagement check runs,
    **Then** it processes after the "One More Mile" notifications in the same cron invocation,
    **And** users are processed in batches (page size: 100) to stay within D1 row limits and Worker CPU time.

12. **Given** a user receives a Gandalf's Absence Arc push notification,
    **When** the user clicks/taps the notification,
    **Then** the app opens to `/` (which routes to the user's preferred default view — journey or map),
    **And** if a browser tab is already open, it focuses that existing window instead of opening a new one,
    **And** the notification is dismissed on click.

## Tasks / Subtasks

- [x] Task 1: Database migration — `reengage_tier_sent` column on users (AC: #1, #3, #4)
  - [x] 1.1: Create `migrations/0130_add_reengage_tier_sent.sql`: `ALTER TABLE users ADD COLUMN reengage_tier_sent INTEGER NOT NULL DEFAULT 0;`
  - [x] 1.2: Update `docs/data-models.md` with new column description

- [x] Task 2: Database migration — `inactivity_nudge_enabled` user preference (AC: #7, #8)
  - [x] 2.1: Create `migrations/0131_add_inactivity_nudge_enabled.sql`: `ALTER TABLE users ADD COLUMN inactivity_nudge_enabled INTEGER NOT NULL DEFAULT 1;`
  - [x] 2.2: Update `docs/data-models.md` with new column description

- [x] Task 3: Themed message variants — add to `src/push-messages.ts` (AC: #10)
  - [x] 3.1: Export a `REENGAGE_MESSAGES` map keyed by tier (1–4), each tier containing an array of `{ title: string; bodyTemplate: string }` variants
  - [x] 3.2: Implement `getReengageMessage(tier: number, goalTitle: string)` that randomly selects a variant for the given tier and interpolates `{goalTitle}`
  - [x] 3.3: Include at least 4 variants per tier (16+ total messages)

- [x] Task 4: Re-engagement cron handler — add to `src/scheduled-handlers.ts` (AC: #1, #2, #3, #5, #6, #9, #11)
  - [x] 4.1: Add `handleReengagementCron(db: DbClient, env: Env)` function to `src/scheduled-handlers.ts`
  - [x] 4.2: Implement the eligible-user query: find users with `notifications_enabled = 1`, `inactivity_nudge_enabled = 1`, at least one progress row, has active push subscription, NOT completed journey, last walk date ≥ 6 days ago, and `reengage_tier_sent` < current applicable tier
  - [x] 4.3: Process eligible users in batches (100 per query page)
  - [x] 4.4: For each eligible user: determine correct tier from days-since-last-walk, select random message for that tier, call `sendPushToUser()` from `src/push-utils.ts` with URL `/`, update `reengage_tier_sent`
  - [x] 4.5: Handle `sendPushToUser` failures gracefully — log errors, continue processing remaining users
  - [x] 4.6: Clean up expired subscriptions on 404/410 (reuse `cleanupExpiredSubscription` from `push-utils.ts`)

- [x] Task 5: Wire re-engagement handler in `src/index.ts` scheduled export (AC: #11)
  - [x] 5.1: Add `handleReengagementCron(db, env)` call inside the existing `scheduled()` handler, after `handleOneMoreMileCron`
  - [x] 5.2: Wrap in try/catch so a failure in re-engagement doesn't block or affect the One More Mile processing

- [x] Task 6: Reset `reengage_tier_sent` on walk log — `src/progress-handlers.ts` (AC: #4)
  - [x] 6.1: In `handleProgressPost`, after successful INSERT, add: `UPDATE users SET reengage_tier_sent = 0 WHERE id = ? AND reengage_tier_sent > 0`
  - [x] 6.2: The reset must NOT run on PUT (edit) or DELETE — only on new walk creation

- [x] Task 7: Update push settings API — `src/push-handlers.ts` (AC: #8)
  - [x] 7.1: Extend `handlePushSettings` (from Stories 11.1/11.2) to accept `inactivityNudgeEnabled` in addition to existing fields
  - [x] 7.2: Update `PUT /api/push/settings` body validation to handle the new field (any combination of fields can be present)
  - [x] 7.3: Extend `GET /api/push/status` response to include `inactivityNudgeEnabled: boolean`

- [x] Task 8: Add "Inactivity Notifications" toggle to NotificationSettings UI (AC: #7)
  - [x] 8.1: In the `PushPermissionIsland` notification settings group (refactored in Story 11.2), add a new "Inactivity Notifications" toggle below the "One More Mile" toggle
  - [x] 8.2: Toggle label: "Inactivity Notifications" with description: "Receive themed reminders if you haven't walked in a while"
  - [x] 8.3: Wire the toggle to `PUT /api/push/settings` with `{ inactivityNudgeEnabled }` 
  - [x] 8.4: Load initial state for `inactivityNudgeEnabled` from `GET /api/push/status`

- [x] Task 9: Tests (AC: all)
  - [x] 9.1: Backend tests in `tests/api/scheduled-handlers.test.ts` (extend existing file from Story 11.2):
    - Tier 1 notification sent at 6 days inactive
    - Tier 2 notification sent at 10 days (with reengage_tier_sent=1)
    - Tier 3 notification sent at 15 days (with reengage_tier_sent=2)
    - Tier 4 notification sent at 25 days (with reengage_tier_sent=3)
    - No notification at day 5 (below threshold)
    - No notification when reengage_tier_sent = 4 (arc complete)
    - No notification for user with no progress rows (dormant)
    - No notification for user who completed the journey
    - No notification when inactivity_nudge_enabled = 0
    - No notification when notifications_enabled = 0
    - reengage_tier_sent updated correctly after send
    - Batch processing works correctly
    - Expired subscription cleanup on 410
  - [x] 9.2: Backend test in `tests/api/progress-handlers.test.ts`:
    - reengage_tier_sent resets to 0 on new walk POST
    - reengage_tier_sent NOT reset on walk PUT or DELETE
  - [x] 9.3: Backend tests for updated push settings in `tests/api/push-handlers.test.ts`:
    - `PUT /api/push/settings` with `inactivityNudgeEnabled` updates column
    - `GET /api/push/status` returns `inactivityNudgeEnabled` field
  - [x] 9.4: Unit tests for message variants in `tests/api/push-messages.test.ts` (extend existing file from Story 11.2):
    - All 4 tiers have at least 4 message variants
    - `getReengageMessage()` interpolates goal title correctly
    - Invalid tier returns a safe fallback or throws
  - [x] 9.5: Client tests in `client/src/islands/PushPermissionIsland.test.tsx` (extend from Story 11.2):
    - "Inactivity Notifications" toggle visible in expanded notification settings
    - Toggle calls API with correct payload
    - Toggle reflects initial state from API

### Review Findings

- [ ] [Review][Patch] Re-engagement tiers advance even when nothing was actually delivered [src/scheduled-handlers.ts:273]
  - `handleReengagementCron()` ignores the `delivered/deleted` outcome from the push send path and always updates `reengage_tier_sent` on the next line.
  - That means transient push failures (network/VAPID/5xx) still consume the user's current tier even though they never received that message.
  - It also bypasses the story's required `sendPushToUser()` helper, so a user who disables notifications after the batch query starts can still receive a push from a stale eligibility snapshot.
  - Violates AC #1 / AC #2 / AC #9 and Task 4.4's requirement to use `sendPushToUser()`.

- [ ] [Review][Patch] Re-engagement titles do not reference the user's next goal [src/push-messages.ts:61]
  - AC #10 requires the selected variant to include both a `title` and `body` that reference the user's next goal name.
  - All current re-engagement bodies interpolate `{goalTitle}`, but the titles are static strings, so the goal name never appears in the notification title.
  - The current tests only assert the combined title+body contains the goal name, so this acceptance-criteria gap is not being caught.

## Dev Notes

### Architecture & Patterns

- **Handler pattern**: Follow `src/stats-handlers.ts` / `src/friends-handlers.ts`. Each handler receives `(request, db, body?, allowTestAuth?)` and returns a `Response`.
- **DB access**: Use `db.read` for SELECT, `db.write` for INSERT/UPDATE/DELETE via `DbClient` from `src/db.ts`.
- **Response format**: Use `createSuccessResponse(data)` and `createErrorResponse(message, statusCode)` from `src/validators.ts`.
- **Auth validation**: `validateSession(request, db, allowTestAuth)` — returns `{ valid: true, userId }` or `{ valid: false, error: Response }`.

### Tier Thresholds and Day Ranges

```typescript
const REENGAGE_TIERS = [
  { tier: 1, minDays: 6,  maxDays: 9,  label: 'gentle' },
  { tier: 2, minDays: 10, maxDays: 14, label: 'concerned' },
  { tier: 3, minDays: 15, maxDays: 24, label: 'urgent' },
  { tier: 4, minDays: 25, maxDays: Infinity, label: 'dramatic_final' },
] as const;
```

The system calculates days since last walk, looks up which tier that falls into, and compares against `reengage_tier_sent`. If the current tier > sent tier, a notification fires.

### Eligible User Query Strategy

The query joins users, their latest walk date, their total distance, their next goal, and push subscription existence. It filters for all 6 eligibility criteria in one efficient CTE query:

```sql
WITH user_last_walk AS (
  SELECT 
    u.id AS user_id,
    MAX(p.date) AS last_walk_date,
    CAST(julianday('now') - julianday(MAX(p.date)) AS INTEGER) AS days_inactive,
    u.reengage_tier_sent
  FROM users u
  INNER JOIN progress p ON p.user_id = u.id
  WHERE u.notifications_enabled = 1
    AND u.inactivity_nudge_enabled = 1
  GROUP BY u.id
  HAVING days_inactive >= 6
),
user_distances AS (
  SELECT 
    ulw.user_id,
    ulw.last_walk_date,
    ulw.days_inactive,
    ulw.reengage_tier_sent,
    COALESCE(SUM(p.distance), 0) AS total_distance
  FROM user_last_walk ulw
  INNER JOIN progress p ON p.user_id = ulw.user_id
  GROUP BY ulw.user_id
)
SELECT 
  ud.user_id,
  ud.days_inactive,
  ud.reengage_tier_sent,
  ud.total_distance,
  g.title AS next_goal_title
FROM user_distances ud
INNER JOIN goals g ON g.distance = (
  SELECT MIN(g2.distance) FROM goals g2 WHERE g2.distance > ud.total_distance
)
WHERE EXISTS (
  SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = ud.user_id
)
LIMIT 100 OFFSET ?;
```

**Key notes:**
- `INNER JOIN progress` in `user_last_walk` ensures users with zero walks are excluded (dormant account exclusion).
- The correlated subquery `SELECT MIN(g2.distance) ... WHERE g2.distance > ud.total_distance` returns NULL when no goal lies ahead, so the `INNER JOIN` silently drops users who completed the journey.
- `julianday('now') - julianday(MAX(p.date))` computes days since last walk.
- Batch with LIMIT/OFFSET like the One More Mile query pattern.

### Tier Calculation in TypeScript

```typescript
function getReengageTier(daysInactive: number): number {
  if (daysInactive >= 25) return 4;
  if (daysInactive >= 15) return 3;
  if (daysInactive >= 10) return 2;
  if (daysInactive >= 6) return 1;
  return 0; // not eligible
}
```

For each eligible user, call `getReengageTier(daysInactive)`. If it's greater than `reengage_tier_sent`, send a notification for that tier and update.

### Themed Message Variants

Four tiers with at least 4 messages each. All messages include a `{goalTitle}` placeholder for the user's next goal. The notification `url` is always `/`.

**Tier 1 — Gentle (Day 6–9):**
```typescript
[
  { title: "Gandalf Notices Your Absence", bodyTemplate: "\"Even the smallest step counts,\" he says. {goalTitle} still waits for you ahead." },
  { title: "The Road Misses You", bodyTemplate: "Six days without a step — the path to {goalTitle} grows no shorter on its own." },
  { title: "A Gentle Nudge from the Shire", bodyTemplate: "Sam's been keeping your pack ready. {goalTitle} is still out there, waiting." },
  { title: "Your Journey Pauses", bodyTemplate: "The road to {goalTitle} is patient, but Gandalf is watching the horizon for you." },
]
```

**Tier 2 — Concerned (Day 10–14):**
```typescript
[
  { title: "The Fellowship Grows Worried", bodyTemplate: "Sam keeps glancing back down the road… {goalTitle} feels further each day." },
  { title: "Shadows Lengthen", bodyTemplate: "Ten days off the path. The road to {goalTitle} grows darker without your footsteps." },
  { title: "Aragorn Scouts Ahead Alone", bodyTemplate: "Without you, the company is incomplete. {goalTitle} needs every member of the fellowship." },
  { title: "Whispers at the Council", bodyTemplate: "\"Where is our walker?\" they ask. The road to {goalTitle} awaits your return." },
]
```

**Tier 3 — Urgent (Day 15–24):**
```typescript
[
  { title: "Darkness Spreads", bodyTemplate: "Without you, the journey to {goalTitle} may be lost. Return, friend!" },
  { title: "The Enemy Does Not Rest", bodyTemplate: "Fifteen days have passed. Sauron's reach grows while {goalTitle} remains unconquered." },
  { title: "Gandalf's Urgent Summons", bodyTemplate: "\"To delay is to risk all.\" The path to {goalTitle} cannot wait much longer." },
  { title: "The Beacons Are Lit!", bodyTemplate: "Middle-earth calls for aid! The road to {goalTitle} needs you now more than ever." },
]
```

**Tier 4 — Dramatic Final (Day 25+):**
```typescript
[
  { title: "A Moth Brings a Message", bodyTemplate: "A moth finds you with a message from Gandalf: \"It is not too late.\" {goalTitle} still stands." },
  { title: "One Last Hope", bodyTemplate: "Even in the darkest hour, a single step towards {goalTitle} can change everything." },
  { title: "The Grey Pilgrim's Final Plea", bodyTemplate: "\"I will not say: do not weep; for not all tears are an evil.\" But the road to {goalTitle} still remains." },
  { title: "All Is Not Lost", bodyTemplate: "Twenty-five days in shadow, yet {goalTitle} endures. One walk. That is all that is asked of you." },
]
```

**Random selection**: Use `Math.floor(Math.random() * messages.length)` — no need for crypto-grade randomness. Same pattern as `getOneMoreMileMessage` from Story 11.2.

**Interpolation**: Simple string replace: `.replace(/{goalTitle}/g, goalTitle)`.

### Walk Log Reset — `src/progress-handlers.ts`

In `handleProgressPost`, after the successful `INSERT INTO progress`, add a single UPDATE to reset the re-engagement tier:

```typescript
// Reset re-engagement tier on new walk (not on PUT/DELETE)
await db.write.prepare(
  'UPDATE users SET reengage_tier_sent = 0 WHERE id = ? AND reengage_tier_sent > 0'
).bind(userId).run();
```

The `AND reengage_tier_sent > 0` guard avoids unnecessary writes for active users. This runs alongside the existing `syncPartyProgressLog()` call. If the reset fails, it should NOT block the walk from being saved — wrap in try/catch with `console.error`.

### Push Settings API Extension

Story 11.2 extends `PUT /api/push/settings` to accept `{ notificationsEnabled?, oneMoreMileEnabled? }`. This story adds `inactivityNudgeEnabled`:

- Accept body: `{ notificationsEnabled?: boolean, oneMoreMileEnabled?: boolean, inactivityNudgeEnabled?: boolean }` — any combination.
- Validate: if `inactivityNudgeEnabled` is present, it must be a boolean.
- Update: follow the same dynamic UPDATE SET pattern from `handleUpdatePreferences` in `auth-handlers.ts`:
  ```typescript
  if (hasInactivityNudge) {
    updates.push('inactivity_nudge_enabled = ?');
    values.push(inactivityNudgeEnabled ? 1 : 0);
  }
  ```
- Extend `GET /api/push/status` response to include `inactivityNudgeEnabled: boolean`.

### Notification Settings UI — Adding the Toggle

The `PushPermissionIsland` is refactored by Story 11.2 into a collapsible "Notification Settings" group. This story adds a second toggle inside that expanded group:

```
┌─ Notification Settings ──────────────────┐
│ 🔔 Push Notifications  [━━━━●] ON       │  ← Global toggle (collapse header)
│                                           │
│ ┌─ Notification Types ─────────────────┐ │  ← Revealed when global is ON
│ │ 📍 One More Mile      [━━━━●] ON    │ │  ← From Story 11.2
│ │   Get a nudge when you're close to   │ │
│ │   your next milestone.               │ │
│ │                                      │ │
│ │ 🧙 Inactivity Notifications [━━●] ON│ │  ← NEW in this story
│ │   Receive themed reminders if you    │ │
│ │   haven't walked in a while.         │ │
│ └──────────────────────────────────────┘ │
│                                           │
│ Enabled on 2 devices                      │
└───────────────────────────────────────────┘
```

**Implementation**: Follow the exact same toggle pattern established by the "One More Mile" toggle in Story 11.2 — same CSS classes, same API call pattern, same state loading from `GET /api/push/status`.

### Scheduled Handler — Sequential Processing

The `scheduled()` handler in `src/index.ts` (added by Story 11.2) runs `handleOneMoreMileCron`. This story adds re-engagement as a second, independent pass:

```typescript
async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  const db = createDbClient(env.DB);
  
  // Run both independently — failure in one should not block the other
  try {
    await handleOneMoreMileCron(db, env);
  } catch (err) {
    console.error('One More Mile cron failed:', err);
  }
  
  try {
    await handleReengagementCron(db, env);
  } catch (err) {
    console.error('Re-engagement cron failed:', err);
  }
}
```

**CPU time**: Cloudflare Workers `scheduled()` has a 30-second CPU time limit. Both handlers share this budget. If combined processing is too large, consider splitting into separate cron schedules later. For current user volumes this is not a concern.

### Migration Details

- **Next migration numbers**: `0130` and `0131` (after Story 11.2's `0128` and `0129`)
- **0130_add_reengage_tier_sent.sql**:
  ```sql
  ALTER TABLE users ADD COLUMN reengage_tier_sent INTEGER NOT NULL DEFAULT 0;
  ```
- **0131_add_inactivity_nudge_enabled.sql**:
  ```sql
  ALTER TABLE users ADD COLUMN inactivity_nudge_enabled INTEGER NOT NULL DEFAULT 1;
  ```

### CRITICAL: Do NOT

- Do NOT send more than one re-engagement notification per day per user — the tier system inherently prevents this.
- Do NOT send re-engagement notifications to users who have **never** walked (no progress rows). They are dormant accounts, not lapsed walkers.
- Do NOT send to users who have completed the entire journey.
- Do NOT send if either `notifications_enabled` or `inactivity_nudge_enabled` is 0.
- Do NOT reset `reengage_tier_sent` on walk PUT or DELETE — only on POST (new walk creation).
- Do NOT create a separate table for tier tracking — use a column on `users` (consistent with `one_more_mile_enabled`, `notifications_enabled` pattern).
- Do NOT block the walk save if the tier reset fails — wrap in try/catch.
- Do NOT use the `web-push` npm library — reuse `sendPushToUser` from `push-utils.ts` (Cloudflare Workers Web Crypto API).
- Do NOT modify the One More Mile cron logic — this story only adds a new handler called sequentially after it.

### Previous Story Intelligence (Story 11.2)

From Story 11.2's design:
- `src/scheduled-handlers.ts` will contain `handleOneMoreMileCron(db, env)` — add `handleReengagementCron(db, env)` to the same file.
- `src/push-messages.ts` will contain `ONE_MORE_MILE_MESSAGES` — add `REENGAGE_MESSAGES` map to the same file.
- The `scheduled()` export in `src/index.ts` will already exist — add the re-engagement call alongside.
- `PUT /api/push/settings` will already accept multiple optional fields — extend with the new one.
- `GET /api/push/status` will already return `oneMoreMileEnabled` — extend with `inactivityNudgeEnabled`.
- The collapsible notification settings UI group in `PushPermissionIsland` will already exist — add the new toggle inside it.
- Batch processing (LIMIT 100 OFFSET) and expired subscription cleanup patterns are established.
- `sendPushToUser(db, userId, payload, env)` from `push-utils.ts` handles all encryption, delivery, and 410 cleanup.
- `PushPayload` interface: `{ title: string; body: string; url?: string; icon?: string }`.
- Test pattern: `TEST_MOCK_TOKEN_<username>` for auth.

### Project Structure Notes

- New files:
  - `migrations/0130_add_reengage_tier_sent.sql`
  - `migrations/0131_add_inactivity_nudge_enabled.sql`
- Modified files:
  - `src/push-messages.ts` — add `REENGAGE_MESSAGES` and `getReengageMessage()`
  - `src/scheduled-handlers.ts` — add `handleReengagementCron()`
  - `src/index.ts` — add `handleReengagementCron` call in `scheduled()` handler
  - `src/progress-handlers.ts` — reset `reengage_tier_sent` on new walk POST
  - `src/push-handlers.ts` — extend settings endpoint for `inactivityNudgeEnabled`
  - `client/src/islands/PushPermissionIsland.tsx` — add "Inactivity Notifications" toggle
  - `client/src/islands/PushPermissionIsland.test.tsx` — add tests for new toggle
  - `client/src/utils/push-client.ts` — extend `updateNotificationSettings` to support new field
  - `docs/data-models.md` — document new columns
  - `docs/api-reference.md` — document updated settings endpoint

### References

- Scheduled handler pattern: [Source: src/index.ts] — `scheduled()` export added by Story 11.2
- Scheduled handler file: [Source: src/scheduled-handlers.ts (from Story 11.2)] — `handleOneMoreMileCron`
- Message template pattern: [Source: src/push-messages.ts (from Story 11.2)] — `ONE_MORE_MILE_MESSAGES`, `getOneMoreMileMessage()`
- Push utility: [Source: src/push-utils.ts (from Story 11.1)] — `sendPushToUser`, `cleanupExpiredSubscription`, `PushPayload`
- Push handlers: [Source: src/push-handlers.ts (from Story 11.1/11.2)] — `handlePushSettings`, `handlePushStatus`
- Walk logging: [Source: src/progress-handlers.ts] — `handleProgressPost` for tier reset hook, `syncPartyProgressLog()` pattern for graceful degradation
- Dynamic preference updates: [Source: src/auth-handlers.ts#handleUpdatePreferences] — pattern for building dynamic UPDATE SET clause
- Notification settings UI: [Source: client/src/islands/PushPermissionIsland.tsx (from Story 11.2)] — collapsible group, toggle pattern
- Goals schema: [Source: migrations/0003_init_goals.sql] — `goals.distance` is absolute position on route
- Total distance calc: [Source: src/goals-handlers.ts] — sums `progress.distance`
- Progress unique constraint: [Source: migrations/0005_add_unique_date_constraint.sql] — `UNIQUE(date, user_id)` index
- Profile island: [Source: client/src/islands/ProfileIsland.tsx] — toggle UI patterns with `toggle-group`, `toggle-switch`, `toggle-slider` CSS classes
- Profile styles: [Source: public/css/profile.css] — existing toggle-group / toggle-switch / toggle-slider styles
- Island registration: [Source: client/src/index.tsx] — auto-hydration map
- Test auth pattern: [Source: tests/api/*.test.ts] — `TEST_MOCK_TOKEN_<username>`
- Local cron testing: `npx wrangler dev --test-scheduled`, then `curl http://localhost:8787/__scheduled?cron=0+9+*+*+*`
- Epic 11 Story 11.3 definition: [Source: _bmad-output/planning-artifacts/epics-phases-4-15.md#Story 11.3]
- FR_ENGAGE_01, NFR_REENGAGE_01: [Source: _bmad-output/planning-artifacts/epics-phases-4-15.md#Requirements Inventory]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (GitHub Copilot)

### Completion Notes List

- Story created: 2026-04-10
- Ultimate context engine analysis completed — comprehensive developer guide created
- Key design decisions per user request:
  - Deeplink URL is `/` (not `/journey`) so `default_view_map` preference determines landing page
  - Users who finished the journey (no remaining goals) are excluded from notifications
  - New "Inactivity Notifications" toggle added to the notification settings group (same pattern as "One More Mile" from Story 11.2)
  - Titles and bodies designed for each of 4 tiers with Tolkien narrative arc (gentle → concerned → urgent → dramatic)
- Key dependency: Stories 11.1 (push infrastructure) and 11.2 (scheduled handler, notification settings group, message template file) must be implemented first
- Epic originally specified days [3, 7, 14, 21+] but story uses [6, 10, 15, 25] per the epic's own AC text — these are the canonical thresholds
- `reengage_tier_sent` column on `users` table tracks arc progression (0 = no notifications sent, 1–4 = tier reached)
- Tier resets to 0 on new walk POST only (not PUT/DELETE) — this is the "activity resumes" signal
- Migration numbers 0130–0131 follow Story 11.2's 0128–0129

### File List

- `migrations/0130_add_reengage_tier_sent.sql` — NEW
- `migrations/0131_add_inactivity_nudge_enabled.sql` — NEW
- `src/push-messages.ts` — MODIFIED (added REENGAGE_MESSAGES, ReengageMessageTemplate, getReengageMessage)
- `src/scheduled-handlers.ts` — MODIFIED (added handleReengagementCron, getReengageTier, REENGAGE_ELIGIBLE_QUERY)
- `src/index.ts` — MODIFIED (wired handleReengagementCron in scheduled handler)
- `src/progress-handlers.ts` — MODIFIED (added reengage_tier_sent reset on POST)
- `src/push-handlers.ts` — MODIFIED (extended settings/status for inactivityNudgeEnabled)
- `client/src/islands/PushPermissionIsland.tsx` — MODIFIED (added Inactivity Notifications toggle)
- `client/src/utils/push-client.ts` — MODIFIED (extended interfaces for inactivityNudgeEnabled)
- `client/src/islands/PushPermissionIsland.test.tsx` — MODIFIED (added 5 tests for new toggle)
- `tests/api/scheduled-handlers.test.ts` — MODIFIED (added 14 re-engagement tests)
- `tests/api/progress-handlers.test.ts` — MODIFIED (added 3 tests for tier reset)
- `tests/api/push-handlers.test.ts` — MODIFIED (added 4 tests for inactivityNudgeEnabled)
- `tests/api/push-messages.test.ts` — MODIFIED (added 8 tests for REENGAGE_MESSAGES/getReengageMessage)
- `docs/data-models.md` — MODIFIED (documented new columns)
- `docs/api-reference.md` — MODIFIED (documented updated endpoints and new cron handler)
