## 1. Schema And Data Access

- [ ] 1.1 Add D1 migrations for `goal_content` and `content_discovery_events`, including constraints, indexes, and ordered uniqueness by `(goal_id, sort_order)`.
- [ ] 1.2 Add strict TypeScript row types and database access helpers for goal content records and discovery event writes.

## 2. Worker APIs And Unlock Logic

- [ ] 2.1 Implement admin goal-content list/create/update/delete handlers with validation for type, title, attribution, shared body limit, and sort order.
- [ ] 2.2 Wire admin goal-content routes and allowed methods in `src/index.ts`.
- [ ] 2.3 Implement the public goal-content read endpoint with personal and `partyId`-aware unlock checks that reuse existing goal visibility semantics.
- [ ] 2.4 Extend `GET /api/goals` to include `has_content` without changing existing goal ordering or lock behavior.
- [ ] 2.5 Plumb `ExecutionContext` through the Worker request flow so goal-content analytics can be scheduled with non-blocking background writes.

## 3. Admin Authoring Experience

- [ ] 3.1 Extend the existing admin goal edit island to list ordered content entries and support create, edit, delete, and reorder actions in-place.
- [ ] 3.2 Reuse the existing Markdown preview flow for goal-content bodies and surface validation errors clearly in the admin form.

## 4. Public Goal Surfaces

- [ ] 4.1 Update `GoalModal` to fetch goal content, show a loading state, render unlocked entries in `sort_order`, and hide the section when no content exists.
- [ ] 4.2 Add type-specific rendering treatments for story, poetry, and appendix entries, including appendix attribution and 500-word expand/collapse behavior.
- [ ] 4.3 Update legacy and island-based goal list/card surfaces to use `has_content` for locked teaser placeholders without exposing unlocked bodies.

## 5. Discovery Analytics And UX Hardening

- [ ] 5.1 Record best-effort teaser-impression and content-open discovery events without blocking the related user flow.
- [ ] 5.2 Verify the new `has_content` and goal-content fetch behavior works cleanly with existing cache/versioning expectations and fallback states.

## 6. Validation And Documentation

- [ ] 6.1 Add backend tests covering goal-content validation, admin permissions, ordered persistence, personal unlock checks, fellowship unlock checks, and analytics failure tolerance.
- [ ] 6.2 Add frontend tests covering admin Markdown preview, locked teaser rendering, unlocked content rendering, and appendix truncation behavior.
- [ ] 6.3 Add Playwright coverage for admin authoring and user-facing locked versus unlocked goal-content flows.
- [ ] 6.4 Update the relevant docs in `docs/` for the new schema, APIs, frontend behavior, and testing expectations.