## ADDED Requirements

### Requirement: Journal entries are unique per user and shared canonical goal
The system SHALL store at most one journal entry per user for a canonical goal, and that same entry SHALL be used wherever the shared goal appears across storylines.

#### Scenario: Shared goal shows the same journal across storylines
- **WHEN** a user writes a journal entry for a canonical goal on one storyline
- **THEN** opening the same canonical goal from another storyline shows the same journal entry instead of a separate storyline-specific entry

#### Scenario: Reopening an existing shared-goal journal does not create a duplicate
- **WHEN** a user revisits a canonical goal that already has their journal entry
- **THEN** the system returns the existing entry for that user and goal rather than creating another journal record

### Requirement: Goal-scoped journal state supports the milestone modal
The system SHALL expose goal-scoped journal state for the authenticated viewer, including the viewer's own journal entry for that goal if present, the currently visible friend entries for that goal, and the permission state needed to render GoalModal.

#### Scenario: Goal-scoped journal state returns own entry and permissions
- **WHEN** an authenticated user requests journal state for a goal they can open in GoalModal
- **THEN** the system returns the user's own journal entry for that goal if one exists and permission state indicating what journal actions are available

#### Scenario: Fellowship context is reflected in goal-scoped journal state
- **WHEN** an authenticated user requests journal state for a goal while viewing an eligible fellowship milestone context
- **THEN** the returned permission state reflects that fellowship context for journal reads and writes

#### Scenario: Empty journal state is returned without error
- **WHEN** an authenticated user requests journal state for a goal that has no own entry and no visible friend entries
- **THEN** the system returns an empty journal state rather than failing the milestone view

### Requirement: Users can create, update, and delete their own goal journal entry
The system SHALL allow an authenticated user to create or update their single journal entry for a goal and SHALL allow that same user to delete it later.

#### Scenario: First save creates a journal entry
- **WHEN** an authenticated user saves a valid journal entry for a goal that does not yet have their entry
- **THEN** the system stores a new journal entry for that user and goal

#### Scenario: Later save updates the existing journal entry
- **WHEN** an authenticated user saves a valid journal entry for a goal that already has their entry
- **THEN** the system updates the existing journal entry instead of creating another one

#### Scenario: Author can delete their own journal entry
- **WHEN** the author deletes their existing journal entry for a goal
- **THEN** the system removes that user's journal entry for that goal

### Requirement: Personal or fellowship reach grants journal write access
The system SHALL allow a user to author or update their goal journal entry when they have personally reached the goal or when an active fellowship context they are viewing has reached that goal and they are an active member of that fellowship.

#### Scenario: Personal progress grants write access
- **WHEN** a user has personally reached a goal in their active storyline context
- **THEN** the system allows that user to create or update their journal entry for the canonical goal

#### Scenario: Fellowship progress grants individual write access
- **WHEN** a user has not personally reached a goal but is actively viewing a fellowship context that has reached the same canonical goal and the user is an active member of that fellowship
- **THEN** the system allows that user to create or update their own journal entry for that goal

#### Scenario: Unreached personal and fellowship contexts deny write access
- **WHEN** a user has not personally reached a goal and is not in an active fellowship context that has reached it
- **THEN** the system denies journal creation or updates for that goal

### Requirement: Friend journal visibility follows friendship and milestone visibility rules
The system SHALL expose friend journal entries only from accepted friends and SHALL apply the viewer's milestone visibility preference to determine whether the viewer must also have reached the goal before reading them.

#### Scenario: Accepted friend entry is visible when previews are enabled
- **WHEN** the viewer and the author are accepted friends and the viewer has milestone previews enabled
- **THEN** the system returns the friend's journal entry for that goal even if the viewer has not yet reached it

#### Scenario: Accepted friend entry requires reach when previews are locked
- **WHEN** the viewer and the author are accepted friends, the viewer has milestone previews locked, and the viewer has reached the goal in the current reading context
- **THEN** the system returns the friend's journal entry for that goal

#### Scenario: Locked previews hide friend entry until the viewer reaches the goal
- **WHEN** the viewer and the author are accepted friends, the viewer has milestone previews locked, and the viewer has not reached the goal in the current reading context
- **THEN** the system does not return that friend's journal entry for the goal

#### Scenario: Non-friend entry is never visible
- **WHEN** the journal author is not an accepted friend of the viewer
- **THEN** the system does not return that journal entry in the viewer's friend journal list

### Requirement: Journal bodies remain plain text and safe to render
The system SHALL accept only non-empty plain-text journal bodies up to 2000 characters and SHALL render stored journal text without executing HTML or Markdown.

#### Scenario: Empty journal body is rejected
- **WHEN** a user submits a journal body that is empty after trimming
- **THEN** the system rejects the save request

#### Scenario: Overlength journal body is rejected
- **WHEN** a user submits a journal body longer than 2000 characters
- **THEN** the system rejects the save request

#### Scenario: HTML-like journal text renders as text
- **WHEN** a user stores journal text containing HTML-like or Markdown-like characters
- **THEN** the journal body is displayed as plain text rather than executed or rendered as markup

#### Scenario: Plain-text line breaks are preserved
- **WHEN** a user stores journal text containing line breaks
- **THEN** the journal body preserves those line breaks when displayed

### Requirement: GoalModal presents milestone journals in MVP
The system SHALL present journal authoring and visible friend journal reading inside GoalModal, using the goal-scoped journal state to choose between create, read, edit, delete, and hidden-section states.

#### Scenario: GoalModal shows create state when no own entry exists
- **WHEN** GoalModal opens for a goal and the viewer has no journal entry for that goal but has write access
- **THEN** the modal shows journal authoring controls with a character counter and visibility selector

#### Scenario: GoalModal shows read and edit state when own entry exists
- **WHEN** GoalModal opens for a goal and the viewer already has a journal entry for that goal
- **THEN** the modal shows the existing entry in read mode with actions to edit or delete it

#### Scenario: GoalModal shows visible friend entries newest first
- **WHEN** GoalModal opens for a goal and one or more friend journal entries are visible to the viewer
- **THEN** the modal shows those friend entries ordered from newest to oldest

#### Scenario: GoalModal hides the friends section when nothing is visible
- **WHEN** GoalModal opens for a goal and no friend journal entries are visible under the viewer's current access rules
- **THEN** the modal hides the friends journal section