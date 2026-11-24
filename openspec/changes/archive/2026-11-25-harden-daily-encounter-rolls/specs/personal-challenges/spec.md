# Spec Delta

## ADDED Requirements

### Requirement: Daily encounter rolls are finalized before they are stored

The system SHALL persist a daily encounter roll only after eligibility, probability, definition selection, and target calculation have completed, and SHALL allow a later request on the same UTC day to retry when no finalized roll was stored. A stored roll SHALL remain terminal for that user and UTC day.

#### Scenario: Failure before finalization does not consume the daily roll
- **GIVEN** an authenticated user has no finalized roll for today
- **AND** the first roll attempt fails before an outcome is determined
- **WHEN** the user requests the daily roll again on the same UTC day
- **THEN** the system performs a normal roll instead of returning a stored no-offer result

#### Scenario: Concurrent first requests converge on one finalized result
- **GIVEN** an authenticated user has no roll for today
- **WHEN** two daily-roll requests for that user overlap
- **THEN** exactly one finalized roll is stored
- **AND** both requests receive the same offer or no-offer result

#### Scenario: A finalized no-offer roll is terminal for the UTC day
- **GIVEN** a daily roll has been finalized without an offer
- **WHEN** the user requests the daily roll again on the same UTC day
- **THEN** the system returns the stored no-offer result without performing another probability draw

#### Scenario: A finalized offer keeps its definition and target
- **GIVEN** a daily roll has been finalized with an offer
- **WHEN** the user refreshes the page or repeats the request
- **THEN** the system returns the same encounter definition and personalized target
- **AND** no second occurrence or roll is created

### Requirement: Daily encounter roll outcomes are auditable

The system SHALL persist an explicit outcome for every finalized daily roll using one of `offer`, `probability_miss`, `insufficient_activity`, `active_challenge`, or `no_definition`, and SHALL mark pre-existing rows whose historical outcome cannot be reconstructed as `legacy_unknown` without changing their observable offer behavior.

#### Scenario: Successful offer is recorded
- **GIVEN** an eligible user passes the active probability branch
- **WHEN** the daily roll is finalized with an encounter offer
- **THEN** the stored outcome is `offer`
- **AND** the stored roll references the selected definition and personalized target

#### Scenario: Probability miss is distinguished from eligibility rejection
- **GIVEN** an eligible user does not pass the active probability branch
- **WHEN** the daily roll is finalized without an offer
- **THEN** the stored outcome is `probability_miss`

#### Scenario: Eligibility rejection records its reason
- **GIVEN** a user is ineligible because of insufficient activity, an active challenge, or no enabled definition
- **WHEN** the daily roll is finalized without an offer
- **THEN** the stored outcome is `insufficient_activity`, `active_challenge`, or `no_definition` respectively

#### Scenario: Historical rows remain readable
- **GIVEN** a daily roll written before outcome tracking has an encounter definition and preview target
- **WHEN** the roll result is reconstructed after migration
- **THEN** it is treated as an offer
- **AND** its stored outcome is `offer`

#### Scenario: Historical null-offer rows are marked unknown
- **GIVEN** a daily roll written before outcome tracking has no encounter definition or preview target
- **WHEN** the migration backfills existing rows
- **THEN** its stored outcome is `legacy_unknown`
- **AND** repeated requests continue to return no offer
