## Why

The `community-campaigns` change makes campaigns publicly discoverable, but users have no way to know when new campaigns are created or when campaigns they've joined reach completion. Push notifications for campaign events keep users engaged with the community loop — they learn about new campaigns without manually checking the `/events` page, and they feel the collective achievement when a campaign they contributed to succeeds.

## What Changes

- Add a `community_campaigns_enabled` boolean column to the `users` table (default enabled), following the existing pattern of `one_more_mile_enabled` and `inactivity_nudge_enabled`.
- Extend `handlePushSettings` and `handlePushStatus` to read and write the new category preference.
- Send push notifications when a new community campaign is created (to all users with subscriptions and the category enabled).
- Send push notifications when a community campaign reaches its target and completes (to all participants who contributed and have the category enabled).
- Reuse the existing `sendPushToUser` utility from `src/push-utils.ts` for delivery.

## Capabilities

### New Capabilities
- `community-campaign-notifications`: Push notification category for community campaign creation and completion events, with per-user opt-in/opt-out via the existing push settings flow.

### Modified Capabilities
- None.

## Impact

- D1 schema: new `community_campaigns_enabled` column on `users` table (additive migration, default 1).
- Worker APIs: extend `GET /api/push/status` and `PUT /api/push/settings` to include `communityCampaignsEnabled`.
- Worker domain: add notification trigger points in `community-campaigns` lifecycle hooks — send "new campaign" notification on campaign create, send "campaign completed" notification on completion.
- No new API endpoints, no new tables, no UI changes beyond the existing push settings toggle.
- Tests: Jest coverage for settings persistence and notification trigger logic.
- Documentation: update `docs/api-reference.md` and `docs/email.md` (or push documentation) with the new category.
