# community-campaigns Specification

## Purpose

Community campaigns are admin-crafted, publicly visible events where the entire
community contributes toward a shared target distance. Campaigns are structured
as runs: a definition carries identity, copy, and badge linkage, while each run
carries its own window, target, and lifecycle status, so a completed or expired
campaign can be retriggered into a fresh run without touching history.
Participation is an opt-in join per run with public progress visibility,
ranked contributor distances, and walk-date-based credit reconciled from
canonical walk logs.

## Requirements

### Requirement: Campaign definitions and public visibility
The system SHALL store community campaign definitions carrying identity, copy, imagery, and badge metadata, SHALL store each campaign's runs with their own target distance, date window, and lifecycle status, and SHALL make campaign listings publicly visible to all users including unauthenticated visitors.

#### Scenario: Campaign definition is created via seed migration
- **WHEN** the application starts after migration
- **THEN** a seeded campaign definition exists with name, description, image, and badge slug
- **AND** an initial run exists with target distance, start date, end date, and upcoming status

#### Scenario: Public user views campaign list
- **GIVEN** any user (authenticated or not) visits the events page
- **WHEN** `GET /api/events` is called
- **THEN** the response includes all enabled campaigns with their public metadata, imagery reference, the active run's window/target/status, progress summary, participant count, and past-run outcome summaries

#### Scenario: Authenticated user also sees participation status in campaign list
- **GIVEN** an authenticated user who has joined a campaign's active run
- **WHEN** `GET /api/events` is called with valid auth headers
- **THEN** the response includes the user's participation status and contribution for that run

#### Scenario: Request for non-existent campaign returns 404
- **GIVEN** a campaign ID that does not exist
- **WHEN** `GET /api/events/:id` is called
- **THEN** the system returns a 404 error regardless of authentication status

### Requirement: Campaign participation
The system SHALL let authenticated users join a campaign's active or upcoming run once while the campaign is enabled, SHALL reject duplicate participation within the same run, SHALL not treat participation in a previous run as participation in the current one, SHALL backfill the joining user's existing walks dated inside the run window, and SHALL return the user's participation status alongside public campaign data.

#### Scenario: Authenticated user joins a run
- **GIVEN** an authenticated user views an active or upcoming run they have not joined
- **WHEN** the user calls `POST /api/events/:id/join`
- **THEN** a participant record scoped to that run is created with `joined_at` set to the current time and status `active`
- **AND** subsequent campaign responses show the user as joined

#### Scenario: Joining backfills existing in-window walks
- **GIVEN** an authenticated user has walks dated inside the run window but has not joined
- **WHEN** the user joins the run
- **THEN** those walks are reconciled into the campaign ledger immediately
- **AND** the participant's contribution reflects them without requiring the walks to be re-saved

#### Scenario: Join backfill is idempotent
- **GIVEN** a user joins a run and their in-window walks are backfilled
- **WHEN** the same walk is later edited
- **THEN** the ledger contains one row per walk and no distance is double-counted

#### Scenario: Prior-run participation does not carry into a new run
- **GIVEN** a user joined a campaign's first run, which has completed or expired
- **AND** an admin retriggered the campaign into a second run
- **WHEN** the second run's participation status is queried for that user
- **THEN** the user is not shown as joined until they join the new run

#### Scenario: Previously removed participant can join a later run
- **GIVEN** an admin removed a participant from run 1 (status `removed`)
- **AND** the campaign was retriggered into run 2
- **WHEN** the user calls `POST /api/events/:id/join` for run 2
- **THEN** a fresh run-2 participant record is created

#### Scenario: Duplicate join within a run is rejected
- **GIVEN** a user has already joined the campaign's active run
- **WHEN** the user calls `POST /api/events/:id/join` again for that run
- **THEN** the system returns a 409 conflict error

#### Scenario: Unauthenticated user cannot join a campaign
- **GIVEN** a request without a valid session token
- **WHEN** `POST /api/events/:id/join` is called
- **THEN** the system returns a 401 error

#### Scenario: User cannot join a run that has ended
- **GIVEN** a run whose end date has passed without a successor run being active
- **WHEN** an authenticated user calls `POST /api/events/:id/join`
- **THEN** the system returns a 400 error indicating the campaign is not accepting participants

#### Scenario: Disabled campaign cannot be joined
- **GIVEN** a campaign with `enabled = 0`
- **WHEN** an authenticated user calls `POST /api/events/:id/join`
- **THEN** the system returns a 400 error indicating the campaign is not accepting participants

### Requirement: Progress accounting for community campaigns
The system SHALL credit run progress from canonical walk logs using an idempotent ledger, SHALL count only walks whose date falls within the active run's window (start_date through end_date inclusive), SHALL credit and complete only runs with `active` status, SHALL refresh cached participant and run totals when eligible walks are created, edited, or deleted, and SHALL not block walk saves when reconciliation encounters errors.

#### Scenario: Walk with date within the active run's window counts
- **GIVEN** a user has joined an active run dated June 1-7
- **WHEN** the user creates or edits a walk entry dated June 3
- **THEN** the walk contributes to that user's participant progress for that run

#### Scenario: Walk with date outside the run window does not count
- **GIVEN** a user has joined an active run dated June 1-7
- **WHEN** the user creates or edits a walk entry dated May 30 (before the run)
- **THEN** the walk does not contribute to the participant's progress

#### Scenario: Upcoming runs are not credited
- **GIVEN** a retriggered run with `status = 'upcoming'` starting July 1
- **WHEN** a walk dated June 20 or a future-dated walk inside the new window is saved
- **THEN** the walk is not credited to the upcoming run

#### Scenario: Completed and expired runs are not credited
- **GIVEN** a run with `status = 'completed'` or `status = 'expired'`
- **WHEN** a walk dated inside that run's window is saved
- **THEN** the run is not credited further and cannot be re-completed

#### Scenario: Removed participant is excluded from crediting and ranking
- **GIVEN** an admin cancelled a participant of the active run (status `removed`)
- **WHEN** the participant's walks are saved or the community progress is requested
- **THEN** the removed participant is not credited further
- **AND** the removed participant does not appear in participant or contributor counts

#### Scenario: Disabled campaign is frozen
- **GIVEN** a campaign with `enabled = 0`
- **WHEN** a walk is saved, lifecycle transitions run, or community progress is requested
- **THEN** the campaign is not reconciled, not transitioned, and not listed publicly
- **AND** participant rows, ledger entries, and earned badges are retained

#### Scenario: Re-enabling a campaign backfills the window
- **GIVEN** a disabled campaign with an active run and existing participants
- **WHEN** an admin enables the campaign
- **THEN** the in-window walks for its active participants are reconciled without requiring walk re-saves

#### Scenario: Run completes when community total reaches target during reconciliation
- **GIVEN** an active run with a 100 km community target and 95 km of current progress
- **WHEN** a participant logs a 6 km walk within the run window
- **THEN** the reconciliation process detects the total now exceeds the target
- **AND** the run is immediately marked completed via a guarded update that only succeeds from active status
- **AND** a final snapshot (participant count, contributor count, total distance) is written
- **AND** all contributing participants receive the completion badge

#### Scenario: Edited walk reconciles run progress with previous distance
- **GIVEN** a walk has already contributed to run progress via a ledger entry with distance 5 km
- **WHEN** the user edits that walk's distance to 8 km
- **THEN** the existing ledger entry is updated to 8 km (not duplicated)
- **AND** the participant's cached total is recomputed

#### Scenario: Deleted walk reconciles run progress
- **GIVEN** a walk has already contributed to run progress via a ledger entry
- **WHEN** the user deletes that walk
- **THEN** that walk's ledger entry is removed and the cached total is recomputed

#### Scenario: Ledger history is retained across runs
- **GIVEN** run 1 has completed and the campaign was retriggered into run 2
- **WHEN** run 2's progress is reconciled
- **THEN** run 1's participant rows and ledger entries remain intact and queryable as history

#### Scenario: Reconciliation failure does not block walk save
- **GIVEN** an error occurs during run progress reconciliation
- **WHEN** the user creates, updates, or deletes a walk entry
- **THEN** the walk operation succeeds regardless
- **AND** the reconciliation error is logged but not propagated to the user

### Requirement: Campaign runs and history
The system SHALL structure campaigns as sequential runs, SHALL maintain at most one upcoming or active run per campaign, SHALL write a final snapshot (participant count, contributor count, total distance) when a run completes or expires, SHALL retain run rows, participant rows, and ledger entries as history after a run ends, and SHALL support an admin retrigger action (defined in the `community-campaigns-admin` capability) that creates the next run without modifying or deleting previous runs.

#### Scenario: Campaign has at most one upcoming or active run
- **GIVEN** a campaign with a completed first run
- **WHEN** an admin retriggers the campaign
- **THEN** a second run is created with upcoming status
- **AND** the campaign has exactly one run in upcoming or active status

#### Scenario: Completed run keeps its final snapshot
- **GIVEN** a run has completed
- **WHEN** campaign detail or the events page requests run history
- **THEN** the completed run reports its target, window, final progress, participant count, contributor count, and outcome

#### Scenario: Retriggering preserves history
- **GIVEN** a campaign's run 1 has completed
- **WHEN** an admin retriggers it into run 2
- **THEN** run 1's row, participant rows, and ledger entries are unchanged
- **AND** run 2 starts with zero participants and zero progress

#### Scenario: Repeatable badge escalates across runs
- **GIVEN** a campaign whose badge definition is repeatable with rank thresholds
- **WHEN** a participant contributes to a completed second run after earning the badge in the first run
- **THEN** the participant earns a second badge instance under the second run's idempotency key
- **AND** the badge's earned count and rank presentation reflect both completions

### Requirement: Community campaign progress visibility
The system SHALL expose public progress for a campaign's active run including total distance, target distance, participant count, contributor count, and time remaining. Participant count SHALL include all active participants of the run; contributor count SHALL include only active participants with a contribution greater than zero.

#### Scenario: Public viewer sees community progress
- **GIVEN** a campaign's active run is publicly visible
- **WHEN** any user calls `GET /api/events/:id/community-progress`
- **THEN** the response includes the run's total community distance, target distance, participant count, contributor count, time remaining, and up to 50 ranked contributors with usernames and distances ordered by distance descending

#### Scenario: Zero-distance participant has no contributor rank
- **GIVEN** an authenticated user joined the active run but has not contributed distance
- **WHEN** community progress is requested
- **THEN** the user is counted in participant count
- **AND** the user does not appear in the ranked contributor list and receives no contribution rank

#### Scenario: Empty run shows zero progress
- **GIVEN** an active run that has just been created with no participants
- **WHEN** community progress is requested
- **THEN** the response shows zero total distance, zero contributors, and an empty contributors list

### Requirement: Contributor rankings and personal contribution
The system SHALL publish up to 50 ranked contributor distances with usernames for a campaign's active run, ordered by distance descending with competition ranking for ties. When auth headers are present and the user's contribution is greater than zero, the response SHALL include that user's contribution and rank.

#### Scenario: Tied distances share the same rank
- **GIVEN** two contributors have the same contribution distance
- **WHEN** community progress is requested
- **THEN** both contributors share the same rank number
- **AND** the next different distance skips ranks appropriately (competition ranking)

#### Scenario: Authenticated participant also sees own contribution
- **GIVEN** an authenticated user has joined the active run
- **WHEN** the user calls `GET /api/events/:id/community-progress`
- **THEN** the response includes the user's own contribution distance and rank in addition to the public fields

### Requirement: Campaign lifecycle transitions
The system SHALL transition runs from upcoming to active when their start date arrives and SHALL expire runs when their end date passes without the community target being reached, via the existing daily scheduled run at 09:00 UTC. Disabled campaigns SHALL be skipped by lifecycle transitions. Run completion is handled synchronously during walk reconciliation, not by the scheduled run, and the scheduled run SHALL never create runs.

#### Scenario: Upcoming run activates on its start date during the daily run
- **GIVEN** a run is upcoming with a start date of today (UTC)
- **WHEN** the daily scheduled run executes
- **THEN** the run is marked active

#### Scenario: Run expires when deadline passes without target
- **GIVEN** an active run whose end date has passed without reaching the community target
- **WHEN** the daily scheduled run executes
- **THEN** the run is marked expired and its final snapshot is written
- **AND** no completion badges are awarded

#### Scenario: Scheduled run never creates runs
- **GIVEN** a campaign whose only run has completed or expired
- **WHEN** the daily scheduled run executes
- **THEN** no new run is created
- **AND** a successor run exists only after an admin retrigger or a seed migration

#### Scenario: Lifecycle cron failure does not block other scheduled jobs
- **GIVEN** run lifecycle processing encounters an error
- **WHEN** the daily scheduled run executes
- **THEN** existing scheduled push notification jobs are not blocked

### Requirement: Public events page
The system SHALL render a public `/events` page (using the public-page layout that does not require a session) showing community campaigns with their imagery, progress bars, participant counts, deadlines, the current user's participation status when authenticated, and past-run outcomes. The page SHALL NOT display personal challenges.

#### Scenario: Public events page shows community campaigns
- **GIVEN** any user opens the events page
- **WHEN** the page loads
- **THEN** active and upcoming community campaigns are displayed with imagery, progress bars, and participant counts

#### Scenario: Campaign card renders campaign imagery
- **GIVEN** a campaign definition has an image slug with optimized artwork
- **WHEN** its card is rendered
- **THEN** the card shows the campaign image with a thumbnail placeholder
- **AND** a campaign without imagery renders copy-only instead of a broken image

#### Scenario: Past runs show final outcomes
- **GIVEN** a campaign has completed or expired runs
- **WHEN** the events page loads
- **THEN** those runs are displayed in a past section with their final progress and outcome status

#### Scenario: Anonymous visitor is not redirected to login
- **GIVEN** an unauthenticated visitor opens `/events`
- **WHEN** the page loads
- **THEN** campaign data is rendered without a login redirect
- **AND** each joinable campaign shows a "Sign in to join" link instead of a join button

#### Scenario: Join affordance discloses public visibility
- **GIVEN** an authenticated user views an unjoined campaign
- **WHEN** the join affordance is rendered
- **THEN** it states that the user's username and contribution distance will be publicly visible

#### Scenario: Campaign card states which walk dates count
- **GIVEN** a campaign with an active or upcoming run window
- **WHEN** its card is rendered
- **THEN** the card states that walks dated inside the run window count toward the campaign

#### Scenario: Events island renders the top five contributors
- **GIVEN** a run with more than five contributors
- **WHEN** the events page renders its card
- **THEN** the top five contributors are shown
- **AND** an "and X more" indicator reflects the remaining contributor count

#### Scenario: Authenticated user sees join button and own contribution
- **GIVEN** an authenticated user views the events page
- **AND** a campaign the user has not joined has an active run
- **WHEN** the page loads
- **THEN** a join button is displayed for that campaign
- **AND** campaigns whose active run the user has joined show the user's contribution
- **AND** joined upcoming runs show a "starts on" state instead of a contribution

### Requirement: Join affordance and card copy
The join affordance SHALL state that usernames and contribution distances are publicly visible before joining, and each campaign card SHALL state which walk dates count toward the campaign.

#### Scenario: Disclosure and window copy are present
- **GIVEN** the events page renders a campaign card with a join affordance
- **WHEN** the user inspects the card
- **THEN** the public-visibility disclosure appears near the join action
- **AND** the which-walk-dates-count line appears on the card
