## Why

The `community-campaigns` change makes campaigns publicly discoverable, but users have no way to know when new campaigns are created or when campaigns they've joined reach completion. Push notifications for campaign events keep users engaged with the community loop — they learn about new campaigns without manually checking the `/events` page, and they feel the collective achievement when a campaign they contributed to succeeds.

## What Changes

- Add a `community_campaigns_enabled` boolean column to the `users` table (default enabled), following the existing pattern of `one_more_mile_enabled` and `inactivity_nudge_enabled`.
- Extend `handlePushSettings` and `handlePushStatus` to read and write the new category preference, including the settings-presence guard and the `PushStatusRow` shape.
- Add a "Community Campaigns" toggle to the existing Notification Types block in the push settings card, with matching client types.
- Send push notifications when a campaign run first becomes publicly visible (retrigger of an enabled campaign announces the new run; enabling a disabled campaign announces its unannounced run), to all users with subscriptions and the category enabled. Seeded runs stay silent until an admin enables the campaign. Announcement is once per run via the run's `announced_at` stamp.
- Send push notifications when a community campaign run reaches its target and completes, to all contributing participants with the category enabled.
- Reuse the existing `sendPushToUser` utility from `src/push-utils.ts` and the route-layer background scheduling pattern for non-blocking delivery.
- Declare the cross-change dependency: this change requires `community-campaigns` (run model, `announced_at`, completion hook) and `community-campaigns-admin` (retrigger and enable trigger points).

## Capabilities

### New Capabilities
- `community-campaign-notifications`: Push notification category for community campaign creation and completion events, with per-user opt-in/opt-out via the existing push settings flow.

### Modified Capabilities
- None.

## Impact

- D1 schema: new `community_campaigns_enabled` column on `users` table (additive migration, default 1).
- Worker APIs: extend `GET /api/push/status` and `PUT /api/push/settings` to include `communityCampaignsEnabled`; extend the settings-presence guard to accept the new key alone.
- Worker domain: add notification trigger points in the campaign lifecycle — announce a run when it first becomes publicly visible (retrigger route, or enable route for an unannounced run, stamping `announced_at`), and announce completion on synchronous run completion. Delivery runs through the route-layer background scheduling callback, not `ctx.waitUntil` inside handlers (handlers have no execution context).
- Frontend: add the third toggle to `PushPermissionIsland` and the new field to `client/src/utils/push-client.ts` types.
- No new API endpoints, no new tables.
- Tests: Jest coverage for settings persistence and notification trigger logic; Vitest coverage for the new settings toggle.
- Documentation: update `docs/api-reference.md` and `docs/email.md` (or push documentation) with the new category.
