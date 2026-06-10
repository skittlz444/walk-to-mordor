## ADDED Requirements

### Requirement: Campaign definitions and public visibility
The system SHALL store community campaign definitions with a fixed group target distance, date window, name, description, image, and badge metadata, and SHALL make campaign listings publicly visible to all users including unauthenticated visitors.

#### Scenario: Campaign definition is created via seed migration
- **WHEN** the application starts after migration
- **THEN** a seeded campaign definition exists with name, description, image, target distance, start date, end date, and badge slug

#### Scenario: Public user views campaign list
- **GIVEN** any user (authenticated or not) visits the events page
- **WHEN** `GET /api/events` is called
- **THEN** the response includes all campaigns with their public metadata, progress summary, participant count, and status

#### Scenario: Authenticated user also sees participation status in campaign list
- **GIVEN** an authenticated user who has joined a campaign
- **WHEN** `GET /api/events` is called with valid auth headers
- **THEN** the response includes the user's participation status and contribution for each campaign

#### Scenario: Request for non-existent campaign returns 404
- **GIVEN** a campaign ID that does not exist
- **WHEN** `GET /api/events/:id` is called
- **THEN** the system returns a 404 error regardless of authentication status

### Requirement: Campaign participation
The system SHALL let authenticated users join an active or upcoming community campaign once, SHALL reject duplicate active participation, and SHALL return the user's participation status alongside public campaign data.

#### Scenario: Authenticated user joins a campaign
- **GIVEN** an authenticated user views an active or upcoming campaign they have not joined
- **WHEN** the user calls `POST /api/events/:id/join`
- **THEN** a participant record is created with `joined_at` set to the current time
- **AND** subsequent campaign responses show the user as joined

#### Scenario: Duplicate join is rejected
- **GIVEN** a user has already joined a campaign
- **WHEN** the user calls `POST /api/events/:id/join` again
- **THEN** the system returns a 409 conflict error

#### Scenario: Unauthenticated user cannot join a campaign
- **GIVEN** a request without a valid session token
- **WHEN** `POST /api/events/:id/join` is called
- **THEN** the system returns a 401 error

#### Scenario: User cannot join a campaign that has ended
- **GIVEN** a campaign whose end date has passed
- **WHEN** an authenticated user calls `POST /api/events/:id/join`
- **THEN** the system returns a 400 error indicating the campaign is no longer accepting participants

### Requirement: Progress accounting for community campaigns
The system SHALL credit campaign progress from canonical walk logs using an idempotent ledger, SHALL count only walks whose date falls within the campaign's active window (start_date through end_date inclusive), SHALL refresh cached participant and campaign totals when eligible walks are created, edited, or deleted, and SHALL not block walk saves when reconciliation encounters errors.

#### Scenario: Walk with date within campaign window counts
- **GIVEN** a user has joined an active campaign running June 1-7
- **WHEN** the user creates or edits a walk entry dated June 3
- **THEN** the walk contributes to that user's campaign participant progress

#### Scenario: Walk with date outside campaign window does not count
- **GIVEN** a user has joined an active campaign running June 1-7
- **WHEN** the user creates or edits a walk entry dated May 30 (before the campaign)
- **THEN** the walk does not contribute to the campaign participant's progress

#### Scenario: Campaign completes when community total reaches target during reconciliation
- **GIVEN** an active campaign with a 100 km community target and 95 km of current progress
- **WHEN** a participant logs a 6 km walk within the campaign window
- **THEN** the reconciliation process detects the total now exceeds the target
- **AND** the campaign is immediately marked completed
- **AND** all contributing participants receive the completion badge

#### Scenario: Edited walk reconciles campaign progress with previous distance
- **GIVEN** a walk has already contributed to campaign progress via a ledger entry with distance 5 km
- **WHEN** the user edits that walk's distance to 8 km
- **THEN** the existing ledger entry is updated to 8 km (not duplicated)
- **AND** the participant's cached total is recomputed

#### Scenario: Deleted walk reconciles campaign progress
- **GIVEN** a walk has already contributed to campaign progress via a ledger entry
- **WHEN** the user deletes that walk
- **THEN** the ledger entry is removed and the cached total is recomputed

#### Scenario: Reconciliation failure does not block walk save
- **GIVEN** an error occurs during campaign progress reconciliation
- **WHEN** the user creates, updates, or deletes a walk entry
- **THEN** the walk operation succeeds regardless
- **AND** the reconciliation error is logged but not propagated to the user

### Requirement: Community progress and contributor visibility
The system SHALL expose community campaign progress publicly, including total community distance, target distance, participant count, time remaining, and ranked contributor distances with usernames. The system SHALL include the current authenticated user's contribution when auth headers are present.

#### Scenario: Public viewer sees community progress
- **GIVEN** a campaign is publicly visible
- **WHEN** any user calls `GET /api/events/:id/community-progress`
- **THEN** the response includes total community distance, target distance, participant count, total contributor count, and up to 50 ranked contributors with usernames and distances ordered by distance descending

#### Scenario: Tied distances share the same rank
- **GIVEN** two contributors have the same contribution distance
- **WHEN** community progress is requested
- **THEN** both contributors share the same rank number
- **AND** the next different distance skips ranks appropriately (competition ranking)

#### Scenario: Authenticated participant also sees own contribution
- **GIVEN** an authenticated user has joined the campaign
- **WHEN** the user calls `GET /api/events/:id/community-progress`
- **THEN** the response includes the user's own contribution distance and rank in addition to the public fields

#### Scenario: Empty campaign shows zero progress
- **GIVEN** a campaign that has just been created with no participants
- **WHEN** community progress is requested
- **THEN** the response shows zero total distance and an empty contributors list

### Requirement: Campaign lifecycle transitions
The system SHALL transition campaigns from upcoming to active when their start date arrives and SHALL expire campaigns when their end date passes without the community target being reached, via a daily cron running at midnight UTC. Campaign completion is handled synchronously during walk reconciliation, not by the cron.

#### Scenario: Upcoming campaign activates at midnight on its start date
- **GIVEN** a campaign is upcoming with a start date of today
- **WHEN** the daily campaign cron runs
- **THEN** the campaign is marked active

#### Scenario: Campaign expires when deadline passes without target
- **GIVEN** an active campaign whose end date has passed without reaching the community target
- **WHEN** the daily campaign cron runs
- **THEN** the campaign is marked expired
- **AND** no completion badges are awarded

#### Scenario: Lifecycle cron failure does not block other scheduled jobs
- **GIVEN** campaign lifecycle processing encounters an error
- **WHEN** the daily campaign cron runs
- **THEN** existing scheduled push notification jobs are not blocked

### Requirement: Public events page
The system SHALL render a public `/events` page showing community campaigns with progress bars, participant counts, deadlines, and the current user's participation status when authenticated. The page SHALL NOT display personal challenges.

#### Scenario: Public events page shows community campaigns
- **GIVEN** any user opens the events page
- **WHEN** the page loads
- **THEN** active and past community campaigns are displayed with progress bars and participant counts

#### Scenario: Authenticated user sees join button and own contribution
- **GIVEN** an authenticated user views the events page
- **AND** a campaign the user has not joined is active
- **WHEN** the page loads
- **THEN** a join button is displayed for that campaign
- **AND** campaigns the user has joined show the user's contribution

#### Scenario: Campaign expires and shows final outcome
- **GIVEN** a campaign has ended without reaching its target
- **WHEN** the events page loads
- **THEN** the campaign is displayed in a past/expired section with its final progress and outcome status
