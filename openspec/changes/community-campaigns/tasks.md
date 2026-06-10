## 1. Schema and Seed Data

- [ ] 1.1 Add D1 migration for `campaign_definitions` with columns for slug, name, description, image_slug, badge_slug, target_distance, start_date, end_date, status (upcoming/active/completed/expired), enabled state, and timestamps, plus a unique index on slug.
- [ ] 1.2 Add D1 migration for `campaign_participants` with columns for campaign_id (FK), user_id, progress_distance (cached total), joined_at, and a `UNIQUE(user_id, campaign_id)` constraint plus an index on campaign_id for progress aggregation.
- [ ] 1.3 Add D1 migration for `campaign_progress_ledger` with columns for participant_id (FK), source_progress_id, distance, and a `UNIQUE(participant_id, source_progress_id)` constraint plus an index on participant_id.
- [ ] 1.4 Seed an initial community campaign definition via migration with target distance, date window, themed copy, image slug, badge slug, and enabled state.
- [ ] 1.5 Seed the campaign completion badge definition via migration (insert into `achievement_definitions`) with slug `campaign-<name>`, is_repeatable=false, badge_type='community', and appropriate name/description/image.

## 2. Campaign Domain Services

- [ ] 2.1 Create `src/campaign-utils.ts` with strict TypeScript interfaces for `CampaignDefinition`, `CampaignParticipant`, `CampaignProgressLedger`, `CommunityProgressResponse`, and API response shapes, following the existing `DbClient` pattern with no `any`.
- [ ] 2.2 Implement campaign listing: query all enabled campaign definitions with computed participant counts and aggregated progress, order by status and start date.
- [ ] 2.3 Implement campaign participation: create a `campaign_participants` row with `joined_at = now()`. Reject if the campaign has ended or if a duplicate `UNIQUE(user_id, campaign_id)` exists.
- [ ] 2.4 Implement community progress aggregation: compute total distance from `SUM(campaign_progress_ledger.distance)`, participant count, total contributor count, and ranked contributor list (top 50, ordered by distance DESC, username ASC, with competition ranking for ties). When authenticated, include the current user's contribution and rank.
- [ ] 2.5 Add Jest coverage for: campaign listing with/without auth, participation creation, duplicate join rejection, expired campaign join rejection, community progress with/without auth, contributor ranking with ties, non-existent campaign 404.

## 3. Campaign APIs and Routing

- [ ] 3.1 Create `src/campaign-handlers.ts` with public and authenticated handlers using the existing `DbClient` pattern: `handleCampaignsList`, `handleCampaignDetail`, `handleCampaignJoin`, `handleCampaignCommunityProgress`.
- [ ] 3.2 Implement `GET /api/events` (public): returns all enabled campaigns with status, progress summary, participant count, start/end dates. If `Authorization` header is present and valid, includes the authenticated user's participation status and contribution for each campaign.
- [ ] 3.3 Implement `GET /api/events/:id` (public): returns a single campaign's full detail. With auth, includes the user's participation status.
- [ ] 3.4 Implement `GET /api/events/:id/community-progress` (public): returns total community distance, target distance, participant count, and ranked contributor list. With auth, includes the current user's contribution and rank.
- [ ] 3.5 Implement `POST /api/events/:id/join` (authenticated): validates session, checks campaign is active or upcoming, creates participant record, returns participation confirmation. Rejects duplicates (409), expired campaigns (400), and non-existent campaigns (404).
- [ ] 3.6 Wire campaign routes into `src/index.ts`: add `case "/api/events":` to `getAllowedMethods` in the `['GET']` group (exact path). Add `matchRoute` checks for `/api/events/:id` returning `['GET', 'POST']` and `/api/events/:id/community-progress` returning `['GET']` in the `default:` block. In the fetch handler, place `url.pathname === "/api/events"` (exact match for list) BEFORE `matchRoute(url.pathname, '/api/events/:id')` (parameterized match for detail/join). Public endpoints must NOT require session validation — only the join endpoint validates session. The existing personal-challenges exact paths (`/api/events/daily-roll`, etc.) match before the parameterized check and don't collide.
- [ ] 3.7 Add Jest route-dispatch and handler coverage for: public campaign list without auth, public campaign detail without auth, public community progress without auth, authenticated join, duplicate join rejection, expired campaign join rejection, unauthenticated join rejection, and auth-overlay addition to list/detail/progress responses.

## 4. Progress Reconciliation

- [ ] 4.1 Implement campaign progress reconciliation service in `src/campaign-utils.ts`: given a campaign participant and a source progress entry, check if `progress.date >= campaign.start_date AND progress.date <= campaign.end_date`. If eligible, upsert or delete a ledger row with `UNIQUE(participant_id, source_progress_id)`, then recompute `campaign_participants.progress_distance = SUM(ledger.distance)`. Wrap in try/catch — errors are logged but NEVER propagated (graceful degradation, matching the `syncPartyProgressLog` pattern).
- [ ] 4.2 Implement campaign completion check during reconciliation: after updating participant totals for a campaign, compute `SUM(progress_distance) FROM campaign_participants WHERE campaign_id = ?`. If the total meets or exceeds `campaign_definitions.target_distance`, immediately mark the campaign completed and call `awardAchievement` for all participants with `progress_distance > 0`.
- [ ] 4.3 Hook reconciliation into progress create in `src/progress-handlers.ts`: after a new progress row is inserted (following the existing `syncPartyProgressLog` call), find all active campaign participants for that user, and for each, reconcile if the progress date is within the campaign window, then check for campaign completion.
- [ ] 4.4 Hook reconciliation into progress update: before the UPDATE, fetch the existing row's distance (`SELECT distance FROM progress WHERE date = ? AND user_id = ?`). After the UPDATE succeeds, pass both old and new distances to the reconciliation service so it can correctly UPDATE (not duplicate) the ledger entry. Then check completion.
- [ ] 4.5 Hook reconciliation into progress delete: after a progress row is deleted, remove the corresponding ledger entries and recompute cached totals. Never revoke an earned badge.
- [ ] 4.6 Add Jest coverage for: walk-date-within-window credit, walk-date-outside-window exclusion, edited walk reconciliation (old → new, no duplicate ledger row), deleted walk reconciliation, ledger idempotency, campaign completion detection during reconciliation, badge awards to all contributors, graceful error handling (walk save succeeds despite reconciliation failure).

## 5. Lifecycle Cron

- [ ] 5.1 Implement a daily campaign lifecycle cron in `src/campaign-utils.ts` or `src/scheduled-handlers.ts`: query campaigns with `status = 'upcoming' AND start_date = DATE('now')` → mark active. Query campaigns with `status = 'active' AND end_date < DATE('now')` → mark expired. No completion logic — completion happens during reconciliation.
- [ ] 5.2 Wire the daily campaign cron into the Worker `scheduled()` handler in `src/index.ts`: add a new independent try/catch block following the pattern of existing cron jobs.
- [ ] 5.3 Add Jest coverage for: upcoming-to-active transition at midnight, active-to-expired transition after end date, lifecycle cron failure isolation (other scheduled jobs still run).

## 6. Public Events Page UI

- [ ] 6.1 Create `src/renderEventsPage.ts` SSR shell rendering the `/events` page with a `data-island="EventsIsland"` placeholder, navigation, and a new `events.css` stylesheet reference.
- [ ] 6.2 Wire the `/events` page route in `src/index.ts` to serve `renderEventsPage()`.
- [ ] 6.3 Create `client/src/islands/EventsIsland.tsx`: Preact functional component that fetches `GET /api/events` (with auth headers if logged in), renders campaign cards with name, description, progress bar (community progress / target), participant count, deadline, and status. Authenticated users see join buttons for unjoined active campaigns and their contribution for joined campaigns. Unauthenticated users only see public data. Shows loading, error, and empty states.
- [ ] 6.4 Add a "Campaigns" link to the `DrawerIsland` navigation list linking to `/events`. Place it after the Fellowship link and before the Friends link.
- [ ] 6.5 Register `EventsIsland` in `client/src/index.tsx`: add import, add to `autoHydratedIslands` and `allIslands` objects.
- [ ] 6.6 Create `public/css/events.css` with styles for campaign cards, progress bars, contributor list, join button, and responsive layout. Reference from `renderEventsPage.ts`.

## 7. Documentation and Validation

- [ ] 7.1 Update `docs/data-models.md` with the campaign schema invariants: definition/participant/ledger model, walk-date-based credit (progress.date within campaign window), and community progress aggregation.
- [ ] 7.2 Update `docs/api-reference.md` with public campaign list, detail, community-progress, and authenticated join endpoint specifications.
- [ ] 7.3 Update `docs/architecture.md` with campaign lifecycle (daily cron + sync completion), walk-date-based progress reconciliation, and lifecycle notes.
- [ ] 7.4 Add Vitest coverage for `EventsIsland`: renders campaign cards with progress bars, shows join button for unauthenticated user (or hides it when not logged in), shows join button for authenticated user on unjoined campaign, shows contribution for joined campaign, handles loading/error/empty states.
- [ ] 7.5 Run `npm test` and fix regressions related to campaign handlers, route dispatch, progress reconciliation, and lifecycle cron.
- [ ] 7.6 Run `npm run test:client` and fix regressions related to the events island and island registration.
- [ ] 7.7 Run focused Playwright coverage for the events page join and community-progress flow, and public vs authenticated view differences.
- [ ] 7.8 Run `npm run check` and resolve any TypeScript or Wrangler dry-run issues.
