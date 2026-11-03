# achievement-catalog-expansion Specification

## Purpose
Seeds the second achievement-catalog slice — three global repeatable habit badges and a two-badge fellowship collection — and makes all five earnable from walk logging and party lifecycle events.

## Requirements

### Requirement: Habit catalog expansion

The system SHALL seed three global, repeatable habit achievement definitions — `habit-weekend-warrior`, `habit-steady-month`, and `habit-hundred-week` — each with a display name, a user-facing description, `image_slug` equal to its slug, `badge_type` of `habit`, `is_repeatable` of 1, and metadata containing `storyline: null`, four ascending `rank_thresholds`, a `criteria` label, and a `unit`.

#### Scenario: Weekend Warrior is catalogued

- **WHEN** the catalog migrations are applied
- **THEN** `habit-weekend-warrior` exists as a repeatable habit badge named "Weekend Warrior"
- **AND** its description states that a walk is logged on both Saturday and Sunday of the same week
- **AND** its metadata has `storyline: null`, `rank_thresholds: [1, 4, 12, 26]`, `criteria: "weekend_both_days"`, and `unit: "weekends"`

#### Scenario: Steady Month is catalogued

- **WHEN** the catalog migrations are applied
- **THEN** `habit-steady-month` exists as a repeatable habit badge named "Steady Month"
- **AND** its description states that at least 20 distinct days are logged in a calendar month
- **AND** its metadata has `storyline: null`, `rank_thresholds: [1, 3, 6, 12]`, `criteria: "distinct_days_month >= 20"`, and `unit: "months"`

#### Scenario: Hundred-K Week is catalogued

- **WHEN** the catalog migrations are applied
- **THEN** `habit-hundred-week` exists as a repeatable habit badge named "Hundred-K Week"
- **AND** its description states that at least 100 km are logged within a Monday–Sunday calendar week
- **AND** its metadata has `storyline: null`, `rank_thresholds: [1, 4, 12, 26]`, `criteria: "trailing_7d_km >= 100"`, and `unit: "weeks"`

#### Scenario: Habit definitions resolve a rank from repeat count

- **GIVEN** a user has earned `habit-weekend-warrior` four times
- **WHEN** the achievement summary is displayed
- **THEN** the definition's `rank_thresholds` place the badge at rank 2
- **AND** no fixed `rank` value is stored on the definition

### Requirement: Community fellowship collection

The system SHALL seed two non-repeatable community achievement definitions — `community-fellowship-founder` and `community-good-company` — that form the two-badge collection `community-fellowship` ("The Fellowship"), each with `badge_type` of `community`, `storyline: null`, `image_slug` equal to its slug, and a fixed rank and collection position.

#### Scenario: Fellowship Founder is catalogued

- **WHEN** the catalog migrations are applied
- **THEN** `community-fellowship-founder` exists as a non-repeatable community badge named "Fellowship Founder"
- **AND** its metadata has `rank: 1`, `criteria: "party_created"`, and collection position 1 of 2 in `community-fellowship`

#### Scenario: Good Company is catalogued

- **WHEN** the catalog migrations are applied
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

### Requirement: Catalog scope and ownership boundary

This change SHALL add only the five named definitions and their award integration, SHALL NOT add book, challenge, field-guide, or campaign definitions, SHALL preserve the `profile-badge-display` ten-definition seed unchanged, and SHALL NOT change the schema or add admin UI.

#### Scenario: No foreign-family definitions are added

- **WHEN** the catalog expansion migration is applied
- **THEN** no definition slug begins with `journey-`, `book-`, `challenge-`, `field-guide-`, or `campaign-`
- **AND** the five new slugs do not include `habit-first-steps` or `habit-faithful-walker`

#### Scenario: The five definitions become earnable through this change

- **GIVEN** the catalog migrations have been applied
- **WHEN** a user logs a qualifying habit window or creates a qualifying fellowship
- **THEN** the matching definition earns an instance without any further feature opt-in

#### Scenario: Artwork ships for the five slugs

- **WHEN** this change is applied
- **THEN** every definition references an `image_slug` equal to its slug
- **AND** a 512 px card and a 200 px thumbnail exist under `public/img/achievements/` for each slug
- **AND** a definition without art still renders the profile placeholder

### Requirement: Fellowship badge award integration

The system SHALL award `community-fellowship-founder` to the user who creates a fellowship and `community-good-company` to every active member of a fellowship that has at least four active members, covering both direct-join and invite-accept activation, awarding each badge at most once per user and never failing the party operation when an award fails.

#### Scenario: Founder is awarded on fellowship creation

- **GIVEN** an authenticated user with no fellowship badges
- **WHEN** the user creates a fellowship
- **THEN** `community-fellowship-founder` is awarded once
- **AND** creating another fellowship does not create a second instance

#### Scenario: Good Company is awarded at the fourth active member

- **GIVEN** a fellowship with three active members
- **WHEN** a fourth member joins directly
- **THEN** `community-good-company` is awarded to all four active members
- **AND** the founding leader receives it too

#### Scenario: Invite acceptance counts toward Good Company

- **GIVEN** a fellowship with three active members
- **WHEN** an invited user accepts and becomes active
- **THEN** `community-good-company` is awarded to all active members
- **AND** the invite-accept path awards without requiring a separate join

#### Scenario: Late joiners to a qualifying fellowship are awarded

- **GIVEN** a fellowship that already has four active members
- **WHEN** another user joins or accepts an invite
- **THEN** the new member is awarded `community-good-company` on activation
- **AND** the other active members do not receive a second instance

#### Scenario: Award failure does not fail the party operation

- **GIVEN** an award step that throws
- **WHEN** a user creates or joins a fellowship
- **THEN** the party write still succeeds
- **AND** the error is logged

#### Scenario: Existing fellowships are backfilled once

- **GIVEN** fellowships created before this change
- **WHEN** the fellowship backfill migration is applied
- **THEN** `community-fellowship-founder` is awarded to each non-dissolved fellowship's current leader
- **AND** `community-good-company` is awarded to active members of non-dissolved fellowships with at least four active members
- **AND** re-applying the migration creates no duplicates
