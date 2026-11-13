## Why

Personal challenges give individual users spontaneous story encounters, but there's no way for the community to rally around a shared goal. A "Walk to Rivendell" campaign where everyone's kilometers combine toward a group target creates social motivation that individual challenges can't provide. This change adds community campaigns — admin-crafted, publicly visible events where users opt in, contribute distance, see community progress with ranked contributors, and earn completion badges together.

## What Changes

- Introduce D1 tables for campaign definitions, campaign runs, campaign participants, and a campaign progress ledger, all completely separate from personal challenge tables. Definitions carry identity and badge linkage; each **run** carries its own target distance, date window, status (`upcoming/active/completed/expired`), completion timestamp, and final snapshot. Campaigns have no daily rolls, no personalized targets, no eligibility gating, and no accept/decline flow — they use a simple opt-in join model. Participants are scoped per run (`UNIQUE(user_id, campaign_id, run_id)`) and carry an `active`/`removed` status.
- Structure campaigns as runs so a completed/expired campaign can be retriggered by an admin (via the `community-campaigns-admin` change) into a fresh run — one identity, one badge, no history wiped. Run rows and ledger entries are retained forever as history; runs are never auto-created by cron.
- Add a public (auth-free) `/events` page showing active and past community campaigns with campaign imagery, community progress, participant counts, and ranked contributor distances for the active run, plus past-run outcomes. Authenticated users also see their own participation status and contribution. The page is rendered as a public page and deliberately does not show personal challenges.
- Add authenticated per-run join and own-contribution endpoints alongside public community progress endpoints. Joining immediately backfills the user's existing walks whose dates fall inside the active run's window through the same idempotent ledger used by walk-save reconciliation, so credit follows the walk-date rule uniformly regardless of join timing.
- Reconcile run progress from canonical walk logs through a ledger-backed service, counting only walks whose date falls within the active run's window (same rule as personal challenges), gated on the run being `active`. No `progress` table migration needed.
- Run run lifecycle transitions inside the existing daily 09:00 UTC `scheduled()` run (upcoming → active on start date, active → expired after end date when the target is unmet) with independent error isolation; no new midnight cron is added, and the cron never creates runs. Run completion is triggered synchronously during walk reconciliation when the community total reaches the target.
- Award run-completion badges via the shared achievement infrastructure with the per-run idempotency key `campaign:<slug>:run:<run_id>`, so repeatable badges can escalate across runs.
- Seed the recurring "Beacon Watch" campaign through migration — definition (`enabled = 0`), run 1 (upcoming, suggested 14-day window, adjustable target), and the repeatable badge (`is_repeatable = 1`, `metadata.rank_thresholds = [1, 3, 7, 15]`, `badge_type = 'community'`) — no admin UI dependency in this change. Generate 12 emblem candidates and 12 illustration candidates with FLUX.3 Klein, review them as contact sheets, and present a top-2 shortlist per asset with a primary recommendation for the user to select before committing either pick.
- Disclose public visibility on the join affordance and provide no leave/withdraw action within a run.

## Capabilities

### New Capabilities
- `community-campaigns`: Public community campaigns with opt-in participation, fixed group targets, public progress with ranked contributor display, walk-date-based progress reconciliation, daily lifecycle cron plus synchronous completion via walk reconciliation, and completion badge awarding via shared achievement infrastructure.

### Modified Capabilities
- `events-and-challenges`: Replaces the speculative shared event-template/occurrence model and the duplicate campaign participation, progress, lifecycle, and presentation requirements with the separate-table community campaign model defined here. The `/events` page no longer displays personal challenges. See `specs/events-and-challenges/spec.md`.

## Impact

- D1 schema: new tables for `campaign_definitions` (identity, copy, badge linkage, enabled), `campaign_runs` (run_number, target, window, status, completed_at, announced_at, final snapshot), `campaign_participants` (run-scoped, `status`/`removed_at`), and `campaign_progress_ledger` (run-scoped) with indexes and uniqueness constraints, completely separate from personal challenge tables. No `progress` table migration needed — credit is walk-date-based.
- Worker APIs: public (auth-free) `GET /api/events`, `GET /api/events/:id`, `GET /api/events/:id/community-progress`; authenticated `POST /api/events/:id/join`; all registered on the Hono app via `app.get`/`app.post` in `src/index.ts`. List/detail responses carry name, description, `image_slug`, the active run's window/target/status/progress, and past-run outcome summaries.
- Progress handlers: join-time backfill plus reconciliation hooks on calendar progress create/update/delete in `src/progress-handlers.ts`, gated on the active run, with synchronous run completion when the community total reaches the target.
- Scheduled Worker: run lifecycle transitions added to the existing daily 09:00 UTC `scheduled()` run with independent error isolation. Run completion happens during walk reconciliation, not in the cron; the cron never creates runs.
- Frontend: new public `/events` SSR shell (`publicPage: true`) and `EventsIsland` Preact island; campaign imagery on cards; community progress display with ranked contributors; past-run outcomes; personal contribution display for authenticated participants; sign-in prompt for anonymous visitors; new `events.css` stylesheet.
- Badge display: campaign badges appear on profiles via the existing `profile-badge-display` change; the recurring campaign's repeatable badge escalates rank via `metadata.rank_thresholds`; badges render in the badge grid's fallback section until campaign collection metadata is introduced.
- Tests: Jest coverage for public endpoints, walk-date-based reconciliation with active-run gating, join-time backfill, run lifecycle transitions; Vitest coverage for the events island; Playwright coverage for the join/progress flow.
- Documentation: updates to `docs/data-models.md`, `docs/api-reference.md`, and `docs/architecture.md`.
