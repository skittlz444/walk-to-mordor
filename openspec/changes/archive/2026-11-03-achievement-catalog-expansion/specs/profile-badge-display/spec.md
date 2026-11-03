# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
