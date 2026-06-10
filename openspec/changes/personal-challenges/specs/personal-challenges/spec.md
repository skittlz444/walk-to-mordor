## ADDED Requirements

### Requirement: Personal encounter definitions and occurrences
The system SHALL store reusable personal encounter definitions separately from concrete user-specific encounter occurrences, and SHALL seed the Nazgul pursuit definition as globally eligible across all active storylines and path distances.

#### Scenario: Nazgul definition is seeded and globally eligible
- **WHEN** the application starts after migration
- **THEN** a Nazgul pursuit encounter definition exists
- **AND** the definition is globally eligible without storyline or path-distance restrictions

#### Scenario: Accepting an encounter creates a user-specific occurrence
- **GIVEN** an active personal encounter definition is offered to a user
- **WHEN** the user accepts the offered encounter
- **THEN** the system creates a user-specific timed occurrence with a personalized target distance, start time, and deadline

#### Scenario: Same definition can create distinct occurrences on repeated acceptance
- **GIVEN** a user has already completed a repeatable encounter definition in the past
- **WHEN** the same definition is offered again on a later eligible roll and the user accepts
- **THEN** the system creates a new occurrence distinct from the prior completion

### Requirement: Daily personal encounter rolls
The system SHALL roll for personal encounter offers at most once per authenticated user per UTC day, SHALL return the same roll result for repeated roll requests on that date, SHALL use defined probability branches based on recent encounter history, and SHALL not offer personal encounters to users below the minimum recent-activity threshold or with an active challenge in progress.

#### Scenario: First daily roll returns an offer or no-offer result
- **GIVEN** an authenticated user has not rolled for a personal encounter today
- **WHEN** the daily roll endpoint is called
- **THEN** the system records the roll for that user and date
- **AND** the response indicates either no encounter or one eligible encounter offer

#### Scenario: Repeated daily roll is idempotent
- **GIVEN** an authenticated user has already rolled for a personal encounter today
- **WHEN** the daily roll endpoint is called again
- **THEN** the system returns the existing roll result without rolling again

#### Scenario: Higher base chance after no recent encounter
- **GIVEN** a user meets the recent-activity threshold
- **AND** the user has not accepted or declined a personal encounter in the past 30 days
- **WHEN** the daily roll endpoint evaluates the user's chance
- **THEN** the system uses the 1-in-10 probability branch

#### Scenario: Lower repeat chance after recent encounter
- **GIVEN** a user meets the recent-activity threshold
- **AND** the user has accepted or declined a personal encounter in the past 30 days
- **WHEN** the daily roll endpoint evaluates the user's chance
- **THEN** the system uses the 1-in-30 probability branch

#### Scenario: Active personal challenge suppresses new offers
- **GIVEN** a user already has an active in-progress personal challenge
- **WHEN** the daily roll endpoint is called
- **THEN** the system does not offer a new personal encounter

#### Scenario: Insufficient activity history prevents personal encounter roll
- **GIVEN** a user has fewer than 7 walks in the past 30 days
- **AND** the user has fewer than 3 walks in the past 7 days
- **WHEN** the daily roll endpoint is called
- **THEN** the system returns a no-offer result with zero probability

### Requirement: Personal encounter choice
The system SHALL let a user accept or decline an offered personal encounter, and declining an encounter SHALL carry no penalty and SHALL prevent another roll for that user on the same UTC day.

#### Scenario: User accepts a Nazgul pursuit
- **GIVEN** the user is offered the Nazgul pursuit encounter
- **WHEN** the user chooses to accept and sends the encounter definition ID from the offer
- **THEN** the system creates a timed personal challenge for that user
- **AND** the challenge has a coverage window of `[today, today + duration_days - 1]`
- **AND** the response includes the personalized target distance, coverage end date, grace deadline, and the encounter definition's copy and badge information

#### Scenario: User declines a Nazgul pursuit
- **GIVEN** the user is offered the Nazgul pursuit encounter
- **WHEN** the user chooses to decline
- **THEN** the system updates the daily roll status to declined
- **AND** no personal challenge is created
- **AND** the user does not see the encounter modal again if they refresh the page on the same UTC day

#### Scenario: UTC date rollover does not allow accepting a stale roll
- **GIVEN** a user receives a roll offer at 23:58 UTC
- **AND** the date rolls over to the next UTC day before the user acts
- **WHEN** the user sends accept with the previous day's encounter definition ID
- **THEN** the system rejects the accept because the current day's roll does not match

### Requirement: Personalized challenge targets
The system SHALL calculate accepted personal challenge target distances from the user's average distance across active walking days multiplied by a definition-configured stretch factor, clamped to definition-configured minimum and maximum bounds.

#### Scenario: Target uses recent active-day walking average
- **GIVEN** a user meets the activity threshold and accepts a personal challenge
- **WHEN** the challenge target is calculated
- **THEN** the target is derived from the user's average distance on days they actually walked in the past 30 days
- **AND** the average is multiplied by the definition's stretch factor

#### Scenario: Personal target is clamped to definition bounds
- **GIVEN** an eligible user accepts a personal challenge
- **WHEN** the calculated target falls below the definition's minimum or above the maximum
- **THEN** the final target is clamped to the definition's configured min/max bracket

### Requirement: Progress accounting for personal challenges
The system SHALL credit personal challenge progress from canonical walk logs using an idempotent ledger, SHALL count only walks whose date falls within the coverage window (accept date through accept date + duration_days - 1), SHALL refresh cached participant totals when eligible walks are created or updated within the coverage window or during the grace period, SHALL not block walk saves when reconciliation encounters errors, and SHALL preserve earned achievements when later reconciliation reduces progress below a completed threshold.

#### Scenario: Walk with date within coverage window counts
- **GIVEN** a user has accepted a 3-day personal challenge starting June 10
- **AND** the coverage window is June 10-12
- **WHEN** the user logs a walk for June 11
- **THEN** the walk contributes to that challenge participant's progress

#### Scenario: Walk with date outside coverage window does not count
- **GIVEN** a user has accepted a 3-day personal challenge starting June 10
- **WHEN** the user logs a walk for June 9 (day before acceptance)
- **THEN** the walk does not contribute to the challenge participant's progress

#### Scenario: Walk logged during grace period for a coverage window date counts
- **GIVEN** a user's coverage window has ended but the grace period is still active
- **WHEN** the user logs a walk for a date within the coverage window
- **THEN** the walk contributes to the challenge participant's progress

#### Scenario: Walk logged during grace period for a non-coverage date does not count
- **GIVEN** a user's coverage window ended June 12 and the grace deadline is June 15
- **WHEN** the user logs a walk for June 13 (outside coverage window)
- **THEN** the walk does not contribute to the challenge participant's progress

#### Scenario: Challenge completes when all coverage days have entries and target is met
- **GIVEN** a user has a 3-day challenge with a 15 km target
- **AND** the user has logged walks for all 3 coverage days totalling 16 km
- **WHEN** the third day's walk is logged or updated
- **THEN** the challenge is marked completed
- **AND** the completion badge is awarded

#### Scenario: Challenge remains active when all days are covered but target is not met
- **GIVEN** a user has a 3-day challenge with a 15 km target
- **AND** the user has logged walks for all 3 coverage days totalling only 12 km
- **WHEN** all three days have been entered
- **THEN** the challenge remains active
- **AND** the user can update any coverage day's distance to reach the target

#### Scenario: Challenge completes on later edit of a coverage day
- **GIVEN** a challenge is active with all coverage days entered but only 12 km of a 15 km target
- **WHEN** the user edits one coverage day's distance upward
- **THEN** the reconciled total is checked against the target
- **AND** if the total now meets or exceeds 15 km, the challenge completes

#### Scenario: Edited walk reconciles progress
- **GIVEN** a walk has already contributed to a challenge participant's progress via a ledger entry
- **WHEN** the user edits that walk's distance
- **THEN** the ledger entry is updated
- **AND** the participant's cached progress total reflects the edited distance

#### Scenario: Deleted walk reconciles progress
- **GIVEN** a walk has already contributed to a challenge participant's progress via a ledger entry
- **WHEN** the user deletes that walk
- **THEN** the ledger entry is removed
- **AND** the participant's cached progress total no longer includes that walk's distance

#### Scenario: Reconciliation failure does not block walk save
- **GIVEN** an error occurs during event progress reconciliation
- **WHEN** the user creates, updates, or deletes a walk entry
- **THEN** the walk operation succeeds regardless
- **AND** the reconciliation error is logged but not propagated to the user

#### Scenario: Achievement is preserved when progress is reduced
- **GIVEN** a user has earned a personal challenge completion achievement
- **WHEN** the user subsequently edits a walk downward so the total falls below the target
- **THEN** the achievement remains in the user's earned instances

### Requirement: Personal challenge outcomes
The system SHALL complete a personal challenge immediately when all coverage days have walk entries and the cumulative total reaches or exceeds the personalized target, and SHALL fail the challenge when the grace period expires without the target being met.

#### Scenario: Personal challenge completed during coverage window
- **GIVEN** a user has an active personal challenge
- **WHEN** credited progress from walks within the coverage window reaches or exceeds the personalized target distance
- **THEN** the system marks the challenge completed
- **AND** the system awards the configured completion badge via the shared achievement infrastructure

#### Scenario: Personal challenge completed at acceptance
- **GIVEN** a user accepts a challenge and already has a walk logged for today
- **AND** that walk's distance meets or exceeds the personalized target
- **WHEN** the challenge is created
- **THEN** the walk is credited via reconciliation
- **AND** the challenge is immediately completed

#### Scenario: Personal challenge fails after grace period
- **GIVEN** a user has an active personal challenge below the target distance
- **WHEN** the grace period expires and scheduled settlement runs
- **THEN** the system marks the challenge failed
- **AND** no completion badge is awarded

### Requirement: Scheduled settlement of personal challenges
The system SHALL process expired personal challenge outcomes through scheduled settlement in the existing Worker `scheduled()` handler with independent error isolation from existing notification jobs.

#### Scenario: Expired grace deadline triggers settlement
- **GIVEN** a personal challenge's coverage window has ended and the grace deadline has passed
- **WHEN** scheduled event processing runs
- **THEN** the system evaluates the challenge outcome and settles it as completed or failed

#### Scenario: Settlement failure does not block other scheduled jobs
- **GIVEN** personal challenge settlement encounters an error
- **WHEN** scheduled Worker processing continues
- **THEN** existing scheduled push notification jobs are not blocked

### Requirement: Encounter popup modal
The system SHALL display a modal overlay on journey and map pages when a daily roll returns a personal encounter offer, showing the encounter's themed copy, personalized target distance, coverage window dates, and explicit accept and decline actions. The modal SHALL include a footnote explaining which days count and the grace logging period. The modal SHALL NOT reappear after the user declines an offer on the same UTC day.

#### Scenario: Encounter offer modal appears on journey page
- **GIVEN** an authenticated user loads the journey page
- **AND** the daily roll returns a Nazgul pursuit offer with status 'offered'
- **WHEN** the page initializes
- **THEN** a modal overlay is displayed with Nazgul themed copy
- **AND** the modal shows the personalized target distance and coverage window dates
- **AND** the modal includes a footnote about which days count and the grace logging period
- **AND** the modal blocks page interaction until the user accepts or declines

#### Scenario: Encounter offer modal appears on map page
- **GIVEN** an authenticated user loads the map page
- **AND** the daily roll returns a Nazgul pursuit offer with status 'offered'
- **WHEN** the page initializes
- **THEN** a modal overlay is displayed with Nazgul themed copy

#### Scenario: Accepting the encounter closes the modal
- **GIVEN** the encounter popup modal is displayed
- **WHEN** the user clicks the accept action
- **THEN** the accept request is sent with the encounter definition ID
- **AND** the modal closes
- **AND** the user sees a confirmation toast or brief success indicator

#### Scenario: Declining the encounter closes the modal and suppresses re-display
- **GIVEN** the encounter popup modal is displayed
- **WHEN** the user clicks the decline action
- **THEN** the decline request is sent
- **AND** the modal closes
- **AND** the daily roll status is updated to declined
- **AND** refreshing the page on the same UTC day does not show the modal again

#### Scenario: No modal appears when daily roll returns no offer
- **GIVEN** an authenticated user loads the journey or map page
- **AND** the daily roll returns no encounter offer or has a status other than 'offered'
- **WHEN** the page initializes
- **THEN** no encounter modal is displayed
