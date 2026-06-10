## Context

The app already has a push notification system with two categories: `one_more_mile_enabled` and `inactivity_nudge_enabled`. These are stored as boolean columns on the `users` table, exposed through `GET /api/push/status` and `PUT /api/push/settings`, and triggered by scheduled cron jobs in `src/scheduled-handlers.ts`.

The `push_subscriptions` table stores Web Push subscription objects per user. `sendPushToUser` in `src/push-utils.ts` delivers notifications to all of a user's registered subscriptions. The `PushPayload` interface carries a `type` discriminator and a `body` message.

Community campaign notifications follow this exact pattern: a new category column, a new `type` discriminator, and trigger points in the campaign lifecycle.

## Goals / Non-Goals

**Goals:**
- Add a `community_campaigns_enabled` column to `users` (default 1/enabled).
- Expose the new setting through the existing push status and settings endpoints.
- Send notifications when a new community campaign is created and when a campaign completes.
- Respect per-user opt-out: only send to users with `community_campaigns_enabled = 1` who have active push subscriptions.

**Non-Goals:**
- No campaign-specific notification settings beyond the single enabled/disabled toggle.
- No notification for campaign expiry (only creation and completion).
- No notification for personal challenges (separate future work if needed).
- No notification content customization UI (uses standard campaign name + fixed message template).

## Decisions

### Follow the existing notification category pattern exactly

Add `community_campaigns_enabled INTEGER NOT NULL DEFAULT 1` to `users`. Extend `NotificationSettingsRow` and the push handlers to read/write it. Use `community_campaign_created` and `community_campaign_completed` as `type` discriminators in the `PushPayload`.

Rationale: the two existing categories (`one_more_mile_enabled`, `inactivity_nudge_enabled`) are a proven pattern. Adding a third follows the same schema, handler, and delivery approach without inventing anything new.

### Trigger notifications from the campaign lifecycle, not the push system

The notification send calls are added to the campaign lifecycle hooks in `src/campaign-utils.ts` (or wherever campaign creation and completion are processed):
- **On campaign create** (admin creates via migration or admin UI): send `community_campaign_created` to all users with `community_campaigns_enabled = 1`.
- **On campaign completion** (reconciliation detects target met): send `community_campaign_completed` to all participants with `progress_distance > 0` and `community_campaigns_enabled = 1`.

Rationale: the push system is a delivery mechanism, not a decision engine. The campaign lifecycle knows when events happen; it fires notifications through the existing push utility.

### Use `ctx.waitUntil` for non-blocking delivery

Notification sending uses `ctx.waitUntil(sendPushNotification(...))` so campaign creation/completion responses are not delayed by push delivery. This follows the same pattern used by admin audit logging and content discovery analytics.

Rationale: push delivery can take hundreds of milliseconds per recipient. `waitUntil` lets the Worker continue processing after the response is sent.

### Notification for new campaigns goes to all subscribed users

When a campaign is created, notifications go to ALL users with the category enabled and active push subscriptions — not just participants (the campaign is new, there are no participants yet). This drives discovery: users learn about the campaign and may join.

Rationale: the whole point of community campaign notifications is to tell people about new campaigns so they can join. Limiting to participants would make the "new campaign" notification pointless.

### Notification for completed campaigns goes to contributors only

When a campaign completes, notifications go to all participants who contributed any distance — not all users. This is a personal "your effort helped" message, not a general announcement.

## Risks / Trade-offs

- [Large user base could make notification delivery slow] → `ctx.waitUntil` decouples delivery from the response. D1 queries for active subscriptions are indexed by user_id and efficient at the expected scale.
- [New notification category adds migration complexity] → Additive migration only. Defaulting to enabled means existing users automatically receive the new category; they can opt out via push settings.
- [Notification text may feel generic] → Use a fixed template with the campaign name. Customization can come later via admin UI if needed.

## Migration Plan

1. Add migration for `community_campaigns_enabled` column on `users`.
2. Extend `handlePushStatus` and `handlePushSettings` to include the new category.
3. Add notification send calls to campaign creation and completion hooks in `src/campaign-utils.ts`.
4. Add Jest coverage for settings persistence and notification triggers.
5. Update docs.

Rollback: remove the column migration, remove the handler extensions, remove the notification calls. No data loss.

## Open Questions

None.
