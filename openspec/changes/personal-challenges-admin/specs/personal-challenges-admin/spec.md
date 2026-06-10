## ADDED Requirements

### Requirement: Admin encounter definition CRUD
The system SHALL provide admin APIs to list, create, read, update, enable, and disable personal encounter definitions, SHALL validate all required fields including the badge slug against existing achievement definitions, SHALL auto-create achievement definition rows from inline badge fields when the badge slug does not already exist, and SHALL reject requests from non-admin users.

#### Scenario: Admin lists all encounter definitions
- **GIVEN** an authenticated admin
- **WHEN** the admin calls `GET /api/admin/encounters`
- **THEN** the response includes all definitions with their current fields and enabled state

#### Scenario: Admin creates a valid encounter definition
- **GIVEN** an authenticated admin submits valid definition fields including badge slug, name, description, and image
- **WHEN** the admin calls `POST /api/admin/encounters`
- **THEN** the definition is created with enabled=false
- **AND** if the badge slug does not exist in achievement_definitions, a new achievement definition row is auto-created from the inline badge fields
- **AND** an audit log entry is recorded

#### Scenario: Admin create is rejected for invalid fields
- **GIVEN** an authenticated admin submits a definition with missing or invalid fields
- **WHEN** the admin calls `POST /api/admin/encounters`
- **THEN** the system returns a validation error with field-level detail

#### Scenario: Admin updates an existing definition
- **GIVEN** an existing encounter definition
- **WHEN** an admin calls `PUT /api/admin/encounters/:id` with updated fields
- **THEN** the definition is updated
- **AND** the linked badge definition is updated if inline badge fields changed
- **AND** an audit log entry is recorded

#### Scenario: Admin enables a definition
- **GIVEN** a disabled encounter definition
- **WHEN** an admin calls `PUT /api/admin/encounters/:id/enable`
- **THEN** the definition's enabled flag is set to true
- **AND** an audit log entry is recorded

#### Scenario: Admin disables a definition with no active occurrences
- **GIVEN** an enabled encounter definition with no active user occurrences
- **WHEN** an admin calls `PUT /api/admin/encounters/:id/disable`
- **THEN** the definition's enabled flag is set to false
- **AND** an audit log entry is recorded

#### Scenario: Admin disables a definition with active occurrences
- **GIVEN** an enabled encounter definition with active user occurrences
- **WHEN** an admin calls `PUT /api/admin/encounters/:id/disable`
- **THEN** the API returns the count of active occurrences and requires a confirmation body parameter
- **AND** the admin must send `{ cancelActive: true }` to proceed with disabling and failing all active occurrences
- **OR** the admin can send `{ cancelActive: false }` to disable future rolls only while leaving active occurrences running

#### Scenario: Non-admin cannot manage encounter definitions
- **GIVEN** an authenticated non-admin user
- **WHEN** the user calls any `/api/admin/encounters` endpoint
- **THEN** the system returns a 403 error

### Requirement: Admin encounter management UI
The system SHALL render a personal encounter management section on the admin dashboard page showing the list of existing definitions with their enabled state, SHALL provide inline forms for creating and editing definitions with inline badge metadata fields and field-level validation feedback, and SHALL show a confirmation modal when disabling a definition that has active occurrences.

#### Scenario: Admin dashboard shows encounter definitions list
- **GIVEN** an authenticated admin loads the admin dashboard
- **WHEN** the page initializes
- **THEN** a list of existing personal encounter definitions is displayed below the dashboard stats
- **AND** each definition shows its name, slug, duration_days, enabled/disabled state, and badge name

#### Scenario: Admin creates a new encounter via the dashboard
- **GIVEN** an admin views the encounter management section on the dashboard
- **WHEN** the admin fills in the create form with valid values including inline badge fields and submits
- **THEN** a new definition is created
- **AND** a corresponding badge definition is created or linked
- **AND** it appears in the definition list

#### Scenario: Admin edits an existing encounter via the dashboard
- **GIVEN** an admin views an existing definition in the list
- **WHEN** the admin opens the edit form, changes fields including badge metadata, and submits
- **THEN** the definition is updated
- **AND** the list reflects the changes

#### Scenario: Admin toggles a definition's enabled state
- **GIVEN** an admin views the encounter definitions list
- **WHEN** the admin clicks the enable or disable action on a definition with no active occurrences
- **THEN** the definition's enabled state changes
- **AND** the list row updates to reflect the new state

#### Scenario: Disable confirmation modal appears for active occurrences
- **GIVEN** an admin clicks disable on a definition that has active user occurrences
- **WHEN** the API response indicates active occurrences exist
- **THEN** a confirmation modal is shown with the count of affected users
- **AND** the admin can choose to keep active challenges or cancel all active challenges

#### Scenario: Validation errors appear inline on the form
- **GIVEN** an admin fills in a create or edit form with invalid values
- **WHEN** the form is submitted
- **THEN** field-level validation errors are displayed next to the relevant fields
- **AND** the form is not cleared
