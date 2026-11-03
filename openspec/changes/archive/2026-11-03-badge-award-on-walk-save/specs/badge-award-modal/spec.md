# Spec Delta

## ADDED Requirements

### Requirement: Award modal greets pending awards after a walk save

The award modal SHALL run one event-driven pending check after each successful walk create or update in the same page view, without requiring a reload. The client SHALL dispatch a `wtm:walk-saved` document event only after the progress response succeeds. The check SHALL merge unseen awards by instance id, open the modal when nothing else is open, coalesce concurrent refreshes to at most one in flight plus one queued re-run, and treat any failure as silent. Deletes SHALL NOT trigger a check.

#### Scenario: A badge earned on the map opens without a reload

- **GIVEN** an authenticated user on the map with no visible award modal
- **WHEN** the user saves a walk that earns a badge and the progress response succeeds
- **THEN** the award modal opens on the newly earned badge
- **AND** the page was not reloaded

#### Scenario: A badge earned from the calendar opens without a reload

- **GIVEN** an authenticated user on the journey calendar
- **WHEN** the user saves a walk that earns a badge and the progress response succeeds
- **THEN** the award modal opens on the newly earned badge
- **AND** the page was not reloaded

#### Scenario: A badge earned while the queue is open is appended

- **GIVEN** the award modal is open on pending award 2 of 3
- **WHEN** a saved walk earns another badge
- **THEN** the new award is appended to the queue
- **AND** the modal still shows award 2 and the total reaches 4
- **AND** advancing reaches the appended award

#### Scenario: Already-queued awards are not duplicated

- **GIVEN** a pending award is already in the in-memory queue
- **WHEN** a save-triggered check returns that award again
- **THEN** the queue keeps exactly one entry for that instance

#### Scenario: A rejected save does not check

- **GIVEN** a save that the server rejects, such as a duplicate date returning 409
- **WHEN** the progress response resolves
- **THEN** no `wtm:walk-saved` event is dispatched
- **AND** no pending check is made

#### Scenario: A delete does not check

- **GIVEN** a successful walk delete
- **WHEN** the `wtm:walk-saved` event reports the delete action
- **THEN** no pending check is made
- **AND** no award modal is opened

#### Scenario: A failed check is silent

- **GIVEN** a successful walk save
- **WHEN** the pending check returns 401, another error, or an empty list
- **THEN** no award modal is opened
- **AND** no acknowledge error is shown
- **AND** the walk remains saved in the UI

#### Scenario: Concurrent saves coalesce

- **GIVEN** a pending check is already in flight
- **WHEN** another successful walk save dispatches the event
- **THEN** at most one additional check runs after the in-flight check settles
- **AND** no two checks run concurrently

## MODIFIED Requirements

### Requirement: Award modal greets pending awards on page open

The system SHALL mount the award modal island on every authenticated SSR page, including the map. After hydration, if the user has pending awards, the modal SHALL open on the first pending award; with no session or a failed or empty hydration check it SHALL render nothing and issue no further hydration check in that page view. The island SHALL defer opening only while another modal dialog is open, and SHALL queue rather than drop the pending awards. The map is not a modal dialog.

#### Scenario: Page open with pending awards shows the modal

- **GIVEN** an authenticated user reaches any SSR page with unacknowledged awards
- **WHEN** the pending check completes successfully with a non-empty list
- **THEN** the award modal opens showing the first pending badge

#### Scenario: Queue length is conveyed

- **GIVEN** a user with more than one pending award
- **WHEN** the acknowledge-mode modal is open
- **THEN** the modal shows the position in the queue, such as "Badge 2 of 3"
- **AND** the count is exposed to assistive technology

#### Scenario: No pending awards renders nothing

- **GIVEN** an authenticated user with no pending awards
- **WHEN** the pending check completes
- **THEN** nothing is rendered inside the island mount

#### Scenario: No session token makes no request

- **GIVEN** a visitor with no session token in local storage
- **WHEN** the modal island hydrates
- **THEN** no pending request is made
- **AND** nothing is rendered

#### Scenario: 401 and failure render nothing

- **GIVEN** a session token that the server rejects as expired
- **WHEN** the hydration check returns 401 or fails
- **THEN** nothing is rendered and no further hydration check is issued in that page view

#### Scenario: Another modal already visible defers opening

- **GIVEN** pending awards exist and another modal dialog is already open on the page
- **WHEN** the modal island's open attempt runs
- **THEN** the award modal waits until no modal dialog is open before opening
- **AND** if the user leaves the page without it opening, the award stays pending

#### Scenario: Map page opens the award modal

- **GIVEN** an authenticated user reaches the map page with pending awards
- **WHEN** the pending check completes successfully with a non-empty list
- **THEN** the award modal opens normally
- **AND** the map is not treated as an open modal
