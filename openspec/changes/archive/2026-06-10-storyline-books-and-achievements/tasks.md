## 1. Schema, Seed Data, and Migration

- [ ] 1.1 Decide final achievement table reuse/naming against the active events-and-challenges change so book badges use one append-only achievement model.
- [ ] 1.2 Add D1 migration for `storyline_books` with storyline ownership, ordered metadata, start/end distances, optional boundary goal anchors, badge metadata, timestamps, and indexes.
- [ ] 1.3 Add D1 migration for active user and party book state, keeping active books tied to active storylines.
- [ ] 1.4 Add D1 migration for personal and fellowship book attempts with attempt status, starting story distance, starting book progress, completion state, and idempotent award keys.
- [ ] 1.5 Add D1 migration for fellowship book contribution tracking needed to identify active members who contributed during a fellowship book attempt.
- [ ] 1.6 Add or extend achievement definition and earned-instance tables for personal and fellowship book completion badges if the generic achievement schema is not already present.
- [ ] 1.7 Seed six book splits and badge metadata for the Frodo/Sam storyline.
- [ ] 1.8 Seed six book splits and badge metadata for the Pippin storyline based on Pippin's position at each Lord of the Rings book ending.
- [ ] 1.9 Add fallback full-journey book records for any other public active storyline or keep incomplete storylines admin-only until valid splits exist.
- [ ] 1.10 Implement one-time user backfill for active book inference and completed personal book achievements.
- [ ] 1.11 Implement one-time fellowship backfill for active book inference and contributor-eligible fellowship achievements where contribution history can be determined safely.
- [ ] 1.12 Add migration tests or fixture-backed Jest coverage for seeded boundaries, shared endpoints, active-book inference, and idempotent backfill.

## 2. Book Domain Services

- [ ] 2.1 Create strict TypeScript interfaces for storyline books, active book context, book attempts, switch options, contribution rows, and achievement award responses.
- [ ] 2.2 Implement book progress math for whole-story distance, current-book progress, book length, relative milestone distance, and clamp behavior.
- [ ] 2.3 Implement active-book inference with next-book-at-boundary semantics and final-book handling.
- [ ] 2.4 Implement public storyline book coverage validation for gaps, overlaps beyond shared endpoints, out-of-range boundaries, and milestones outside public book ranges.
- [ ] 2.5 Implement admin-only draft validation that reports coverage problems without blocking saves.
- [ ] 2.6 Implement user book switch planning for reset, carry, disabled carry, and explanatory disabled states.
- [ ] 2.7 Implement party book switch planning for leader-controlled reset, carry, disabled carry, and explanatory disabled states.
- [ ] 2.8 Implement personal book attempt creation, superseding, completion detection, and award idempotency.
- [ ] 2.9 Implement fellowship book attempt creation, superseding, contribution tracking, completion detection, and contributor award idempotency.
- [ ] 2.10 Add Jest coverage for distance math, boundary inference, validation, reset/carry planning, exact-length carry disablement, and attempt idempotency.

## 3. Worker APIs and Routing

- [ ] 3.1 Extend storyline response shaping so active storylines can include ordered public book metadata for selectors.
- [ ] 3.2 Extend `/api/session` response with active personal book context and achievement-ready metadata needed by client islands.
- [ ] 3.3 Extend `/api/total-distance` response with whole-story distance, current-book progress, active book length, active book metadata, and raw total distance.
- [ ] 3.4 Extend `/api/goals` to support current-book milestone filtering and book-relative display distances while preserving whole-story behavior.
- [ ] 3.5 Add authenticated user book switch endpoint or extend existing storyline switching with book selection and reset/carry semantics.
- [ ] 3.6 Add leader-only fellowship book switch endpoint or extend existing party storyline switching with book selection and reset/carry semantics.
- [ ] 3.7 Add admin storyline book APIs for listing, creating, updating, reordering, deleting, validating, and inspecting books for a storyline.
- [ ] 3.8 Enforce public activation validation when admin updates storyline active/admin-only state.
- [ ] 3.9 Wire book routes and allowed-method metadata through `src/index.ts` without disturbing existing route behavior.
- [ ] 3.10 Add Jest handler and route coverage for auth, non-admin rejection, book responses, switching modes, validation errors, and current-book goals.

## 4. Progress and Achievement Integration

- [ ] 4.1 Hook personal book completion checks into progress create, update, and delete flows using previous and updated story distance.
- [ ] 4.2 Ensure progress edits/deletes never revoke earned book achievements.
- [ ] 4.3 Ensure progress edits/deletes cannot award a second badge for an already completed attempt.
- [ ] 4.4 Hook fellowship book contribution tracking into existing party progress synchronization when member contributions change.
- [ ] 4.5 Hook fellowship book completion checks into party progress updates and book switching flows.
- [ ] 4.6 Ensure departed members keep earned fellowship badges but are excluded from future fellowship book award eligibility.
- [ ] 4.7 Add achievement aggregation support for repeated personal and fellowship book completions on profile response shapes.
- [ ] 4.8 Add Jest coverage for personal crossing, repeat reset completion, edit/delete exploit safety, late joiner eligibility, departed-member exclusion, and immutable awards.

## 5. User and Fellowship UI

- [ ] 5.1 Add starting book selection to new-user storyline setup while preserving current registration/session flow.
- [ ] 5.2 Update `ProfileIsland` storyline controls to show active book, book switch choices, reset/carry actions, and disabled carry explanations.
- [ ] 5.3 Update `PartyManageIsland` leader controls to show fellowship active book, switch choices, reset/carry actions, and disabled carry explanations.
- [ ] 5.4 Implement current-book versus whole-story view mode persistence using the same persistence scope as the current personal/fellowship view selection.
- [ ] 5.5 Update journey total-distance display to show either whole-story distance or current-book progress based on view mode.
- [ ] 5.6 Update legacy goals rendering integration so current-book view uses book-filtered goals and relative distances without rewriting unrelated legacy behavior.
- [ ] 5.7 Add achievement badge display or extend planned badge display on profile and friend profile surfaces for repeated personal and fellowship book badges.
- [ ] 5.8 Add Vitest coverage for profile book switching, fellowship leader switching, view mode persistence, relative distance display, and repeated badge rendering.

## 6. Map and Social Presentation

- [ ] 6.1 Update map milestone loading so current-book view fetches or filters only active-book waypoints.
- [ ] 6.2 Include storyline id, active book id, and view mode in book-aware milestone cache keys.
- [ ] 6.3 Keep friend and fellowship markers visible regardless of current-book range.
- [ ] 6.4 Update friend and fellowship marker labels to include whole-story distance and storyline context.
- [ ] 6.5 Add Vitest coverage for map milestone filtering, cache key separation, and social marker label formatting.
- [ ] 6.6 Add focused Playwright or visual coverage for current-book map mode with overlapping route milestones.

## 7. Admin Storylines UI

- [ ] 7.1 Extend `AdminStorylinesIsland` detail loading to include books, boundary anchors, coverage validation, and badge metadata.
- [ ] 7.2 Add admin UI for creating, editing, reordering, and deleting storyline books without inserting CSS into unrelated admin selector blocks.
- [ ] 7.3 Add milestone-anchor boundary pickers that store boundary distances as the source of truth.
- [ ] 7.4 Add inline validation summaries for gaps, overlaps, shared endpoints, out-of-range milestones, and activation blockers.
- [ ] 7.5 Add admin UI fields for personal and fellowship badge names, image slugs, repeatability metadata, and descriptions.
- [ ] 7.6 Add admin audit logging for mutating storyline book actions.
- [ ] 7.7 Add Vitest coverage for admin book forms, validation display, anchor selection, badge metadata edits, and non-admin error states.

## 8. Documentation and Validation

- [ ] 8.1 Update `docs/data-models.md` with storyline book, attempt, contribution, active-book, and achievement invariants.
- [ ] 8.2 Update `docs/api-reference.md` with book-aware session, total-distance, goals, user switch, party switch, and admin storylines endpoints.
- [ ] 8.3 Update `docs/architecture.md` with book progression, attempt idempotency, achievement immutability, and migration notes.
- [ ] 8.4 Update `docs/frontend-guide.md` with current-book view, map filtering, and admin storylines UI patterns.
- [ ] 8.5 Run `npm test` and fix regressions related to book domain services, handlers, migrations, progress hooks, and achievements.
- [ ] 8.6 Run `npm run test:client` and fix regressions related to Preact islands, map filtering, admin UI, and badge display.
- [ ] 8.7 Run focused Playwright coverage for starting at a later book, switching reset/carry, disabled carry, current-book map view, and admin validation.
- [ ] 8.8 Run `npm run check` and resolve TypeScript, build, or Wrangler dry-run issues introduced by book-aware APIs and UI.
