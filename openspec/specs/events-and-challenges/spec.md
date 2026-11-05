# events-and-challenges Specification

## Purpose
TBD - created by archiving change events-and-challenges. Update Purpose after archive.

## Requirements

### Requirement: Event templates and occurrences
The system SHALL define reusable event templates separately from concrete event occurrences so personal encounters and community campaigns can share participation, progress, lifecycle, and achievement behavior while preserving their distinct trigger models.

#### Scenario: Personal encounter template can create user-specific occurrence
- **GIVEN** an active personal encounter template is eligible for a user
- **WHEN** the user accepts the offered encounter
- **THEN** the system creates a user-specific timed occurrence and participant record for that user

#### Scenario: Community campaign uses crafted occurrence
- **GIVEN** an admin creates a community campaign
- **WHEN** the campaign is saved
- **THEN** the system stores a concrete occurrence with its configured name, description, target distance, start time, end time, and reward configuration

#### Scenario: Repeatable personal encounter creates distinct occurrences
- **GIVEN** a user has already completed a repeatable personal encounter template in the past
- **WHEN** the same template is offered again and the user accepts it on a later eligible roll
- **THEN** the system creates a new personal occurrence distinct from the prior completion

### Requirement: Event participation
The system SHALL let authenticated users join active or upcoming community campaigns once, SHALL let users view their participation status, and SHALL reject duplicate active participation.

#### Scenario: User joins community campaign
- **GIVEN** an authenticated user views an active or upcoming community campaign they have not joined
- **WHEN** the user joins the campaign
- **THEN** the system creates one participant record for that user and campaign
- **AND** subsequent event list and detail responses show the user as joined

#### Scenario: Duplicate join is rejected
- **GIVEN** a user has already joined a community campaign
- **WHEN** the user tries to join the same campaign again
- **THEN** the system rejects the duplicate join without changing the existing participant record

### Requirement: Admin event management
The system SHALL provide admin APIs and a first-pass admin UI for listing, creating, editing, enabling, disabling, and inspecting both personal encounter templates and community campaigns.

#### Scenario: Admin manages personal encounter template fields
- **GIVEN** an authenticated admin opens the event management UI
- **WHEN** the admin edits a personal encounter template
- **THEN** the UI allows management of event copy, image, eligible storylines, eligible path distance brackets, enabled state, duration, target min/max bracketing, and badge metadata

#### Scenario: Admin creates community campaign with suggested values
- **GIVEN** an authenticated admin opens the event management UI
- **WHEN** the admin creates a community campaign
- **THEN** the UI displays suggested target and duration values based on recent community walking metrics
- **AND** the admin can override the suggested values before saving

#### Scenario: Non-admin cannot manage campaigns
- **GIVEN** an authenticated non-admin user
- **WHEN** the user calls an admin event management endpoint
- **THEN** the system denies the request

### Requirement: Community campaign progress and contributors
The system SHALL expose community campaign progress publicly, including total distance, target distance, participant count, public contributor rankings with exact contribution distances, and the current user's contribution when authenticated.

#### Scenario: Public viewer sees community progress
- **GIVEN** a community campaign is publicly visible
- **WHEN** any user views campaign progress
- **THEN** the response includes total community distance, target distance, participant count, time remaining, and top contributors with contribution distances

#### Scenario: Authenticated participant also sees personal contribution
- **GIVEN** an authenticated user has joined a community campaign
- **WHEN** the user views campaign progress
- **THEN** the response includes the current user's contribution in addition to public community progress fields

#### Scenario: Community campaign completes at target
- **GIVEN** an active community campaign with a target distance
- **WHEN** participant contributions reach or exceed the target distance
- **THEN** the system marks the campaign completed
- **AND** contributors receive the configured community achievement exactly once

### Requirement: Event lifecycle settlement
The system SHALL process event lifecycle transitions and outcome settlement through scheduled work without preventing existing scheduled notification jobs from running.

#### Scenario: Upcoming campaign activates
- **GIVEN** a community campaign is upcoming and its start time has passed
- **WHEN** scheduled event processing runs
- **THEN** the system marks the campaign active

#### Scenario: Active event closes after deadline
- **GIVEN** an event is active and its end time has passed
- **WHEN** scheduled event processing runs
- **THEN** the system settles participant outcomes for that event
- **AND** the system marks the event completed or expired according to its progress and outcome rules

#### Scenario: Event settlement failure is isolated
- **GIVEN** event lifecycle processing encounters an error
- **WHEN** scheduled Worker processing continues
- **THEN** existing scheduled push notification jobs are not blocked by the event error

### Requirement: Immutable and repeatable achievements
The system SHALL preserve earned achievements after they are awarded, even if later walk edits or deletes reduce the progress that originally caused the award, and SHALL aggregate repeated awards of the same repeatable badge for display.

#### Scenario: Achievement remains after contributing walk is edited
- **GIVEN** a user has earned an event achievement
- **WHEN** the user edits or deletes a walk that contributed to earning it
- **THEN** the achievement remains visible on the user's profile surfaces

#### Scenario: Repeatable badge count increases on repeated completion
- **GIVEN** a user has already earned a repeatable personal-event badge once
- **WHEN** the user completes another occurrence of the same repeatable personal event
- **THEN** the system records another earned instance
- **AND** profile surfaces display the badge with an incremented earned count

### Requirement: Event presentation
The system SHALL provide public community event surfaces plus authenticated personal-event surfaces for encounter offers, active and past events, event details, and achievement display.

#### Scenario: Encounter offer is shown only on journey and map pages
- **GIVEN** the daily roll endpoint returns a personal encounter offer
- **WHEN** the authenticated journey page or map page initializes
- **THEN** the user sees themed encounter text with explicit accept and decline actions

#### Scenario: Public user views events page
- **GIVEN** any user opens the events page
- **WHEN** event data loads
- **THEN** the page shows public community campaigns, community progress, and relevant public past outcomes

#### Scenario: Authenticated user sees personal event state on events page
- **GIVEN** an authenticated user opens the events page
- **WHEN** event data loads
- **THEN** the page also shows that user's active personal challenges and joined community campaigns

#### Scenario: Achievements appear on profile surfaces
- **GIVEN** a user has earned one or more event achievements
- **WHEN** the user's profile or friend profile is viewed
- **THEN** earned event achievements are displayed with their names and visual badge metadata
