# community-campaign-notifications Specification

## Purpose

Push notifications for community campaign runs: a per-user opt-out category
(`community_campaigns_enabled`, default on), a run-announcement notification
sent exactly once when a run first becomes publicly visible (retrigger of an
enabled campaign, or first enable of a campaign with an unannounced run, tracked
by the run's `announced_at` stamp), and a completion notification to the
contributing participants of a completed run. Delivery failures never block
campaign operations.

## Requirements


### Requirement: Community campaign notification category
The system SHALL provide a community campaign push notification category with per-user opt-in, SHALL default the category to enabled for all users, SHALL expose the setting through the existing push status and settings endpoints, and SHALL render a category toggle in the existing push settings card.

#### Scenario: Push status includes community campaign setting
- **GIVEN** an authenticated user with push subscriptions
- **WHEN** the user calls `GET /api/push/status`
- **THEN** the response includes `communityCampaignsEnabled` as a boolean

#### Scenario: User updates community campaign notification preference
- **GIVEN** an authenticated user
- **WHEN** the user calls `PUT /api/push/settings` with `communityCampaignsEnabled: false`
- **THEN** the preference is saved and the user no longer receives community campaign notifications

#### Scenario: Settings body with only the new key is accepted
- **GIVEN** an authenticated user with push subscriptions
- **WHEN** the user sends `PUT /api/push/settings` with only `communityCampaignsEnabled`
- **THEN** the request succeeds instead of being rejected by the settings presence guard

#### Scenario: Push settings card shows the campaign toggle
- **GIVEN** an authenticated user with notifications enabled
- **WHEN** the push settings card renders
- **THEN** a "Community Campaigns" toggle with an explanatory hint appears in the Notification Types block
- **AND** toggling it persists the preference

#### Scenario: New users default to community campaign notifications enabled
- **GIVEN** a newly registered user
- **WHEN** their notification preferences are queried
- **THEN** `communityCampaignsEnabled` is true

### Requirement: Run announcement notification
The system SHALL send a push notification to all users with the category enabled and active push subscriptions when a campaign run first becomes publicly visible, exactly once per run as tracked by the run's `announced_at` stamp. Runs inserted directly by migration SHALL NOT announce until an admin enables their campaign.

#### Scenario: Retriggering an enabled campaign announces the new run
- **GIVEN** an enabled campaign whose latest run is terminal
- **WHEN** an admin retriggers it into a new run
- **THEN** all users with `community_campaigns_enabled = 1` and active push subscriptions receive a notification with the campaign name, run number, and type `community_campaign_created`
- **AND** the new run's `announced_at` is stamped

#### Scenario: Enabling a campaign announces its unannounced run
- **GIVEN** a campaign created disabled with an unannounced run
- **WHEN** an admin enables the campaign
- **THEN** the run is announced and its `announced_at` is stamped

#### Scenario: Repeated enable does not re-announce
- **GIVEN** a run whose `announced_at` is already stamped
- **WHEN** the campaign is disabled and enabled again
- **THEN** no announcement is sent for that run

#### Scenario: Migration-seeded run does not announce on deploy
- **GIVEN** the application starts after the campaign seed migration
- **WHEN** the seeded run becomes available
- **THEN** no `community_campaign_created` notification is sent
- **AND** the run is announced only after an admin enables the campaign

#### Scenario: User with category disabled does not receive notification
- **GIVEN** a user has `community_campaigns_enabled = 0`
- **WHEN** a run is announced
- **THEN** that user does not receive the notification

#### Scenario: Campaign notifications link to the events page
- **GIVEN** a user receives a campaign notification
- **WHEN** the user clicks it
- **THEN** the service worker navigates to `/events` rather than the default journey page

### Requirement: Campaign completion notification
The system SHALL send a push notification to all contributing active participants with the category enabled when a campaign run reaches its target and completes.

#### Scenario: Contributors receive completion notification
- **GIVEN** a community campaign reaches its target and completes
- **WHEN** the campaign is marked completed
- **THEN** all active participants with `progress_distance > 0` and `community_campaigns_enabled = 1` receive a notification with the campaign name and type `community_campaign_completed`

#### Scenario: Non-contributing participant does not receive completion notification
- **GIVEN** a user joined a campaign but contributed zero distance
- **WHEN** the campaign completes
- **THEN** that user does not receive the completion notification

#### Scenario: Removed participant does not receive completion notification
- **GIVEN** a participant was marked `removed` by an admin
- **WHEN** the campaign completes
- **THEN** that user does not receive the completion notification
- **AND** any badge already earned is retained

#### Scenario: Notification delivery does not block campaign processing
- **GIVEN** push notification delivery is slow or fails
- **WHEN** a campaign is created or completed
- **THEN** the campaign operation succeeds regardless
- **AND** notification delivery errors are logged but not propagated
