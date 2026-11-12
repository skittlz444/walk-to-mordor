## Context

The `personal-challenges` change seeds the Nazgul pursuit for individual players via daily random rolls. Community campaigns are a separate product shape — admin-crafted, publicly visible events where the entire community contributes toward a shared target. They use the same walk-date-based credit rule as personal challenges (only walk dates within the active window count), a simple opt-in join model with public progress visibility, and a single daily cron for date-based lifecycle transitions. Campaigns are structured as **runs**: a campaign definition carries identity, copy, and badge linkage, while each run carries its own window, target, and status. A completed or expired campaign can be retriggered by an admin into a fresh run, so recurring rallies (e.g. a monthly community target) reuse one campaign identity, one badge, and one URL.

The `shared-achievement-infrastructure` and `profile-badge-display` changes provide the badge infrastructure that community campaigns consume for completion awards.

No `progress.created_at` migration is needed. Credit eligibility uses `progress.date` — only walks with dates between the active run's `start_date` and `end_date` (inclusive) count. This mirrors the personal challenges model where walk dates within the coverage window determine credit.

## Goals / Non-Goals

**Goals:**
- Provide public community campaigns with fixed group targets, opt-in participation, and public progress tracking with ranked contributor distances.
- Expose public (auth-free) endpoints for campaign listing, detail, and community progress.
- Let authenticated users join a run and see their own contribution alongside public data.
- Reconcile run progress from canonical walk logs using walk-date-based credit (same rule as personal challenges: only walk dates within the active run's window count), gated on the run being active.
- Trigger run completion synchronously during walk reconciliation when the community total reaches the target.
- Run run lifecycle transitions (upcoming → active, active → expired when the target is unmet) inside the existing daily 09:00 UTC scheduled run.
- Structure campaigns as runs so a completed/expired campaign can be retriggered by an admin (community-campaigns-admin change) into a fresh run without touching history.
- Provide a public `/events` page showing community campaigns (not personal challenges), campaign imagery, and past-run outcomes.

**Non-Goals:**
- No personal challenges here (separate change, separate tables).
- No admin campaign management UI or retrigger action in this change (separate `community-campaigns-admin` change).
- No cron-driven auto-retrigger — new runs are created by an admin action or a seed migration.
- No daily rolls, randomized offers, personalized targets, or activity gating.
- No storyline-specific or path-distance campaign eligibility (campaigns are global).
- No campaign notifications in this change (future `community-campaign-notifications` change).
- No `progress.created_at` migration — credit is purely walk-date-based.

## Decisions

### Use completely separate tables from personal challenges

`campaign_definitions`, `campaign_runs`, `campaign_participants`, and `campaign_progress_ledger` are separate tables with no shared schema with `personal_encounter_definitions` and related tables.

Rationale: the differences (public vs private visibility, fixed community targets vs personalized targets, opt-in join vs accept/decline, no daily rolls vs random rolls, global vs eligibility-gated) outweigh the superficial similarity. Clean separation avoids nullable columns and branching query logic.

Alternative considered: a shared `events` table with discriminator. Rejected because personal challenges already shipped with their own schema, and the divergence would make every query branch on type.

### Runs carry the window, target, and status

`campaign_definitions` holds identity only: slug, name, description, image slug, badge slug, enabled flag, timestamps. `campaign_runs` holds everything that changes between cycles: `run_number` (1-based per campaign), `target_distance`, `start_date`, `end_date`, `status` (upcoming/active/completed/expired), `completed_at`, `announced_at` (nullable — used by the notifications change), and a final snapshot written once at the terminal transition (`participant_count`, `contributor_count`, `total_distance`). The **active run** is the run in `upcoming` or `active` status; there is at most one. Reconciliation, joining, ranking, lifecycle transitions, and listing all scope to the active run.

Rationale: a retriggerable campaign needs an immutable per-run identity (award keys, history, opt-in) without duplicating definition rows or wiping data. One-shot campaigns are simply campaigns with a single run.

Alternatives considered: per-run campaign definitions with a shared badge (rejected — duplicate copy/metadata and slug churn per cycle); wipe-and-reset of a single row (rejected — destroys the per-run history the events page past section displays, and conflicts with the never-delete-ledger stance).

### Participation is per run

`campaign_participants` rows carry `run_id` and are unique per `(user_id, campaign_id, run_id)`. Joining a run creates a fresh participant row; a user who joined a previous run must join the new run explicitly (per-run opt-in). Removal is per run too: an admin-cancelled participant of run 1 can freely join run 2. Past-run participant rows, their cached totals, and their ledger entries are retained untouched as history.

Rationale: auto-enrolling everyone into every future run (the consequence of keying participants on the campaign alone) removes user agency and makes admin cancellation effectively permanent; per-run opt-in restores both.

### Ledger rows are retained across runs

`campaign_progress_ledger` rows gain `run_id` (through their per-run participant) and are never deleted. Credit for the active run aggregates only ledger rows whose participant belongs to the active run; past-run leaderboards and final snapshots remain queryable from the same rows.

Rationale: the events page's past-outcome display and any future "your run 1 contribution" surface need the original credit rows; deleting them on retrigger would trade permanent history for a little table tidiness.

### Use walk-date-based credit (same rule as personal challenges)

Campaign progress reconciliation checks `progress.date >= active_run.start_date AND progress.date <= active_run.end_date`. Only walks with dates within the active run's window count. Walks for dates before the run starts (or after it ends) are excluded. There is no `created_at` check — the walk date is the sole determinant.

Rationale: this mirrors the personal challenges model where walk dates within the coverage window determine credit. It's simpler (no `progress` table migration needed) and consistent across both feature domains. A user who joins mid-run has their existing in-window walks backfilled at join time, so the date rule applies uniformly rather than depending on whether a walk was saved before or after joining.

Alternative considered: using `progress.created_at > participant.joined_at`. Rejected because it requires a schema migration and adds complexity without meaningful benefit — walks are entered at most once per day per user, so the walk date is already the natural gating mechanism.

### Reconciliation and completion are gated on the active run

Reconciliation only credits and only checks completion for a run with `status = 'active'` — never `upcoming`, `completed`, or `expired`. Completion marks the run via a guarded UPDATE (`WHERE status = 'active'`) and proceeds only when `result.meta.changes > 0`, matching the personal-challenges completion pattern (`event-utils.ts`). Because retriggered runs never overlap a still-active run, this guard also closes the future-dated-walk leak: a walk dated inside a future window cannot credit or complete a run that has not started.

Rationale: `progress.date` accepts future dates, and without a status guard a backdated or future-dated walk could complete an upcoming or long-expired run. The guard is one predicate, cheap, and already proven in `src/event-utils.ts`.

### Joining backfills existing in-window walks

`POST /api/events/:id/join` inserts a participant row scoped to the active run and then reconciles the user's existing walks whose `progress.date` falls inside `[start_date, end_date]` using the same idempotent `(participant_id, source_progress_id)` ledger upsert as walk-save reconciliation. Join is rejected after the end date, so the backfill window is always bounded.

Rationale: without the backfill, two users with identical walk histories would receive different credit depending on when they joined or whether they later re-saved a walk. The backfill makes the walk-date rule deterministic and explainable ("any walk dated inside the run's window counts").

### Public endpoints are auth-free; authenticated overlay adds personal data

`GET /api/events` and `GET /api/events/:id` and `GET /api/events/:id/community-progress` are public — no session required. If the request includes a valid `Authorization` header, the response also includes the authenticated user's participation status, contribution, and badge info.

Rationale: community campaigns are meant to be discoverable. Unauthenticated visitors should see the campaign list and progress to drive sign-ups. Authenticated users get the same data plus their personal participation context.

Alternative considered: requiring authentication for all event endpoints. Rejected because it walls off the discovery surface that drives campaign participation.

### Community progress returns ranked contributor distances publicly

`GET /api/events/:id/community-progress` returns total community distance, target distance, participant count, and a ranked list of contributors with usernames and contribution distances. This data is visible to all users, including unauthenticated visitors.

Rationale: public contribution rankings are part of the collaborative motivation loop. Seeing other players' contributions encourages participation. The restructuring plan explicitly calls this out as a product decision.

Alternative considered: hiding exact distances for non-friends. Rejected as unnecessary privacy concern — campaign contribution distances are public by design, similar to a charity walk leaderboard.

### Progress reconciliation excludes walks outside the campaign date window

The reconciliation service checks `progress.date >= active_run.start_date AND progress.date <= active_run.end_date`. Walks for dates outside this window do not count, even if the user is a participant. This is the same rule personal challenges use: only walks whose date falls within the active period count.

Rationale: consistent credit model across both feature domains. Simple to explain and implement. No schema migration needed.

### Reconciliation uses graceful degradation

Campaign reconciliation follows the same pattern as personal challenges and `syncPartyProgressLog`: errors are caught and logged, never propagated to the walk save caller.

Rationale: walk saving is the primary operation. Campaign progress is secondary. A reconciliation failure must never block a user from logging a walk.

### Run completion is triggered during walk reconciliation, not by cron

When a user creates, updates, or deletes a walk entry, the reconciliation service:
1. Finds the user's active-run participations (runs with `status = 'active'`)
2. If the walk date is within a run's window, updates the ledger entries for that participation
3. Recomputes the participant's cached total
4. Checks the run-level total as `SUM(campaign_progress_ledger.distance)` joined through the run's active participants (the ledger is the source of truth; `campaign_participants.progress_distance` is a derived cache)
5. If the total meets or exceeds the run's target, marks the run completed via a guarded UPDATE (`WHERE status = 'active'`, proceeding only on `changes > 0`) and awards the completion badge to all contributors (participants with `progress_distance > 0`)

Rationale: users expect to see the campaign complete as soon as someone's walk pushes the community total over the target. Delaying completion to the next cron tick (up to 24 hours) would be confusing and demotivating. Synchronous completion makes the moment feel immediate and celebratory.

Alternative considered: deferring completion to the daily cron. Rejected because the 24-hour gap between "total reached" and "campaign marked completed" undermines the motivational loop.

### Run completion awards badges to all contributors

When `SUM(campaign_progress_ledger.distance) >= campaign_runs.target_distance` (scoped to the run's active participants), the run completes. All active participants who contributed any distance (> 0) receive the campaign's completion badge via the shared `awardAchievement` service with idempotency key `campaign:<slug>:run:<run_id>` — one instance per run for repeatable badges, mirroring the `encounter_occurrence:<id>` pattern. Participants removed from the active run keep any badge already earned but are not awarded on its completion.

Rationale: every contributor helped reach the community target. Even a small contribution counted toward the shared goal. The per-run key is what lets a repeatable badge escalate across runs; a fixed `campaign:<slug>` key would make every completion after the first an idempotent no-op.

### Lifecycle transitions ride the existing daily 09:00 UTC cron

The Worker's only cron trigger is `0 9 * * *` (`wrangler.json`). Run lifecycle transitions are added as an independent try/catch block inside the existing `scheduled()` handler rather than adding a midnight trigger, because adding or retiming the cron would move every existing scheduled job (one-more-mile, re-engagement, personal challenge settlement) to the new schedule. The block handles, per active run:
- `upcoming → active`: when `start_date <= DATE('now')`
- `active → expired`: when `end_date < DATE('now')` and the community total is below `target_distance`; the expired run's final snapshot is written at the transition

Run completion happens during reconciliation, not in the cron. Disabled campaigns are skipped by both transitions and by reconciliation. New runs are never created by the cron — a fresh run exists only via seed migration or the admin retrigger action (`community-campaigns-admin`), which means a retriggered campaign sits in `upcoming` until its start date arrives.

Rationale: users enter walks at most once per day, so one daily transition pass is sufficient for date-based boundaries. Per-minute polling is unnecessary and wasteful when the only thing that changes between ticks is user-initiated walks — which already trigger reconciliation synchronously. Reusing the existing trigger avoids re-timing unrelated notification jobs.

### Public `/events` page shows community campaigns only

The `/events` page renders `EventsIsland`, which fetches public campaign data and renders campaign cards with the campaign image (`/img/highres/<image_slug>.webp`, thumb placeholder, copy-only fallback when missing), progress bars, participant counts, and deadlines for the active run. Completed/expired runs surface in a past section with their final snapshot and outcome. Authenticated users see their participation status and contribution for runs they joined. Personal challenges are not shown on this page — they remain private to each user.

Rationale: community campaigns and personal challenges serve different purposes. Mixing them on the same page would confuse the distinction. Personal challenges are private encounters; community campaigns are public rallies.

### Signed-out visitors get a sign-in prompt, not a join button

Anonymous visitors see campaign progress and a "Sign in to join" link. The join endpoint still returns 401 without a session.

Rationale: hiding the affordance entirely leaves visitors with no path into participation.

### Ranking distinguishes participants from contributors

`participantCount` counts all active participants of the active run, including zero-distance joiners. The ranked contributor list and `contributorCount` include only active participants with `progress_distance > 0`; zero-distance participants have no public rank. The authenticated overlay returns the caller's contribution and rank only when it is greater than zero. The events island renders the top five contributors per card with "and X more" when `contributorCount > 5`; the API remains capped at 50.

### No leave/withdraw action within a run

Joining a run is one-way for the MVP, and the join affordance states that the user's username and contribution distance are publicly visible. A leave endpoint is a non-goal for this change; if added later it must define whether ledger credit and earned badges are retained. Between runs no leave is needed — each run requires a fresh opt-in, so simply not joining is the exit.

### Disabled campaigns are frozen, not just hidden

`enabled = 0` excludes a campaign from public listings, reconciliation, completion checks, lifecycle transitions, and joining. Participant rows, ledger entries, and run history are retained. Re-enabling triggers the same backfill reconciliation as joining for the active run, so walks dated inside its window are credited without requiring users to re-save them. This resolves the previous ambiguity where a hidden campaign could still credit and complete.

### All campaign dates are UTC dates

`start_date`, `end_date`, lifecycle queries, and walk-date comparisons use UTC (`DATE('now')` in D1). Admin validation compares against the UTC current date.

### No admin UI in this change

Campaign definitions are seeded via migration. The admin management UI (`community-campaigns-admin` change) follows separately. This change focuses on the user-facing campaign experience and the backend infrastructure.

### Seed campaign: Beacon Watch

The migration seeds exactly one campaign, `beacon-watch` ("Beacon Watch"), `enabled = 0`:

- Copy: name "Beacon Watch"; description along the lines of "The beacons of Gondor are lit one hilltop at a time. Rally the community, log your kilometres, and light the next beacon together." (final copy authored at implementation)
- `image_slug = 'beacon-watch'` — the campaign card illustration, generated by this change
- `badge_slug = 'community-beacon-watch'` — repeatable completion badge, `badge_type = 'community'`, `metadata.rank_thresholds = [1, 3, 7, 15]` (Nazgul-style curve), no `metadata.rank`
- Run 1: `run_number = 1`, `status = 'upcoming'`, a suggested 14-day window, and a placeholder target of **581 km** — the beacon run on the map path between Gondor and Edoras: from "Pass Edoras and the Snowbourn" (1729 mi / 2,783 km) to "Reach Minas Tirith with Gandalf" (2090 mi / 3,364 km) on the Pippin line, passing the beacon hills Halifirien, Calenhad, Min-Rimmon, Erelas, Nardol, and Eilenach. The run stays upcoming and admin-adjustable until the campaign is enabled.

Rationale: one recurring campaign exercises the full run lifecycle (join, credit, completion, expiry, retrigger) end-to-end; a second one-shot seed would double the artwork work without adding behavior coverage. The badge escalates per completed run via the shared repeatable-infra rank thresholds.

### Campaign artwork: authored prompts and candidate review

Two assets are generated with FLUX.3 Klein via ComfyUI — **12 candidates each** — reviewed as contact sheets and narrowed to a **top-2 shortlist with a primary recommendation** that the user decides on before anything is committed.

**Emblem** (badge pipeline; entry added to `scripts/badge-art/prompts.json` with `family: community`, `rank: "thresholds"`, `canvas: 1024`, `target_outer_px: 800`; the pipeline composes its style prefix/suffix around these motif variants):

- Variant a (enamel): "A hilltop signal beacon: an iron brazier set on a stone cairn, crowned by a tall leaping flame with a single curl of smoke rising, warm bronze and gold. Polished hard enamel with glossy raised gold outlines, smooth saturated colour fields, a thin bright metal edge, and no separate outer frame or border ring."
- Variant b (aged metal): "A hilltop signal beacon: an iron brazier set on a stone cairn, crowned by a tall leaping flame with a single curl of smoke rising. Aged engraved metal with hand-chased relief, patinated bronze and weathered iron, warm gold highlights on the flame, deep recessed colour, and no separate outer frame or border ring."

Candidates: the six default seeds × both variants = 12, via `generate.py --only emblem/community-beacon-watch`, then `process_candidates.py` and contact sheets. The motif is deliberately distinct from the existing community emblems (Fellowship Founder's flame-carved standing stone, Good Company's stones around a campfire).

**Campaign card illustration** (separate FLUX.3 graph at 2048×2048, matching the `nazgul-pursuit` precedent; three composition variants × four seeds = 12):

- A (dusk ridge chain): "Painterly Middle-earth landscape illustration at dusk: a green hilltop with a stone beacon cairn and a bright signal fire, one curl of smoke, a chain of distant blue ridgelines each with a faint far-off beacon glow, a winding footpath with tiny distant silhouetted walkers carrying lanterns, warm firelight against cool indigo dusk, soft painted texture, no text, no watermark."
- B (dawn, path-led): "Painterly Middle-earth landscape illustration at first light: a winding footpath climbing from misty green lowlands toward a hilltop stone beacon cairn with an unlit brazier awaiting its flame, distant blue ridgelines fading into morning haze, tiny distant silhouetted walkers with lanterns ascending, cool blue-green palette with a single warm sunrise accent, soft painted texture, no text, no watermark."
- C (night beacon): "Painterly Middle-earth landscape illustration at night: a hilltop beacon fire blazing against a starry indigo sky, its glow touching a chain of distant dark ridgelines, a winding footpath with tiny lantern-bearing walkers below, deep blues against warm orange firelight, soft painted texture, no text, no watermark."

Seeds: 112358, 271828, 314159, 161803 per variant.

**Review and selection protocol:**
1. Build contact sheets (emblem: `contact_sheets.py`; illustration: a simple candidate grid).
2. Present the **top two of each** to the user with a **primary recommendation** and the reasoning (emblem: silhouette legibility at 96/200 px and fit within the locked community frame; illustration: composition and tone consistency with existing goal imagery).
3. Nothing is committed until the user picks. The emblem pick is recorded in `final-selections.json` (`emblems` + `repeatable`) as `<variant>-<seed>`; the illustration pick is the selected candidate file.
4. Illustration optimization runs **before** any emblem staging exists under `raw_assets/` — the optimizer aborts the whole run on duplicate basenames and badge candidates share basenames — or `raw_assets/badges` is excluded from the optimizer scan.

Rationale: the emblem must read as part of the locked community family at badge sizes, and the illustration must sit naturally beside existing goal imagery; both are taste calls a human should make from real candidates.

### Routes are registered on the Hono app

Campaign routes are declared with `app.get`/`app.post` on the Hono app in `src/index.ts` (the manual if/else dispatch chain, `matchRoute`, and `getAllowedMethods` no longer exist). Hono resolves static segments before parameterized ones, so `/api/events`, `/api/events/daily-roll`, and `/api/events/:id` coexist without manual ordering. Public campaign routes are registered without auth middleware; only `POST /api/events/:id/join` uses the existing auth guard. Route tests dispatch through `app.request(...)`, matching `tests/api/event-routes.test.ts`.

### PUT reconciliation: fetch previous distance for accurate ledger updates

`handleProgressPut` will fetch the existing row's distance BEFORE performing the UPDATE: `SELECT distance FROM progress WHERE date = ? AND user_id = ?`. Both the old and new distances are passed to the reconciliation service, which can then correctly UPDATE the ledger entry with the new value (rather than inserting a duplicate or relying solely on the new distance).

Rationale: the ledger stores one row per `(participant_id, source_progress_id)` with the current distance. Without the old value, the reconciliation service can't differentiate between "this is a new row" and "this is an edit of an existing row." The PUT handler derives 404 detection from the UPDATE's `result.meta.changes === 0` and only fetches the row afterwards for its id, so the pre-UPDATE `SELECT distance` is one additional query.

### Non-existent campaign returns 404

`GET /api/events/:id` returns 404 when the campaign ID doesn't match any `campaign_definitions` row, regardless of authentication status.

### Contributor ranking capped at 50 with competition ranking

`GET /api/events/:id/community-progress` returns at most 50 ranked contributors, ordered by `distance DESC, username ASC`. Users with the same distance share the same rank number (competition ranking: 1, 2, 2, 4, ...). The response includes a `contributorCount` field with the total number of contributors (active participants with a contribution greater than zero) used for the "and X more" display. This keeps response sizes bounded for large campaigns.

### Events page linked from Drawer navigation

A "Campaigns" link is added to the `DrawerIsland` navigation list, linking to `/events`. The drawer already links to journey, map, fellowship, friends, and stats — campaigns fits as a new item between fellowship and friends (or at the end).

## Risks / Trade-offs

- [Public leaderboard exposes usernames and distances] → This is by design. The join affordance states that username and contribution distance are publicly visible before joining. Users who don't want their distance public can simply not join a run; there is no leave action within a run.
- [Run completion could process large participant counts] → Badge awarding runs during reconciliation when the target is met. D1 aggregation queries are efficient for the expected scale (hundreds, not millions of participants).
- [No admin UI means migration-only seeding] → Campaigns are seeded by migration until the admin UI change lands. This is intentional — the feature works end-to-end with seeded data. Migration-seeded runs do not fire the `community-campaign-notifications` announcement; a run is announced when it first becomes publicly visible (see the notifications change).
- [Retriggered campaign sits in upcoming until its start date] → The admin retrigger action suggests a start of tomorrow or later, so a start-date/today edge after the 09:00 UTC cron doesn't strand the campaign; the admin can pick any future date.
- [Campaign badges render in the badge grid's fallback section] → Campaign badge definitions do not carry collection metadata in this change, so `BadgeDisplayIsland` groups them under "Other". A dedicated collection can be added later without schema changes.

## Migration Plan

1. Add migrations for `campaign_definitions` (identity only), `campaign_runs` (window/target/status/snapshot/announced_at), `campaign_participants` (run-scoped, `status`/`removed_at`), and `campaign_progress_ledger` (run-scoped) with indexes and uniqueness constraints. No `progress` table migration needed — credit is walk-date-based.
2. Seed the `beacon-watch` campaign definition (`enabled = 0`), its run 1 in `campaign_runs` (upcoming, suggested 14-day window, adjustable target placeholder), and the repeatable `community-beacon-watch` badge definition (`rank_thresholds = [1, 3, 7, 15]`), per the seed-campaign decision above.
3. Add campaign API handlers and register routes on the Hono app in `src/index.ts`.
4. Add join-time backfill and progress reconciliation hooks to the existing calendar progress handlers, gated on the active run, including synchronous run completion on target met.
5. Add run lifecycle transitions to the existing daily 09:00 UTC `scheduled()` run with independent error isolation.
6. Add the public `/events` SSR shell (`publicPage: true`), `EventsIsland` with campaign imagery and past-run outcomes, and focused CSS.
7. Update docs and add tests.

Rollback strategy: all migrations are additive. If the UI or handlers need to be rolled back, campaign tables sit unused. Route registration can be disabled independently.

## Open Questions

None.
