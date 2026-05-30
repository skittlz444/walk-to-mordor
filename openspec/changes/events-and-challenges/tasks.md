## 1. Schema and Seed Data

- [ ] 1.1 Add a migration for progress `created_at` and `updated_at` timestamps if current schema lacks reliable log-time fields.
- [ ] 1.2 Add migrations for event templates, event occurrences, daily encounter rolls, event participants, event progress ledger entries, and user achievement instances with repeatable badge support.
- [ ] 1.3 Add indexes and uniqueness constraints for user/date daily rolls, participant uniqueness, source progress ledger idempotency, active event lookups, and achievement-instance uniqueness per earned occurrence while allowing repeated badge counts.
- [ ] 1.4 Seed the initial Nazgul pursuit personal encounter template and its completion achievement metadata.
- [ ] 1.5 Update `docs/data-models.md` with the event, progress ledger, daily roll, and achievement schema invariants.

## 2. Event Domain Services

- [ ] 2.1 Create typed event domain interfaces for templates, occurrences, participants, rolls, progress ledger rows, achievements, and API response shapes.
- [ ] 2.2 Implement event template loading and eligibility evaluation for active challenge state, cooldowns, storyline, route segment, milestone context, eligible storyline/path brackets, and recent activity rules.
- [ ] 2.3 Implement daily roll logic that records one roll per user per UTC day, uses the 1-in-10 versus 1-in-30 probability branches, and returns the existing result on repeated calls.
- [ ] 2.4 Implement personalized target calculation from active-day walking averages with template stretch and min/max bracketing, and suppress personal encounter offers for users below the minimum activity threshold.
- [ ] 2.5 Implement participant creation for accepted personal challenges and joined community campaigns.
- [ ] 2.6 Implement immutable repeatable achievement awarding with per-occurrence records and aggregated badge counts.
- [ ] 2.7 Add Jest coverage for eligibility, daily roll branch selection, minimum-history suppression, personalized targets, participant creation, and repeatable achievement aggregation.

## 3. Event APIs and Routing

- [ ] 3.1 Create event API handlers using the existing `DbClient` read/write pattern and explicit D1 result interfaces.
- [ ] 3.2 Add `POST /api/events/daily-roll` for authenticated personal encounter rolls.
- [ ] 3.3 Add personal encounter accept and decline endpoints for offered daily rolls.
- [ ] 3.4 Add `GET /api/events` for public community event visibility plus authenticated personal and joined-event data.
- [ ] 3.5 Add `GET /api/events/:id` for public community event detail with authenticated participation status when available.
- [ ] 3.6 Add `POST /api/events/:id/join` for community campaign participation.
- [ ] 3.7 Add public `GET /api/events/:id/community-progress` with total distance, target distance, participant count, public ranked contributor distances, and current user contribution when authenticated.
- [ ] 3.8 Wire event routes and allowed-method metadata through `src/index.ts` without disturbing existing API routing.
- [ ] 3.9 Add Jest route-dispatch and handler coverage for auth, duplicate joins, encounter accept/decline, event list/detail, and community progress responses.

## 4. Progress Accounting

- [ ] 4.1 Implement an event progress reconciliation service that credits eligible source walks through ledger entries and refreshes participant cached totals.
- [ ] 4.2 Reconcile event progress when a walk is created after the user has joined or accepted an event.
- [ ] 4.3 Reconcile event progress when an already-credited walk is edited.
- [ ] 4.4 Reconcile event progress when an already-credited walk is deleted.
- [ ] 4.5 Ensure pre-join walks do not contribute to event progress under the initial policy.
- [ ] 4.6 Preserve earned achievements when later reconciliation reduces progress below a completed threshold.
- [ ] 4.7 Add Jest coverage for create/update/delete reconciliation, duplicate ledger prevention, cached total refresh, pre-join exclusion, and immutable achievements.

## 5. Scheduled Lifecycle Processing

- [ ] 5.1 Implement scheduled event lifecycle processing for upcoming-to-active transitions.
- [ ] 5.2 Implement scheduled settlement for expired personal challenges, including failed status when target distance was not reached.
- [ ] 5.3 Implement scheduled settlement for community campaigns, including completed versus expired outcome rules.
- [ ] 5.4 Wire event scheduled processing into the existing Worker `scheduled()` handler with independent error isolation from push jobs.
- [ ] 5.5 Add Jest coverage for event activation, personal failure settlement, community completion, achievement award on settlement, and scheduled error isolation.

## 6. Admin Event Management

- [ ] 6.1 Add admin event management APIs for listing, creating, updating, enabling, disabling, and inspecting personal encounter templates and community campaigns.
- [ ] 6.2 Implement community metric suggestion logic for target distance, duration, expected opt-in, and safety margin assumptions.
- [ ] 6.3 Add an admin SSR shell and Preact `AdminEventsIsland` registered through the existing island registry.
- [ ] 6.4 Build admin create/edit/list/inspect UI with personal template fields for copy, image, eligible storylines, path-distance brackets, enabled state, duration, target brackets, badge metadata, plus community campaign suggestion and visibility controls.
- [ ] 6.5 Add admin audit logging for community campaign creation and updates.
- [ ] 6.6 Add Jest and Vitest coverage for admin APIs, suggestion calculations, personal-template management, non-admin rejection, admin island loading, and form submission behavior.

## 7. User Event Surfaces

- [ ] 7.1 Add a public `/events` SSR shell and Preact events island registered through the existing island registry.
- [ ] 7.2 Build event list/detail UI for public community campaigns, authenticated personal challenges, joined campaigns, progress, deadlines, and past outcomes.
- [ ] 7.3 Add an encounter offer island or app-level event module that calls the daily roll endpoint only on authenticated journey and map pages.
- [ ] 7.4 Build the Nazgul pursuit popup with themed copy, accept action, and hide/decline action.
- [ ] 7.5 Add community campaign progress UI with total progress, participant count, current user contribution, and public ranked contributor distances.
- [ ] 7.6 Add achievement badge display with repeat counts to profile and friend profile surfaces.
- [ ] 7.7 Add focused CSS for events/admin events without inserting new rules inside unrelated existing admin selector blocks.
- [ ] 7.8 Add Vitest coverage for public events island states, journey/map encounter popup accept/decline behavior, community progress rendering, and badge display with repeat counts.

## 8. Documentation and Validation

- [ ] 8.1 Update `docs/api-reference.md` with public community event visibility endpoints, personal encounter endpoints, community progress endpoints, and admin event/template endpoints.
- [ ] 8.2 Update `docs/architecture.md` with event lifecycle, progress reconciliation, and scheduled processing notes.
- [ ] 8.3 Run `npm test` and fix regressions related to event handlers, route dispatch, progress reconciliation, and scheduled processing.
- [ ] 8.4 Run `npm run test:client` and fix regressions related to Preact islands and event components.
- [ ] 8.5 Run focused Playwright coverage for the encounter popup, events page join/progress flow, admin event creation, and badge display.
- [ ] 8.6 Run `npm run check` after implementation and resolve TypeScript or Wrangler dry-run issues related to the new event surfaces.