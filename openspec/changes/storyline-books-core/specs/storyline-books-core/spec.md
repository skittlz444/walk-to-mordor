## ADDED Requirements

### Requirement: Storyline book definitions and seeding
The system SHALL store storyline book definitions with ordered distance boundaries and optional milestone anchor references, SHALL seed six-book splits for the Frodo/Sam and Pippin storylines matching Lord of the Rings book endings, and SHALL provide fallback full-journey books for other public active storylines.

#### Scenario: Books seeded for Frodo/Sam storyline
- **WHEN** the application starts after migration
- **THEN** the Frodo/Sam storyline has six ordered books with distance boundaries and badge slugs

#### Scenario: Books seeded for Pippin storyline
- **WHEN** the application starts after migration
- **THEN** the Pippin storyline has six ordered books with distance boundaries based on Pippin's position at each book ending

#### Scenario: Public storyline without explicit books gets a fallback
- **GIVEN** a public active storyline without seeded book splits
- **WHEN** the migration runs
- **THEN** a single full-journey book is created covering the storyline's entire distance range

#### Scenario: Books have complete coverage validation enforced at public activation
- **GIVEN** a storyline has books with gaps or overlaps beyond shared endpoints
- **WHEN** an admin attempts to activate the storyline
- **THEN** the system rejects activation with coverage errors

### Requirement: Active book state
The system SHALL store active personal and fellowship book state explicitly in D1 tied to the active storyline, SHALL default new users to the first book of their storyline, SHALL update the active book when story distance crosses a book boundary during progress reconciliation, SHALL update the active book on explicit switch, and SHALL preserve active book state across devices.

#### Scenario: New user defaults to first book of their storyline
- **GIVEN** a new user who has just selected a storyline with multiple books
- **WHEN** their active book is initialized
- **THEN** the active book is set to the first book in that storyline's ordered list

#### Scenario: Active book is updated when story distance crosses a boundary
- **GIVEN** a user with story distance of 170 km and active book set to Book 1 (which ends at 180 km)
- **WHEN** the user logs a walk that pushes story distance to 185 km
- **THEN** the active book is updated to Book 2 (which starts at 180 km)

#### Scenario: Active book stays at final book beyond its end
- **GIVEN** a user has reached or exceeded the start distance of the final book
- **WHEN** further walks are logged
- **THEN** the active book remains at the final book

#### Scenario: Active book is recomputed after admin boundary changes
- **GIVEN** an admin adjusts book boundaries
- **WHEN** the user's active book state is recomputed
- **THEN** the active book is recalculated from the user's current story distance under the new boundaries
- **AND** earned achievements are not revoked

### Requirement: Book progress math
The system SHALL derive book progress from absolute story distance and book boundaries, SHALL present milestones relative to book start distance in current-book view, and SHALL support whole-story and current-book distance representations.

#### Scenario: Book progress is derived from story distance
- **GIVEN** a user with story distance 250 km
- **AND** the active book starts at 180 km and ends at 350 km
- **WHEN** book progress is calculated
- **THEN** book progress is 70 km (250 - 180)

#### Scenario: Book progress is clamped at zero for pre-book distances
- **GIVEN** a user with story distance 50 km on a new storyline
- **AND** the active book starts at 180 km
- **WHEN** book progress is calculated
- **THEN** book progress is 0 km

#### Scenario: Book progress is clamped at book length for post-book distances
- **GIVEN** a user with story distance 400 km
- **AND** the active book ends at 350 km
- **WHEN** book progress is calculated
- **THEN** book progress is 170 km (book length, not 220)

### Requirement: Book switching
The system SHALL support user and fellowship leader book switching with reset and carry modes, SHALL disable carry when the carried book progress exceeds the target book length, and SHALL not award skipped prior-book achievements.

#### Scenario: User switches books with reset mode
- **GIVEN** a user with 70 km progress in Book 2
- **WHEN** the user switches to Book 3 with reset mode
- **THEN** book progress starts at 0 km for Book 3
- **AND** no completion badge is awarded for Book 2 (it wasn't completed)

#### Scenario: User switches books with carry mode
- **GIVEN** a user with 70 km progress in Book 2
- **WHEN** the user switches to Book 3 with carry mode
- **THEN** the carried progress is added to Book 3's starting distance
- **AND** a new attempt record is created for Book 3

#### Scenario: Carry is disabled when progress exceeds target book length
- **GIVEN** a user with 200 km progress in Book 2 but Book 3 is only 150 km long
- **WHEN** the user attempts to switch to Book 3 with carry mode
- **THEN** carry mode is disabled
- **AND** an explanation is returned indicating carry would immediately complete Book 3

### Requirement: Personal book completion achievements
The system SHALL award a personal book completion badge when a user's story distance crosses the active book end during a distinct book attempt, SHALL never award the same attempt twice, and SHALL support repeatable completions through new attempts.

#### Scenario: Badge awarded when story distance crosses book end
- **GIVEN** a user has an active Book 2 attempt with 65 km progress
- **AND** Book 2 is 170 km long
- **WHEN** the user logs a walk that pushes their story distance past the book's end
- **THEN** the attempt is marked completed
- **AND** a completion badge is awarded via the shared achievement infrastructure

#### Scenario: Edit loop does not award duplicate badge for same attempt
- **GIVEN** a user has completed Book 2 and earned the badge
- **WHEN** the user edits a walk to move story distance below the book end and then above again
- **THEN** no second badge is awarded for the same attempt

#### Scenario: Reset and recompletion awards a new badge
- **GIVEN** a user who previously completed Book 2 and earned a badge
- **WHEN** the user resets to Book 2 and completes it again
- **THEN** a new attempt is created and a second badge is awarded upon completion

### Requirement: Fellowship book completion achievements
The system SHALL award fellowship book completion badges when a fellowship's story distance crosses the active book end, only to active members who contributed any distance to that book attempt before completion, tracked via a boolean `has_contributed` flag, and SHALL exclude departed members from future awards while preserving their previously earned badges.

#### Scenario: Fellowship book badge awarded to contributing members
- **GIVEN** a fellowship with 3 active members and a book attempt
- **AND** members A and B have `has_contributed = true`; member C has not
- **WHEN** the fellowship's story distance crosses the book end
- **THEN** members A and B receive the completion badge
- **AND** member C does not receive the badge

#### Scenario: Departed members keep earned badges but are excluded from future awards
- **GIVEN** a member who earned a fellowship book badge in Book 1
- **AND** the member has since left the fellowship
- **WHEN** the fellowship completes Book 2
- **THEN** the departed member does not receive the Book 2 badge
- **AND** the member's Book 1 badge remains in their earned achievements

### Requirement: Book-aware API responses
The system SHALL extend `/api/session` with a top-level `activeBook` field containing book ID, slug, title, progress, length, and badge slug, SHALL extend `/api/total-distance` with book progress, book length, and active book metadata, and SHALL extend `/api/goals` with an optional `viewMode` parameter that defaults to `story` (whole-story view) and supports `book` for book-relative filtering.

#### Scenario: Session response includes active book context as a top-level field
- **GIVEN** an authenticated user with an active book
- **WHEN** `GET /api/session` is called
- **THEN** the response includes `activeBook` with bookId, slug, title, bookProgress, bookLength, and badgeSlug
- **AND** the field is a sibling of `activeStoryline`, not nested inside it

#### Scenario: Total-distance response includes book-aware fields
- **GIVEN** an authenticated user with an active book
- **WHEN** `GET /api/total-distance` is called
- **THEN** the response includes `activeBook` with bookId, title, bookProgress, and bookLength
- **AND** the existing `totalDistance`, `rawTotalDistance`, and `activeStoryline` fields are preserved

#### Scenario: Goals response includes book boundary metadata
- **GIVEN** an authenticated user with an active book
- **WHEN** `GET /api/goals` is called
- **THEN** the response includes `bookMetadata` with `bookStartDistance` and `bookEndDistance`
- **AND** all goals are returned with absolute story distances
- **AND** the response is identical to current behavior when no active book exists

### Requirement: Admin storyline book APIs
The system SHALL provide admin APIs for listing, creating, updating, reordering, and validating storyline books, SHALL enforce public activation validation, and SHALL reject requests from non-admin users.

#### Scenario: Admin creates a book for a storyline
- **GIVEN** an authenticated admin
- **WHEN** the admin creates a new book with distance boundaries for a storyline
- **THEN** the book is created with ordered metadata

#### Scenario: Coverage validation catches gaps
- **GIVEN** a storyline with books
- **WHEN** the admin validates coverage
- **THEN** the system reports any gaps, overlaps, or out-of-range milestones

#### Scenario: Public activation is blocked without valid coverage
- **GIVEN** a storyline with gap-ridden or incomplete book coverage
- **WHEN** an admin attempts to make the storyline publicly active
- **THEN** the system rejects the activation

### Requirement: Migration backfill
The system SHALL backfill existing users once during migration by inferring active books from current story distance and awarding completed book achievements, and SHALL be idempotent.

#### Scenario: User backfill awards completed book badges
- **GIVEN** an existing user whose story distance has surpassed Book 1 and Book 2 endings
- **WHEN** the migration runs
- **THEN** Book 1 and Book 2 completion badges are awarded
- **AND** the active book is inferred as the next incomplete book

#### Scenario: Backfill does not award badge for the currently active incomplete book
- **GIVEN** an existing user partway through Book 3
- **WHEN** the migration runs
- **THEN** no badge is awarded for Book 3
- **AND** an active attempt is created for Book 3 with current progress
