# Spec Delta

## MODIFIED Requirements

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
