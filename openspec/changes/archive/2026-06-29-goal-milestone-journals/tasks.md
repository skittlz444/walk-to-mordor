## 1. Schema And Journal Data Access

- [x] 1.1 Add a D1 migration for `milestone_journals` with `(user_id, goal_id)` uniqueness, visibility validation, timestamps, and indexes for goal-scoped reads.
- [x] 1.2 Add strict TypeScript row types and shared data-access helpers for canonical goal journals, accepted-friend lookups, and storyline or fellowship reach checks.

## 2. Worker Journal APIs And Access Rules

- [x] 2.1 Implement the goal-scoped journal-state read handler that returns own entry, visible friend entries, and permission flags for GoalModal.
- [x] 2.2 Implement the goal-scoped journal upsert handler with plain-text validation, personal reach checks, and fellowship-context write validation via optional `partyId`.
- [x] 2.3 Implement the goal-scoped journal delete handler for the current user's entry.
- [x] 2.4 Wire the new journal routes and allowed-method registration in `src/index.ts`.

## 3. Modal Context Plumbing

- [x] 3.1 Extend shared goal and modal context types to preserve canonical `goal_id`, `storyline_goal_id`, and optional `partyId` where journal access rules need them.
- [x] 3.2 Update legacy and island-based GoalModal callers so personal, map, walk-congratulations, and fellowship milestone flows pass the correct journal context.

## 4. GoalModal Journal Experience

- [x] 4.1 Update `GoalModal` to fetch goal-scoped journal state, show loading and error handling, and render own-entry plus friend-entry sections from permission flags.
- [x] 4.2 Add journal authoring, edit, and delete interactions with a 2000-character counter, visibility selector, and safe plain-text rendering with preserved line breaks.
- [x] 4.3 Hide the friends journal section when friend entries are not visible under the viewer's current friendship and preview rules.

## 5. Validation Coverage

- [x] 5.1 Add Jest coverage for shared-goal identity across storylines, goal-scoped journal-state responses, personal and fellowship write access, friend visibility rules, plain-text validation, and route dispatch.
- [x] 5.2 Add Vitest coverage for GoalModal journal states in personal and fellowship contexts, including create, read, edit, delete, and hidden-friends states.
- [x] 5.3 Add Playwright coverage for personal journal authoring, fellowship-based journal authoring, and friend-entry visibility when milestone previews are enabled versus locked.

## 6. Documentation And Change Hygiene

- [x] 6.1 Update the relevant docs in `docs/` for the new journal schema, goal-scoped API shape, GoalModal behavior, and the MVP exclusion of a standalone My Journal page.
- [x] 6.2 Verify the journal modal changes remain compatible with the adjacent goal-content change surfaces and document any merge-order considerations in the change notes if needed.