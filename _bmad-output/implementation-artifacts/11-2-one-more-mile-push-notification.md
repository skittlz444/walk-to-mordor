# Story 11.2: "One More Mile" Push Notification

Status: review

## Story

As a user who is close to reaching my next milestone but hasn't walked recently,
I want to receive a themed push notification reminding me how close I am,
so that I get a gentle, contextual nudge that motivates me to log a walk and reach my next goal.

## Context & Design Intent

This is NOT a daily spam notification. It is a **targeted, one-time nudge** for users who meet ALL of the following criteria simultaneously:

1. They are **less than 2 km** from their next goal/milestone.
2. They have **not logged a walk in the past 3 days** (yesterday, the day before, and the day before that — encouraging them to possibly back-fill yesterday's walk).
3. They have **never been sent a "One More Mile" notification for this specific goal** before.
4. They have **not completed the full journey** (total distance < final milestone).
5. They have **notifications enabled globally** (`users.notifications_enabled = 1`).
6. They have the **"One More Mile" notification type specifically enabled** (`users.one_more_mile_enabled = 1`).

The notification features **multiple themed message variants** for variety — each run randomly selects from a pool of Tolkien-flavoured messages.

## Acceptance Criteria

1. **Given** a user's total distance is within 2 km of their next milestone's distance,
   **And** they have not logged a walk entry for any of the past 3 days (yesterday, day-before-yesterday, or the day before that),
   **And** they have never received a "One More Mile" notification for that specific goal before,
   **And** they have not completed the full journey (i.e., there exists a goal with `distance > totalDistance`),
   **And** `users.notifications_enabled = 1` (global toggle) **and** `users.one_more_mile_enabled = 1` (feature toggle),
   **When** the scheduled cron job runs,
   **Then** a push notification is sent to all of that user's active push subscriptions,
   **And** the notification payload includes a randomly selected themed message variant,
   **And** a record is stored in `one_more_mile_sent` to prevent re-sending for the same goal,
   **And** the notification's click-through URL is `/` (so the app routes to `/journey` or `/map` based on the user's `default_view_map` preference).

2. **Given** a user meets all distance and inactivity criteria,
   **But** they have already received a "One More Mile" notification for that specific goal,
   **When** the cron job runs,
   **Then** no notification is sent for that goal.

3. **Given** a user is within 2 km of their next goal,
   **But** they logged a walk yesterday, or the day before, or the day before that,
   **When** the cron job runs,
   **Then** no notification is sent (user is already active).

4. **Given** a user has completed the entire journey (no remaining goals beyond their total distance),
   **When** the cron job runs,
   **Then** no notification is sent.

5. **Given** an authenticated user views the notification settings on their profile,
   **When** the global notifications toggle is OFF,
   **Then** the notification settings group is collapsed and individual toggles are hidden.

6. **Given** an authenticated user views the notification settings on their profile,
   **When** the global notifications toggle is ON,
   **Then** the settings group expands showing individual notification type toggles,
   **And** a "One More Mile" toggle is visible with a description explaining the feature,
   **And** the toggle defaults to ON for new users.

7. **Given** a user toggles the "One More Mile" setting,
   **When** `PUT /api/push/settings` is called with `{ oneMoreMileEnabled: boolean }`,
   **Then** `users.one_more_mile_enabled` is updated and the response confirms success.

8. **Given** the cron job runs and sends a notification,
   **When** the push service returns 404 or 410 (Gone),
   **Then** the expired subscription is cleaned up (deleted from `push_subscriptions`),
   **And** the `one_more_mile_sent` record is still written (so the user isn't re-targeted if they re-subscribe).

9. **Given** there are multiple themed message variants,
   **When** a notification is sent,
   **Then** the selected variant includes a `title` and `body` that reference the goal name and remaining distance,
   **And** the variant is randomly chosen from the pool.

10. **Given** the `scheduled()` handler is called,
    **When** there are many eligible users,
    **Then** users are processed in batches (page size: 100) to stay within D1 row limits and Worker CPU time.

11. **Given** a user receives a "One More Mile" push notification,
    **When** the user clicks/taps the notification,
    **Then** the app opens to `/` (which routes to the user's preferred default view) — if the PWA or a browser tab is already open, it focuses that existing window instead of opening a new one,
    **And** the notification is dismissed on click.

## Tasks / Subtasks

- [x] Task 1: Database migration — `one_more_mile_sent` tracking table (AC: #1, #2, #8)
  - [x] 1.1: Create `migrations/0128_create_one_more_mile_sent.sql` with `one_more_mile_sent` table: `id` (PK), `user_id` (FK → users ON DELETE CASCADE), `goal_id` (FK → goals ON DELETE CASCADE), `sent_at` (TEXT DEFAULT CURRENT_TIMESTAMP), with `UNIQUE(user_id, goal_id)` constraint
  - [x] 1.2: Update `docs/data-models.md` with new table

- [x] Task 2: Database migration — `one_more_mile_enabled` user preference (AC: #6, #7)
  - [x] 2.1: Create `migrations/0129_add_one_more_mile_enabled.sql`: `ALTER TABLE users ADD COLUMN one_more_mile_enabled INTEGER NOT NULL DEFAULT 1;`
  - [x] 2.2: Update `docs/data-models.md` with new column

- [x] Task 3: Themed message variants — `src/push-messages.ts` (AC: #9)
  - [x] 3.1: Create `src/push-messages.ts` exporting a `ONE_MORE_MILE_MESSAGES` array of `{ title: string; bodyTemplate: string }` objects
  - [x] 3.2: Implement `getOneMoreMileMessage(goalTitle: string, remainingKm: number)` that randomly selects a variant and interpolates `{goalTitle}` and `{remainingKm}` placeholders
  - [x] 3.3: Include at least 8 themed message variants (see Dev Notes for examples)

- [x] Task 4: Cron handler — `src/scheduled-handlers.ts` (AC: #1, #2, #3, #4, #8, #10)
  - [x] 4.1: Create `src/scheduled-handlers.ts` with `handleOneMoreMileCron(env: Env)` function
  - [x] 4.2: Implement the eligible-user query: join `users`, `progress` (aggregated), `goals`, `push_subscriptions`, filtering by all 6 criteria (< 2 km, no walks in 3 days, not sent for this goal, not completed journey, both toggles enabled, has active subscription)
  - [x] 4.3: Process eligible users in batches (100 per query page)
  - [x] 4.4: For each eligible user: select random message, call `sendPushToUser()` from `src/push-utils.ts`, insert into `one_more_mile_sent`
  - [x] 4.5: Handle `sendPushToUser` failures gracefully — log errors, continue processing remaining users
  - [x] 4.6: Clean up expired subscriptions on 404/410 (re-use `cleanupExpiredSubscription` from `push-utils.ts`)

- [x] Task 5: Wire scheduled handler in `src/index.ts` (AC: #10)
  - [x] 5.1: Add `scheduled()` export alongside existing `fetch()` handler
  - [x] 5.2: Route to `handleOneMoreMileCron(env)` on cron trigger
  - [x] 5.3: Wrap in try/catch with console.error logging

- [x] Task 6: Update `wrangler.json` with cron trigger (AC: #10)
  - [x] 6.1: Add `"triggers": { "crons": ["0 9 * * *"] }` — run daily at 09:00 UTC
  - [x] 6.2: Document the cron schedule choice in code comment

- [x] Task 7: Update push settings API — `src/push-handlers.ts` (AC: #7)
  - [x] 7.1: Extend `handlePushSettings` (from Story 11.1) to accept `oneMoreMileEnabled` in addition to `notificationsEnabled`
  - [x] 7.2: Update `PUT /api/push/settings` body validation to handle both fields (either or both can be present)
  - [x] 7.3: Extend `GET /api/push/status` response to include `oneMoreMileEnabled: boolean`

- [x] Task 8: Refactor PushPermissionIsland into NotificationSettings group (AC: #5, #6)
  - [x] 8.1: Refactor `PushPermissionIsland` (from Story 11.1) to use a collapsible "Notification Settings" group pattern
  - [x] 8.2: The global notifications toggle becomes the collapse header — when OFF, group stays collapsed; when ON, group expands to show individual notification type toggles
  - [x] 8.3: Add "One More Mile Notifications" toggle inside the expanded group with descriptive text: "Get a nudge when you're close to your next milestone and haven't walked in a few days"
  - [x] 8.4: Wire the "One More Mile" toggle to `PUT /api/push/settings` with `{ oneMoreMileEnabled }` 
  - [x] 8.5: Load initial state for `oneMoreMileEnabled` from `GET /api/push/status`
  - [x] 8.6: Add CSS for the collapsible group in `public/css/profile.css`

- [x] Task 9: Tests (AC: all)
  - [x] 9.1: Backend tests in `tests/api/scheduled-handlers.test.ts`:
    - Eligible user gets notification (all criteria met)
    - User with walk in past 3 days is skipped
    - User already notified for this goal is skipped
    - User who completed the journey is skipped
    - User with global notifications off is skipped
    - User with one_more_mile_enabled off is skipped
    - Batch processing works correctly
    - Expired subscription cleanup on 410
    - Random message selection produces valid output
  - [x] 9.2: Backend tests for updated push settings in `tests/api/push-handlers.test.ts`:
    - `PUT /api/push/settings` with `oneMoreMileEnabled` updates column
    - `GET /api/push/status` returns `oneMoreMileEnabled` field
  - [x] 9.3: Unit tests for message variants in `tests/api/push-messages.test.ts`:
    - All message templates produce valid strings
    - `getOneMoreMileMessage()` interpolates goal name and distance correctly
    - Random selection covers the pool (statistical test optional)
  - [x] 9.4: Client tests in `client/src/islands/PushPermissionIsland.test.tsx`:
    - Collapsible group collapses when global toggle is OFF
    - Group expands when global toggle is ON
    - "One More Mile" toggle visible in expanded state
    - Toggle calls API with correct payload

### Review Findings

- [x] [Review][Patch] Mutable OFFSET pagination can skip eligible users after the first full batch [src/scheduled-handlers.ts:77] — **Fixed**: Removed OFFSET; always query from 0 since processed users are excluded by NOT EXISTS on one_more_mile_sent.
- [x] [Review][Patch] The sent-tracking row is written even when push delivery fails for non-404/410 errors [src/scheduled-handlers.ts:133] — **Fixed**: sendToUserSubscriptions now returns delivery summary; claim is rolled back when no sends succeeded and no subscriptions were cleaned up.
- [x] [Review][Patch] Overlapping cron runs can double-send the same one-time notification before dedupe is recorded [src/scheduled-handlers.ts:67] — **Fixed**: Claim-first pattern: INSERT dedupe row before sending; skip user if claim fails (UNIQUE constraint); roll back on send failure.
- [x] [Review][Patch] Notification clicks will not focus an already-open `/journey` or `/map` tab because the service worker only matches the exact `/` URL [public/sw.js:167] — **Fixed**: Added same-origin fallback loop after exact URL match fails.
- [x] [Review][Patch] `PUT /api/push/settings` accepts partially invalid payloads instead of rejecting malformed provided fields [src/push-handlers.ts:186] — **Fixed**: Added explicit type checks before boolean coercion; rejects with 400 if a present field is not boolean.

## Dev Notes

### Architecture & Patterns

- **Handler pattern**: Follow `src/stats-handlers.ts` / `src/friends-handlers.ts`. Each handler receives `(request, db, body?, allowTestAuth?)` and returns a `Response`.
- **DB access**: Use `db.read` for SELECT, `db.write` for INSERT/UPDATE/DELETE via `DbClient` from `src/db.ts`.
- **Response format**: Use `createSuccessResponse(data)` and `createErrorResponse(message, statusCode)` from `src/validators.ts`.
- **Auth validation**: `validateSession(request, db, allowTestAuth)` — returns `{ valid: true, userId }` or `{ valid: false, error: Response }`.

### Scheduled Handler Pattern

The Worker must export a `scheduled()` handler alongside `fetch()`. This is a **new pattern** for this codebase — no scheduled handler exists yet.

```typescript
// src/index.ts — export pattern
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // ... existing router ...
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleOneMoreMileCron(env));
  }
} satisfies ExportedHandler<Env>;
```

**wrangler.json** addition:
```json
{
  "triggers": {
    "crons": ["0 9 * * *"]
  }
}
```

**Local testing**: `npx wrangler dev --test-scheduled`, then `curl http://localhost:8787/__scheduled?cron=0+9+*+*+*`

### Eligible User Query Strategy

The core query must find users matching ALL criteria in a single efficient query. Here is the recommended approach:

```sql
-- Step 1: For each user with active push subscriptions + both toggles enabled,
-- compute their total distance and find their next goal
WITH user_distances AS (
  SELECT 
    u.id AS user_id,
    COALESCE(SUM(p.distance), 0) AS total_distance
  FROM users u
  LEFT JOIN progress p ON p.user_id = u.id
  WHERE u.notifications_enabled = 1
    AND u.one_more_mile_enabled = 1
  GROUP BY u.id
),
-- Step 2: Find next goal for each user (first goal with distance > total_distance)
user_next_goals AS (
  SELECT 
    ud.user_id,
    ud.total_distance,
    MIN(g.id) AS next_goal_id,
    MIN(g.distance) AS next_goal_distance,
    MIN(g.title) AS next_goal_title
  FROM user_distances ud
  INNER JOIN goals g ON g.distance > ud.total_distance
  GROUP BY ud.user_id, ud.total_distance
),
-- Step 3: Filter to within 2 km
close_users AS (
  SELECT *
  FROM user_next_goals
  WHERE (next_goal_distance - total_distance) < 2.0
)
SELECT 
  cu.user_id,
  cu.total_distance,
  cu.next_goal_id,
  cu.next_goal_distance,
  cu.next_goal_title,
  (cu.next_goal_distance - cu.total_distance) AS remaining_km
FROM close_users cu
-- Must have at least one active push subscription
WHERE EXISTS (
  SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = cu.user_id
)
-- Must NOT have a walk in the past 3 days
AND NOT EXISTS (
  SELECT 1 FROM progress p 
  WHERE p.user_id = cu.user_id 
    AND p.date >= date('now', '-3 days')
)
-- Must NOT have already been sent a notification for this goal
AND NOT EXISTS (
  SELECT 1 FROM one_more_mile_sent oms 
  WHERE oms.user_id = cu.user_id 
    AND oms.goal_id = cu.next_goal_id
)
LIMIT 100 OFFSET ?;
```

**Performance notes:**
- D1 has a 1 MB result size limit per query — batching with LIMIT/OFFSET handles this.
- The CTE approach avoids N+1 queries. With small user counts (<10k), this is efficient.
- Index on `push_subscriptions(user_id)` exists from Story 11.1 migration.
- Consider adding an index on `progress(user_id, date)` if not already present — check existing schema.

### "3 Days" Inactivity Logic

The intent is: the user hasn't walked for 3 consecutive recent days (yesterday, day-before-yesterday, and the day before that). This means:
- `date('now', '-1 day')` = yesterday
- `date('now', '-2 days')` = day before yesterday  
- `date('now', '-3 days')` = 3 days ago

The query `p.date >= date('now', '-3 days')` catches any walk logged on yesterday, the day before, or the day before that. If ANY walk exists in that range, the user is considered "active" and is skipped.

**Why 3 days specifically?** The user wants to encourage back-filling yesterday's walk. If someone walked yesterday but hasn't entered it yet, they have 3 days of buffer before getting nudged. This avoids annoying users who simply log their walks a day or two late.

### Themed Message Variants

Create at least 8 variants. Each has a `title` and `bodyTemplate` with `{goalTitle}` and `{remainingKm}` placeholders. Examples:

```typescript
export const ONE_MORE_MILE_MESSAGES: ReadonlyArray<{ title: string; bodyTemplate: string }> = [
  {
    title: "One More Mile, {goalTitle} Awaits!",
    bodyTemplate: "You're just {remainingKm} km away from {goalTitle}. Surely a short walk would take you there!"
  },
  {
    title: "The Road Goes Ever On",
    bodyTemplate: "Only {remainingKm} km to {goalTitle}. Even the smallest step forward can change the journey."
  },
  {
    title: "Don't Stop Now, Traveller!",
    bodyTemplate: "{goalTitle} is a mere {remainingKm} km ahead. You've come too far to rest now."
  },
  {
    title: "Almost There!",
    bodyTemplate: "If Samwise can carry Frodo up Mount Doom, you can walk {remainingKm} km to {goalTitle}."
  },
  {
    title: "A Shortcut to {goalTitle}",
    bodyTemplate: "Just {remainingKm} km remain. Mushrooms optional, but the milestone is within reach!"
  },
  {
    title: "The Eagles Are Coming!",
    bodyTemplate: "Well, not quite — but {goalTitle} is only {remainingKm} km away. Lace up those boots!"
  },
  {
    title: "Strider's Counsel",
    bodyTemplate: "\"Not all those who wander are lost.\" And you're only {remainingKm} km from {goalTitle}."
  },
  {
    title: "A Light in the Darkness",
    bodyTemplate: "{goalTitle} glimmers just {remainingKm} km ahead. One walk is all it takes."
  }
];
```

**Random selection**: Use `Math.floor(Math.random() * messages.length)` — no need for crypto-grade randomness.

**Interpolation**: Simple string replace: `.replace(/{goalTitle}/g, goalTitle).replace(/{remainingKm}/g, remainingKm.toFixed(1))`.

### Notification Settings UI — Collapsible Group Pattern

The existing `PushPermissionIsland` (from Story 11.1) currently has a single global toggle. This story refactors it into a **collapsible notification settings group**:

```
┌─ Notification Settings ──────────────────┐
│ 🔔 Push Notifications  [━━━━●] ON       │ ← Global toggle (collapse header)
│                                           │
│ ┌─ Notification Types ─────────────────┐ │ ← Revealed when global is ON
│ │ 📍 One More Mile      [━━━━●] ON    │ │
│ │   Get a nudge when you're close to   │ │
│ │   your next milestone.               │ │
│ └──────────────────────────────────────┘ │
│                                           │
│ Enabled on 2 devices                      │
└───────────────────────────────────────────┘
```

When global toggle is OFF:
```
┌─ Notification Settings ──────────────────┐
│ 🔔 Push Notifications  [●━━━━] OFF      │ ← Collapsed, no children visible
└───────────────────────────────────────────┘
```

**Implementation approach:**
- Use a Preact state signal `isExpanded` derived from the global `notificationsEnabled` state.
- When `notificationsEnabled` is false, render only the header toggle.
- When `notificationsEnabled` is true, expand to show device status + individual notification type toggles.
- Each notification type toggle calls `PUT /api/push/settings` with the specific field.
- Animate expand/collapse with CSS `max-height` transition or `details`/`summary` HTML element.

### Migration Details

- **Next migration numbers**: `0128` and `0129` (after Story 11.1's `0126` and `0127`)
- **0128_create_one_more_mile_sent.sql**:
  ```sql
  CREATE TABLE IF NOT EXISTS one_more_mile_sent (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, goal_id)
  );
  CREATE INDEX idx_one_more_mile_sent_user_goal ON one_more_mile_sent(user_id, goal_id);
  ```
- **0129_add_one_more_mile_enabled.sql**:
  ```sql
  ALTER TABLE users ADD COLUMN one_more_mile_enabled INTEGER NOT NULL DEFAULT 1;
  ```

### Push settings API extension

Story 11.1 creates `PUT /api/push/settings` accepting `{ notificationsEnabled }`. This story extends it:

- Accept body: `{ notificationsEnabled?: boolean, oneMoreMileEnabled?: boolean }` — either or both fields.
- Validate: if `oneMoreMileEnabled` is present, it must be a boolean.
- Update: build dynamic UPDATE SET clause for only the provided fields (follow the pattern in `handleUpdatePreferences` in `auth-handlers.ts` which dynamically builds column sets).
- Extend `GET /api/push/status` response to include `oneMoreMileEnabled`.

### Worker `scheduled()` handler — New export pattern

The current `src/index.ts` exports a `default` object with only `fetch`. This must be extended:

```typescript
export default {
  async fetch(request, env, ctx) { /* existing */ },
  async scheduled(event, env, ctx) { /* new */ }
} satisfies ExportedHandler<Env>;
```

**Check**: If `src/index.ts` currently uses `export default { fetch: ... }` syntax, the `scheduled` handler is simply added alongside. If it uses `export default { async fetch() {} }` shorthand, same pattern applies.

**CPU limit**: Cloudflare Workers `scheduled` handlers have a **30-second CPU time limit** (soft, may vary by plan). Process users in batches of 100, and if the batch count is large, consider using `ctx.waitUntil()` for background processing.

### Progress table index check

The query filters on `progress(user_id, date)`. Check if an index exists:
- Migration `0005_add_unique_date_constraint.sql` adds `UNIQUE(date, user_id)` — this creates a unique index on `(date, user_id)`. This is sufficient for the `NOT EXISTS` subquery.

### Project Structure Notes

- New files:
  - `src/push-messages.ts` — themed notification message templates
  - `src/scheduled-handlers.ts` — cron job handler
  - `migrations/0128_create_one_more_mile_sent.sql`
  - `migrations/0129_add_one_more_mile_enabled.sql`
  - `tests/api/scheduled-handlers.test.ts` — cron handler tests
  - `tests/api/push-messages.test.ts` — message template tests (optional, can co-locate)
- Modified files:
  - `src/index.ts` — add `scheduled()` export, import scheduled handler
  - `wrangler.json` — add `triggers.crons` array
  - `src/push-handlers.ts` — extend settings endpoint for `oneMoreMileEnabled`
  - `client/src/islands/PushPermissionIsland.tsx` — refactor into collapsible notification settings group
  - `client/src/islands/PushPermissionIsland.test.tsx` — update tests for new UI
  - `client/src/utils/push-client.ts` — extend `updateNotificationSettings` to support new field
  - `public/css/profile.css` — styles for collapsible group
  - `docs/data-models.md` — document new table + column
  - `docs/api-reference.md` — document updated settings endpoint + cron behavior

### Previous Story Intelligence (Story 11.1)

- Story 11.1 establishes the push infrastructure: `push_subscriptions` table, VAPID keys, `push-handlers.ts`, `push-utils.ts`, `PushPermissionIsland`, Service Worker push/notificationclick handlers.
- `sendPushToUser(db, userId, payload, env)` from `push-utils.ts` handles: querying all active subscriptions, checking `notifications_enabled`, sending encrypted payloads, cleaning up 410s. **Reuse this directly** — do not duplicate.
- `cleanupExpiredSubscription(db, endpoint)` from `push-utils.ts` — reuse for 410 cleanup.
- `PushPayload` interface from `push-utils.ts`: `{ title: string; body: string; url?: string; icon?: string }`.
- The profile page already has a `<div data-island="PushPermissionIsland">` mount point.
- The island reads `sessionToken` from `appStore` signals.
- Test pattern uses `TEST_MOCK_TOKEN_<username>` for auth in tests.

### CRITICAL: Do NOT

- Do NOT create a separate "notification preferences" table — use columns on the `users` table (consistent with `show_future_goals_unlocked`, `default_view_map` pattern).
- Do NOT make this notification daily — it should only fire ONCE per goal per user, and only when ALL 6 criteria are met.
- Do NOT send to users who have completed the entire journey.
- Do NOT hardcode cron time — use `wrangler.json` config so it can be adjusted without code changes.
- Do NOT send notification if the user has logged ANY walk in the past 3 days (even a 0-distance entry is activity).
- Do NOT use the `web-push` npm library — it requires Node.js crypto. Use `sendPushToUser` from `push-utils.ts` which is built for Cloudflare Workers (Web Crypto API).

---

## Change Log

### Implementation Record

**Branch**: `feat/11-2-one-more-mile-push-notification`

**New Files:**
- `migrations/0128_create_one_more_mile_sent.sql` — Tracking table for sent notifications
- `migrations/0129_add_one_more_mile_enabled.sql` — User preference column
- `src/push-messages.ts` — 8 Tolkien-themed message variants with interpolation
- `src/scheduled-handlers.ts` — Cron handler with CTE query, batch processing, 410 cleanup
- `tests/api/push-messages.test.ts` — Message template unit tests
- `tests/api/scheduled-handlers.test.ts` — Cron handler unit tests

**Modified Files:**
- `src/index.ts` — Added `scheduled()` handler export
- `wrangler.json` — Added `triggers.crons` for daily 09:00 UTC
- `src/push-handlers.ts` — Extended settings/status for `oneMoreMileEnabled`, dynamic UPDATE pattern
- `client/src/islands/PushPermissionIsland.tsx` — Collapsible group with One More Mile toggle
- `client/src/utils/push-client.ts` — Extended `updateNotificationSettings` for new field
- `client/src/islands/PushPermissionIsland.test.tsx` — Tests for collapsible group + toggle
- `tests/api/push-handlers.test.ts` — Tests for updated settings/status endpoints
- `public/css/profile.css` — Notification types section styling
- `docs/data-models.md` — New table + column documentation
- `docs/api-reference.md` — Updated settings endpoint + cron documentation

**Test Results:**
- Backend: 41 suites, 1239 tests — all passing
- Client: 50 suites, 783 tests — all passing
- No lint errors

**Dev Agent Notes:**
- `handlePushSettings` was refactored from single-field to dynamic multi-field UPDATE pattern (following `handleUpdatePreferences` in `auth-handlers.ts`)
- The cron handler uses a single CTE-based query for efficiency, with LIMIT/OFFSET batch pagination
- `sendPushNotification` from `push-utils.ts` is called directly per-subscription (not `sendPushToUser`) to enable per-subscription 410 cleanup in the cron context
- All acceptance criteria (#1-#11) are covered by the implementation and tests

### References

- Cron handler pattern: [Source: docs/architecture.md] — new pattern, Cloudflare Workers `scheduled()` export
- Cron wrangler config: `"triggers": { "crons": ["0 9 * * *"] }` in `wrangler.json` — [Source: Cloudflare docs: Scheduled Handler]
- Push utility: [Source: src/push-utils.ts (from Story 11.1)] — `sendPushToUser`, `cleanupExpiredSubscription`, `PushPayload`
- Push handlers: [Source: src/push-handlers.ts (from Story 11.1)] — `handlePushSettings`, `handlePushStatus`
- Goals schema: [Source: migrations/0003_init_goals.sql] — `goals.distance` is absolute position on route
- Total distance calc: [Source: src/goals-handlers.ts#calculateTotalDistance] — sums `progress.distance`
- Progress unique constraint: [Source: migrations/0005_add_unique_date_constraint.sql] — `UNIQUE(date, user_id)` creates index
- Dynamic preference updates: [Source: src/auth-handlers.ts#handleUpdatePreferences] — pattern for building dynamic UPDATE SET clause
- Island registration: [Source: client/src/index.tsx] — auto-hydration map
- App store signals: [Source: client/src/stores/appStore.ts] — `sessionToken`, `userId`
- Test auth pattern: [Source: tests/api/*.test.ts] — `TEST_MOCK_TOKEN_<username>`
- Local cron testing: `npx wrangler dev --test-scheduled`, then `curl http://localhost:8787/__scheduled?cron=0+9+*+*+*`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (GitHub Copilot)

### Completion Notes List

- Story created: 2026-04-10
- User explicitly requested: <2 km threshold, 3-day inactivity window, once-per-goal dedup, themed message variety, completed-journey exclusion, separate toggle with collapsible settings group
- Key dependency: Story 11.1 (Web Push Infrastructure) must be implemented first — this story uses `sendPushToUser`, `push_subscriptions` table, `PushPermissionIsland`, `push-handlers.ts`
- Key new pattern: `scheduled()` handler — first cron trigger in the codebase
- Migration numbers 0128–0129 follow Story 11.1's 0126–0127
- The "3 days" inactivity check uses `date('now', '-3 days')` which in SQLite returns the date 3 days ago — the `>=` comparison catches any activity in the past 3 days

### File List

<!-- To be filled by dev agent -->
