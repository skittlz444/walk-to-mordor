## ADDED Requirements

### Requirement: Admin campaign definition CRUD
The system SHALL provide admin APIs to list, create, read, update, enable, and disable community campaign definitions, and SHALL reject requests from non-admin users.

#### Scenario: Admin lists all campaign definitions
- **GIVEN** an authenticated admin
- **WHEN** the admin calls `GET /api/admin/campaigns`
- **THEN** the response includes all campaign definitions with their current fields and enabled state

#### Scenario: Admin creates a valid campaign definition
- **GIVEN** an authenticated admin submits valid campaign fields including badge slug, name, description, image, target distance, start date, and end date
- **WHEN** the admin calls `POST /api/admin/campaigns`
- **THEN** the campaign is created with enabled=false
- **AND** if the badge slug does not exist in achievement_definitions, a new achievement definition row is auto-created from the inline badge fields
- **AND** an audit log entry is recorded

#### Scenario: Admin updates an existing campaign
- **GIVEN** an existing campaign definition
- **WHEN** an admin calls `PUT /api/admin/campaigns/:id` with updated fields
- **THEN** the campaign is updated
- **AND** the linked badge definition is updated if inline badge fields changed
- **AND** an audit log entry is recorded

#### Scenario: Admin enables a campaign
- **GIVEN** a disabled campaign definition
- **WHEN** an admin calls `PUT /api/admin/campaigns/:id/enable`
- **THEN** the campaign's enabled flag is set to true
- **AND** an audit log entry is recorded

#### Scenario: Admin disables a campaign with no active participants
- **GIVEN** an enabled campaign definition with no participants
- **WHEN** an admin calls `PUT /api/admin/campaigns/:id/disable`
- **THEN** the campaign's enabled flag is set to false
- **AND** an audit log entry is recorded

#### Scenario: Admin disables a campaign with active participants
- **GIVEN** an enabled campaign definition with active participants
- **WHEN** an admin calls `PUT /api/admin/campaigns/:id/disable`
- **THEN** the API returns the count of active participants and requires a confirmation body parameter
- **AND** `{ cancelActive: true }` disables the campaign and marks active participants `status='removed'` without deleting ledger rows or earned badges
- **OR** `{ cancelActive: false }` disables the campaign while leaving participant rows untouched
- **AND** the disabled campaign is frozen: no crediting, completion, lifecycle transitions, or joining until re-enabled

#### Scenario: Admin re-enables a campaign
- **GIVEN** a disabled campaign with existing participants and in-window walks
- **WHEN** an admin calls `PUT /api/admin/campaigns/:id/enable`
- **THEN** the campaign becomes publicly visible and joinable again
- **AND** the campaign backfill credits in-window walks without requiring walk re-saves

#### Scenario: Non-admin cannot manage campaign definitions
- **GIVEN** an authenticated non-admin user
- **WHEN** the user calls any `/api/admin/campaigns` endpoint
- **THEN** the system returns a 403 error

### Requirement: Community metric suggestions
The system SHALL provide an admin endpoint that calculates suggested campaign target distance and expected participant count from the last 30 days of community walking data, using an admin-supplied duration (default 14 days) and a documented 0.25 opt-in assumption.

#### Scenario: Admin requests metric suggestions
- **GIVEN** an authenticated admin
- **WHEN** the admin calls `GET /api/admin/campaigns/suggestions`
- **THEN** the response includes suggested target distance, suggested duration in days, suggested participant count, and the raw community totals used for the calculation
- **AND** the suggested target equals `total / max(activeUsers, 1) * durationDays * 0.25`, rounded to the nearest kilometer

### Requirement: Admin campaign management UI
The system SHALL render a community campaign management section on the admin dashboard page showing the list of existing campaign definitions with their enabled state and active participant count, SHALL provide inline forms for creating and editing campaigns with inline badge metadata fields and field-level validation feedback, and SHALL show a confirmation modal when disabling a campaign that has active participants. The MVP SHALL NOT include a participant roster.

#### Scenario: Admin dashboard shows campaign definitions list
- **GIVEN** an authenticated admin loads the admin dashboard
- **WHEN** the page initializes
- **THEN** a list of existing community campaign definitions is displayed below the dashboard stats and encounters
- **AND** each campaign shows its name, slug, target distance, dates, enabled/disabled state, badge name, and active participant count

#### Scenario: Admin creates a new campaign via the dashboard
- **GIVEN** an admin views the campaign management section on the dashboard
- **WHEN** the admin fills in the create form with valid values including inline badge fields and submits
- **THEN** a new campaign is created
- **AND** a corresponding badge definition is created or linked
- **AND** it appears in the campaign list

#### Scenario: Admin creates a campaign with metric suggestion assistance
- **GIVEN** an admin opens the campaign create form
- **WHEN** the admin clicks a "Get Suggestions" button
- **THEN** the form fields for target distance, start date, and end date are pre-filled with suggested values
- **AND** the admin can override any suggested value

#### Scenario: Admin edits an existing campaign via the dashboard
- **GIVEN** an admin views an existing campaign in the list
- **WHEN** the admin opens the edit form, changes fields including badge metadata, and submits
- **THEN** the campaign is updated
- **AND** the list reflects the changes

#### Scenario: Admin toggles a campaign's enabled state
- **GIVEN** an admin views the campaign definitions list
- **WHEN** the admin clicks the enable or disable action on a campaign with no active participants
- **THEN** the campaign's enabled state changes
- **AND** the list row updates to reflect the new state

#### Scenario: Disable confirmation modal appears for active participants
- **GIVEN** an admin clicks disable on a campaign that has active participants
- **WHEN** the API response indicates active participants exist
- **THEN** a confirmation modal is shown with the count of affected participants
- **AND** the admin can choose to leave participants running or cancel all active participation

#### Scenario: Validation errors appear inline on the form
- **GIVEN** an admin fills in a create or edit form with invalid values
- **WHEN** the form is submitted
- **THEN** field-level validation errors are displayed next to the relevant fields
- **AND** the form is not cleared

### Requirement: Campaign validation and badge ownership
The system SHALL validate all required campaign fields including the badge slug, SHALL apply the start-date-not-in-the-past rule on create only, SHALL reject changes to `target_distance`, `start_date`, or `badge_slug` once a campaign is no longer upcoming, SHALL auto-create achievement definitions only from inline badge fields for slugs without an existing definition, and SHALL only update definitions with `badge_type='community'`.

#### Scenario: Admin create is rejected for invalid fields
- **GIVEN** an authenticated admin submits a campaign with missing or invalid fields
- **WHEN** the admin calls `POST /api/admin/campaigns`
- **THEN** the system returns a validation error with field-level detail
- **AND** a start date in the past is rejected on create

#### Scenario: Admin updates an older campaign without changing frozen fields
- **GIVEN** an active campaign whose start date is in the past
- **WHEN** an admin updates only copy fields and leaves `target_distance`, `start_date`, and `badge_slug` unchanged
- **THEN** the update succeeds despite the past start date
- **AND** an audit log entry is recorded

#### Scenario: Admin cannot retarget or restart an active campaign
- **GIVEN** a campaign that is no longer upcoming
- **WHEN** an admin attempts to change `target_distance`, `start_date`, or `badge_slug`
- **THEN** the system returns a validation error for the frozen field

#### Scenario: Non-community badge is never overwritten
- **GIVEN** a `badge_slug` that matches an achievement definition with a badge type other than `community`
- **WHEN** an admin saves a campaign with inline badge fields for that slug
- **THEN** the system rejects the badge update instead of modifying the definition

### Requirement: Campaign retrigger
The system SHALL let an admin create a campaign's next run when its latest run is completed or expired and the campaign is enabled, SHALL pre-fill the new run's target distance from the suggestions formula (clamped to at least 1 km) with a suggested 14-day window starting no earlier than tomorrow, and SHALL reject retriggering while a run is upcoming or active or the campaign is disabled.

#### Scenario: Admin retriggers a completed campaign
- **GIVEN** a campaign whose latest run is completed and which is enabled
- **WHEN** an admin calls `POST /api/admin/campaigns/:id/retrigger`
- **THEN** a new run is created with `run_number` incremented and status `upcoming`
- **AND** an audit log entry is recorded

#### Scenario: Retrigger pre-fills suggested values
- **GIVEN** an admin opens the retrigger action
- **WHEN** the form loads
- **THEN** the target distance is pre-filled from the suggestions formula clamped to at least 1 km
- **AND** the start date defaults to tomorrow (UTC) and the end date defaults to a 14-day inclusive window
- **AND** the admin can override any value before confirming
- **AND** overrides are validated under the creation rules

#### Scenario: Retrigger is rejected while a run is live
- **GIVEN** a campaign whose latest run is upcoming or active
- **WHEN** an admin calls `POST /api/admin/campaigns/:id/retrigger`
- **THEN** the system returns a 400 error

#### Scenario: Retrigger is rejected for a disabled campaign
- **GIVEN** a campaign with `enabled = 0`
- **WHEN** an admin calls `POST /api/admin/campaigns/:id/retrigger`
- **THEN** the system returns a 400 error directing the admin to enable the campaign first

#### Scenario: Retriggering preserves prior run history
- **GIVEN** a campaign with a completed run including participants, ledger entries, and earned badges
- **WHEN** the admin retriggers the campaign
- **THEN** the previous run's row, participant rows, ledger entries, and earned badges are unchanged
- **AND** the new run starts with zero participants and zero progress

#### Scenario: Retrigger never deletes history
- **GIVEN** any retrigger action
- **WHEN** it completes
- **THEN** no previous run, participant row, ledger entry, or earned badge has been modified or deleted

#### Scenario: Admin starts the next run from the dashboard
- **GIVEN** an admin views a campaign whose latest run is completed or expired
- **WHEN** the admin opens the retrigger action and confirms the pre-filled or overridden values
- **THEN** the campaign list reflects the new upcoming run
