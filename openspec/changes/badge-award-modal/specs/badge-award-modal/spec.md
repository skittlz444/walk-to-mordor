## Purpose

Defines how earned awards become acknowledged, how pending awards are fetched and acknowledged, and how the award modal presents and queues them — including the click-to-open behavior on the profile and friend badge grids.

## ADDED Requirements

### Requirement: Award acknowledgement storage

The system SHALL persist a per-user acknowledgement for each earned achievement instance in a `user_achievement_acknowledgements` table keyed by user and instance. Acknowledgements SHALL be idempotent and SHALL never create, modify, or delete `user_achievement_instances` rows.

#### Scenario: First acknowledgement creates one row
- **GIVEN** a user with an earned achievement instance
- **WHEN** the user acknowledges that instance for the first time
- **THEN** one row is stored for that user and instance
- **AND** the earned instance itself is unchanged

#### Scenario: Repeat acknowledgement is a no-op
- **GIVEN** an instance the user has already acknowledged
- **WHEN** the user acknowledges the same instance again
- **THEN** no duplicate row is created and no error is raised

#### Scenario: Acknowledgements are private to the caller
- **GIVEN** instance rows earned by user A
- **WHEN** user B acknowledges those instance IDs
- **THEN** no acknowledgement row is created for user B affecting user A's record

### Requirement: Pending awards endpoint

The system SHALL expose `GET /api/achievements/pending` to an authenticated caller, returning `{ pending: [...] }` listing that user's earned-but-unacknowledged instances ordered oldest-earned first. Each entry SHALL include the instance ID, the instance `earned_at`, the definition display fields, and a `presentation` block whose rank is the rank at that instance's award time, derived from the instance's ordinal within its definition.

#### Scenario: Authenticated user fetches pending awards
- **GIVEN** an authenticated user with earned and unacknowledged instances
- **WHEN** the user calls `GET /api/achievements/pending`
- **THEN** the response status is 200
- **AND** each entry includes `instance_id`, `earned_at`, `earned_count`, `slug`, `name`, `description`, `image_slug`, `badge_type`, `is_repeatable`, and `presentation`

#### Scenario: Acknowledged awards are not pending
- **GIVEN** earned instances, some acknowledged and some not
- **WHEN** the user calls `GET /api/achievements/pending`
- **THEN** only the unacknowledged instances are returned
- **AND** acknowledged instances do not reappear after a repeat acknowledgement

#### Scenario: Pending awards are ordered oldest earned first
- **GIVEN** a user with unacknowledged instances earned at different times
- **WHEN** the user calls `GET /api/achievements/pending`
- **THEN** the entry earned earliest appears first

#### Scenario: Pending presentation uses the awarding rank
- **GIVEN** a pending repeatable badge with `rank_thresholds` `[1,4,12,26]` and four unacknowledged instances
- **WHEN** the pending list is returned
- **THEN** the first three entries have `presentation.rank_label` `bronze`
- **AND** the fourth entry has `presentation.rank_label` `silver`
- **AND** each entry's artwork name uses its own `rank_label`

#### Scenario: Same-rank instances share artwork and threshold crossings do not
- **GIVEN** two queued instances of the same repeatable at the same rank
- **WHEN** the modal shows them
- **THEN** they use the same full-image variant
- **AND** when one instance crosses a rank threshold, it uses the next rank variant

#### Scenario: Pending metadata falls back safely
- **GIVEN** a pending definition whose metadata is null, invalid, or out of range
- **WHEN** the pending list is returned
- **THEN** `presentation.rank` is 1, `collection` is null, and `storyline` is null

#### Scenario: Empty when nothing is pending
- **GIVEN** an authenticated user with no unacknowledged instances
- **WHEN** the user calls `GET /api/achievements/pending`
- **THEN** the response status is 200 and `pending` is an empty array

#### Scenario: Unauthenticated request is rejected
- **GIVEN** a request without a valid session token
- **WHEN** `GET /api/achievements/pending` is called
- **THEN** the system returns a 401 error

### Requirement: Acknowledge endpoint

The system SHALL expose `POST /api/achievements/acknowledge` to an authenticated caller with a body of `{ instance_ids: number[] }`, acknowledging each submitted instance owned by the caller. The call SHALL be idempotent, SHALL ignore instance IDs the caller does not own, and SHALL return `{ acknowledged: <count> }`. Malformed bodies SHALL be rejected with 400.

#### Scenario: Pending award is acknowledged
- **GIVEN** a user with a pending instance
- **WHEN** the user calls `POST /api/achievements/acknowledge` with that instance ID
- **THEN** the response status is 200 and `acknowledged` is 1
- **AND** the instance no longer appears in the pending list

#### Scenario: Re-acknowledge is idempotent
- **GIVEN** an instance already acknowledged by the user
- **WHEN** the user calls `POST /api/achievements/acknowledge` with that instance ID again
- **THEN** the response status is 200 without duplicating acknowledgement rows

#### Scenario: Instances owned by others are ignored
- **GIVEN** a caller submitting instance IDs that belong to another user or do not exist
- **WHEN** the acknowledge call completes
- **THEN** the response status is 200
- **AND** `acknowledged` counts only the caller's own newly acknowledged instances

#### Scenario: Malformed body is rejected
- **GIVEN** a body that is missing `instance_ids`, is not an array, is empty, or contains non-integer values
- **WHEN** `POST /api/achievements/acknowledge` is called
- **THEN** the system returns a 400 error

#### Scenario: Unauthenticated request is rejected
- **GIVEN** a request without a valid session token
- **WHEN** `POST /api/achievements/acknowledge` is called
- **THEN** the system returns a 401 error

### Requirement: Award modal greets pending awards on page open

The system SHALL mount the award modal island on every authenticated SSR page, including the map. After hydration, if the user has pending awards, the modal SHALL open on the first pending award; with no session or a failed or empty check it SHALL render nothing and retry nothing within that page view. The island SHALL defer opening only while another modal dialog is open, and SHALL queue rather than drop the pending awards. The map is not a modal dialog.

#### Scenario: Page open with pending awards shows the modal
- **GIVEN** an authenticated user reaches any SSR page with unacknowledged awards
- **WHEN** the pending check completes successfully with a non-empty list
- **THEN** the award modal opens showing the first pending badge

#### Scenario: Queue length is conveyed
- **GIVEN** a user with more than one pending award
- **WHEN** the acknowledge-mode modal is open
- **THEN** the modal shows the position in the queue, such as "Badge 2 of 3"
- **AND** the count is exposed to assistive technology

#### Scenario: No pending awards renders nothing
- **GIVEN** an authenticated user with no pending awards
- **WHEN** the pending check completes
- **THEN** nothing is rendered inside the island mount

#### Scenario: No session token makes no request
- **GIVEN** a visitor with no session token in local storage
- **WHEN** the modal island hydrates
- **THEN** no pending request is made
- **AND** nothing is rendered

#### Scenario: 401 and failure render nothing
- **GIVEN** a session token that the server rejects as expired
- **WHEN** the pending check returns 401 or fails
- **THEN** nothing is rendered and no further pending request is issued in that page view

#### Scenario: Another modal already visible defers opening
- **GIVEN** pending awards exist and another modal dialog is already open on the page
- **WHEN** the modal island's open attempt runs
- **THEN** the award modal waits until no modal dialog is open before opening
- **AND** if the user leaves the page without it opening, the award stays pending

#### Scenario: Map page opens the award modal
- **GIVEN** an authenticated user reaches the map page with pending awards
- **WHEN** the pending check completes successfully with a non-empty list
- **THEN** the award modal opens normally
- **AND** the map is not treated as an open modal

### Requirement: Acknowledge mode queues one award at a time

The acknowledge-mode modal SHALL show one pending award at a time in queue order. Multiple pending awards MAY be queued at once. Acknowledging the shown award SHALL advance to the next. Acknowledgement SHALL be idempotent, and a failed acknowledgement SHALL hold the current badge with a retry control.

#### Scenario: Continue acknowledges and advances
- **GIVEN** an acknowledge-mode modal showing a pending award
- **WHEN** the user activates the primary continue control
- **THEN** the shown instance is acknowledged
- **AND** the next pending badge is shown with an updated queue position

#### Scenario: Last award closes the modal
- **GIVEN** the modal is showing the last pending award
- **WHEN** the user activates the continue control
- **THEN** the instance is acknowledged and the modal closes
- **AND** the queue is not re-opened during the same page view

#### Scenario: Failed acknowledgement holds and offers retry
- **GIVEN** an acknowledge request that fails
- **WHEN** the modal handles the failure
- **THEN** the same badge remains displayed
- **AND** a retry control re-issues the acknowledge request
- **AND** advancing is not possible until acknowledgement succeeds

### Requirement: Dismiss semantics depend on repeatability

Closing, pressing Escape, or activating the overlay SHALL acknowledge a repeatable award so it does not re-trigger. For a non-repeatable award, dismissal SHALL leave it pending so explicit acknowledgement is required on a later visit. A failed repeatable close-acknowledgement SHALL hold the same badge with a retry control.

#### Scenario: Closing a one-off without acknowledging keeps it pending
- **GIVEN** an acknowledge-mode modal showing a non-repeatable award
- **WHEN** the user activates the dismiss control or presses Escape
- **THEN** the modal closes and no acknowledge call is issued for the shown award
- **AND** the award opens again on the next page open

#### Scenario: Closing a repeatable acknowledges it
- **GIVEN** an acknowledge-mode modal showing a repeatable award
- **WHEN** the user activates the dismiss control or presses Escape
- **THEN** the shown instance is acknowledged
- **AND** it does not re-trigger on the next page open

#### Scenario: Failed repeatable close acknowledgement holds the badge
- **GIVEN** a repeatable award and an acknowledge request that fails while closing
- **WHEN** the modal handles the failure
- **THEN** the same badge remains displayed with a retry control
- **AND** the modal does not close until acknowledgement succeeds

### Requirement: Award modal presents the badge's full artwork

The modal SHALL display the badge's 1024 px full image at `/img/achievements/full/<name>.webp`, where `<name>` is the `image_slug` for fixed-rank badges and `<image_slug>--<rank_label>` for repeatables. In acknowledge mode `presentation` is the pending entry's awarding rank; in view-only mode it is the grid's current rank. The image SHALL use the grid's slug validation and fallback rules: no request for an invalid slug, base-image retry, and a fallback so the modal never breaks.

#### Scenario: Fixed-rank badge shows its full image
- **GIVEN** a fixed-rank badge whose `image_slug` matches the slug pattern
- **WHEN** the modal renders that badge
- **THEN** the image source is `/img/achievements/full/<image_slug>.webp`

#### Scenario: Repeatable badge shows its rank variant
- **GIVEN** a repeatable badge with `presentation.rank_label` `gold`
- **WHEN** the modal renders that badge
- **THEN** the image source is `/img/achievements/full/<image_slug>--gold.webp`

#### Scenario: Queued repeatables show their awarding ranks
- **GIVEN** two queued instances of the same repeatable, the second crossing a rank threshold
- **WHEN** the modal shows each in turn
- **THEN** each image uses that instance's awarding `rank_label`
- **AND** two instances at the same rank use the same image

#### Scenario: Full image loads progressively over the thumbnail
- **GIVEN** a modal badge with a valid artwork name
- **WHEN** the full image is still loading
- **THEN** the badge's thumbnail is displayed first
- **AND** the full image replaces it once loaded

#### Scenario: Malformed slug is never requested
- **GIVEN** a badge whose `image_slug` contains path traversal or disallowed characters
- **WHEN** the modal renders
- **THEN** no request is made to that path
- **AND** the modal shows the badge name and description without an image

#### Scenario: Image failure does not break the modal
- **GIVEN** a badge whose rank-variant and base-image load attempts both fail
- **WHEN** the modal renders
- **THEN** the image area is hidden
- **AND** the name, rank label, earned date, and description remain visible

### Requirement: Award modal shows badge details

The modal SHALL show the badge name, rank label, earned date, and repeat context alongside the artwork. The rank label SHALL match the artwork variant shown: the awarding rank in acknowledge mode and the current rank in view-only mode.

#### Scenario: Acknowledging a repeatable shows its awarding details
- **GIVEN** a pending repeatable instance whose awarding rank is silver and whose current rank is mithril
- **WHEN** the modal shows the instance in acknowledge mode
- **THEN** the rank label is silver
- **AND** the full image uses the silver variant

### Requirement: Modal dialog behavior and accessibility

The modal SHALL behave as a modal dialog with `role="dialog"` and `aria-modal`, labelled with the badge name. Escape and overlay activation SHALL close it with the same repeatability-aware dismiss semantics as the dismiss control. Focus SHALL move into the dialog on open and return to the trigger when opened by a badge-card activation. Non-essential transitions SHALL be disabled under reduced motion, and the layout SHALL adapt to small viewports without cropping the artwork.

#### Scenario: Escape closes the modal
- **GIVEN** the award modal is open
- **WHEN** the user presses Escape
- **THEN** the modal closes with the same repeatability-aware semantics as the dismiss control

#### Scenario: Focus moves into and out of the dialog
- **GIVEN** a user activated a badge card in the profile grid
- **WHEN** the modal opens and then closes
- **THEN** focus moves into the dialog on open
- **AND** focus returns to the activating card on close

#### Scenario: Overlay click closes the modal
- **GIVEN** the modal is open
- **WHEN** the user activates outside the dialog box
- **THEN** the modal closes with the same dismiss semantics as Escape

#### Scenario: Reduced motion disables non-essential transition
- **GIVEN** a user with prefers-reduced-motion enabled
- **WHEN** the modal opens
- **THEN** entrance and celebratory transitions are disabled
- **AND** content appears without animation

#### Scenario: Small viewport keeps content usable
- **GIVEN** a mobile viewport
- **WHEN** the modal is open
- **THEN** the dialog fits the viewport width
- **AND** the artwork and details remain reachable without horizontal scrolling

### Requirement: Badge grid click opens the modal in view-only mode

The profile and friend badge grids SHALL make each earned badge card activatable in a way exposed to assistive technology. Activating an own-profile badge card SHALL open the award modal for that badge in view-only mode: the same artwork, name, rank, earned date, and details, with no acknowledge or continue control, and no pending request for that activation. View-only mode SHALL use the badge's current rank from the grid, not a pending instance's awarding rank.

#### Scenario: Click opens the modal in view-only mode
- **GIVEN** an authenticated user viewing their own profile badge grid
- **WHEN** the user activates a badge card
- **THEN** the award modal opens showing that badge's full artwork and details
- **AND** no acknowledge or continue control is shown

#### Scenario: Views reflect earned count and rank
- **GIVEN** a repeatable badge the user has earned multiple times
- **WHEN** its card activates in view-only mode
- **THEN** the modal shows the repeat count, earned date, and current rank label from the badge data the grid already holds

#### Scenario: View-only mode uses the current rank
- **GIVEN** a repeatable badge whose current rank is mithril
- **WHEN** its card opens in view-only mode
- **THEN** the modal uses the mithril artwork from the grid payload
- **AND** it does not use an older awarding-rank variant

#### Scenario: Cards are keyboard accessible
- **GIVEN** a badge card in any badge grid
- **WHEN** a keyboard user focuses and activates it
- **THEN** the modal opens the same way as with a pointer

### Requirement: View-only mode preserves the pending queue

The pending award queue SHALL be preserved while a view-only modal is open and offered after it closes. View-only activation SHALL NOT acknowledge any pending instance.

#### Scenario: View-only activation never acknowledges
- **GIVEN** a user with pending wait-queue awards
- **WHEN** the user activates a badge card in view-only mode
- **THEN** no acknowledge request is issued for that activation
- **AND** the deferred pending queue is offered after the view-only modal closes

### Requirement: Friend-profile badges open without acknowledgement

Badges on a friend's profile SHALL open the award modal in view-only mode showing the friend's badge data. No acknowledge request SHALL be issued and the viewer's own pending queue SHALL NOT be affected by viewing friend badges.

#### Scenario: Friend badge opens view-only
- **GIVEN** user A views user B's friend profile badge grid
- **AND** user B has earned badges
- **WHEN** user A activates one of B's badge cards
- **THEN** the modal shows the friend badge's artwork and details
- **AND** no acknowledge control is shown

#### Scenario: Friend badge viewing is read-only for the account
- **GIVEN** user A opens badges from B's profile
- **WHEN** the session ends
- **THEN** no acknowledgement rows exist that resulted from viewing B's badges
