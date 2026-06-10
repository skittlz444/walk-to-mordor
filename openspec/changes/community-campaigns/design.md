## Context

The `personal-challenges` change seeds the Nazgul pursuit for individual players via daily random rolls. Community campaigns are a separate product shape — admin-crafted, publicly visible events where the entire community contributes toward a shared target. They use the same walk-date-based credit rule as personal challenges (only walk dates within the campaign's active window count), a simple opt-in join model with public progress visibility, and a single daily cron for date-based lifecycle transitions.

The `shared-achievement-infrastructure` and `profile-badge-display` changes provide the badge infrastructure that community campaigns consume for completion awards.

No `progress.created_at` migration is needed. Credit eligibility uses `progress.date` — only walks with dates between the campaign `start_date` and `end_date` (inclusive) count. This mirrors the personal challenges model where walk dates within the coverage window determine credit.

## Goals / Non-Goals

**Goals:**
- Provide public community campaigns with fixed group targets, opt-in participation, and public progress tracking with ranked contributor distances.
- Expose public (auth-free) endpoints for campaign listing, detail, and community progress.
- Let authenticated users join campaigns and see their own contribution alongside public data.
- Reconcile campaign progress from canonical walk logs using walk-date-based credit (same rule as personal challenges: only walk dates within the campaign's `start_date` to `end_date` window count).
- Trigger campaign completion synchronously during walk reconciliation when the community total reaches the target.
- Run a single daily cron at midnight UTC for campaign lifecycle transitions (start → active, active → expired).
- Provide a public `/events` page showing community campaigns (not personal challenges).

**Non-Goals:**
- No personal challenges here (separate change, separate tables).
- No admin campaign management UI (separate `community-campaigns-admin` change).
- No daily rolls, randomized offers, personalized targets, or activity gating.
- No storyline-specific or path-distance campaign eligibility (campaigns are global).
- No campaign notifications in this change (future `community-campaign-notifications` change).
- No `progress.created_at` migration — credit is purely walk-date-based.

## Decisions

### Use completely separate tables from personal challenges

`campaign_definitions`, `campaign_participants`, and `campaign_progress_ledger` are separate tables with no shared schema with `personal_encounter_definitions` and related tables.

Rationale: the differences (public vs private visibility, fixed community targets vs personalized targets, opt-in join vs accept/decline, no daily rolls vs random rolls, global vs eligibility-gated) outweigh the superficial similarity. Clean separation avoids nullable columns and branching query logic.

Alternative considered: a shared `events` table with discriminator. Rejected because personal challenges already shipped with their own schema, and the divergence would make every query branch on type.

### Use walk-date-based credit (same rule as personal challenges)

Campaign progress reconciliation checks `progress.date >= campaign_definitions.start_date AND progress.date <= campaign_definitions.end_date`. Only walks with dates within the campaign's active window count. Walks for dates before the campaign starts (or after it ends) are excluded. There is no `created_at` check — the walk date is the sole determinant.

Rationale: this mirrors the personal challenges model where walk dates within the coverage window determine credit. It's simpler (no `progress` table migration needed) and consistent across both feature domains. A user who joins mid-campaign cannot have their pre-join walks count because the campaign wasn't active when those walks were dated.

Alternative considered: using `progress.created_at > participant.joined_at`. Rejected because it requires a schema migration and adds complexity without meaningful benefit — walks are entered at most once per day per user, so the walk date is already the natural gating mechanism.

### Public endpoints are auth-free; authenticated overlay adds personal data

`GET /api/events` and `GET /api/events/:id` and `GET /api/events/:id/community-progress` are public — no session required. If the request includes a valid `Authorization` header, the response also includes the authenticated user's participation status, contribution, and badge info.

Rationale: community campaigns are meant to be discoverable. Unauthenticated visitors should see the campaign list and progress to drive sign-ups. Authenticated users get the same data plus their personal participation context.

Alternative considered: requiring authentication for all event endpoints. Rejected because it walls off the discovery surface that drives campaign participation.

### Community progress returns ranked contributor distances publicly

`GET /api/events/:id/community-progress` returns total community distance, target distance, participant count, and a ranked list of contributors with usernames and contribution distances. This data is visible to all users, including unauthenticated visitors.

Rationale: public contribution rankings are part of the collaborative motivation loop. Seeing other players' contributions encourages participation. The restructuring plan explicitly calls this out as a product decision.

Alternative considered: hiding exact distances for non-friends. Rejected as unnecessary privacy concern — campaign contribution distances are public by design, similar to a charity walk leaderboard.

### Progress reconciliation excludes walks outside the campaign date window

The reconciliation service checks `progress.date >= campaign.start_date AND progress.date <= campaign.end_date`. Walks for dates outside this window do not count, even if the user is a participant. This is the same rule personal challenges use: only walks whose date falls within the active period count.

Rationale: consistent credit model across both feature domains. Simple to explain and implement. No schema migration needed.

### Reconciliation uses graceful degradation

Campaign reconciliation follows the same pattern as personal challenges and `syncPartyProgressLog`: errors are caught and logged, never propagated to the walk save caller.

Rationale: walk saving is the primary operation. Campaign progress is secondary. A reconciliation failure must never block a user from logging a walk.

### Campaign completion is triggered during walk reconciliation, not by cron

When a user creates, updates, or deletes a walk entry, the reconciliation service:
1. Updates the ledger entries for that user's active campaign participations (if the walk date is within the campaign window)
2. Recomputes the participant's cached total
3. Checks the campaign-level total: `SUM(campaign_participants.progress_distance) WHERE campaign_id = ?`
4. If the total meets or exceeds the campaign target, immediately marks the campaign completed and awards the completion badge to all contributors (participants with `progress_distance > 0`)

Rationale: users expect to see the campaign complete as soon as someone's walk pushes the community total over the target. Delaying completion to the next cron tick (up to 24 hours) would be confusing and demotivating. Synchronous completion makes the moment feel immediate and celebratory.

Alternative considered: deferring completion to the daily cron. Rejected because the 24-hour gap between "total reached" and "campaign marked completed" undermines the motivational loop.

### Campaign completion awards badges to all contributors

When `SUM(campaign_progress_ledger.distance) >= campaign_definitions.target_distance`, the campaign completes. All participants who contributed any distance (> 0) receive the campaign's completion badge via the shared `awardAchievement` service.

Rationale: every contributor helped reach the community target. Even a small contribution counted toward the shared goal.

### Daily cron at midnight UTC handles lifecycle transitions

A single daily cron (triggered by the Worker `scheduled()` handler, which fires on a cron schedule) handles:
- `upcoming → active`: when `start_date = today` (campaigns that start today become active)
- `active → expired`: when `end_date < today` and progress < target (campaigns that ended without reaching the target)

Campaign completion happens during reconciliation, not in the cron. The daily cron only handles date-based boundary transitions.

Rationale: users enter walks at most once per day. A daily cron at midnight UTC is sufficient for date-based transitions. Per-minute polling is unnecessary and wasteful when the only thing that changes between ticks is user-initiated walks — which already trigger reconciliation synchronously.

### Public `/events` page shows community campaigns only

The `/events` page renders `EventsIsland`, which fetches public campaign data and renders campaign cards with progress bars, participant counts, and deadlines. Authenticated users see their participation status and contribution. Personal challenges are not shown on this page — they remain private to each user.

Rationale: community campaigns and personal challenges serve different purposes. Mixing them on the same page would confuse the distinction. Personal challenges are private encounters; community campaigns are public rallies.

### No admin UI in this change

Campaign definitions are seeded via migration. The admin management UI (`community-campaigns-admin` change) follows separately. This change focuses on the user-facing campaign experience and the backend infrastructure.

### Route ordering: exact match before parameterized match

`GET /api/events` (list) and `GET /api/events/:id` (detail) share the `/api/events` prefix. In the if/else chain, the exact path match (`url.pathname === "/api/events"`) must be checked BEFORE the `matchRoute(url.pathname, '/api/events/:id')` parameterized match, so the list endpoint doesn't get incorrectly dispatched as a detail lookup with `:id = undefined`.

In `getAllowedMethods`, `case "/api/events":` is added to the `['GET']` return group for the exact path, and a `matchRoute` check for `/api/events/:id` is added to the `default:` block returning `['GET', 'POST']`. Note: the existing personal-challenges routes (`/api/events/daily-roll`, etc.) don't collide because they match as exact paths before the parameterized check.

### PUT reconciliation: fetch previous distance for accurate ledger updates

`handleProgressPut` will fetch the existing row's distance BEFORE performing the UPDATE: `SELECT distance FROM progress WHERE date = ? AND user_id = ?`. Both the old and new distances are passed to the reconciliation service, which can then correctly UPDATE the ledger entry with the new value (rather than inserting a duplicate or relying solely on the new distance).

Rationale: the ledger stores one row per `(participant_id, source_progress_id)` with the current distance. Without the old value, the reconciliation service can't differentiate between "this is a new row" and "this is an edit of an existing row." The PUT handler already fetches the row to check `result.meta.changes === 0` for 404 detection, so this adds no extra query.

### Non-existent campaign returns 404

`GET /api/events/:id` returns 404 when the campaign ID doesn't match any `campaign_definitions` row, regardless of authentication status.

### Contributor ranking capped at 50 with competition ranking

`GET /api/events/:id/community-progress` returns at most 50 ranked contributors, ordered by `distance DESC, username ASC`. Users with the same distance share the same rank number (competition ranking: 1, 2, 2, 4, ...). The response includes a `contributorCount` field with the total number of participants (used for "and X more" display). This keeps response sizes bounded for large campaigns.

### Events page linked from Drawer navigation

A "Campaigns" link is added to the `DrawerIsland` navigation list, linking to `/events`. The drawer already links to journey, map, fellowship, friends, and stats — campaigns fits as a new item between fellowship and friends (or at the end).

## Risks / Trade-offs

- [Public leaderboard exposes usernames and distances] → This is by design. The campaign page makes visibility clear before joining. Users who don't want their distance public can simply not join.
- [Campaign completion could process large participant counts] → Badge awarding runs during reconciliation when the target is met. D1 aggregation queries are efficient for the expected scale (hundreds, not millions of participants).
- [No admin UI means migration-only seeding] → Campaigns are seeded by migration until the admin UI change lands. This is intentional — the feature works end-to-end with seeded data.

## Migration Plan

1. Add migrations for `campaign_definitions`, `campaign_participants`, and `campaign_progress_ledger` with indexes and uniqueness constraints. No `progress` table migration needed — credit is walk-date-based.
2. Seed an initial campaign definition and its badge definition via migration.
3. Add campaign API handlers and wire routes into `src/index.ts`.
4. Add progress reconciliation hooks to existing calendar progress handlers, including synchronous campaign completion on target met.
5. Add a daily campaign lifecycle cron to the Worker `scheduled()` handler for start/expiry date transitions.
6. Add the `/events` SSR shell, `EventsIsland`, and focused CSS.
7. Update docs and add tests.

Rollback strategy: all migrations are additive. If the UI or handlers need to be rolled back, campaign tables sit unused. Route registration can be disabled independently.

## Open Questions

None.
