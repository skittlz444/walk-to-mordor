# Spec Delta

## REMOVED Requirements

### Requirement: Event templates and occurrences
**Reason**: The shared template/occurrence schema was never implemented. Personal challenges shipped with dedicated tables, and the community campaign design deliberately uses separate `campaign_definitions`, `campaign_participants`, and `campaign_progress_ledger` tables. The requirement's crafted-occurrence scenario would mandate a schema the new capability rejects.
**Migration**: Use the `Campaign definitions and public visibility` requirement in `openspec/specs/community-campaigns/spec.md` for campaign definitions and the `Personal encounter definitions and occurrences` requirement in `openspec/specs/personal-challenges/spec.md` for personal encounters.

### Requirement: Event participation
**Reason**: Duplicated and looser than the `Campaign participation` requirement in the `community-campaigns` capability, which adds join-time backfill, disabled-campaign rejection, duplicate-active rejection, and participant status semantics.
**Migration**: Use the `Campaign participation` requirement in `openspec/specs/community-campaigns/spec.md`.

### Requirement: Community campaign progress and contributors
**Reason**: Replaced by `Community campaign progress visibility` and `Contributor rankings and personal contribution` in the `community-campaigns` capability, which specify the per-run model, participant versus contributor counts, zero-distance handling, the top-50 cap with competition ranking, and public visibility rules.
**Migration**: Use the `Community campaign progress visibility` and `Contributor rankings and personal contribution` requirements in `openspec/specs/community-campaigns/spec.md`.

## MODIFIED Requirements

### Requirement: Event lifecycle settlement

The system SHALL process event lifecycle transitions through the existing daily scheduled run (09:00 UTC) without preventing existing scheduled notification jobs from running: community campaigns transition upcoming to active on their start date and active to expired after their end date when the target is unmet. Campaign completion SHALL be triggered synchronously during walk reconciliation, not by scheduled work. Personal challenge settlement remains specified by the `personal-challenges` capability.

#### Scenario: Upcoming campaign activates

- **GIVEN** a community campaign is upcoming and its start date has arrived (UTC)
- **WHEN** the daily scheduled run executes
- **THEN** the system marks the campaign active

#### Scenario: Active event closes after deadline

- **GIVEN** an active campaign whose end date has passed and whose community total is below target
- **WHEN** the daily scheduled run executes
- **THEN** the system marks the campaign expired
- **AND** no completion badges are awarded by the scheduled run

#### Scenario: Target-met campaign is not expired

- **GIVEN** an active campaign whose end date has passed but whose community total reached the target
- **WHEN** the daily scheduled run executes
- **THEN** the system does not mark the campaign expired

#### Scenario: Event settlement failure is isolated

- **GIVEN** event lifecycle processing encounters an error
- **WHEN** scheduled Worker processing continues
- **THEN** existing scheduled push notification jobs are not blocked by the event error

### Requirement: Event presentation

The system SHALL provide a public `/events` page for community campaigns plus authenticated personal-event surfaces for encounter offers on the journey and map pages. The public events page SHALL show community campaigns and the authenticated user's joined campaigns, but SHALL NOT show personal challenges.

#### Scenario: Encounter offer is shown only on journey and map pages

- **GIVEN** the daily roll endpoint returns a personal encounter offer
- **WHEN** the authenticated journey page or map page initializes
- **THEN** the user sees themed encounter text with explicit accept and decline actions

#### Scenario: Public user views events page

- **GIVEN** any user opens the events page
- **WHEN** event data loads
- **THEN** the page shows public community campaigns, community progress, and relevant public past outcomes

#### Scenario: Authenticated user sees personal event state on events page

- **GIVEN** an authenticated user opens the events page
- **WHEN** event data loads
- **THEN** the page shows that user's joined community campaigns
- **AND** personal challenges remain on their own surfaces rather than the public events page

#### Scenario: Achievements appear on profile surfaces

- **GIVEN** a user has earned one or more event achievements
- **WHEN** the user's profile or friend profile is viewed
- **THEN** earned event achievements are displayed with their names and visual badge metadata
