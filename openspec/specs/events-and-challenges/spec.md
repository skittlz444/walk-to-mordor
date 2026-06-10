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

### Requirement: Daily personal encounter rolls
The system SHALL roll for personal encounter offers at most once per authenticated user per UTC day, SHALL return the same roll result for repeated roll requests on that date, SHALL use defined probability branches based on recent encounter history, and SHALL not offer personal encounters to users below the minimum recent-activity threshold.

#### Scenario: First daily roll returns an offer or no-offer result
- **GIVEN** an authenticated user has not rolled for a personal encounter today
- **WHEN** the daily roll endpoint is called
- **THEN** the system records the roll for that user and date
- **AND** the response indicates either no encounter or one eligible encounter offer

#### Scenario: Higher base chance after no recent encounter
- **GIVEN** a user meets the recent-activity threshold
- **AND** the user has not accepted or declined a personal encounter in the past 30 days
- **WHEN** the daily roll endpoint evaluates the user's chance
- **THEN** the system uses the 1-in-10 probability branch

#### Scenario: Lower repeat chance after recent encounter
- **GIVEN** a user meets the recent-activity threshold
- **AND** the user has accepted or declined a personal encounter in the past 30 days
- **WHEN** the daily roll endpoint evaluates the user's chance
- **THEN** the system uses the 1-in-30 probability branch

#### Scenario: Repeated daily roll is idempotent
- **GIVEN** an authenticated user has already rolled for a personal encounter today
- **WHEN** the daily roll endpoint is called again
- **THEN** the system returns the existing roll result without rolling again

#### Scenario: Active personal challenge suppresses new offers
- **GIVEN** a user already has an active personal challenge
- **WHEN** the daily roll endpoint is called
- **THEN** the system does not offer a new personal encounter

#### Scenario: Insufficient activity history prevents personal encounter roll
- **GIVEN** a user has fewer than 7 walks in the past 30 days
- **AND** the user has fewer than 3 walks in the past 7 days
- **WHEN** the daily roll endpoint is called
- **THEN** the system returns no personal encounter offer

### Requirement: Contextual personal encounter eligibility
The system SHALL evaluate personal encounter eligibility from template rules that can include user activity, active storyline, route segment, milestone context, active challenge state, eligible storylines, eligible path distance brackets, and template cooldowns.

#### Scenario: Storyline-specific encounter eligibility
- **GIVEN** a personal encounter template is limited to a specific storyline or route segment
- **WHEN** a user outside that context receives a daily roll
- **THEN** that encounter template is not eligible for the user

#### Scenario: Future personal encounters can reuse the same roll system
- **GIVEN** multiple active personal encounter templates exist
- **WHEN** a user rolls for an encounter
- **THEN** the system chooses from templates that are eligible for that user's current context and cooldown state

#### Scenario: Nazgul template is globally eligible in the first pass
- **GIVEN** the seeded Nazgul pursuit template is enabled
- **WHEN** an otherwise eligible user rolls on any active storyline or path distance segment
- **THEN** the Nazgul template remains eligible without storyline or path-distance restriction

### Requirement: Personal encounter choice
The system SHALL let a user accept or decline an offered personal encounter, and declining an encounter SHALL carry no penalty and SHALL prevent another roll for that user on the same UTC day.

#### Scenario: User accepts a Nazgul pursuit
- **GIVEN** the user is offered the Nazgul pursuit encounter
- **WHEN** the user chooses to outrun the threat
- **THEN** the system starts a timed personal challenge for that user
- **AND** the response includes the target distance, deadline, reward, and event copy needed by the client UI

#### Scenario: User declines a Nazgul pursuit
- **GIVEN** the user is offered the Nazgul pursuit encounter
- **WHEN** the user chooses to hide
- **THEN** the system records the encounter as declined
- **AND** no personal challenge is created
- **AND** the user cannot receive another personal encounter roll until the next UTC day

### Requirement: Personalized challenge targets
The system SHALL calculate accepted personal challenge target distances only for users who meet the minimum recent-activity threshold, using the user's average distance across active walking days plus template-defined stretch and min/max bracketing so challenges are motivating but not punitive.

#### Scenario: Target uses recent activity baseline
- **GIVEN** a user has at least 7 walks in the past 30 days or at least 3 walks in the past 7 days
- **AND** the user accepts a personal challenge
- **WHEN** the challenge starts
- **THEN** the target distance is derived from the user's average distance on active walking days and the template's stretch configuration

#### Scenario: Personal target is bounded by template brackets
- **GIVEN** an eligible user accepts a personal challenge
- **WHEN** the target distance is calculated
- **THEN** the final target remains within the template's configured minimum and maximum bounds

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

### Requirement: Progress accounting
The system SHALL credit event progress from canonical walk logs and SHALL keep participant progress consistent when eligible walks are created, edited, or deleted.

#### Scenario: Walk logged after joining counts
- **GIVEN** a user has accepted a personal challenge or joined a community campaign
- **WHEN** the user logs a walk after joining and before the event deadline
- **THEN** the walk contributes to that event participant's progress

#### Scenario: Walk logged before joining does not count
- **GIVEN** a user joins an event after previously logging a walk
- **WHEN** event progress is calculated
- **THEN** the pre-join walk does not contribute to that event participant's progress

#### Scenario: Edited walk reconciles progress
- **GIVEN** a walk has already contributed to an event participant's progress
- **WHEN** the user edits that walk's distance
- **THEN** the participant's event progress reflects the edited distance exactly once

#### Scenario: Deleted walk reconciles progress
- **GIVEN** a walk has already contributed to an event participant's progress
- **WHEN** the user deletes that walk
- **THEN** the walk no longer contributes to the participant's event progress

### Requirement: Personal challenge outcomes
The system SHALL complete a personal challenge when the participant reaches its target before the deadline and SHALL fail the challenge when the deadline passes without completion.

#### Scenario: Personal challenge completed before deadline
- **GIVEN** a user has an active personal challenge
- **WHEN** credited progress reaches or exceeds the target distance before the deadline
- **THEN** the system marks the participant completed
- **AND** the system awards the configured completion achievement exactly once

#### Scenario: Personal challenge fails after deadline
- **GIVEN** a user has an active personal challenge below the target distance
- **WHEN** the challenge deadline passes
- **THEN** the system marks the participant failed
- **AND** the user receives no completion achievement for that challenge

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

