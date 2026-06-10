## Context

Walk to Mordor is a Cloudflare Workers monolith backed by D1. The app validates sessions through `handleSessionValidation`, records walking progress through `POST/PUT/DELETE /api/calendar-progress`, runs scheduled jobs through the Worker `scheduled()` handler, and renders Preact islands registered in `client/src/index.tsx`.

Two foundational changes already exist or are planned before this one:
- `shared-achievement-infrastructure` provides `awardAchievement()`, `getUserAchievementSummary()`, and the `achievement_definitions` / `user_achievement_instances` tables.
- `profile-badge-display` provides the badge grid UI and `GET /api/achievements` endpoint.

This change introduces personal challenges as the first consuming feature of the achievement infrastructure. It uses separate D1 tables from any future community campaign system — the shared ground between them is too thin to justify a unified schema.

## Goals / Non-Goals

**Goals:**
- Provide end-to-end Nazgul pursuit personal encounter: daily random roll → modal popup → accept/decline → progress tracking → completion → badge.
- Model personal encounter definitions separately from concrete encounter occurrences so the same definition can generate future encounters for the same user.
- Store one daily roll per user per UTC day with idempotent results — repeated calls return the same outcome.
- Calculate personalized distance targets from the user's recent active-day walking averages, clamped by definition-configured min/max brackets.
- Reconcile encounter progress from canonical walk logs through an idempotent ledger that refreshes cached participant totals.
- Count only walks logged after the user accepts the encounter (acceptance creates the participant record; walks before that are naturally excluded).
- Settle expired personal challenges via scheduled processing with independent error isolation.
- Award the Nazgul completion badge immutably through the shared achievement infrastructure.

**Non-Goals:**
- No community campaigns (separate change with separate tables).
- No admin encounter definition management UI (separate `personal-challenges-admin` change).
- No storyline-specific or path-distance eligibility for the first seeded encounter (Nazgul is globally eligible).
- No progress timestamp migration — personal challenges create participant records at acceptance time, so post-accept credit is inherent.
- No social sharing or friend notification for challenge progress.
- No multiple encounter definitions beyond the seeded Nazgul (admin UI enables more, but that's a separate change).

## Decisions

### Use separate tables from any future community campaign system

Personal challenges have their own `personal_encounter_definitions`, `encounter_occurrences`, `daily_rolls`, `event_participants`, and `event_progress_ledger` tables. Community campaigns will use their own tables.

Rationale: the differences (private vs public visibility, personalized vs community targets, random roll vs admin-created, accept/decline vs join, eligibility gating vs global) outweigh the superficial similarity of "timed events." Forcing both into one schema would create nullable-column soup and make query patterns fragile.

Alternative considered: a shared `events` table with a `type` discriminator. Rejected because the divergence in query patterns, constraints, and lifecycle would make every query branch on type.

### Model encounter definitions separately from occurrences

`personal_encounter_definitions` stores the reusable configuration: name, slug, description copy, image, badge_slug, duration_days, target calculation strategy, badge metadata, enabled state. `encounter_occurrences` stores concrete instances created when a user accepts a definition — one per user per acceptance, with a specific start date, coverage end date, grace deadline, and personalized target distance.

Rationale: the same Nazgul definition can create multiple occurrences for the same user over time (it's repeatable). Future definitions like a Moria chase or Minas Tirith defense reuse the same engine with different copy and parameters.

Alternative considered: storing the definition fields directly on each occurrence row. Rejected because it duplicates configuration data and makes definition-level queries harder.

### Store daily rolls with a status column and idempotent (user_id, roll_date) uniqueness

`daily_rolls` has `UNIQUE(user_id, roll_date)` where `roll_date` is a UTC date. The table has a `status` column: `offered` (encounter is being shown), `accepted` (user accepted), `declined` (user declined). The roll endpoint inserts on first call with `status = 'offered'` and returns the existing row on duplicate calls. After accepting or declining, the status is updated to prevent the modal from re-appearing on page refresh.

Rationale: the client may call the roll endpoint multiple times per page load. Idempotency prevents duplicate popups. The status column prevents the modal from re-appearing after decline + page refresh during the same UTC day.

Alternative considered: tracking declined state separately. Rejected because it adds a second table for a single boolean and makes the "should I show the modal?" check need an extra query.

### Use days not hours for duration, with a 3-day grace period for walk logging

Personal challenges use `duration_days` instead of `duration_hours`. A 3-day Nazgul challenge means the walking coverage window is [accept_date, accept_date + 2] (3 days: today and the next 2 days). After the coverage window ends, there is a 3-day grace period where the user can still log walks for dates within the coverage window. At the end of the grace period, the challenge is settled as completed or failed.

Completion is checked:
1. At **acceptance time**: if there's already a walk logged for today, it counts immediately
2. On every **progress create/update** within the coverage window
3. On every **progress update** during the grace period (editing a walk whose date is within the coverage window)
4. At **scheduled settlement** at the end of the grace period

Challenge lifecycle:
```
Day 0 (accept):  │███ coverage window (3 days) ███│── grace (3 days) ──│
                 │                                │                     │
                 │  walks for these dates count   │  can still log      │  final
                 │  if total ≥ target → complete  │  walks for window   │  settlement
                 │  (immediate)                   │  dates              │  → failed if
                 │                                │                     │  target not met
```

Rationale: the user typically logs yesterday's walk the next morning and is sometimes 1-2 days behind. The 3-day grace period accommodates this reality. The coverage window defines which walk dates actually count. The grace deadline prevents challenges from hanging forever.

Alternative considered: using hours and requiring walks to be logged within 48 hours. Rejected because it doesn't match how users actually use the app (backfilling walks from 1-2 days ago is normal behavior).

### Completion is re-evaluated on each entry, not locked on first check

If a user enters walks for all coverage days but the total is below the target, the challenge remains active. If they later update a day's distance (e.g., they walked more later that day and re-enter), reconciliation re-checks — if the total now meets the target, the challenge completes. The challenge only fails at grace-period settlement if the target was never met during the window.

Rationale: walks can be updated (PUT) at any time with a new distance. A day-2 entry that's too low can be corrected later on day 2. Completion should be based on the most recent data, not the first entry that happened to cover all days.

### Use walk date for coverage, not log timestamp

Credit eligibility is determined by `progress.date`: only walks whose date falls within the coverage window [accept_date, accept_date + duration_days - 1] count. Walks logged during the grace period for dates outside the coverage window do not count.

Rationale: the progress table has no `created_at` column and the app stores one entry per date per user. Using the walk date directly means no schema changes are needed and the rule is simple to explain: "walks you did on these specific days count."

Alternative considered: adding timestamps to progress. Rejected because personal challenges have a clean acceptance boundary and walk-date comparison achieves the same effect without a migration.

### Use two probability branches with activity gating

The daily roll uses these rules:
- Users with fewer than 7 walks in the past 30 days AND fewer than 3 walks in the past 7 days have a 0% roll chance — no offer is made.
- Users meeting the activity threshold who have no accepted or declined encounter in the past 30 days roll at 1-in-10.
- Users meeting the activity threshold who have an accepted or declined encounter in the past 30 days roll at 1-in-30.
- Users with an active (in-progress) personal challenge receive no new offer.

Rationale: prevents brand-new or very infrequent users from feeling pressured, keeps the first encounter feeling special, and avoids encounter fatigue.

Alternative considered: always-on rolling with a fallback target for new users. Rejected because it makes the feature feel like work before the user has established a walking rhythm.

### Calculate personalized targets from active-day averages

The target distance for an accepted encounter is `clamp(recentActiveDayAverage × stretchMultiplier, minTarget, maxTarget)` where:
- `recentActiveDayAverage` is the user's average distance per day on distinct days they walked in the past 30 days (one entry per day — `SUM(distance) / COUNT(DISTINCT date)`).
- `stretchMultiplier` is a definition-configured value (e.g., 1.3 for a 30% stretch).
- `minTarget` and `maxTarget` are definition-configured bounds.

Rationale: targets based on actual walking history are motivating rather than punitive. The clamp prevents absurd targets for both very active and very sedentary users. Dividing by distinct active days (not walk count) gives a fair per-day baseline since the app stores one entry per day.

Alternative considered: a flat target distance per definition. Rejected because a target that's trivially easy for one user could be impossibly hard for another.

### Use ledger-backed progress reconciliation with graceful degradation

`event_progress_ledger` stores one row per (participant, source_progress_id) with `UNIQUE(participant_id, source_progress_id)`. `event_participants` stores a cached `progress_distance` value. On progress create/update/delete:

1. Find all active personal challenge participants for the user.
2. For each participant, check if the progress date falls within [accept_date, accept_date + duration_days - 1].
3. If eligible, upsert or delete the ledger row.
4. Recompute `event_participants.progress_distance = SUM(ledger.distance)`.
5. Check for completion: if all coverage days have entries AND cumulative total ≥ target.

Errors during reconciliation are caught and logged but **never** propagated to the caller — the walk save must always succeed. This follows the existing `syncPartyProgressLog` pattern of graceful degradation.

Rationale: the ledger provides auditability and determinism. The cached total keeps reads fast. Graceful degradation means the core app function (logging a walk) is never blocked by event processing.

Alternative considered: deriving progress from `event_participants` directly without a ledger. Rejected because it's too fragile across create/update/delete.

### Accept and decline endpoints use explicit definitions, not just the current roll

`POST /api/events/daily-roll/accept` requires `{ encounter_definition_id }` in the body. The server validates that the definition ID matches the current day's roll offer before accepting.

Rationale: prevents a race condition where the user opens the modal at 23:58 UTC (roll A), the date rolls over at 00:00, a new roll (roll B) is created, and the user clicks accept at 00:01. Without the definition ID check, the user would accept roll A against roll B's data — or worse, accept a roll that no longer exists.

Alternative considered: no body — server looks up current roll. Rejected because of the UTC date rollover edge case.

### Use a modal overlay with a footnote about coverage rules

When the daily roll returns an encounter offer, `EncounterPopupIsland` renders as a centered modal overlay. The modal displays:
- Themed encounter copy (Nazgul pursuit narrative)
- Challenge duration: "Today and the next N days"
- Personalized target distance
- A footnote: "Only walks from today through [coverage_end_date] count. You have 3 days after the challenge to log any remaining walks."

Rationale: users need to understand the coverage window to plan their walking. The footnote sets expectations about which days count and when the grace logging window ends.

### Trigger the encounter popup from an app-level trigger module

Create a standalone TypeScript module (`client/src/modules/encounterTrigger.ts`) that:
1. Called after auth verification on journey and map pages
2. Calls `POST /api/events/daily-roll`
3. If an offer is returned, programmatically renders `EncounterPopupIsland` via the global `window.preactIslands` registry

The trigger module is imported and called from:
- `public/js/main.js` (after `checkAuth()` on the journey page) — legacy path
- `client/src/index.tsx` bootstrap (after `initializeAppStore()`, gated to journey/map paths) — the eventual path as the app migrates to Preact

Rationale: the app currently has two rendering pipelines. A standalone module works in both contexts. As the app migrates to Preact, the trigger call moves fully into `index.tsx` without architectural changes.

### Wire scheduled settlement into the existing scheduled() handler

Personal challenge settlement runs as a new independent try/catch block in the Worker's `scheduled()` handler. Settlement processes all active occurrences whose grace deadline has passed:
- If `progress_distance >= personalized_target` → completed + badge awarded
- If `progress_distance < personalized_target` → failed (with a note that walks for all coverage days may not have been logged in time)

Failures in settlement do not block other scheduled jobs (push notifications).

Rationale: the existing pattern of independent try/catch blocks is proven. The grace-period approach means settlement runs reliably — challenges don't hang forever.

### Do not add progress timestamp columns in this change

Personal challenges use `progress.date` for coverage window eligibility. No `created_at`/`updated_at` migration is needed.

Rationale: the app stores one entry per date per user. Walk-date comparison is sufficient and avoids an unnecessary schema change.

## Risks / Trade-offs

- [Daily rolls could feel spammy] → One roll per UTC day max, cooldown suppression for users with recent encounters, declined rolls suppress re-offer via status column, and the ability to decline without penalty.
- [Personalized targets could feel like chores] → Conservative stretch multipliers and min/max clamping prevent targets that feel punitive.
- [Progress reconciliation bugs could over-credit or under-credit] → Ledger with UNIQUE constraint prevents duplicate entries; recomputation from ledger ensures correctness after edits/deletes; graceful degradation prevents walk saves from ever being blocked.
- [Modal popup could interrupt important page actions] → The modal only appears on page load after the daily roll; it does not interrupt mid-session. Users who are in the middle of logging a walk won't see it until their next page load. Declined rolls don't re-appear on refresh.
- [UTC date rollover could cause accept/decline race conditions] → Accept endpoint requires `encounter_definition_id` in body to validate the roll still matches.
- [Users may not understand which days count] → Modal footnote explains the coverage window and grace logging period.
- [Grace period could let challenges stay open too long] → 3-day grace is a fixed constant. Scheduled settlement runs reliably and closes challenges after the grace deadline. Users who forget to log walks fail with a clear "walks not logged in time" outcome.
- [Encounter tables are over-modeled for a single Nazgul encounter] → The definition/occurrence split and full ledger model are designed for the admin-tunable multi-encounter future. Keeping names clear and avoiding speculative fields keeps the schema understandable.

## Migration Plan

1. Add D1 migrations for `personal_encounter_definitions`, `encounter_occurrences`, `daily_rolls` (with `status` column), `event_participants`, and `event_progress_ledger` with indexes and uniqueness constraints.
2. Seed the Nazgul pursuit encounter definition (3-day duration, 1.3 stretch) and its completion achievement definition via migration.
3. Add the event domain service, trigger module, and API handlers, wiring routes into `src/index.ts`.
4. Add progress reconciliation hooks to existing calendar progress create/update/delete handlers with graceful (non-blocking) error handling.
5. Add scheduled settlement to the Worker `scheduled()` handler.
6. Add the encounter popup island and focused CSS; reference CSS from journey and map page renderers.
7. Update docs and add focused tests.

Rollback strategy: all migrations are additive. If the UI or handlers need to be rolled back, existing journey, progress, party, push, and storyline behavior continues unchanged. Encounter tables sit unused and can be re-enabled later. Route registration and encounter bootstrap can be disabled independently.

## Open Questions

None. All design decisions are resolved:
- Separate tables from community campaigns
- Definition/occurrence model with seeded Nazgul definition
- Daily roll idempotency via `UNIQUE(user_id, roll_date)` with `status` column
- Two probability branches (1-in-10 / 1-in-30) with activity gating
- Personalized targets from active-day averages with clamp
- Days-based duration with 3-day grace period for walk logging
- Coverage window: only walks with dates in [accept_date, accept_date + duration_days - 1] count
- Completion checked at acceptance, on every progress create/update, and at grace settlement
- Ledger-backed progress reconciliation with graceful (non-blocking) error handling
- Modal overlay with coverage-window footnote
- Standalone trigger module (works in legacy JS + Preact contexts)
- Accept endpoint takes `encounter_definition_id` for rollover safety
- Scheduled settlement at grace deadline with failure outcome
