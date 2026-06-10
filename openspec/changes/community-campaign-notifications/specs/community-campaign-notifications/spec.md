## ADDED Requirements

### Requirement: Community campaign notification category
The system SHALL provide a community campaign push notification category with per-user opt-in, SHALL default the category to enabled for all users, and SHALL expose the setting through the existing push status and settings endpoints.

#### Scenario: Push status includes community campaign setting
- **GIVEN** an authenticated user with push subscriptions
- **WHEN** the user calls `GET /api/push/status`
- **THEN** the response includes `communityCampaignsEnabled` as a boolean

#### Scenario: User updates community campaign notification preference
- **GIVEN** an authenticated user
- **WHEN** the user calls `PUT /api/push/settings` with `communityCampaignsEnabled: false`
- **THEN** the preference is saved and the user no longer receives community campaign notifications

#### Scenario: New users default to community campaign notifications enabled
- **GIVEN** a newly registered user
- **WHEN** their notification preferences are queried
- **THEN** `communityCampaignsEnabled` is true

### Requirement: New campaign notification
The system SHALL send a push notification to all users with the category enabled and active push subscriptions when a new community campaign is created.

#### Scenario: All subscribed users receive new campaign notification
- **GIVEN** an admin creates a new community campaign
- **WHEN** the campaign is saved
- **THEN** all users with `community_campaigns_enabled = 1` and active push subscriptions receive a notification with the campaign name and type `community_campaign_created`

#### Scenario: User with category disabled does not receive notification
- **GIVEN** a user has `community_campaigns_enabled = 0`
- **WHEN** a new campaign is created
- **THEN** that user does not receive the notification

### Requirement: Campaign completion notification
The system SHALL send a push notification to all contributing participants with the category enabled when a community campaign reaches its target and completes.

#### Scenario: Contributors receive completion notification
- **GIVEN** a community campaign reaches its target and completes
- **WHEN** the campaign is marked completed
- **THEN** all participants with `progress_distance > 0` and `community_campaigns_enabled = 1` receive a notification with the campaign name and type `community_campaign_completed`

#### Scenario: Non-contributing participant does not receive completion notification
- **GIVEN** a user joined a campaign but contributed zero distance
- **WHEN** the campaign completes
- **THEN** that user does not receive the completion notification

#### Scenario: Notification delivery does not block campaign processing
- **GIVEN** push notification delivery is slow or fails
- **WHEN** a campaign is created or completed
- **THEN** the campaign operation succeeds regardless
- **AND** notification delivery errors are logged but not propagated
