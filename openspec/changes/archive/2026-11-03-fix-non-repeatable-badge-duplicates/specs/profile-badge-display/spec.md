# Spec Delta

## MODIFIED Requirements

### Requirement: Badge grid on the profile page

The system SHALL render earned badges grouped by collection, showing artwork, name, rank, collection position, and a repeat count only for repeatable badges. Collections render with a progress header; standalone badges render newest first. Skeletons show while loading; nothing renders when the summary is empty.

#### Scenario: Profile page shows badge grid with earned badges

- **GIVEN** an authenticated user with earned achievements
- **WHEN** the page loads and the achievements request completes
- **THEN** a grid of badge cards is displayed
- **AND** each card shows the badge image and name

#### Scenario: Collections render as grouped sections

- **GIVEN** a user who has earned three badges from an eight-badge collection and one standalone badge
- **WHEN** the grid renders
- **THEN** the three collection badges appear together in collection-index order
- **AND** the section header shows the collection label and `3/8`
- **AND** the standalone badge appears after the collection section

#### Scenario: Repeatable badges show a count overlay

- **GIVEN** a repeatable badge with `earned_count` greater than 1
- **WHEN** the card renders
- **THEN** the card shows the repeat count

#### Scenario: Non-repeatable badges never show a count overlay

- **GIVEN** a non-repeatable badge whose summary reports `earned_count` greater than 1
- **WHEN** the card renders
- **THEN** the card shows no repeat count
- **AND** the accessible name does not claim the badge was earned more than once

#### Scenario: Rank is visible on the card

- **GIVEN** a badge with `presentation.rank` and `presentation.rank_label`
- **WHEN** the card renders
- **THEN** the card shows the rank label
- **AND** the rank is exposed to assistive technology

#### Scenario: Circular placeholders show while loading

- **GIVEN** an authenticated user views their profile page
- **WHEN** the achievements request is still in flight after a short delay
- **THEN** circular skeleton shapes are displayed
- **AND** the shapes are replaced when data arrives

#### Scenario: Profile page shows nothing when user has no badges

- **GIVEN** an authenticated user with no earned achievements
- **WHEN** the achievements request completes with an empty list
- **THEN** no badge section is rendered
- **AND** no placeholder or empty-state message is displayed

#### Scenario: Failed request renders nothing and logs

- **GIVEN** an authenticated user views their profile page
- **WHEN** the achievements request fails
- **THEN** the skeletons are removed
- **AND** no badge section is rendered
- **AND** the failure is logged to the console
