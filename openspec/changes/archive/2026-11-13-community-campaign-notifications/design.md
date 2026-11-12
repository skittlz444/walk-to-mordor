## Context

The app already has a push notification system with two categories: `one_more_mile_enabled` and `inactivity_nudge_enabled`. These are stored as boolean columns on the `users` table, exposed through `GET /api/push/status` and `PUT /api/push/settings`, and triggered by scheduled cron jobs in `src/scheduled-handlers.ts`.

The `push_subscriptions` table stores Web Push subscription objects per user. `sendPushToUser` in `src/push-utils.ts` delivers notifications to all of a user's registered subscriptions. The `PushPayload` interface is `{ title: string; body: string; url?: string; icon?: string } & Record<string, string>` — there is no `type` discriminator in existing payloads, and nested objects are not allowed. Campaign payloads therefore use flat string fields (`type`, `campaignSlug`) plus `title`, `body`, and `url`.

Community campaign notifications follow this exact pattern: a new category column, a new `type` discriminator, and trigger points in the campaign lifecycle.

## Goals / Non-Goals

**Goals:**
- Add a `community_campaigns_enabled` column to `users` (default 1/enabled).
- Expose the new setting through the existing push status and settings endpoints.
- Send notifications when a campaign run first becomes publicly visible and when a run completes.
- Respect per-user opt-out: only send to users with `community_campaigns_enabled = 1` who have active push subscriptions.

**Non-Goals:**
- No campaign-specific notification settings beyond the single enabled/disabled toggle.
- No notification for run expiry (only run announcement and completion).
- No notification for personal challenges (separate future work if needed).
- No notification content customization UI (uses standard campaign name + fixed message template).

## Decisions

### Follow the existing notification category pattern exactly

Add `community_campaigns_enabled INTEGER NOT NULL DEFAULT 1` to `users`. Extend `PushStatusRow` and the push handlers to read/write it. Use `community_campaign_created` and `community_campaign_completed` as flat string `type` fields in the payload.

Rationale: the two existing categories (`one_more_mile_enabled`, `inactivity_nudge_enabled`) are a proven pattern. Adding a third follows the same schema, handler, and delivery approach without inventing anything new.

### Trigger notifications from the campaign lifecycle, not the push system

Runs carry an `announced_at` column (created by the `community-campaigns` change), and a run is announced exactly once — when it **first becomes publicly visible**:
- **On retrigger** (`community-campaigns-admin` retrigger route, campaign enabled): the new run is announced immediately and `announced_at` is stamped.
- **On enable** (admin enable route): if the campaign's unannounced upcoming/active run exists, it is announced and `announced_at` is stamped. Campaign create and seed migrations store `enabled = false`, so a seeded run stays silent until an admin enables the campaign.
- **On run completion** (reconciliation detects target met): send `community_campaign_completed` to all active participants of the completed run with `progress_distance > 0` and `community_campaigns_enabled = 1`.

Announcement is idempotent by construction: `announced_at` is stamped in the same D1 batch that dispatches, and only runs with `announced_at = NULL` are announced — a later maintenance disable→enable cycle re-announces nothing.

Cross-change dependency: the retrigger/enable triggers live in the `community-campaigns-admin` change and the completion hook in the `community-campaigns` change. This change cannot be applied standalone.

Rationale: the push system is a delivery mechanism, not a decision engine. The campaign lifecycle knows when events happen; it fires notifications through the existing push utility.

### Use route-layer background scheduling, not `ctx.waitUntil` in handlers

Campaign lifecycle work runs inside request handlers (`progress-handlers.ts`, campaign admin handlers) that receive no execution context, so `ctx.waitUntil` is unavailable there. Instead, the route layer passes a `scheduleBackground` callback into the handler (the pattern used by `goal-content-handlers.ts` with the route wiring in `index.ts`): the callback wraps `sendPushToUser` deliveries in `waitUntil` when an execution context exists.

Rationale: push delivery can take hundreds of milliseconds per recipient. Background scheduling keeps campaign responses fast without threading execution contexts through domain services.

### Notification for run announcements goes to all subscribed users

When a run first becomes publicly visible, notifications go to ALL users with the category enabled and active push subscriptions — not just participants (a fresh run has none). This drives discovery: users learn the new run started and may join.

Rationale: the whole point of run announcements is to tell people a run is live so they can join. Limiting to participants would make the announcement pointless for each new run.

### Flat payload templates with an events click-through

Both payloads use flat strings compatible with `PushPayload`:
- `{ title: 'Community campaign', body: '"X" is live — rally the community to the target!', url: '/events', type: 'community_campaign_created', campaignSlug: 'x', runNumber: '2' }`
- `{ title: 'Campaign completed', body: 'Campaign "X" has been completed! Well done!', url: '/events', type: 'community_campaign_completed', campaignSlug: 'x', runNumber: '2' }`

`type` keeps the `community_campaign_created` name for the run announcement (a run is the campaign instance going live). The service worker navigates to `payload.url` when present, falling back to `/journey`; without `url`, campaign notifications would open the wrong page.

### Settings guard and client toggle

`handlePushSettings` currently rejects a body unless one of the three existing keys is present; the new key is added to that presence guard so `{ communityCampaignsEnabled: false }` alone is accepted. On the client, `PushPermissionIsland` renders a third toggle in the Notification Types block (label "Community Campaigns", hint covering new-campaign and completion notices), and `client/src/utils/push-client.ts` gains the field in `PushStatusData` and `NotificationSettingsPayload`.

### Notification for completed campaigns goes to contributors only

When a campaign completes, notifications go to all participants who contributed any distance — not all users. This is a personal "your effort helped" message, not a general announcement.

## Risks / Trade-offs

- [Large user base could make notification delivery slow] → background scheduling decouples delivery from the response. D1 queries for active subscriptions are indexed by user_id and efficient at the expected scale.
- [New notification category adds migration complexity] → Additive migration only. Defaulting to enabled means existing users automatically receive the new category; they can opt out via push settings. This is a deliberate product decision and should be mentioned in release notes.
- [Notification text may feel generic] → Use a fixed template with the campaign name. Customization can come later via admin UI if needed.
- [Migration-seeded runs never announce on deploy] → Seeded runs ship disabled and silent; an admin enabling the campaign announces the run to subscribers. Documented and acceptable.
- [Cross-change dependency] → The retrigger/enable triggers require `community-campaigns-admin` and the completion hook requires `community-campaigns` (including the `campaign_runs.announced_at` column); this change should be applied after both.

## Migration Plan

1. Add migration for `community_campaigns_enabled` column on `users`.
2. Extend `handlePushStatus` and `handlePushSettings` to include the new category, including the presence guard.
3. Add notification send calls at the run-visibility points (retrigger route, enable route for unannounced runs) and the completion hook (walk-save route), stamping `announced_at` in the same batch, using the route-layer background scheduling callback.
4. Add the client toggle and client types.
5. Add Jest and Vitest coverage.
6. Update docs.

Rollback: remove the column migration, remove the handler extensions, remove the notification calls. No data loss.

## Open Questions

None.
