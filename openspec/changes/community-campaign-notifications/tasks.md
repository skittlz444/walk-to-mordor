## 1. Schema and Settings

- [ ] 1.1 Add D1 migration for `community_campaigns_enabled` column on `users` table: `ALTER TABLE users ADD COLUMN community_campaigns_enabled INTEGER NOT NULL DEFAULT 1`.
- [ ] 1.2 Extend the `PushStatusRow` interface and query in `src/push-handlers.ts` to include `community_campaigns_enabled`.
- [ ] 1.3 Extend `handlePushStatus` (`GET /api/push/status`) to return `communityCampaignsEnabled` in the response alongside existing `notificationsEnabled`, `oneMoreMileEnabled`, and `inactivityNudgeEnabled`.
- [ ] 1.4 Extend `handlePushSettings` (`PUT /api/push/settings`) to accept `communityCampaignsEnabled: boolean` and write it to the `users` table following the existing update pattern. Add the new key to the presence guard so a body containing only `communityCampaignsEnabled` is accepted.
- [ ] 1.5 Extend `client/src/utils/push-client.ts` types (`PushStatusData`, `NotificationSettingsPayload`) with `communityCampaignsEnabled`.

## 2. Notification Triggers

- [ ] 2.1 In the retrigger flow (`POST /api/admin/campaigns/:id/retrigger` from `community-campaigns-admin`, campaign enabled), after inserting the new run, query all users with `community_campaigns_enabled = 1` and active push subscriptions, send `community_campaign_created` with the campaign name and run number via `sendPushToUser` using the route-layer background scheduling callback, and stamp the run's `announced_at` in the same batch. Only runs with `announced_at = NULL` are announced.
- [ ] 2.2 In the enable flow (`PUT /api/admin/campaigns/:id/enable`), if the campaign's unannounced upcoming/active run exists, send the run announcement the same way and stamp its `announced_at`. A later disable→enable maintenance cycle re-announces nothing because the run is already stamped.
- [ ] 2.3 In the run completion flow (reconciliation in `src/campaign-utils.ts`), after marking the run completed and awarding badges, query all active participants with `progress_distance > 0` and `community_campaigns_enabled = 1`, then send `community_campaign_completed` with the campaign name and run number via `sendPushToUser` using the route-layer background scheduling callback.
- [ ] 2.4 Define flat notification payload templates compatible with `PushPayload`: `{ title: 'Community campaign', body: '"X" is live — rally the community to the target!', url: '/events', type: 'community_campaign_created', campaignSlug: 'x', runNumber: '2' }` and `{ title: 'Campaign completed', body: 'Campaign "X" has been completed! Well done!', url: '/events', type: 'community_campaign_completed', campaignSlug: 'x', runNumber: '2' }`.
- [ ] 2.5 Add the third toggle to `PushPermissionIsland` in the Notification Types block: label "Community Campaigns", hint covering run announcements and completion notices, bound to the new setting and hidden while the global notifications toggle is off.

## 3. Validation

- [ ] 3.1 Add Jest coverage for: push status includes new setting, push settings update writes new setting, settings body with only the new key is accepted, retrigger of an enabled campaign triggers the run announcement, enable announces an unannounced run, repeated enable does not re-announce, seeded silent run announced only after enabling, run completion triggers notification to contributors only, users with category disabled are excluded, notification failure does not block campaign operations.
- [ ] 3.2 Add Vitest coverage for the new `PushPermissionIsland` toggle: renders with label and hint, reflects status, and sends the updated settings payload.
- [ ] 3.3 Run `npm test` and fix regressions related to the new column, handler extensions, and notification triggers.
- [ ] 3.4 Run `npm run test:client` and fix regressions related to the settings toggle.
- [ ] 3.5 Run `npm run check` and resolve any TypeScript or Wrangler dry-run issues.
- [ ] 3.6 Update `docs/api-reference.md` with the new `communityCampaignsEnabled` field in push status and settings endpoints.
