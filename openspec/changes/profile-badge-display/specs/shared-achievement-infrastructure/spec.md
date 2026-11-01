## MODIFIED Requirements

### Requirement: Aggregated achievement summary with repeat counts
The system SHALL return achievement summaries that group earned instances by achievement definition, SHALL include the repeat count for repeatable badges, and SHALL include the definition's display fields plus its raw `metadata` payload.

#### Scenario: Summary for a user with no achievements returns empty
- **GIVEN** a user has no earned achievement instances
- **WHEN** a consuming feature requests the user's achievement summary
- **THEN** the system returns an empty list

#### Scenario: Summary groups multiple earns of the same repeatable badge
- **GIVEN** a user has earned the same repeatable achievement three times
- **WHEN** a consuming feature requests the user's achievement summary
- **THEN** the system returns one summary entry for that achievement
- **AND** the entry includes `earned_count: 3`
- **AND** the entry includes the definition's name, description, image_slug, and badge_type

#### Scenario: Summary includes one-time badges with count of one
- **GIVEN** a user has earned a non-repeatable achievement once
- **WHEN** a consuming feature requests the user's achievement summary
- **THEN** the system returns one summary entry with `earned_count: 1`

#### Scenario: Summary returns multiple distinct badges
- **GIVEN** a user has earned two different achievements
- **WHEN** a consuming feature requests the user's achievement summary
- **THEN** the system returns two summary entries, one per achievement definition

#### Scenario: Summary includes definition metadata
- **GIVEN** an achievement definition whose `metadata` column contains a JSON payload
- **WHEN** a consuming feature requests the user's achievement summary
- **THEN** the matching entry includes that raw `metadata` value
- **AND** a definition whose `metadata` is null returns null
