## Why

Walk to Mordor motivates progress through milestones, stats, fellowships, and push nudges, but has no way to offer personalized timed challenges that feel like story moments. A Nazgul pursuit appearing on the journey page creates tension and urgency — outrun the threat or hide — making the walking app feel like a living Middle-earth experience. This change introduces the personal encounter loop: random daily offers, acceptance, progress tracking against personalized targets, completion rewards, and permanent badge display.

## What Changes

- Introduce D1 tables for personal encounter definitions, encounter occurrences, daily rolls, participants, and a progress reconciliation ledger, all separate from any future community campaign tables.
- Add a daily random encounter roll endpoint (`POST /api/events/daily-roll`) that evaluates eligibility using activity thresholds and cooldown-based probability branches, returning idempotent results per UTC day.
- Add accept and decline endpoints for offered encounters, creating timed personal challenge instances with personalized distance targets derived from the user's recent walking activity.
- Reconcile encounter progress from canonical walk logs through a ledger-backed service, counting only walks logged after the user accepts the encounter.
- Implement scheduled settlement to expire unanswered encounters and fail uncompleted personal challenges after their deadline.
- Add a modal encounter popup Preact island on journey and map pages showing the Nazgul pursuit with themed copy and explicit accept/decline actions.
- Award the Nazgul completion badge via the shared achievement infrastructure when the target is reached before the deadline; the badge appears on profiles through the already-built profile-badge-display.
- Seed the Nazgul pursuit encounter definition and its badge definition through a migration, with the encounter globally eligible across all storylines and path distances.

## Capabilities

### New Capabilities
- `personal-challenges`: Daily random encounter rolls, personal encounter acceptance and personalized challenge targets, ledger-backed progress reconciliation for personal challenges, scheduled settlement of expired personal challenges, Nazgul pursuit encounter UI, and badge awarding via shared achievement infrastructure.

### Modified Capabilities
- `events-and-challenges`: Retires the personal-encounter requirement set (daily rolls, contextual eligibility, encounter choice, personalized targets, progress accounting, personal challenge outcomes) in favor of the `personal-challenges` capability. Community-campaign requirements in that spec remain for the pending community-campaigns changes.

## Impact

- D1 schema: new tables for `personal_encounter_definitions`, `encounter_occurrences`, `daily_rolls`, `event_participants`, and `event_progress_ledger` with indexes and uniqueness constraints, added as migrations `0152`–`0156`. No progress timestamp migration needed — personal challenges start at acceptance time and the participant record carries the accept timestamp.
- Worker APIs: new authenticated endpoints for daily roll, encounter accept, and encounter decline, wired as Hono routes in `src/index.ts` behind the existing `authGuard` middleware.
- Progress handlers: reconciliation hooks on calendar progress create/update/delete paths in `src/progress-handlers.ts`, with idempotent ledger entries and cached participant totals.
- Scheduled Worker: personal challenge expiry and failure settlement in the existing `scheduled()` handler with independent error isolation from existing cron jobs.
- Frontend: new `EncounterPopupIsland` Preact island registered in `client/src/index.tsx`; a trigger module under `client/src/utils` invokes the roll after the Preact bootstrap on journey and map pages and renders the island programmatically (same pattern as the existing progress modals via `window.preactIslands`). The modal presents the encounter's watercolour illustration.
- Badge display and artwork: Nazgul badge definition seeded via migration with repeatable rank metadata; display handled by the existing `profile-badge-display`; artwork follows the locked `achievement-badge-artwork` rules (challenge family frame, four rank bosses, three sizes).
- Assets: the watercolour Nazgul illustration goes through the shared static image pipeline (`raw_assets/` → `npm run optimize:images` → `public/img/highres/` + `thumbs/`, served via the ASSETS binding), documented per `docs/asset-workflow.md`.
- Tests: Jest coverage for eligibility, daily roll, personalized targets, progress reconciliation, and scheduled settlement; migration test following the `tests/api/achievement-catalog-expansion.test.ts` pattern; Vitest coverage for the encounter popup island; Playwright coverage for the accept/decline flow.
- Documentation: updates to `docs/data-models.md`, `docs/api-reference.md`, and `docs/architecture.md`.
