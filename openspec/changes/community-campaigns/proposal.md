## Why

Personal challenges give individual users spontaneous story encounters, but there's no way for the community to rally around a shared goal. A "Walk to Rivendell" campaign where everyone's kilometers combine toward a group target creates social motivation that individual challenges can't provide. This change adds community campaigns — admin-crafted, publicly visible events where users opt in, contribute distance, see community progress with ranked contributors, and earn completion badges together.

## What Changes

- Introduce D1 tables for campaign definitions, campaign participants, and a campaign progress ledger, all completely separate from personal challenge tables. Campaigns have no daily rolls, no personalized targets, no eligibility gating, and no accept/decline flow — they use a simple opt-in join model.
- Add a public (auth-free) `/events` page showing active and past community campaigns with community progress, participant counts, and ranked contributor distances. Authenticated users also see their own participation status and contribution.
- Add authenticated campaign join and own-contribution endpoints alongside public community progress endpoints.
- Reconcile campaign progress from canonical walk logs through a ledger-backed service, counting only walks whose date falls within the campaign's active window (same rule as personal challenges). No `progress` table migration needed.
- Run a single daily cron at midnight UTC for campaign lifecycle transitions (upcoming → active on start date, active → expired after end date). Campaign completion is triggered synchronously during walk reconciliation when the community total reaches the target.
- Award campaign completion badges via the shared achievement infrastructure to all participants who contributed any distance when the campaign completes.
- Seed the campaign definition and badge definition through migration — no admin UI dependency in this change.

## Capabilities

### New Capabilities
- `community-campaigns`: Public community campaigns with opt-in participation, fixed group targets, public progress with ranked contributor display, walk-date-based progress reconciliation, daily lifecycle cron plus synchronous completion via walk reconciliation, and completion badge awarding via shared achievement infrastructure.

### Modified Capabilities
- None.

## Impact

- D1 schema: new tables for `campaign_definitions`, `campaign_participants`, and `campaign_progress_ledger` with indexes and uniqueness constraints, completely separate from personal challenge tables. No `progress` table migration needed — credit is walk-date-based.
- Worker APIs: public (auth-free) `GET /api/events`, `GET /api/events/:id`, `GET /api/events/:id/community-progress`; authenticated `POST /api/events/:id/join`; all wired through `src/index.ts`.
- Progress handlers: reconciliation hooks on calendar progress create/update/delete in `src/progress-handlers.ts`, counting walks whose date falls within each active campaign's window, with synchronous campaign completion when the community total reaches the target.
- Scheduled Worker: single daily campaign lifecycle cron in the existing `scheduled()` handler for start-date activation and end-date expiry, with independent error isolation. Campaign completion happens during walk reconciliation, not in the cron.
- Frontend: new public `/events` SSR shell and `EventsIsland` Preact island; community progress display with ranked contributors; personal contribution display for authenticated participants; new `events.css` stylesheet.
- Badge display: campaign completion badges appear on profiles via the existing `profile-badge-display` change.
- Tests: Jest coverage for public endpoints, walk-date-based reconciliation, daily lifecycle cron; Vitest coverage for the events island; Playwright coverage for the join/progress flow.
- Documentation: updates to `docs/data-models.md`, `docs/api-reference.md`, and `docs/architecture.md`.
