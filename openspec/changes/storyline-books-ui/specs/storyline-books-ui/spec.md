## ADDED Requirements

### Requirement: Starting book selection in onboarding
The system SHALL let new users select a starting book when choosing their storyline, SHALL default to the first book, and SHALL not award skipped prior-book achievements.

#### Scenario: New user selects a starting book
- **GIVEN** a new user is setting up their storyline
- **WHEN** the user chooses a storyline with multiple books
- **THEN** a book selector is displayed alongside the storyline selector
- **AND** the first book is pre-selected by default

#### Scenario: Starting at a later book does not award skipped badges
- **GIVEN** a new user selects Book 3 as their starting book
- **WHEN** the selection is saved
- **THEN** no completion badges are awarded for Books 1 or 2
- **AND** book progress starts at 0 km for Book 3

### Requirement: Book display and switching on profile
The system SHALL display the active book alongside the active storyline on the profile page, SHALL offer book switching with reset and carry modes, and SHALL explain when carry mode is disabled.

#### Scenario: Profile shows active book
- **GIVEN** an authenticated user with an active book
- **WHEN** the profile page loads
- **THEN** the active book title and progress are displayed

#### Scenario: User switches book with reset mode
- **GIVEN** a user with 70 km progress in Book 2
- **WHEN** the user selects Book 3 and chooses reset
- **THEN** a new attempt is created for Book 3
- **AND** book progress resets to 0 km

#### Scenario: User switches book with carry mode
- **GIVEN** a user with 70 km progress in Book 2
- **WHEN** the user selects Book 3 and chooses carry
- **THEN** the carried progress is added to Book 3's starting state

#### Scenario: Carry mode is disabled and explained
- **GIVEN** a user whose carried progress exceeds the target book's length
- **WHEN** the user views book switch options
- **THEN** the carry option is greyed out with an explanation

### Requirement: Book switching on party management
The system SHALL let fellowship leaders switch the fellowship's active book with reset and carry modes, SHALL display the fellowship's active book, and SHALL show disabled carry explanations.

#### Scenario: Party management shows fellowship active book
- **GIVEN** a fellowship leader viewing party management with an active book
- **WHEN** the page loads
- **THEN** the active book title is displayed alongside the storyline

#### Scenario: Leader switches fellowship book with reset
- **GIVEN** a fellowship leader with book switching controls
- **WHEN** the leader selects a new book and chooses reset
- **THEN** a new fellowship attempt is created
- **AND** the fellowship's book progress resets

### Requirement: Current-book vs whole-story view mode
The system SHALL provide a toggle on the journey page to switch between whole-story view and current-book view, SHALL persist the choice using the same mechanism as the current view selection, and SHALL default to whole-story view.

#### Scenario: View mode toggle switches to book view
- **GIVEN** a user on the journey page in whole-story view
- **WHEN** the user toggles to book view
- **THEN** the total distance display switches from whole-story distance to book progress
- **AND** the view mode is persisted in localStorage

#### Scenario: View mode defaults to whole-story on first visit
- **GIVEN** a user visiting the journey page for the first time after books are enabled
- **WHEN** the page loads
- **THEN** the view mode defaults to whole-story view

### Requirement: Book-aware goals on the journey page
The system SHALL return all storyline goals with absolute story distances regardless of view mode, SHALL include book boundary metadata in the response when an active book exists, and SHALL compute book-relative distances and filter to the book's range client-side in book view.

#### Scenario: Goals response includes book boundary metadata
- **GIVEN** an authenticated user with an active book
- **WHEN** goals are fetched
- **THEN** the response includes `bookMetadata` with `bookStartDistance` and `bookEndDistance`
- **AND** all goals are returned with their absolute story distances

#### Scenario: Book view shows book-relative distances for goals within book range
- **GIVEN** a user in current-book view with a book starting at 180 km and ending at 350 km
- **WHEN** the goals list renders using the client-side `bookMetadata`
- **THEN** only goals within 180-350 km are displayed
- **AND** goal distances are shown relative to the book start (a 200 km goal shows as 20 km)
- **AND** the book start and end markers are rendered

#### Scenario: Story view shows all goals with absolute distances
- **GIVEN** a user in whole-story view
- **WHEN** the goals list renders
- **THEN** all storyline goals are displayed with their absolute distances
- **AND** the behavior is identical to before books were introduced

#### Scenario: Toggling view mode does not re-fetch goals
- **GIVEN** a user has already fetched goals
- **WHEN** the user toggles between story view and book view
- **THEN** the UI recomputes display from the already-fetched data
- **AND** no additional API call is made

### Requirement: Map milestone filtering by book
The system SHALL filter map milestones client-side to the active book's range in current-book view using `bookMetadata` from the goals response, SHALL include book and view mode in milestone cache keys, and SHALL show all storyline milestones in whole-story view.

#### Scenario: Map shows only active book milestones in book view
- **GIVEN** a user in current-book view on the map with `bookMetadata` from the goals response
- **WHEN** the map renders waypoints
- **THEN** only waypoints within `[bookStartDistance, bookEndDistance]` are displayed

#### Scenario: Milestone cache keys include book context
- **GIVEN** a user switches from Book 1 to Book 2
- **WHEN** the map reloads milestones
- **THEN** the cache is invalidated and Book 2's milestones are fetched
- **AND** stale Book 1 milestone data is not displayed

### Requirement: Social markers globally visible with storyline context
The system SHALL keep friend and fellowship markers visible on the map regardless of the viewer's current book, and SHALL include storyline context in marker labels.

#### Scenario: Friend marker shows whole-story distance and storyline
- **GIVEN** a friend at 634 km on the Pippin storyline
- **WHEN** the viewer's map renders friend markers
- **THEN** the friend marker shows "634 km as Pippin" regardless of the viewer's current book

#### Scenario: Friend marker is visible even outside viewer's current book range
- **GIVEN** a viewer in Book 1 (0-180 km) of Frodo/Sam
- **AND** a friend at 634 km on the Pippin storyline
- **WHEN** the map renders
- **THEN** the friend marker is still displayed at 634 km
