## Why

Walk to Mordor already makes milestones feel social, but users still cannot leave their own reflections at the places they reach together. This change adds personal milestone journals so shared goals become shared storytelling moments, while fitting the repo's storyline-aware goal model and existing GoalModal experience.

## What Changes

- Introduce plain-text milestone journal entries stored once per user per canonical goal and shared across all storylines that reuse that goal.
- Add authenticated journal APIs for create, update, delete, own-entry reads, and friends' journal reads, with access rules derived from friendship, milestone visibility, and viewing context.
- Allow a user to create an individual journal entry when they have reached the goal personally or when an active fellowship context they are viewing has reached the same goal.
- Extend GoalModal to load the viewer's own journal state and friends' journals for the current goal, with character counting, visibility controls, safe plain-text rendering, and no standalone My Journal page in MVP.
- Reuse existing safe text and HTML sanitization patterns already adopted in adjacent goal-content work, while keeping journal bodies plain text only.
- Preserve compatibility across the app's hybrid goal surfaces, including legacy journey goals, map goal modals, walk congratulations, and fellowship milestone modals.

## Capabilities

### New Capabilities
- `goal-journals`: Plain-text user journal entries attached to canonical goals, including storyline-shared identity, personal and fellowship write access, friends-only visibility rules, and GoalModal reading and authoring for MVP.

### Modified Capabilities

None.

## Impact

- D1 schema: new `milestone_journals` table and supporting indexes, with journal identity centered on canonical `goal_id` so shared goals work across storylines.
- Worker APIs: new journal routes, route-method registration updates in `src/index.ts`, and storyline-aware plus fellowship-aware access checks.
- Frontend: `GoalModal` becomes the MVP journal surface across personal, map, and fellowship entry points; no dedicated `/journals` page or profile journal archive is included in this change.
- Shared client models: goal and modal context may need to preserve `storyline_goal_id` and optional fellowship context so journal reads and writes validate correctly.
- Testing and docs: new Jest, Vitest, and Playwright coverage plus updates to API, data-model, frontend, and architecture docs.