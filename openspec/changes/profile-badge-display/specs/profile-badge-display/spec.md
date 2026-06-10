## ADDED Requirements

### Requirement: Authenticated achievement summary endpoint
The system SHALL provide an endpoint that returns the authenticated user's aggregated achievement summary, including badge definitions with name, description, image slug, badge type, and earned count for repeatable badges.

#### Scenario: Authenticated user fetches own achievements
- **GIVEN** an authenticated user with earned achievements
- **WHEN** the user calls `GET /api/achievements`
- **THEN** the response includes an array of achievement summary entries
- **AND** each entry includes name, description, image_slug, badge_type, and earned_count

#### Scenario: User with no achievements receives empty list
- **GIVEN** an authenticated user with no earned achievement instances
- **WHEN** the user calls `GET /api/achievements`
- **THEN** the response includes an empty array

#### Scenario: Unauthenticated request is rejected
- **GIVEN** a request without a valid session token
- **WHEN** `GET /api/achievements` is called
- **THEN** the system returns a 401 error

### Requirement: Friend-scoped achievement access
The system SHALL return another user's achievement summary when the authenticated user provides a userId parameter AND has an accepted friendship with that user.

#### Scenario: Friend fetches another user's achievements
- **GIVEN** an authenticated user A who is accepted friends with user B
- **AND** user B has earned achievements
- **WHEN** user A calls `GET /api/achievements?userId=<B>`
- **THEN** the response includes user B's achievement summary

#### Scenario: Non-friend cannot fetch another user's achievements
- **GIVEN** an authenticated user who is NOT friends with user B
- **WHEN** the user calls `GET /api/achievements?userId=<B>`
- **THEN** the system returns a 403 error

#### Scenario: Friend sees empty achievements for user with none
- **GIVEN** an authenticated user who is friends with user B
- **AND** user B has no earned achievements
- **WHEN** the user calls `GET /api/achievements?userId=<B>`
- **THEN** the response includes an empty array

### Requirement: Badge grid display on profile page
The system SHALL render earned achievement badges as a visual grid on the authenticated user's profile page, showing each badge's image, name, and a repeat count overlay for badges earned more than once. The system SHALL show hexagonal skeleton placeholder shapes during data fetching.

#### Scenario: Profile page shows badge grid with earned badges
- **GIVEN** an authenticated user with earned achievements views their profile page
- **WHEN** the page loads and the achievements API request completes
- **THEN** a grid of badge cards is displayed
- **AND** each card shows the badge image and name
- **AND** repeatable badges earned more than once show a count overlay

#### Scenario: Profile page shows hexagonal shadow placeholders while loading
- **GIVEN** an authenticated user views their profile page
- **WHEN** the achievements API request is in-flight
- **THEN** hexagonal skeleton shapes are displayed as placeholders
- **AND** the shapes replace with real badge cards when data arrives

#### Scenario: Profile page shows nothing when user has no badges
- **GIVEN** an authenticated user with no earned achievements
- **WHEN** the achievements API request completes with an empty list
- **THEN** the hexagonal placeholders are removed
- **AND** no badge grid is rendered
- **AND** no placeholder or empty-state message is displayed

#### Scenario: Badge image gracefully handles load failure
- **GIVEN** an achievement definition references an image slug
- **WHEN** the image file is missing at both `/images/achievements/<slug>.png` and `/images/achievements/<slug>.webp`
- **THEN** the grid does not break layout
- **AND** the broken image is hidden for that badge card

### Requirement: Badge grid display on friend profile page
The system SHALL render a friend's earned achievement badges on the friend profile page, using the same grid layout and hexagonal loading placeholders as the profile page, with the friend's user ID detected from the page URL.

#### Scenario: Friend profile page shows friend's badges
- **GIVEN** user A views user B's friend profile page at `/friends/<B>`
- **AND** user B has earned achievements
- **WHEN** the friend profile page loads
- **THEN** user B's badges are displayed in a grid below the friend's profile information

#### Scenario: Friend profile page shows nothing when friend has no badges
- **GIVEN** user A views user B's friend profile page
- **AND** user B has no earned achievements
- **WHEN** the achievements API request completes with an empty list
- **THEN** no badge grid is rendered
