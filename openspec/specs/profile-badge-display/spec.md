# profile-badge-display Specification

## Purpose

Defines the achievement summary API, ranked badge presentation, profile and friend-profile badge grids, the seeded first catalog, and artwork resolution for those grids.

## Requirements

### Requirement: Authenticated achievement summary endpoint

The system SHALL expose `GET /api/achievements` to an authenticated caller, returning `{ achievements: [...] }` ordered newest-earned first. Each entry SHALL include the badge definition fields, `earned_count`, first and last earned timestamps, and a `presentation` block.

#### Scenario: Authenticated user fetches own achievements
- **GIVEN** an authenticated user with earned achievements
- **WHEN** the user calls `GET /api/achievements`
- **THEN** the response status is 200
- **AND** the body contains an `achievements` array
- **AND** each entry includes `slug`, `name`, `description`, `image_slug`, `badge_type`, `is_repeatable`, `earned_count`, `first_earned_at`, `last_earned_at`, and `presentation`

#### Scenario: User with no achievements receives empty list
- **GIVEN** an authenticated user with no earned achievement instances
- **WHEN** the user calls `GET /api/achievements`
- **THEN** the response status is 200
- **AND** `achievements` is an empty array

#### Scenario: Unauthenticated request is rejected
- **GIVEN** a request without a valid session token
- **WHEN** `GET /api/achievements` is called
- **THEN** the system returns a 401 error

#### Scenario: Achievements are ordered newest-earned first
- **GIVEN** an authenticated user with badges earned on different dates
- **WHEN** the user calls `GET /api/achievements`
- **THEN** the entry with the most recent `last_earned_at` appears first

### Requirement: Friend-scoped achievement access

The system SHALL accept an optional `userId` query parameter and return that user's summary only when an accepted friendship exists in either direction. Self-queries resolve to the caller. Non-friends and unknown users SHALL receive 404.

#### Scenario: Friend fetches another user's achievements
- **GIVEN** an authenticated user A who is accepted friends with user B
- **AND** user B has earned achievements
- **WHEN** user A calls `GET /api/achievements?userId=<B>`
- **THEN** the response includes user B's achievement summary

#### Scenario: Non-friend cannot fetch another user's achievements
- **GIVEN** an authenticated user who is NOT friends with user B
- **WHEN** the user calls `GET /api/achievements?userId=<B>`
- **THEN** the system returns a 404 error

#### Scenario: Unknown user is indistinguishable from a non-friend
- **GIVEN** an authenticated user
- **WHEN** the user calls `GET /api/achievements?userId=<nonexistent>`
- **THEN** the system returns a 404 error

#### Scenario: Self query returns the caller's own summary
- **GIVEN** an authenticated user A
- **WHEN** user A calls `GET /api/achievements?userId=<A>`
- **THEN** the response includes user A's own achievement summary

#### Scenario: Invalid userId is rejected
- **GIVEN** an authenticated user
- **WHEN** the user calls `GET /api/achievements?userId=abc`
- **THEN** the system returns a 400 error

#### Scenario: Friend sees empty achievements for user with none
- **GIVEN** an authenticated user who is friends with user B
- **AND** user B has no earned achievements
- **WHEN** the user calls `GET /api/achievements?userId=<B>`
- **THEN** `achievements` is an empty array

### Requirement: Ranked and numbered badge presentation

The system SHALL resolve rank and collection position from definition metadata: a fixed rank or earned-count thresholds mapped to ranks 1–4 (bronze, silver, gold, mithril), plus an optional collection position. Missing or malformed metadata SHALL fall back to rank 1 with no collection.

#### Scenario: Fixed rank is returned
- **GIVEN** a badge definition whose metadata contains `rank: 3`
- **WHEN** the achievement summary is returned
- **THEN** `presentation.rank` is 3
- **AND** `presentation.rank_label` is `gold`

#### Scenario: Repeat count raises rank through thresholds
- **GIVEN** a repeatable definition with `rank_thresholds` `[1, 4, 12, 26]`
- **AND** the user has earned it 5 times
- **WHEN** the achievement summary is returned
- **THEN** `presentation.rank` is 2
- **AND** `presentation.rank_label` is `silver`

#### Scenario: Earned count below the first threshold uses rank 1
- **GIVEN** a repeatable definition with `rank_thresholds` `[2, 4, 12, 26]`
- **AND** the user has earned it once
- **WHEN** the achievement summary is returned
- **THEN** `presentation.rank` is 1

#### Scenario: Collection position is returned
- **GIVEN** a definition whose metadata declares `collection` with `index: 3` and `size: 8`
- **WHEN** the achievement summary is returned
- **THEN** `presentation.collection.index` is 3
- **AND** `presentation.collection.size` is 8
- **AND** `presentation.collection.slug` and `label` match the metadata

#### Scenario: Missing or malformed metadata falls back safely
- **GIVEN** a definition whose `metadata` is null, invalid JSON, or contains out-of-range values
- **WHEN** the achievement summary is returned
- **THEN** `presentation.rank` is 1
- **AND** `presentation.collection` is null
- **AND** `presentation.storyline` is null

#### Scenario: Storyline scope is returned
- **GIVEN** a definition whose metadata contains `storyline: "frodo-sam"`
- **WHEN** the achievement summary is returned
- **THEN** `presentation.storyline` is `frodo-sam`

### Requirement: Badge grid on the profile page

The system SHALL render earned badges grouped by collection, showing artwork, name, rank, collection position, and repeat count. Collections render with a progress header; standalone badges render newest first. Skeletons show while loading; nothing renders when the summary is empty.

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
- **GIVEN** a badge with `earned_count` greater than 1
- **WHEN** the card renders
- **THEN** the card shows the repeat count

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

### Requirement: Badge grid on the friend profile page

The system SHALL render a friend's earned badges using the same grid, rank, collection, and empty-state rules as the profile page, with the friend's user ID detected from the page URL.

#### Scenario: Friend profile page shows friend's badges
- **GIVEN** user A views user B's friend profile page at `/friends/<B>`
- **AND** user B has earned achievements
- **WHEN** the friend profile page loads
- **THEN** user B's badges are displayed in a grid below the friend's profile information

#### Scenario: Friend profile page shows nothing when friend has no badges
- **GIVEN** user A views user B's friend profile page
- **AND** user B has no earned achievements
- **WHEN** the achievements request completes with an empty list
- **THEN** no badge section is rendered

#### Scenario: Non-friend response is treated as no badges
- **GIVEN** user A is not friends with user B
- **WHEN** the badges request for user B returns 404
- **THEN** no badge section is rendered

### Requirement: Seeded initial badge catalog

The system SHALL seed eight Frodo/Sam journey badges forming one numbered, ranked collection and two global habit badges. Definitions SHALL carry rank, collection, storyline, and threshold metadata and SHALL be idempotently seeded.

#### Scenario: Journey definitions are seeded
- **GIVEN** the migration has been applied
- **THEN** eight `journey-*` definitions exist with `badge_type` of `journey`
- **AND** each carries `storyline: "frodo-sam"`, a fixed rank, a distance threshold, and a collection position from 1 to 8

#### Scenario: Glittering Caves return badge is seeded
- **GIVEN** the migration has been applied
- **THEN** `journey-frodo-sam-glittering-caves` exists with `badge_type` of `journey`
- **AND** its metadata has `storyline: "frodo-sam"`, `rank: 4`, `threshold_km: 3827.0`, and collection position 7 of 8 in `frodo-sam-journey`
- **AND** its description references Helm's Deep, the Glittering Caves of Aglarond, and the stone-gardens Gimli spoke of

#### Scenario: Habit definitions are seeded
- **THEN** `habit-first-steps` exists as a non-repeatable badge with fixed rank 1
- **AND** `habit-faithful-walker` exists as a repeatable badge with four rank thresholds
- **AND** both have no `storyline` scope

#### Scenario: Seeding is idempotent
- **GIVEN** the seed migration has already been applied
- **WHEN** the migration is applied again
- **THEN** no duplicate definitions are created

### Requirement: Storyline-aware award from walk logging

After a successful progress create or update, the system SHALL award badges whose conditions are met — journey badges against the user's displayed distance for the active storyline, habit criteria against raw walk data — skipping badges scoped to another storyline, and SHALL never fail the walk log when an award fails. The faithful-walker habit SHALL be awarded only when the logged date is a Sunday and all seven dates of that Monday–Sunday week have progress rows, keyed to that Sunday's date.

#### Scenario: Threshold crossing awards a journey badge

- **GIVEN** a Frodo/Sam user whose displayed distance is below a badge threshold
- **WHEN** the user logs enough distance to cross the threshold
- **THEN** the badge is awarded
- **AND** it appears in the achievement summary

#### Scenario: Badges scoped to another storyline are skipped

- **GIVEN** a user whose active storyline is not `frodo-sam`
- **AND** the user's displayed distance crosses a Frodo/Sam badge threshold
- **WHEN** the walk is logged
- **THEN** no Frodo/Sam badge is awarded

#### Scenario: Global habit badges apply on every storyline

- **GIVEN** a user on any active storyline
- **WHEN** the user logs their first walk
- **THEN** the first-steps habit badge is awarded

#### Scenario: Repeatable habit badge awards once per calendar week

- **GIVEN** a user with walks on all seven dates (Monday through Sunday) of a calendar week
- **WHEN** the Sunday walk is logged or updated
- **THEN** the faithful-walker badge is awarded
- **AND** the award is keyed to that Sunday's date
- **AND** logging or updating another walk in the same week does not award it again
- **AND** a week missing any of its seven dates is not awarded

#### Scenario: Repeatable habit badge waits for Sunday

- **GIVEN** a user with walks on Monday through Saturday of a calendar week
- **WHEN** the Saturday walk is logged or updated
- **THEN** the faithful-walker badge is not awarded
- **AND** it is awarded when the Sunday walk is logged or updated

#### Scenario: Duplicate awards are no-ops

- **GIVEN** a user who already earned a non-repeatable badge
- **WHEN** another qualifying walk is logged
- **THEN** no additional instance is created

#### Scenario: Award failure does not fail the walk log

- **GIVEN** an award step that throws
- **WHEN** the user logs a walk
- **THEN** the progress write still succeeds
- **AND** the error is logged

#### Scenario: Qualifying badges are backfilled for existing progress

- **GIVEN** a user whose distance already exceeds several thresholds before this change ships
- **WHEN** migration `0148_backfill_existing_achievements.sql` is applied
- **THEN** first-steps and every qualifying non-repeatable journey badge for the active storyline is awarded
- **AND** the user's next log remains idempotent

#### Scenario: Repeatable habits are not backfilled retroactively

- **GIVEN** an existing user with historical Monday-through-Sunday walking weeks
- **WHEN** the backfill migration runs
- **THEN** no faithful-walker instances are created for those historical weeks
- **AND** future Sunday logs continue to award the repeatable habit through the normal log path

### Requirement: Badge artwork resolution

The system SHALL resolve card artwork from `/img/achievements/<name>.webp`, thumbnails from `/img/achievements/<name>-thumb.webp`, and full artwork from `/img/achievements/full/<name>.webp`. `<name>` SHALL be `<image_slug>--<rank_label>` for repeatable badges and `<image_slug>` otherwise. This change SHALL commit the full artwork as an asset but SHALL NOT add a UI reference or click target for it.

#### Scenario: Fixed-rank image renders at all sizes
- **GIVEN** a badge with `image_slug` `journey-frodo-sam-buckleberry-ferry`
- **WHEN** the card, thumbnail, and full image are requested
- **THEN** the sources are `/img/achievements/journey-frodo-sam-buckleberry-ferry.webp`, `/img/achievements/journey-frodo-sam-buckleberry-ferry-thumb.webp`, and `/img/achievements/full/journey-frodo-sam-buckleberry-ferry.webp`

#### Scenario: Repeatable badge selects its rank variant
- **GIVEN** a repeatable badge with `image_slug` `habit-faithful-walker`, `presentation.rank` 3, and `presentation.rank_label` `gold`
- **WHEN** the card renders
- **THEN** the image source is `/img/achievements/habit-faithful-walker--gold.webp`
- **AND** the full image asset is `/img/achievements/full/habit-faithful-walker--gold.webp`

#### Scenario: Thumbnail is available for compact previews
- **GIVEN** a badge with a valid artwork name
- **WHEN** a compact preview requests the thumbnail
- **THEN** the source is `/img/achievements/<name>-thumb.webp`

### Requirement: Badge artwork fallback

When the image slug is null, malformed, or an image fails to load, the card SHALL render a CSS placeholder without breaking layout. A repeatable badge whose rank variant fails SHALL retry the base image before falling back.

#### Scenario: Missing rank variant falls back to the base image
- **GIVEN** a repeatable badge whose rank-variant image is missing
- **WHEN** the card image fails to load
- **THEN** the image source is retried with `/img/achievements/<image_slug>.webp`

#### Scenario: Null image slug uses the placeholder
- **GIVEN** a badge with a null `image_slug`
- **WHEN** the card renders
- **THEN** no image request is made
- **AND** a CSS placeholder is displayed

#### Scenario: Image load failure falls back without breaking layout
- **GIVEN** a badge whose card image and any applicable base fallback are missing
- **WHEN** the image fails to load
- **THEN** the broken image is hidden
- **AND** the card keeps its size and shows the name

#### Scenario: Malformed slug is not used in a URL
- **GIVEN** a badge whose `image_slug` contains path traversal or disallowed characters
- **WHEN** the card renders
- **THEN** no request is made to that path
- **AND** the CSS placeholder is displayed

### Requirement: Catalog habit award windows

The award hook SHALL evaluate three global habit criteria on every successful progress write using raw logged distance, with one idempotency key per window: `weekend_both_days` (both Saturday and Sunday of the weekend logged, keyed to that weekend), `distinct_days_month >= 20` (20 distinct dates in the logged month, keyed to that month), and `trailing_7d_km >= 100` (Sunday logs only; the Monday–Sunday week totals at least 100 km, keyed to that Sunday).

#### Scenario: Weekend Warrior is awarded when both weekend days are logged

- **GIVEN** a user with a Saturday walk
- **WHEN** the user logs the Sunday walk of the same weekend
- **THEN** `habit-weekend-warrior` is awarded
- **AND** the award is keyed to that weekend

#### Scenario: A weekend missing a day is not awarded

- **GIVEN** a user with only a Saturday walk
- **WHEN** the user logs a Monday walk
- **THEN** `habit-weekend-warrior` is not awarded for the previous weekend

#### Scenario: Weekend awards are idempotent per weekend

- **GIVEN** a user already awarded for a weekend
- **WHEN** the user updates a walk in that weekend
- **THEN** no second instance is created

#### Scenario: Steady Month is awarded at twenty distinct days

- **GIVEN** a user with 19 distinct logged dates in a month
- **WHEN** the user logs a walk on a 20th distinct date of that month
- **THEN** `habit-steady-month` is awarded
- **AND** the award is keyed to that month

#### Scenario: Steady Month waits for the twentieth distinct day

- **GIVEN** a user with 19 distinct logged dates in a month
- **WHEN** the user logs a walk on a date already logged that month
- **THEN** `habit-steady-month` is not awarded

#### Scenario: Month awards are idempotent per month

- **GIVEN** a user already awarded for a month
- **WHEN** the user logs another distinct date in that month
- **THEN** no second instance is created

#### Scenario: Hundred-K Week is awarded on the Sunday log

- **GIVEN** a user whose Monday–Sunday walks total at least 100 km
- **WHEN** the Sunday walk is logged
- **THEN** `habit-hundred-week` is awarded
- **AND** the award is keyed to that Sunday

#### Scenario: Hundred-K Week is not awarded before Sunday

- **GIVEN** a user whose walks so far total at least 100 km in the week
- **WHEN** a Monday-to-Saturday walk is logged
- **THEN** `habit-hundred-week` is not awarded

#### Scenario: Hundred-K Week waits for the missing Sunday log

- **GIVEN** a user whose Monday–Sunday walks total at least 100 km
- **WHEN** no Sunday walk is logged
- **THEN** `habit-hundred-week` is not awarded for that week

#### Scenario: Habit criteria use raw distance, not storyline offset

- **GIVEN** a user with a storyline distance offset
- **WHEN** the user's raw weekly distance is below 100 km but the displayed distance is above it
- **THEN** `habit-hundred-week` is not awarded

#### Scenario: New habit windows are not backfilled

- **GIVEN** an existing user with historical qualifying weekends, months, or 100 km weeks
- **WHEN** the catalog migrations and hooks ship
- **THEN** no habit instances are created for those historical windows
- **AND** future qualifying windows are awarded through the log path

#### Scenario: Repeated windows advance rank

- **GIVEN** a user awarded `habit-weekend-warrior` three times
- **WHEN** a fourth weekend qualifies
- **THEN** a fourth instance is created
- **AND** the presentation resolves rank 2 from `rank_thresholds`
