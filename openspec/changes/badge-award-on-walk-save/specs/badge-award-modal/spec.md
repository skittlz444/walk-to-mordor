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
