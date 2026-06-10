## ADDED Requirements

### Requirement: Admin campaign definition CRUD
The system SHALL provide admin APIs to list, create, read, update, enable, and disable community campaign definitions, SHALL validate all required fields including the badge slug against existing achievement definitions, SHALL auto-create achievement definition rows from inline badge fields when the badge slug does not already exist, and SHALL reject requests from non-admin users.

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

#### Scenario: Admin create is rejected for invalid fields
- **GIVEN** an authenticated admin submits a campaign with missing or invalid fields
- **WHEN** the admin calls `POST /api/admin/campaigns`
- **THEN** the system returns a validation error with field-level detail

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
- **AND** the admin must send `{ cancelActive: true }` to proceed with disabling and marking all active participants as removed
- **OR** the admin can send `{ cancelActive: false }` to disable future joins only while leaving active participants running

#### Scenario: Non-admin cannot manage campaign definitions
- **GIVEN** an authenticated non-admin user
- **WHEN** the user calls any `/api/admin/campaigns` endpoint
- **THEN** the system returns a 403 error

### Requirement: Community metric suggestions
The system SHALL provide an admin endpoint that calculates suggested campaign target distance, duration, and expected participant count from recent community walking data.

#### Scenario: Admin requests metric suggestions
- **GIVEN** an authenticated admin
- **WHEN** the admin calls `GET /api/admin/campaigns/suggestions`
- **THEN** the response includes suggested target distance, suggested duration in days, suggested participant count, and the raw community totals used for the calculation

### Requirement: Admin campaign management UI
The system SHALL render a community campaign management section on the admin dashboard page showing the list of existing campaign definitions with their enabled state, SHALL provide inline forms for creating and editing campaigns with inline badge metadata fields and field-level validation feedback, and SHALL show a confirmation modal when disabling a campaign that has active participants.

#### Scenario: Admin dashboard shows campaign definitions list
- **GIVEN** an authenticated admin loads the admin dashboard
- **WHEN** the page initializes
- **THEN** a list of existing community campaign definitions is displayed below the dashboard stats and encounters
- **AND** each campaign shows its name, slug, target distance, dates, enabled/disabled state, and badge name

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
