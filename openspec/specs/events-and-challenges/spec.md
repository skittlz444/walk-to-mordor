# events-and-challenges Specification

## Purpose
TBD - created by archiving change events-and-challenges. Update Purpose after archive.

## Requirements

### Requirement: Admin event management

The system SHALL provide admin APIs and dashboard surfaces for listing, creating, editing, enabling, disabling, and inspecting personal encounter definitions and community campaigns. Personal encounters are managed by `AdminEncountersIsland` on the `/admin` dashboard page, and community campaigns are managed by `AdminCommunityCampaignsIsland` on the same page; the two management surfaces need not be a single unified UI.

#### Scenario: Admin manages personal encounter template fields
- **GIVEN** an authenticated admin opens the admin dashboard
- **WHEN** the admin edits a personal encounter template in the encounters island
- **THEN** the UI allows management of event copy, image, eligible storylines, eligible path distance brackets, enabled state, duration, target min/max bracketing, and badge metadata

#### Scenario: Admin creates community campaign with suggested values
- **GIVEN** an authenticated admin opens the campaigns island on the admin dashboard
- **WHEN** the admin creates a community campaign
- **THEN** the UI displays suggested target and duration values based on recent community walking metrics
- **AND** the admin can override the suggested values before saving

#### Scenario: Non-admin cannot manage campaigns
- **GIVEN** an authenticated non-admin user
- **WHEN** the user calls an admin event management endpoint
- **THEN** the system denies the request

### Requirement: Event lifecycle settlement

The system SHALL process event lifecycle transitions through the existing daily scheduled run (09:00 UTC) without preventing existing scheduled notification jobs from running: community campaigns transition upcoming to active on their start date and active to expired after their end date when the target is unmet. Campaign completion SHALL be triggered synchronously during walk reconciliation, not by scheduled work. Personal challenge settlement remains specified by the `personal-challenges` capability.

#### Scenario: Upcoming campaign activates

- **GIVEN** a community campaign is upcoming and its start date has arrived (UTC)
- **WHEN** the daily scheduled run executes
- **THEN** the system marks the campaign active

#### Scenario: Active event closes after deadline

- **GIVEN** an active campaign whose end date has passed and whose community total is below target
- **WHEN** the daily scheduled run executes
- **THEN** the system marks the campaign expired
- **AND** no completion badges are awarded by the scheduled run

#### Scenario: Target-met campaign is not expired

- **GIVEN** an active campaign whose end date has passed but whose community total reached the target
- **WHEN** the daily scheduled run executes
- **THEN** the system does not mark the campaign expired

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

The system SHALL provide a public `/events` page for community campaigns plus authenticated personal-event surfaces for encounter offers on the journey and map pages. The public events page SHALL show community campaigns and the authenticated user's joined campaigns, but SHALL NOT show personal challenges.

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
- **THEN** the page shows that user's joined community campaigns
- **AND** personal challenges remain on their own surfaces rather than the public events page

#### Scenario: Achievements appear on profile surfaces

- **GIVEN** a user has earned one or more event achievements
- **WHEN** the user's profile or friend profile is viewed
- **THEN** earned event achievements are displayed with their names and visual badge metadata
