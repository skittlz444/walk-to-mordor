# storyline-books Specification

## Purpose
TBD - created by archiving change storyline-books-and-achievements. Update Purpose after archive.
## Requirements
### Requirement: Storylines define first-class books
The system SHALL model books as first-class ordered segments of a storyline with stored start and end distances, display metadata, optional boundary milestone anchors, and completion badge metadata.

#### Scenario: Public storyline requires complete book coverage
- **GIVEN** an admin attempts to make a storyline publicly active
- **WHEN** the storyline has book ranges that do not cover the full storyline distance
- **THEN** the system rejects the activation and returns validation errors for the uncovered ranges

#### Scenario: Public storyline rejects overlapping books
- **GIVEN** an admin attempts to make a storyline publicly active
- **WHEN** two books overlap beyond a shared endpoint boundary
- **THEN** the system rejects the activation and returns validation errors for the overlapping ranges

#### Scenario: Admin-only storyline may be incomplete
- **GIVEN** a storyline is admin-only
- **WHEN** an admin saves books with gaps, overlaps, or milestones outside book ranges
- **THEN** the system stores the draft book data without making it visible to regular users

#### Scenario: Shared boundary milestone belongs to both books
- **GIVEN** Book 1 ends at the same distance where Book 2 starts
- **AND** a milestone exists at that shared boundary distance
- **WHEN** the system lists milestones for either book
- **THEN** the boundary milestone appears in both book milestone lists

### Requirement: New users can start at a selected book
The system SHALL let a new user choose a storyline and starting book, and starting at a later book SHALL set story distance to the book start, set current-book progress to 0 km, and not award skipped prior-book achievements.

#### Scenario: New user starts at Book 2
- **GIVEN** a new user selects a storyline and Book 2 during setup
- **WHEN** the setup is saved
- **THEN** the user's story distance starts at Book 2's start distance
- **AND** the user's active book is Book 2
- **AND** the user's current-book progress is 0 km
- **AND** the user receives no Book 1 completion achievement

#### Scenario: Prior milestones are completed in whole-story view
- **GIVEN** a user started at Book 2
- **WHEN** the user views the whole-story milestone list
- **THEN** milestones before Book 2's start distance are shown as completed based on the user's story distance

### Requirement: Users can switch active books
The system SHALL let an existing user switch to another book using reset or carry behavior, and SHALL disable carry when current-book progress is greater than or equal to the target book length.

#### Scenario: User resets into another book
- **GIVEN** a user has selected a target book
- **WHEN** the user chooses reset
- **THEN** the user's story distance becomes the target book's start distance
- **AND** the user's current-book progress becomes 0 km
- **AND** a new personal book attempt is created without awarding a completion achievement

#### Scenario: User carries current book progress into another book
- **GIVEN** a user's current-book progress is less than the target book length
- **WHEN** the user chooses carry
- **THEN** the user's story distance becomes the target book's start distance plus the carried book progress
- **AND** the user's current-book progress on the target book equals the carried book progress
- **AND** a new personal book attempt is created without awarding a completion achievement

#### Scenario: Carry is disabled when progress would complete target book
- **GIVEN** a user's current-book progress is greater than or equal to the target book length
- **WHEN** the user is offered switch actions for the target book
- **THEN** the carry action is disabled
- **AND** the UI explains that carried progress would place the user at or beyond the book end

### Requirement: Active book is inferred from story distance
The system SHALL infer a user's or fellowship's active book from absolute story distance whenever book boundaries change, and SHALL use the next book when story distance exactly equals a shared book boundary.

#### Scenario: Exact boundary advances to next book
- **GIVEN** Book 1 ends at the same distance where Book 2 starts
- **WHEN** a user's story distance equals that shared boundary distance
- **THEN** the user's active book is Book 2

#### Scenario: Final book remains active at the end
- **GIVEN** a user is on the final book of a storyline
- **WHEN** the user's story distance is at or beyond the final book's end distance
- **THEN** the final book remains the inferred active book

#### Scenario: Boundary edit recalculates active books
- **GIVEN** an admin changes public book boundaries
- **WHEN** the change is saved
- **THEN** existing users and fellowships keep their story distance and earned achievements
- **AND** their active books are recalculated from their story distance under the new boundaries

### Requirement: Current-book and whole-story views
The system SHALL support whole-story view and current-book view for personal and fellowship journey presentation, with current-book view using book-relative distance and whole-story view using absolute story distance.

#### Scenario: Current-book view shows relative progress
- **GIVEN** a user is 25 km into a book that starts at 100 km
- **WHEN** the user selects current-book view
- **THEN** the displayed journey progress is 25 km
- **AND** milestones in that book display distances relative to the book start

#### Scenario: Whole-story view shows absolute progress
- **GIVEN** a user is 25 km into a book that starts at 100 km
- **WHEN** the user selects whole-story view
- **THEN** the displayed journey progress is 125 km
- **AND** milestones display absolute storyline distances

#### Scenario: Boundary milestones use book-relative labels
- **GIVEN** a book starts at a boundary milestone and ends at another boundary milestone
- **WHEN** the user views that book in current-book view
- **THEN** the start boundary milestone is labelled 0 km
- **AND** the end boundary milestone is labelled with the book length

#### Scenario: View mode is remembered at existing view-selection scope
- **GIVEN** the user changes between current-book view and whole-story view
- **WHEN** the user returns to the same journey context
- **THEN** the selected view mode is remembered using the same persistence scope as the app's current personal-versus-fellowship view selection

### Requirement: Book-aware milestone and map presentation
The system SHALL filter journey and map milestones to the active book in current-book view while keeping all relevant social markers visible with whole-story distance and storyline context.

#### Scenario: Book view filters journey milestones
- **GIVEN** a user is viewing Book 2 in current-book view
- **WHEN** the journey milestone list loads
- **THEN** the list includes milestones whose distances fall within Book 2's inclusive start and end boundaries
- **AND** milestones outside Book 2 are not shown in that list

#### Scenario: Whole-story view shows full storyline milestones
- **GIVEN** a user is viewing a storyline in whole-story view
- **WHEN** the journey milestone list loads
- **THEN** the list includes milestones from the full active storyline

#### Scenario: Map book view filters waypoint milestones
- **GIVEN** a user is viewing Book 2 in current-book view
- **WHEN** the map loads milestone waypoints
- **THEN** only Book 2 milestone waypoints are rendered as storyline waypoints

#### Scenario: Social markers remain visible outside current book
- **GIVEN** a friend or fellowship is outside the viewer's current book range
- **WHEN** the map renders social markers
- **THEN** the friend or fellowship marker remains visible
- **AND** the marker label includes whole-story distance and storyline context, such as `634 km as Pippin`

### Requirement: Personal book attempts award repeatable achievements
The system SHALL award personal book completion achievements through attempt-scoped idempotency, allowing intentional repeat completions while preventing repeated awards from progress edits within the same attempt.

#### Scenario: Crossing active book end awards personal badge
- **GIVEN** a user has an active personal book attempt
- **WHEN** the user's story distance crosses from below the active book end to at or beyond the active book end
- **THEN** the system awards the configured personal book completion achievement once for that attempt
- **AND** the achievement remains visible on profile surfaces

#### Scenario: Progress edit cannot farm same attempt badge
- **GIVEN** a user has already earned a completion achievement for a book attempt
- **WHEN** the user edits or deletes walks so progress falls below the book end and later rises above it again
- **THEN** the system does not award another achievement for the same attempt

#### Scenario: Reset enables a future repeat badge
- **GIVEN** a user has completed a book and earned its achievement
- **WHEN** the user explicitly resets into that book again
- **THEN** the system creates a new personal book attempt
- **AND** the user may earn another instance of that book achievement by completing the new attempt

#### Scenario: Boundary edits do not revoke badges
- **GIVEN** a user has earned a personal book completion achievement
- **WHEN** an admin later changes that book's boundary distances
- **THEN** the earned achievement remains visible and is not revoked

### Requirement: Fellowship book attempts award contributor achievements
The system SHALL support leader-controlled fellowship book attempts and SHALL award fellowship book completion achievements to active members who contributed distance to the completed fellowship book attempt.

#### Scenario: Leader resets fellowship into a book
- **GIVEN** a fellowship leader selects a target book
- **WHEN** the leader chooses reset
- **THEN** the fellowship story distance becomes the target book's start distance
- **AND** a new fellowship book attempt is created without awarding completion achievements

#### Scenario: Leader carries fellowship progress into another book
- **GIVEN** the fellowship's current-book progress is less than the target book length
- **WHEN** the leader chooses carry
- **THEN** the fellowship story distance becomes the target book's start distance plus the carried book progress
- **AND** a new fellowship book attempt is created without awarding completion achievements

#### Scenario: Fellowship completion awards active contributors
- **GIVEN** a fellowship has an active book attempt
- **AND** an active member has contributed distance to that fellowship book attempt
- **WHEN** the fellowship story distance crosses the book end
- **THEN** the system awards that member the configured fellowship book completion achievement once for the attempt

#### Scenario: Late joiner can earn fellowship badge after contributing
- **GIVEN** a user joins a fellowship after the fellowship has already started a book attempt
- **AND** the user contributes distance before the fellowship completes the book
- **WHEN** the fellowship crosses the book end while the user is an active member
- **THEN** the user receives the fellowship book completion achievement

#### Scenario: Departed member is not eligible for future fellowship badge
- **GIVEN** a user contributed distance to a fellowship book attempt and then left the fellowship before completion
- **WHEN** the fellowship later crosses the book end
- **THEN** the departed user does not receive the fellowship book completion achievement
- **AND** any fellowship achievements the user earned before departure remain visible

### Requirement: Book-aware APIs expose consistent context
The system SHALL expose active storyline, active book, story distance, book progress, view-ready milestone data, and switch availability through authenticated APIs without requiring clients to duplicate book math.

#### Scenario: Session includes active book context
- **GIVEN** an authenticated user has an active storyline and active book
- **WHEN** the session endpoint is requested
- **THEN** the response includes the active storyline and active book metadata needed by client islands

#### Scenario: Total distance includes story and book distances
- **GIVEN** an authenticated user has an active book
- **WHEN** the total-distance endpoint is requested
- **THEN** the response includes whole-story distance, current-book progress, active book length, and active book metadata

#### Scenario: Goals endpoint supports book-aware presentation
- **GIVEN** an authenticated user requests goals for current-book view
- **WHEN** the goals endpoint responds
- **THEN** the returned goals are limited to the active book and include display distances relative to the book start

#### Scenario: Switch options explain disabled carry
- **GIVEN** a target book is selected for user or fellowship switching
- **WHEN** carry is not allowed because progress is greater than or equal to target book length
- **THEN** the API or client state exposes enough information to disable carry and show the explanation

### Requirement: Admins manage book boundaries and badges in storylines
The system SHALL let admins create, update, reorder, validate, and inspect storyline books from the storylines admin area, using milestone anchors as editing aids while storing distances as the authoritative boundaries.

#### Scenario: Admin chooses boundary milestone anchors
- **GIVEN** an admin edits a storyline book
- **WHEN** the admin selects start and end milestone anchors
- **THEN** the system stores the corresponding start and end distances as the book boundary source of truth

#### Scenario: Admin edits stored boundary distance
- **GIVEN** an admin edits a book boundary distance directly
- **WHEN** the book is saved
- **THEN** the stored distance is used for validation, display, active-book inference, and completion checks

#### Scenario: Admin configures completion badge metadata
- **GIVEN** an admin edits a storyline book
- **WHEN** the admin saves badge metadata for personal and fellowship completion
- **THEN** future completion achievements for that book use the saved badge metadata

#### Scenario: Admin sees validation before public activation
- **GIVEN** a storyline has invalid book coverage
- **WHEN** an admin views or saves the storyline
- **THEN** the admin UI reports coverage, overlap, and out-of-range milestone validation errors before public activation is allowed

### Requirement: Migration seeds and backfills book state
The system SHALL migrate existing data to book-aware storylines by seeding real book splits for Frodo/Sam and Pippin, inferring active books from current story distance, and awarding one-time backfill achievements for already completed books.

#### Scenario: Frodo/Sam receives six book splits
- **GIVEN** the migration runs
- **WHEN** the Frodo/Sam storyline is present
- **THEN** the system creates six book records matching the six Lord of the Rings book sections on the Frodo/Sam route

#### Scenario: Pippin receives six book splits
- **GIVEN** the migration runs
- **WHEN** the Pippin storyline is present
- **THEN** the system creates six book records based on Pippin's position at the end of each Lord of the Rings book section

#### Scenario: Existing user receives completed-book backfill once
- **GIVEN** an existing user's current story distance is past one or more book end distances
- **WHEN** the migration backfill runs
- **THEN** the user receives one personal completion achievement for each completed book up to their current story position
- **AND** the backfill does not create repeated achievements if rerun

#### Scenario: Existing active book is inferred during migration
- **GIVEN** an existing user's current story distance falls inside or exactly on a book boundary
- **WHEN** the migration backfill runs
- **THEN** the user's active book is inferred using the same next-book-at-boundary rule as normal active-book inference

#### Scenario: Existing fellowship backfill respects contribution eligibility
- **GIVEN** an existing active fellowship has completed one or more books by current fellowship story distance
- **WHEN** the migration backfill can identify active members with qualifying contribution history
- **THEN** the system awards one fellowship completion achievement per completed book to each qualifying active contributor
- **AND** the backfill does not award departed members new fellowship achievements

