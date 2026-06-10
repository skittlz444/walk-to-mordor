## 1. Schema and Settings

- [ ] 1.1 Add D1 migration for `community_campaigns_enabled` column on `users` table: `ALTER TABLE users ADD COLUMN community_campaigns_enabled INTEGER NOT NULL DEFAULT 1`.
- [ ] 1.2 Extend the `NotificationSettingsRow` interface and query in `src/push-handlers.ts` to include `community_campaigns_enabled`.
- [ ] 1.3 Extend `handlePushStatus` (`GET /api/push/status`) to return `communityCampaignsEnabled` in the response alongside existing `notificationsEnabled`, `oneMoreMileEnabled`, and `inactivityNudgeEnabled`.
- [ ] 1.4 Extend `handlePushSettings` (`PUT /api/push/settings`) to accept `communityCampaignsEnabled: boolean` and write it to the `users` table following the existing update pattern.

## 2. Notification Triggers

- [ ] 2.1 In the campaign creation flow (admin campaign create handler in `src/campaign-utils.ts` or `src/campaign-admin-handlers.ts`), after saving the campaign, call a notification function that queries all users with `community_campaigns_enabled = 1` and active push subscriptions, then sends `community_campaign_created` with the campaign name via `sendPushToUser` using `ctx.waitUntil`.
- [ ] 2.2 In the campaign completion flow (reconciliation in `src/campaign-utils.ts`), after marking the campaign completed and awarding badges, query all participants with `progress_distance > 0` and `community_campaigns_enabled = 1`, then send `community_campaign_completed` with the campaign name via `sendPushToUser` using `ctx.waitUntil`.
- [ ] 2.3 Define notification payload templates: `{ type: 'community_campaign_created', body: 'A new campaign "X" is now active!', data: { campaignId, campaignSlug } }` and `{ type: 'community_campaign_completed', body: 'Campaign "X" has been completed! Well done!', data: { campaignId, campaignSlug } }`.

## 3. Validation

- [ ] 3.1 Add Jest coverage for: push status includes new setting, push settings update writes new setting, new campaign triggers notification to all subscribed users, campaign completion triggers notification to contributors only, users with category disabled are excluded, notification failure does not block campaign operations.
- [ ] 3.2 Run `npm test` and fix regressions related to the new column, handler extensions, and notification triggers.
- [ ] 3.3 Run `npm run check` and resolve any TypeScript or Wrangler dry-run issues.
- [ ] 3.4 Update `docs/api-reference.md` with the new `communityCampaignsEnabled` field in push status and settings endpoints.
