## ADDED Requirements

### Requirement: Admins can manage ordered goal content entries
The system SHALL allow authenticated admins to list, create, update, and delete authored content entries attached directly to a goal, with each entry storing a content type, title, Markdown body, optional attribution, and sort order.

#### Scenario: Admin lists content for a goal
- **WHEN** an authenticated admin requests content for a goal
- **THEN** the system returns that goal's content entries ordered by `sort_order` ascending

#### Scenario: Admin creates a content entry
- **GIVEN** an authenticated admin is editing a goal
- **WHEN** the admin creates a valid content entry with type, title, body, and sort order
- **THEN** the system stores the entry for that goal and returns the created content record

#### Scenario: Duplicate sort order is rejected for a goal
- **GIVEN** a goal already has a content entry with sort order `2`
- **WHEN** an authenticated admin creates or updates another content entry on that same goal with sort order `2`
- **THEN** the system rejects the request

#### Scenario: Field limits are enforced
- **WHEN** an authenticated admin submits a content entry with a title longer than 120 characters, an attribution longer than 255 characters, a body longer than 20,000 characters, or a sort order outside the allowed range
- **THEN** the system rejects the request

#### Scenario: Non-admin cannot manage goal content
- **WHEN** an authenticated non-admin user calls a goal-content admin endpoint
- **THEN** the system denies the request

### Requirement: Goal content reuses existing goal unlock behavior
The system SHALL use the exact same goal unlock state as the relevant goal surface when deciding whether authored goal content is viewable, with no separate content-specific locking or unlocking mechanism.

#### Scenario: Personal goal unlock also unlocks goal content
- **GIVEN** a goal is unlocked for the active user in personal view
- **WHEN** the user requests content for that goal
- **THEN** the system returns the goal's authored content entries

#### Scenario: Fellowship goal unlock also unlocks goal content
- **GIVEN** a goal is viewable in a fellowship context because the fellowship has already unlocked that goal
- **WHEN** a member requests content for that goal in that fellowship context
- **THEN** the system returns the same authored content entries for that goal

#### Scenario: Locked goal content is not returned as unlocked content
- **GIVEN** a goal is still locked in the requested viewing context
- **WHEN** the user requests content for that goal
- **THEN** the system denies access to the unlocked content payload

#### Scenario: Goal with no content returns an empty list
- **GIVEN** a goal is unlocked in the requested viewing context
- **WHEN** the user requests content for that goal and no content entries exist
- **THEN** the system returns an empty array

### Requirement: Goal list responses advertise content presence
The system SHALL include content-presence state on goal list responses so goal surfaces can hint when a goal has additional authored content, including for goals that are still locked.

#### Scenario: Goal with authored content reports content presence
- **WHEN** the goal list is requested
- **THEN** each goal that has one or more authored content entries includes `has_content = true`

#### Scenario: Goal without authored content reports no content presence
- **WHEN** the goal list is requested
- **THEN** each goal with no authored content includes `has_content = false`

#### Scenario: Locked goal can still advertise extra content
- **GIVEN** a goal is locked in the current viewing context
- **AND** that goal has authored content
- **WHEN** the goal list is rendered
- **THEN** the UI can detect that extra content exists without receiving the unlocked content body itself

### Requirement: Locked goals tease extra content without revealing it
The system SHALL show a blurred or obscured teaser placeholder for additional goal content on locked goal surfaces when `has_content = true`, so users can tell that more content exists without reading the actual content before the goal unlocks.

#### Scenario: Locked goal with content shows teaser placeholder
- **GIVEN** a goal is locked in the current viewing context
- **AND** the goal has authored content
- **WHEN** the goal surface renders
- **THEN** the UI shows a blurred or obscured placeholder where additional content would otherwise appear

#### Scenario: Locked goal without content shows no teaser placeholder
- **GIVEN** a goal is locked in the current viewing context
- **AND** the goal has no authored content
- **WHEN** the goal surface renders
- **THEN** the UI does not show an additional-content teaser placeholder

#### Scenario: Unlocked goal does not use teaser placeholder
- **GIVEN** a goal is unlocked in the current viewing context
- **AND** the goal has authored content
- **WHEN** the goal surface renders
- **THEN** the UI shows the unlocked content experience instead of a blurred teaser placeholder

### Requirement: GoalModal displays unlocked goal content
The system SHALL load and render authored goal content inside the existing goal detail experience when a goal is unlocked and has content, while hiding the unlocked content section when no content exists.

#### Scenario: GoalModal loads content when opened
- **GIVEN** a goal has authored content and is unlocked in the current viewing context
- **WHEN** the user opens the goal detail modal
- **THEN** the client requests that goal's content from the goal-content API

#### Scenario: Loading state is shown while content loads
- **GIVEN** the goal detail modal has requested goal content
- **WHEN** the response has not yet returned
- **THEN** the modal shows a loading placeholder for the content area

#### Scenario: Content section is hidden when no content exists
- **GIVEN** a goal is unlocked in the current viewing context
- **AND** the goal has no authored content
- **WHEN** the goal detail modal renders
- **THEN** the goal-content section is hidden

#### Scenario: Multiple content entries display in configured order
- **GIVEN** a goal has multiple authored content entries
- **WHEN** the goal detail modal renders unlocked content
- **THEN** the entries are displayed in ascending `sort_order`

### Requirement: Goal content renders with type-specific presentation
The system SHALL render authored goal content as safe HTML with presentation that varies by content type, while preserving one shared ordered content stream for the goal.

#### Scenario: Story entries render as campfire stories
- **GIVEN** an unlocked goal has a content entry of type `story`
- **WHEN** the content is displayed
- **THEN** the story uses the story presentation treatment for campfire lore

#### Scenario: Poetry entries render as poems
- **GIVEN** an unlocked goal has a content entry of type `poetry`
- **WHEN** the content is displayed
- **THEN** the poem uses centered, stanza-friendly presentation distinct from story entries

#### Scenario: Appendix entries render as reference content
- **GIVEN** an unlocked goal has a content entry of type `appendix`
- **WHEN** the content is displayed
- **THEN** the appendix uses a structured long-form presentation distinct from story and poetry entries

#### Scenario: Markdown renders as sanitized HTML
- **GIVEN** an unlocked goal has Markdown-authored content
- **WHEN** the content is rendered in the browser
- **THEN** the Markdown is converted to HTML and sanitized before insertion into the DOM

#### Scenario: Type badges are shown for rendered entries
- **GIVEN** an unlocked goal has one or more content entries
- **WHEN** the entries are displayed
- **THEN** each entry shows its content type badge

### Requirement: Long appendices support truncation and attribution
The system SHALL collapse appendix entries longer than 500 words by default, provide a user-controlled expand action, and render attribution when present.

#### Scenario: Short appendix renders fully expanded
- **GIVEN** an appendix entry contains 500 words or fewer
- **WHEN** the content is displayed
- **THEN** the appendix body is shown without a truncation control

#### Scenario: Long appendix renders collapsed by default
- **GIVEN** an appendix entry contains more than 500 words
- **WHEN** the content is displayed
- **THEN** the appendix body is initially truncated and shows an expand control

#### Scenario: User expands a long appendix
- **GIVEN** a long appendix is initially truncated
- **WHEN** the user activates the expand control
- **THEN** the full appendix body becomes visible

#### Scenario: Attribution renders when present
- **GIVEN** an appendix entry has author attribution text
- **WHEN** the content is displayed
- **THEN** the attribution is shown beneath that entry's body

### Requirement: Admin authoring reuses Markdown preview in the existing goal editor
The system SHALL let admins manage goal content from the existing goal editing experience and SHALL provide a Markdown preview during authoring.

#### Scenario: Admin edits goal content from the goal edit page
- **GIVEN** an authenticated admin opens the existing goal edit page
- **WHEN** the admin manages authored content for that goal
- **THEN** the content controls appear in the goal edit experience rather than a separate admin page

#### Scenario: Markdown preview is available while authoring
- **GIVEN** an authenticated admin is editing a goal content entry
- **WHEN** the admin switches from edit mode to preview mode
- **THEN** the UI shows a rendered preview of the Markdown body

### Requirement: Goal content discovery events are recorded best-effort
The system SHALL record lightweight best-effort discovery analytics for goal-content teasers and content opens without blocking the user-facing action that triggered the event.

#### Scenario: Teaser impression is recorded
- **GIVEN** a goal surface renders a locked teaser placeholder for additional content
- **WHEN** that teaser becomes visible to the user
- **THEN** the system records a teaser-impression discovery event on a best-effort basis

#### Scenario: Content open is recorded
- **GIVEN** a goal with authored content is opened in an unlocked context
- **WHEN** the user opens or reveals the unlocked content experience
- **THEN** the system records a content-open discovery event on a best-effort basis

#### Scenario: Discovery logging failure does not block the user flow
- **GIVEN** a goal-content discovery event cannot be written
- **WHEN** the related goal surface still renders or opens
- **THEN** the user-facing action succeeds even though the discovery event was not persisted