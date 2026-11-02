## ADDED Requirements

### Requirement: Habit catalog expansion

The system SHALL seed three global, repeatable habit achievement definitions — `habit-weekend-warrior`, `habit-steady-month`, and `habit-hundred-week` — each with a display name, a user-facing description, `image_slug` equal to its slug, `badge_type` of `habit`, `is_repeatable` of 1, and metadata containing `storyline: null`, four ascending `rank_thresholds`, a `criteria` label, and a `unit`.

#### Scenario: Weekend Warrior is catalogued

- **WHEN** the catalog expansion migration is applied
- **THEN** `habit-weekend-warrior` exists as a repeatable habit badge named "Weekend Warrior"
- **AND** its description states that a walk is logged on both Saturday and Sunday of the same week
- **AND** its metadata has `storyline: null`, `rank_thresholds: [1, 4, 12, 26]`, `criteria: "weekend_both_days"`, and `unit: "weekends"`

#### Scenario: Steady Month is catalogued

- **WHEN** the catalog expansion migration is applied
- **THEN** `habit-steady-month` exists as a repeatable habit badge named "Steady Month"
- **AND** its description states that at least 20 distinct days are logged in a calendar month
- **AND** its metadata has `storyline: null`, `rank_thresholds: [1, 3, 6, 12]`, `criteria: "distinct_days_month >= 20"`, and `unit: "months"`

#### Scenario: Hundred-K Week is catalogued

- **WHEN** the catalog expansion migration is applied
- **THEN** `habit-hundred-week` exists as a repeatable habit badge named "Hundred-K Week"
- **AND** its description states that at least 100 km are logged within a trailing seven-day window
- **AND** its metadata has `storyline: null`, `rank_thresholds: [1, 4, 12, 26]`, `criteria: "trailing_7d_km >= 100"`, and `unit: "weeks"`

#### Scenario: Habit definitions resolve a rank from repeat count

- **GIVEN** a user has earned `habit-weekend-warrior` four times
- **WHEN** the achievement summary is displayed
- **THEN** the definition's `rank_thresholds` place the badge at rank 2
- **AND** no fixed `rank` value is stored on the definition

### Requirement: Community fellowship collection

The system SHALL seed two non-repeatable community achievement definitions — `community-fellowship-founder` and `community-good-company` — that form the two-badge collection `community-fellowship` ("The Fellowship"), each with `badge_type` of `community`, `storyline: null`, `image_slug` equal to its slug, and a fixed rank and collection position.

#### Scenario: Fellowship Founder is catalogued

- **WHEN** the catalog expansion migration is applied
- **THEN** `community-fellowship-founder` exists as a non-repeatable community badge named "Fellowship Founder"
- **AND** its metadata has `rank: 1`, `criteria: "party_created"`, and collection position 1 of 2 in `community-fellowship`

#### Scenario: Good Company is catalogued

- **WHEN** the catalog expansion migration is applied
- **THEN** `community-good-company` exists as a non-repeatable community badge named "Good Company"
- **AND** its description states that the user belongs to a fellowship with at least four active members
- **AND** its metadata has `rank: 2`, `criteria: "party_active_members >= 4"`, and collection position 2 of 2 in `community-fellowship`

#### Scenario: Community collection positions are complete

- **GIVEN** both community definitions are seeded
- **THEN** their collection entries share the slug `community-fellowship` and label `The Fellowship`
- **AND** their `index` values are 1 and 2 with a shared `size` of 2

### Requirement: Idempotent and order-independent seeding

The migration SHALL insert definitions with `INSERT OR IGNORE`, SHALL NOT reference explicit row IDs, SHALL NOT change the schema, and SHALL be safe to apply more than once and independently of the ten-definition `profile-badge-display` seed.

#### Scenario: Migration is applied twice

- **GIVEN** the achievement definition table exists
- **WHEN** the catalog expansion migration is applied twice
- **THEN** exactly five definitions from this change exist
- **AND** every slug is unique
- **AND** no error is raised on the second application

#### Scenario: Migration runs before the ten-badge seed

- **GIVEN** only the shared achievement tables exist
- **WHEN** the catalog expansion migration is applied before the `profile-badge-display` seed
- **THEN** the five definitions are created
- **AND** the later ten-badge seed can be applied without a slug collision

#### Scenario: Migration changes no schema

- **WHEN** the catalog expansion migration is applied
- **THEN** no table, column, or index is created, altered, or dropped

### Requirement: Catalog-only ownership boundary

This change SHALL add only the five named definitions, SHALL NOT add book, challenge, field-guide, or campaign definitions, SHALL NOT implement award hooks or badge artwork, and SHALL preserve the `profile-badge-display` ten-definition seed unchanged.

#### Scenario: No foreign-family definitions are added

- **WHEN** the catalog expansion migration is applied
- **THEN** no definition slug begins with `journey-`, `book-`, `challenge-`, `field-guide-`, or `campaign-`
- **AND** the five new slugs do not include `habit-first-steps` or `habit-faithful-walker`

#### Scenario: New definitions are inert until a consuming feature awards them

- **GIVEN** the catalog expansion migration has been applied
- **WHEN** no award hook for these criteria has shipped
- **THEN** creating a fellowship or logging a qualifying habit week does not create an earned instance for any of the five definitions

#### Scenario: Artwork is not part of this change

- **WHEN** this change is applied
- **THEN** every definition references an `image_slug` equal to its slug
- **AND** no files are added under `public/img/achievements/`
