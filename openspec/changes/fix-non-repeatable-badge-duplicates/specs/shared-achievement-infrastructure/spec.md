# Spec Delta

## MODIFIED Requirements

### Requirement: Append-only earned achievement instances

The system SHALL store achievement records as append-only instances, SHALL enforce idempotency through a unique constraint on user, achievement, and idempotency key, SHALL treat any existing instance of a non-repeatable achievement as satisfying a later award regardless of its key, and SHALL preserve instances across later walk edits, deletes, or progress changes. A one-time duplicate correction MAY remove accidental duplicate non-repeatable rows.

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

#### Scenario: Backfilled instance blocks a later runtime award

- **GIVEN** a non-repeatable badge was awarded by a backfill under a legacy key such as `journey:<slug>`
- **WHEN** the runtime award path later awards the same badge under the non-repeatable sentinel key
- **THEN** the system finds the existing instance regardless of key
- **AND** no second row is inserted
- **AND** the definition's earned count stays 1

#### Scenario: Duplicate correction leaves one instance

- **GIVEN** a non-repeatable achievement has more than one earned instance for a user
- **WHEN** the duplicate-correction migration runs
- **THEN** exactly one instance remains, keyed with the non-repeatable sentinel
- **AND** the earliest instance is the survivor
- **AND** if any removed duplicate was acknowledged, the survivor is acknowledged
- **AND** re-applying the migration changes nothing

#### Scenario: Award returns instance ID and newness flag

- **GIVEN** a valid achievement slug and idempotency key
- **WHEN** a consuming feature calls the award service
- **THEN** the service returns an object with `instanceId` (the inserted or existing row ID) and `isNew` (true for first award, false for duplicate)

#### Scenario: Missing achievement slug throws error

- **GIVEN** no achievement definition exists with a given slug
- **WHEN** a consuming feature calls the award service with that slug
- **THEN** the service throws an `AchievementDefinitionNotFoundError`

#### Scenario: Progress operations never delete or mutate earned instances

- **GIVEN** a user has earned an achievement
- **WHEN** a later walk edit, walk delete, or progress reconciliation occurs
- **THEN** no existing `user_achievement_instances` row is deleted
- **AND** no existing row's columns are modified
