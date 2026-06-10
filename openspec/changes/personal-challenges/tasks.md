## 1. Schema and Seed Data

- [ ] 1.1 Add D1 migration for `personal_encounter_definitions` with columns for slug, name, description, image_slug, badge_slug, duration_days, target_stretch_multiplier, target_min_distance, target_max_distance, is_repeatable, enabled state, and timestamps, plus a unique index on slug.
- [ ] 1.2 Add D1 migration for `encounter_occurrences` with columns for definition_id (FK), user_id, status (active/completed/failed), personalized_target, started_at, coverage_end_date, grace_deadline, completed_at, and timestamps, plus indexes for user-scoped lookups and active-occurrence queries.
- [ ] 1.3 Add D1 migration for `daily_rolls` with columns for user_id, roll_date (UTC date), encounter_definition_id (nullable — null means no offer), status (offered/accepted/declined), and a `UNIQUE(user_id, roll_date)` constraint plus an index on roll_date.
- [ ] 1.4 Add D1 migration for `event_participants` with columns for occurrence_id (FK), user_id, progress_distance (cached total), joined_at, and a `UNIQUE(user_id, occurrence_id)` constraint.
- [ ] 1.5 Add D1 migration for `event_progress_ledger` with columns for participant_id (FK), source_progress_id, distance, and a `UNIQUE(participant_id, source_progress_id)` constraint plus an index on participant_id.
- [ ] 1.6 Seed the Nazgul pursuit encounter definition with globally eligible configuration, themed copy, image slug, 3-day duration, 1.3 stretch multiplier, and min/max target brackets via migration.
- [ ] 1.7 Seed the Nazgul completion badge definition via migration (insert into `achievement_definitions`) with slug `challenge-nazgul-outrun`, is_repeatable=true, badge_type='challenge', and appropriate name/description/image.

## 2. Event Domain Services

- [ ] 2.1 Create `src/event-utils.ts` with strict TypeScript interfaces for `PersonalEncounterDefinition`, `EncounterOccurrence`, `DailyRoll`, `EventParticipant`, `EventProgressLedger`, and API response shapes, following the existing `DbClient` pattern with no `any`.
- [ ] 2.2 Implement encounter eligibility evaluation: checks enabled state, active-challenge suppression (user has an in-progress occurrence), recent-encounter cooldown (accepted or declined in past 30 days for probability branch), and minimum activity threshold (7 walks on distinct dates in 30 days OR 3 walks on distinct dates in 7 days). Nazgul is globally eligible — no storyline or path-distance filtering.
- [ ] 2.3 Implement daily roll logic: insert a `daily_rolls` row with `UNIQUE(user_id, roll_date)` and `status = 'offered'`, evaluate eligibility, apply the correct probability branch (1-in-10 vs 1-in-30), select an eligible encounter definition if the roll succeeds, and return the result. Duplicate calls return the existing row's result (including its status).
- [ ] 2.4 Implement personalized target calculation: compute the user's average distance per distinct active day in the past 30 days (`SUM(distance) / COUNT(DISTINCT date)`), multiply by the definition's `target_stretch_multiplier`, and clamp to `[target_min_distance, target_max_distance]`.
- [ ] 2.5 Implement encounter acceptance: validate the `encounter_definition_id` from the request body matches the current day's roll offer, create an `encounter_occurrences` row with status='active', the personalized target, `started_at = today`, `coverage_end_date = today + duration_days - 1`, `grace_deadline = coverage_end_date + 3 days`, and an `event_participants` row. Update `daily_rolls.status = 'accepted'`. Immediately run reconciliation: if there's an existing walk entry for today (the acceptance date), credit it and check for completion. The completion badge is awarded via `awardAchievement(db, userId, definition.badge_slug, idempotency_key, context_metadata)`.
- [ ] 2.6 Implement encounter decline: update `daily_rolls.status = 'declined'` without creating an occurrence. The modal will not re-appear on page refresh.
- [ ] 2.7 Add Jest coverage for eligibility evaluation (activity threshold, active-challenge suppression, cooldown), daily roll branch selection (1-in-10 vs 1-in-30), minimum-activity suppression (0% chance), personalized target calculation with clamp, acceptance with definition ID validation, decline with status column, and acceptance-time completion when today's walk already exceeds target.

## 3. Event APIs and Routing

- [ ] 3.1 Create `src/event-handlers.ts` with authenticated handlers using `validateSession` and the existing `DbClient` pattern: `handleDailyRoll`, `handleAcceptEncounter`, `handleDeclineEncounter`, `handleGetMyChallenges`.
- [ ] 3.2 Implement `POST /api/events/daily-roll`: validates session, calls daily roll logic (which returns existing row on duplicate), returns `{ offer: null }` or `{ offer: { definition, target, coverageStart, coverageEnd, graceDeadline } }`. Suppresses re-offer when status is 'declined' or 'accepted'.
- [ ] 3.3 Implement `POST /api/events/daily-roll/accept`: validates session, requires `{ encounter_definition_id }` in body, validates the definition ID matches the current day's roll offer, processes acceptance, returns the created occurrence details.
- [ ] 3.4 Implement `POST /api/events/daily-roll/decline`: validates session, updates the roll status to declined, returns confirmation.
- [ ] 3.5 Implement `GET /api/events/mine`: returns the authenticated user's active and past personal challenges with status, target, progress, coverage window dates, grace deadline, and badge info.
- [ ] 3.6 Wire all event routes into `src/index.ts`: add cases to `getAllowedMethods` and add handler dispatch in the authenticated API section of the fetch handler, before the fallback 404.
- [ ] 3.7 Add Jest route-dispatch and handler coverage for auth rejection, daily roll idempotency, accept with valid/invalid definition ID, decline with status update, declined-offer suppression on re-roll, active-challenge suppression, and my-challenges response.

## 4. Progress Reconciliation

- [ ] 4.1 Implement the event progress reconciliation service in `src/event-utils.ts`: given a participant and a source progress entry, check if `progress.date` falls within `[coverage_start_date, coverage_end_date]`. If eligible, upsert or delete a ledger row with `UNIQUE(participant_id, source_progress_id)`, then recompute `event_participants.progress_distance = SUM(ledger.distance)`. Wrap in try/catch — errors are logged but NEVER propagated (graceful degradation, matching the `syncPartyProgressLog` pattern).
- [ ] 4.2 Implement the completion check helper: after reconciliation, count the number of distinct dates in the ledger for this participant. If `COUNT(DISTINCT ledger_date) = duration_days` (all coverage days have entries) AND `progress_distance >= personalized_target`, mark the occurrence completed and call `awardAchievement` from the shared infra.
- [ ] 4.3 Hook reconciliation into progress create: after a new progress row is inserted in `src/progress-handlers.ts` (following the `syncPartyProgressLog` call), find all active personal challenge participants for that user, and for each, reconcile if the progress date is within the coverage window, then check completion.
- [ ] 4.4 Hook reconciliation into progress update: after an existing progress row is edited, reconcile the ledger entry for that (participant, progress_id) combination if the date is within any active challenge's coverage window, then check completion.
- [ ] 4.5 Hook reconciliation into progress delete: after a progress row is deleted, remove the corresponding ledger entries and recompute cached totals. Never revoke an earned badge.
- [ ] 4.6 Add Jest coverage for: coverage-window-eligible walk credit, coverage-window-ineligible walk exclusion, grace-period credit for window dates, grace-period exclusion for non-window dates, all-days-covered + target-met completion, all-days-covered + target-not-met stays active, later-edit completion, ledger idempotency, graceful error handling (walk save succeeds despite reconciliation failure), and immutable badges preserved after progress reduction.

## 5. Scheduled Lifecycle Processing

- [ ] 5.1 Implement scheduled settlement in `src/event-utils.ts` (or `src/scheduled-handlers.ts`): query all active encounter occurrences whose `grace_deadline` has passed. For each, if `progress_distance >= personalized_target`, mark completed and award badge. Otherwise, mark failed.
- [ ] 5.2 Wire settlement into the Worker `scheduled()` handler in `src/index.ts`: add a new independent try/catch block for personal challenge settlement following the pattern of `handleOneMoreMileCron` and `handleReengagementCron`.
- [ ] 5.3 Add Jest coverage for settlement: grace-deadline-passed with target met → completed + badge awarded; grace-deadline-passed with target not met → failed, no badge; settlement failure isolation (other scheduled jobs still run).

## 6. Encounter Popup UI

- [ ] 6.1 Create `client/src/islands/EncounterPopupIsland.tsx`: Preact functional component that renders a modal overlay with encounter copy (name, description), personalized target distance, coverage window dates ("Today through [coverageEndDate]"), grace logging footnote ("You have until [graceDeadline] to log walks for these days"), and accept/decline buttons. Shows nothing when no offer is active. Accept sends `{ encounter_definition_id }` in the request body.
- [ ] 6.2 Create `client/src/modules/encounterTrigger.ts`: a standalone TypeScript module that calls `POST /api/events/daily-roll` (with auth headers from localStorage), and if an offer with `status === 'offered'` is returned, programmatically renders `EncounterPopupIsland` into a mount point using `window.preactIslands.EncounterPopupIsland`. Only activates on journey (`/` or `/journey`) and map (`/map`) paths.
- [ ] 6.3 Call the trigger module from `public/js/main.js` after `checkAuth()` succeeds (legacy journey page path) and from `client/src/index.tsx` bootstrap after `initializeAppStore()` (Preact path, gated to journey/map URLs).
- [ ] 6.4 Add modal styling: centered overlay with backdrop, themed Nazgul copy presentation, prominent accept and decline buttons, footnote styling, and CSS for encounter modal in a new `encounter-popup.css` stylesheet. Reference the stylesheet from journey and map page renderers.

## 7. Documentation and Validation

- [ ] 7.1 Update `docs/data-models.md` with the personal encounter schema invariants: definition/occurrence model, daily roll idempotency with status column, coverage window and grace deadline semantics, ledger uniqueness, and participant cached totals.
- [ ] 7.2 Update `docs/api-reference.md` with the daily roll, accept (with definition_id body), decline, and my-challenges endpoint specifications.
- [ ] 7.3 Update `docs/architecture.md` with encounter lifecycle (coverage window, grace period, settlement), progress reconciliation with graceful degradation, and scheduled settlement notes.
- [ ] 7.4 Add Vitest coverage for the encounter popup island: renders accept/decline UI with target and coverage dates, shows grace footnote, closes on accept (sends definition ID), closes on decline, shows nothing when no offer.
- [ ] 7.5 Run `npm test` and fix regressions related to event handlers, route dispatch, progress reconciliation (graceful), and scheduled processing.
- [ ] 7.6 Run `npm run test:client` and fix regressions related to the encounter popup island and trigger module.
- [ ] 7.7 Run focused Playwright coverage for the encounter popup accept/decline flow on journey and map pages, and declined-offer non-reappearance on refresh.
- [ ] 7.8 Run `npm run check` and resolve any TypeScript or Wrangler dry-run issues.
