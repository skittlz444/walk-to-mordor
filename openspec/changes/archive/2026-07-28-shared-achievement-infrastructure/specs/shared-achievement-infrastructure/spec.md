## ADDED Requirements

### Requirement: Achievement definition storage
The system SHALL store reusable achievement definitions with a unique slug, display name, description, image reference, badge type, repeatability flag, and extensible metadata, and SHALL make them queryable by consuming features.

#### Scenario: Achievement definition is created with unique slug
- **WHEN** a migration or consuming feature inserts an achievement definition with a slug
- **THEN** the definition is stored with its name, description, image_slug, badge_type, is_repeatable flag, and metadata

#### Scenario: Duplicate slug is rejected
- **WHEN** a migration or consuming feature attempts to insert an achievement definition with an existing slug
- **THEN** the system rejects the duplicate

#### Scenario: Consuming feature queries achievement definition by slug
- **WHEN** a consuming feature looks up a definition by its slug
- **THEN** the system returns the full definition row including is_repeatable and badge_type

### Requirement: Append-only earned achievement instances
The system SHALL store earned achievement records as append-only instances, SHALL enforce idempotency through a unique constraint on user, achievement, and idempotency key, and SHALL preserve earned instances regardless of later walk edits, deletes, or progress changes.

#### Scenario: First award creates a new instance
- **GIVEN** a user has not earned a specific achievement with a given idempotency key
- **WHEN** a consuming feature calls the award service with user ID, achievement slug, idempotency key, and context metadata
- **THEN** the system inserts one new earned instance with the current timestamp and provided context

#### Scenario: Duplicate award with same idempotency key is a no-op
- **GIVEN** a user has already earned a specific achievement with a given idempotency key
- **WHEN** a consuming feature calls the award service with the same user, achievement slug, and idempotency key
- **THEN** the system does not insert a duplicate row
- **AND** the service returns success without error

#### Scenario: Repeatable badge creates distinct instances per idempotency key
- **GIVEN** an achievement definition is marked as repeatable
- **AND** a user has already earned that badge once with idempotency key A
- **WHEN** a consuming feature calls the award service with a different idempotency key B
- **THEN** the system inserts a second earned instance for the same user and achievement

#### Scenario: Non-repeatable badge blocks second award
- **GIVEN** an achievement definition is marked as non-repeatable
- **AND** a user has already earned that badge with any idempotency key
- **WHEN** a consuming feature calls the award service with a different idempotency key
- **THEN** the system does not insert a new row
- **AND** the service returns `{ isNew: false, instanceId: <existingId> }`

#### Scenario: Award returns instance ID and newness flag
- **GIVEN** a valid achievement slug and idempotency key
- **WHEN** a consuming feature calls the award service
- **THEN** the service returns an object with `instanceId` (the inserted or existing row ID) and `isNew` (true for first award, false for duplicate)

#### Scenario: Missing achievement slug throws error
- **GIVEN** no achievement definition exists with a given slug
- **WHEN** a consuming feature calls the award service with that slug
- **THEN** the service throws an `AchievementDefinitionNotFoundError`

#### Scenario: Earned instances are never deleted or mutated
- **GIVEN** a user has earned an achievement
- **WHEN** any subsequent operation occurs (walk edit, walk delete, progress reconciliation)
- **THEN** no existing `user_achievement_instances` row is deleted
- **AND** no existing row's columns are modified

### Requirement: Aggregated achievement summary with repeat counts
The system SHALL return achievement summaries that group earned instances by achievement definition, SHALL include the repeat count for repeatable badges, and SHALL include the full definition metadata for display.

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
