## Why

Walk to Mordor currently motivates progress through journey milestones, stats, fellowships, and push nudges, but it has no reusable way to offer time-limited challenges or community campaigns. Events and challenges create a new motivation layer: occasional personal encounters that feel like story moments, plus opt-in community campaigns that let the whole player base work toward crafted goals together.

## What Changes

- Introduce a reusable events and challenges capability for personal encounter templates, concrete event occurrences, participation, progress accounting, lifecycle status, and immutable achievements.
- Add daily personal encounter rolls so authenticated users may be offered contextual challenges, starting with a Nazgul pursuit encounter where they can choose to outrun the threat or hide.
- Add admin event management for both personal encounter templates and community campaigns, including personal-event copy and reward tuning plus community campaign target/duration suggestions derived from recent community walking metrics.
- Track event progress through a reconcileable ledger backed by canonical walk logs, with cached participant totals for efficient reads.
- Count only walks logged after joining or accepting a challenge for the initial implementation, while keeping the model flexible enough to revisit this rule later.
- Make community campaigns publicly visible to all users, with public contributor distances for opted-in participants to support discovery and sign-ups.
- Award completion achievements immutably; later walk edits or deletes do not revoke earned badges, and repeatable personal-event badges accumulate a visible earned count.
- Add public user-facing event surfaces for active/past events and profile/friend-profile badge display.

## Capabilities

### New Capabilities
- `events-and-challenges`: Personal encounter rolls and timed challenges, opt-in community campaigns, event participation, progress accounting, lifecycle handling, admin event management, and immutable achievements.

### Modified Capabilities
- None.

## Impact

- D1 schema: new event/challenge, participation, progress ledger, daily roll, and achievement tables; optional progress timestamp support if needed for reliable post-join accounting.
- Worker APIs: new public community event list/detail/progress endpoints, personal encounter roll/accept/decline endpoints, authenticated participation endpoints, and admin event/template management endpoints.
- Scheduled Worker: extend existing cron processing to settle event lifecycle and challenge outcomes without blocking existing push jobs.
- Walk logging: reconcile event progress on progress create/update/delete alongside existing party progress synchronization.
- Frontend: new Preact islands for journey/map encounter popup, public `/events`, admin event management, event progress display, and badge display with repeat counts in profile surfaces.
- Documentation and tests: update data/API docs and add Jest/Vitest/Playwright coverage for schema behavior, APIs, cron settlement, progress reconciliation, admin UI, and user-facing event flows.