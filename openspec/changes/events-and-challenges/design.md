## Context

The application is a Cloudflare Workers monolith backed by D1. New interactive surfaces are Preact islands hydrated from SSR shells, while journey logging still uses legacy JavaScript under `public/js/`. The current app already has several patterns this change should extend rather than replace:

- Authenticated session bootstrap through `/api/session` and app-level Preact store initialization.
- Canonical walking data in the `progress` table, with create/update/delete handlers under the calendar-progress API.
- Cross-cutting walk-log synchronization to `party_progress_log` for fellowship activity.
- Admin APIs guarded by the existing `/api/admin/*` route branch and audited through `admin_audit_log`.
- Scheduled Worker processing for push jobs, with independent try/catch blocks so one scheduled concern does not block another.
- Preact island registration in `client/src/index.tsx` for admin and user-facing pages.

Events need to support two related but distinct product shapes: personal encounters that may appear to one user during normal app use, and community campaigns that admins intentionally craft for opt-in global participation.

## Goals / Non-Goals

**Goals:**

- Provide one reusable event domain model for templates, occurrences, participants, progress, lifecycle, and achievements.
- Support daily user-specific personal encounter rolls on journey and map pages, beginning with a Nazgul pursuit encounter.
- Support future contextual personal encounters keyed by storyline, route segment, milestone context, or recent activity.
- Support admin-managed personal encounter templates and admin-created community campaigns with suggested target/duration values based on recent community metrics.
- Reconcile event progress from canonical walk logs while keeping cached participant totals efficient for reads.
- Count only walks logged after joining/accepting for the initial implementation.
- Make community campaigns publicly visible and expose contributor distances for opted-in participants.
- Award achievements immutably once earned and aggregate repeated awards of the same repeatable badge.
- Include first-pass admin UI and user-facing event surfaces in the initial implementation plan.

**Non-Goals:**

- No real-time streaming updates; polling/page refresh is sufficient for community progress.
- No automatic community campaign creation in the first pass.
- No social sharing or friend notification flow for personal challenge progress.
- No revocation of achievements after walk edits or deletes.
- No rewrite of legacy calendar/progress UI beyond adding the event reconciliation hook to existing handlers.

## Decisions

### Use templates plus occurrences

Personal encounter definitions and community campaign definitions are modeled separately from concrete event instances.

- Templates describe reusable challenge behavior: theme, copy, default duration, eligibility rules, reward type, target calculation strategy, and display metadata.
- Occurrences describe actual event windows that users can join or accept: community campaign instances, and user-specific personal challenge instances created after acceptance.

Rationale: Nazgul pursuit is the founding personal encounter, not the entire architecture. Future Moria or Minas Tirith events can reuse the same encounter engine while changing eligibility and target rules. Admin-created community campaigns can share participant/progress/achievement behavior without pretending they are random encounters.

Alternative considered: a single `events` table with JSON metadata for every variation. This is simpler at first but pushes too much domain meaning into untyped JSON and makes daily roll eligibility, admin suggestions, and future contextual encounters harder to validate.

### Keep daily rolls idempotent and explicit

Daily personal encounter rolls are stored per user and UTC date. The roll endpoint returns the existing result if called multiple times on the same date.

Rationale: the app can call a roll endpoint from journey and map page flows without worrying about duplicate popups from refreshes, multiple tabs, or island remounts.

Alternative considered: roll entirely client-side and only persist accepted challenges. That would be simpler but would make cooldowns, probability tuning, auditability, and cross-device behavior inconsistent.

### Use explicit rollout odds and activity gating for personal encounters

The initial Nazgul encounter uses two fixed probability branches and a minimum activity threshold:

- Users with no accepted or declined personal encounter in the past 30 days roll at 1-in-10.
- Users with an accepted or declined personal encounter in the past 30 days roll at 1-in-30.
- Users are eligible for personal encounter rolling only if they have at least 7 walks in the past 30 days or at least 3 walks in the past 7 days.
- Users below that threshold have a 0 percent roll chance.

Rationale: this keeps the first encounter discoverable without becoming noisy, and avoids offering personalized challenge pressure to brand-new or infrequent users before the app has a meaningful activity baseline.

Alternative considered: always-on rolling with a fallback target for new users. This would broaden feature exposure but risks making the app feel like work before the user has established a walking rhythm.

### Keep `/api/session` pure

The encounter roll should be a separate authenticated endpoint rather than embedded in `/api/session`.

Rationale: session validation is already central and should remain a stable identity/preferences response. A separate endpoint can be called after store initialization by an `EventEncounterIsland` or app-level event module, and can be disabled or retried independently.

Alternative considered: include encounter offers directly in `/api/session`. This reduces one request but couples session bootstrap to mutable game logic and makes testing/error handling messier.

### Use ledger-backed progress with cached totals

Event progress is recorded in a ledger keyed to participant and source walk entry, while participant rows store cached `progress_distance` for efficient reads.

Rationale: cached totals alone are fragile when users edit or delete walks. Recomputing from all progress rows on every request is simple but can become expensive. A ledger provides auditability and deterministic reconciliation while cached totals keep event pages fast.

Alternative considered: only store `event_participants.progress_distance`. This mirrors the simplest current story text but is too easy to corrupt across `POST`, `PUT`, and `DELETE /api/calendar-progress`.

### Add progress timestamps if needed for post-join semantics

The initial product rule is “walks logged after joining count.” If current `progress` rows do not provide reliable creation/update timestamps, add timestamp columns as part of the schema work and use them for event credit eligibility.

Rationale: walk date and log time are different concepts. The user may backfill a walk after accepting a challenge, and the current decision is to count the logging action after join.

Alternative considered: use only the walk date. This is easier, but it does not match the chosen initial behavior and would blur future policy changes.

### Make achievements immutable

`user_achievements` is append-only for earned event rewards. Reconciliation can update event progress and participant state, but it does not delete earned achievements.

Rationale: badges should feel like durable accomplishments and avoid surprising revocation after users correct old walk entries.

Alternative considered: derive achievements from current progress. That is mathematically tidy but less humane for a motivational app.

### Seed Nazgul across all storylines and path distances in the first pass

The initial Nazgul pursuit template is configured as globally eligible across all active storylines and the full path distance range.

Rationale: the first personal encounter is meant to validate the encounter loop itself rather than the precision of contextual gating. Storyline-specific and route-segment-specific filtering remain part of the template model for later tightening.

Alternative considered: introduce storyline or location gating immediately. This would better express theme fidelity but would increase tuning complexity before the generic encounter system is proven.

### Community contributor progress is public to all users

Community campaign APIs return public campaign progress and ranked contributor distances to all users, including unauthenticated visitors.

Rationale: public campaign visibility supports discovery and sign-ups, while public contribution is part of the collaborative motivation loop for opted-in participants. This also makes the progress UI simpler and more transparent.

Alternative considered: show ranking without exact distances except for the current user. This protects privacy more aggressively but is unnecessary for this product decision.

### Admin UI covers both personal templates and community campaigns in the first pass

The first implementation includes an admin event management Preact island and SSR shell under the existing admin section for both personal encounter templates and community campaigns.

The admin UI must allow management of personal-event copy, image, eligible storylines, path distance brackets, enabled state, duration, target min/max bracketing, badge image/name metadata, and other template fields needed to tune or retire an encounter.

Rationale: community events are primarily crafted, and personal encounters also need operator-facing tuning once the first Nazgul template is live. API-only admin creation would leave the feature incomplete for actual use.

Alternative considered: seed community events manually through migrations. This would unblock demos but would not satisfy the real product workflow.

### Make achievements immutable and repeatable

Achievement earning is append-only, and repeatable personal-event badges are aggregated for display with a count.

Rationale: users should be able to outrun the Nazgul more than once and see that mastery reflected without losing prior earns when walk data changes.

Alternative considered: one badge row per badge type with an incrementing mutable counter. This is simpler to display but loses occurrence-level auditability.

## Risks / Trade-offs

- Progress reconciliation bugs could over-credit or under-credit events -> Keep ledger rows unique by participant/source progress, make reconciliation idempotent, and cover create/update/delete with handler tests.
- Daily rolls could feel spammy -> Store one roll per user/day, enforce active-challenge and cooldown exclusions, and let users hide an offered encounter without penalty.
- Personal targets could feel like chores -> Use recent baseline averages with min/max clamps and conservative stretch multipliers; tune template metadata without schema changes.
- Event tables may be over-modeled for the first challenge -> Keep template/occurrence names clear and avoid speculative fields that are not needed by Nazgul or community campaigns.
- Admin suggestions may produce misleading values for a small or inactive community -> Show suggestions as editable estimates with the assumptions used, not as automatic decisions.
- Scheduled processing could exceed Worker limits as data grows -> Batch event lifecycle and settlement work, and keep failures isolated from existing push cron jobs.
- Community leaderboards expose exact contributions publicly -> Campaign pages and event join flows must make that visibility clear before participation.

## Migration Plan

1. Add D1 migrations for event templates, event occurrences, daily rolls, participants, progress ledger, achievements, and progress timestamps if required.
2. Seed the initial Nazgul pursuit template and any foundational achievement definitions.
3. Add event handlers and route dispatch behind authenticated/public/admin endpoints.
4. Add progress reconciliation calls to existing calendar progress create/update/delete paths.
5. Extend scheduled processing with event lifecycle and settlement jobs in independent guarded blocks.
6. Add Preact islands and SSR shells for public `/events`, admin event management, journey/map personal encounter popup, and badge display.
7. Update docs and add focused tests before enabling event creation in production.

Rollback strategy: keep migrations additive; if UI or handlers need to be rolled back, existing journey, progress, party, push, and storyline behavior can continue without reading event tables. Event route registration and encounter bootstrap can be disabled independently while retaining stored event data for later repair.

## Open Questions

- None currently.