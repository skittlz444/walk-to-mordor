## Why

Walk to Mordor's main storylines (Frodo/Sam and Pippin) operate as one long route, making long journeys harder to reason about and causing milestone clumping where outward and return paths overlap. First-class storyline books let users and fellowship leaders start at meaningful story sections, focus progress on the current book, and earn durable completion badges — without changing raw walking history. This core change establishes the backend infrastructure for books, while user-facing and admin UI follow in separate changes.

## What Changes

- Add first-class `storyline_books` to D1 with stored distance boundaries and optional milestone anchor references, seeded with real six-book splits for the Frodo/Sam and Pippin storylines.
- Add active personal and fellowship book state in D1, with book inference from current story distance using next-book-at-boundary semantics.
- Add personal and fellowship book attempt tracking for idempotent, repeatable completion achievement awards.
- Implement book domain services: progress math, boundary inference, coverage validation, switch planning (reset/carry/disabled carry), attempt creation and completion detection.
- Extend `/api/session`, `/api/total-distance`, and `/api/goals` responses with book context without breaking existing whole-story behavior.
- Add authenticated user and fellowship leader book switch endpoints with reset and carry semantics.
- Add admin storyline book APIs for CRUD, validation, and public activation enforcement with coverage requirements.
- Hook personal and fellowship book completion detection into progress write flows and party progress synchronization.
- Award immutable, repeatable book completion badges via the shared achievement infrastructure.
- Backfill existing users once during migration: infer active books from current story distance and award completed book achievements.

## Capabilities

### New Capabilities
- `storyline-books-core`: First-class storyline book definitions, active book state, book attempt tracking with idempotent achievement awards, book-aware API responses, book switching (reset/carry), admin book APIs with coverage validation, and one-time migration backfill.

### Modified Capabilities
- None.

## Impact

- D1 schema: new tables for `storyline_books`, user and party active book state, personal and fellowship book attempts, and fellowship book contribution tracking. No changes to the `progress` table or raw walking data.
- Worker APIs: extend `/api/session`, `/api/total-distance`, and `/api/goals` with book context; add user and fellowship leader book switch endpoints; add admin storyline book CRUD with validation and coverage enforcement.
- Progress hooks: extend `src/progress-handlers.ts` for personal book completion detection; extend party progress synchronization for fellowship book contribution tracking and completion detection.
- Badge definitions: create book completion badge definitions via seed migration, using the shared `achievement_definitions` table from `shared-achievement-infrastructure`. Achievement awards use the shared `awardAchievement()` service.
- Migration: one-time backfill infers active books from current story distance and awards completed book achievements to existing users and fellowships.
- Tests: Jest coverage for domain services, API handlers, progress hooks, and migration backfill. No UI/client tests in this change.
- Documentation: update `docs/data-models.md`, `docs/api-reference.md`, and `docs/architecture.md`.
