# profile-view-settings Specification

## Purpose

Defines the split of the user profile into a read-only view page and an editable settings page, the self-overview API that feeds the view page, the shared avatar picker modal, the navigation loop between the two pages, and the loading, error, and accessibility behaviour of each surface. Badge display stays governed by `profile-badge-display`; this change only re-mounts that island on the new view page.

## Requirements

### Requirement: Profile route split

The system SHALL serve a read-only profile view page at `GET /profile` and an editable settings page at `GET /profile/settings` in the standard SSR layout, while `GET /friends/:id` stays unchanged. The drawer Profile link opens the view.

#### Scenario: `/profile` renders the view page

- **GIVEN** the app is deployed with this change
- **WHEN** a browser requests `GET /profile`
- **THEN** the response is the profile view shell with `ProfileViewIsland` and `BadgeDisplayIsland` placeholders inside one page wrapper
- **AND** the page does not contain `ProfileIsland` or `ProfileSettingsIsland` placeholders

#### Scenario: `/profile/settings` renders the settings page

- **GIVEN** the app is deployed with this change
- **WHEN** a browser requests `GET /profile/settings`
- **THEN** the response is the settings shell with `ProfileSettingsIsland`, `PushPermissionIsland`, and `ProfileAccountIsland` placeholders inside one page wrapper, plus the SSR-rendered back row
- **AND** the page does not contain a `BadgeDisplayIsland` placeholder

#### Scenario: Friend profile route is untouched

- **GIVEN** the app is deployed with this change
- **WHEN** a browser requests `GET /friends/123`
- **THEN** the response is the existing friend profile shell with `FriendProfileIsland` and `BadgeDisplayIsland`

#### Scenario: Drawer Profile link opens the view

- **GIVEN** an authenticated user opens the navigation drawer
- **WHEN** the user selects the Profile link
- **THEN** the app navigates to `/profile` (the view page)

### Requirement: Self-overview endpoint

The system SHALL expose `GET /api/profile/overview` (auth-guarded) returning the view page's stats in one response, with no database migration. Unauthenticated calls SHALL receive 401.

#### Scenario: Authenticated user fetches own overview

- **GIVEN** an authenticated user with logged progress, an active storyline, and one active fellowship
- **WHEN** the user calls `GET /api/profile/overview`
- **THEN** the response status is 200
- **AND** the body includes `username`, `avatarId`, `totalDistance`, `memberSince`, `currentGoalTitle`, and `activeStoryline` (same shape `/api/session` returns), plus `fellowships` with `{ id, name }` entries

#### Scenario: Total distance is storyline-adjusted

- **GIVEN** a user whose raw logged sum is 1000 km on a storyline with distanceOffset 120
- **WHEN** `GET /api/profile/overview` is called
- **THEN** `totalDistance` is 1120 (the value the journey page shows)

#### Scenario: Current goal is the next unreached storyline goal

- **GIVEN** a user whose adjusted distance has passed goal A but not the next goal B in the active storyline
- **WHEN** `GET /api/profile/overview` is called
- **THEN** `currentGoalTitle` is the title of goal B
- **AND** when every goal is reached, it is the last goal's title instead of null

#### Scenario: Goal-less storyline yields a null current goal

- **GIVEN** the user's active storyline has no storyline goals
- **WHEN** `GET /api/profile/overview` is called
- **THEN** `currentGoalTitle` is `null`

#### Scenario: Member since is a UTC ISO 8601 string

- **GIVEN** a user whose `users.created_at` is the SQLite UTC datetime `2024-08-15 18:30:00`
- **WHEN** `GET /api/profile/overview` is called
- **THEN** `memberSince` is `"2024-08-15T18:30:00.000Z"` (ISO 8601, server-converted; never the raw SQLite format)

#### Scenario: Fellowships are active and non-dissolved only

- **GIVEN** a user in one active fellowship and one dissolved fellowship
- **WHEN** `GET /api/profile/overview` is called
- **THEN** `fellowships` lists only the active, non-dissolved one as `{ id, name }`
- **AND** no sharing flag is returned (meaningless on the self surface)

#### Scenario: Unauthenticated request is rejected

- **GIVEN** a request without a valid session token
- **WHEN** `GET /api/profile/overview` is called
- **THEN** the system returns a 401 error

#### Scenario: No migration ships

- **GIVEN** this change is implemented
- **WHEN** the implementation is reviewed
- **THEN** the change contains no new `migrations/*.sql` file and no D1 schema change

### Requirement: Profile view page

The system SHALL render on `/profile` a read-only profile that visually matches the friend profile hero: avatar, username, stats grid (total distance and member since), "Heading to" goal line, active journey, Fellowships card when present, earned badge grid, and a prominent Settings control linking to `/profile/settings`. All sections share one page wrapper; badge rendering itself follows `profile-badge-display` unchanged.

#### Scenario: View shows own stats

- **GIVEN** an authenticated user whose overview returns `totalDistance` 2412.5, `memberSince` 2024-08-15, `currentGoalTitle` "Reach northern edge of Ithilien", and active storyline "Frodo & Sam"
- **WHEN** the view page finishes loading
- **THEN** the hero shows the username and a stats grid with "2412.50 km — Total Distance" and the formatted member-since date
- **AND** a "Heading to" line shows "Reach northern edge of Ithilien"
- **AND** the active journey title "Frodo & Sam" is visible

#### Scenario: Missing goal title hides the heading line

- **GIVEN** an overview response with `currentGoalTitle` null
- **WHEN** the view page finishes loading
- **THEN** no "Heading to" line is rendered
- **AND** the stats grid and journey title still render

#### Scenario: Settings control navigates to settings

- **GIVEN** the view page is loaded
- **WHEN** the user activates the Settings control
- **THEN** the browser navigates to `/profile/settings`

#### Scenario: Badge grid aligns with the hero

- **GIVEN** the view page is rendered
- **WHEN** the layout is measured at 360 px or 390 px viewport width
- **THEN** the badge grid, hero, CTA, and Fellowships card share the same page wrapper width
- **AND** `document.documentElement.scrollWidth` equals the viewport width (no horizontal overflow)

#### Scenario: Fellowships card only when present

- **GIVEN** a user with one active fellowship
- **WHEN** the view page loads
- **THEN** a Fellowships card lists its name without a shared marker
- **AND** for a user with no fellowships, no Fellowships card is rendered

#### Scenario: View page shows earned badges

- **GIVEN** a user with earned achievements
- **WHEN** the view page loads
- **THEN** the badge grid renders grouped badge cards as on the friend profile page
- **AND** when the badge summary is empty, the badge section renders nothing (existing `profile-badge-display` behaviour, unchanged here)

### Requirement: Avatar picker modal

The system SHALL open a shared avatar picker modal from the view page avatar and the settings page "Change avatar" control. The modal lists avatars as a radiogroup offering "Use initials", saves a selection immediately via `PUT /api/user/preferences { avatarId }` without a submit step, shows per-selection status, and updates the underlying page's avatar live without closing. Escape and backdrop click close the modal.

#### Scenario: Opening the picker from the view page avatar

- **GIVEN** the view page is loaded and the user has an avatar
- **WHEN** the user activates their avatar (keyboard or click)
- **THEN** the avatar picker modal opens with focus inside the dialog
- **AND** the current avatar stays visible in the modal while the gallery loads

#### Scenario: Gallery load failure offers retry

- **GIVEN** the avatar picker modal is open
- **AND** `GET /api/avatars` fails with a network error or 5xx
- **WHEN** the modal resolves the fetch
- **THEN** the gallery area shows an error state with a Retry action
- **AND** the current avatar preview and the modal itself remain usable

#### Scenario: Selecting an avatar saves immediately

- **GIVEN** the avatar picker modal is open
- **WHEN** the user activates an unselected avatar
- **THEN** a `PUT /api/user/preferences` request carries that avatar's slug
- **AND** the modal shows a saved status without closing
- **AND** the avatar visible on the underlying page updates to the new selection

#### Scenario: Use initials resets the avatar

- **GIVEN** the avatar picker modal is open and the user has an avatar
- **WHEN** the user activates "Use initials"
- **THEN** `PUT /api/user/preferences` is sent with `avatarId: null`
- **AND** the underlying page shows the initials fallback avatar

#### Scenario: Expired session closes the modal and redirects

- **GIVEN** the avatar picker modal is open
- **AND** its next API call (`GET /api/avatars` or the avatar save) returns 401
- **WHEN** the modal reacts
- **THEN** the modal closes and the browser is redirected to `/login`

#### Scenario: Generic save error keeps the modal open

- **GIVEN** the avatar picker modal is open
- **AND** the avatar save returns an error other than 401
- **WHEN** the user activates an avatar
- **THEN** the modal shows the error status and stays open
- **AND** the previous avatar selection remains

#### Scenario: Escape and backdrop close with focus return

- **GIVEN** the avatar picker modal is open after being opened from the view page avatar
- **WHEN** the user presses Escape or activates the backdrop
- **THEN** the modal closes
- **AND** keyboard focus returns to the view page avatar button

### Requirement: Settings editing and dynamic auto-save

The system SHALL give `/profile/settings` every editing capability the current `GET /profile` page has, saving dynamically: username and email on blur (trimmed, validated with the server's exact predicates, sequenced per field, `keepalive: true` so in-flight saves survive navigation), avatar on selection, preferences on toggle, journey on confirmation, and push settings on toggle, each with per-field inline status and no Save control on the page.

#### Scenario: Settings preserves the profile form

- **GIVEN** an authenticated user loads `/profile/settings`
- **WHEN** the first session/preferences data resolves
- **THEN** the username and email fields are populated from `/api/session`
- **AND** the `showFutureGoalsUnlocked` and `defaultViewMap` toggles reflect the current values and each saves on toggle via `PUT /api/user/preferences`
- **AND** the journey select lists the storylines from `/api/storylines`

#### Scenario: Username saves on blur

- **GIVEN** the settings page shows username "FrodoBaggins"
- **WHEN** the user changes it to "FrodoOfTheShire" and blurs the field
- **THEN** a `PUT /api/profile` request carries `{ username: "FrodoOfTheShire" }`
- **AND** the field status announces "Saving…" and then "Saved"
- **AND** the status is exposed through `role="status"` and `aria-live="polite"`
- **AND** no Save Changes control exists on the page

#### Scenario: Email saves on blur

- **GIVEN** the settings page shows the saved email
- **WHEN** the user enters a new valid email and blurs the field
- **THEN** a `PUT /api/profile` request carries only the new `email`
- **AND** the field status announces "Saving…" and then "Saved"
- **AND** the email field keeps the saved value

#### Scenario: Invalid field value is not sent

- **GIVEN** the username or email field contains an invalid value
- **WHEN** the field blurs
- **THEN** no `PUT /api/profile` request is made
- **AND** an inline error is shown next to the field
- **AND** the value remains editable for correction

#### Scenario: Empty or whitespace-only field is invalid

- **GIVEN** the username or email field contains an empty string, only whitespace, or a value that trims to empty
- **WHEN** the field blurs
- **THEN** no `PUT /api/profile` request is made
- **AND** an inline error describes the required format
- **AND** the field stays editable (the previous saved value is not silently restored and no other field is affected)

#### Scenario: Field status starts empty and clears on input

- **GIVEN** the settings page has just loaded with saved username and email
- **WHEN** the page renders
- **THEN** neither field shows a "Saved" status
- **AND** editing a field clears its previous status
- **AND** "Saving…"/"Saved"/error appear only after a save attempt for that field

#### Scenario: Rapid edits keep the latest value

- **GIVEN** the username field
- **WHEN** the user blurs "Frodo-A" then quickly blurs "Frodo-B" so the first PUT resolves after the second
- **THEN** the in-flight saves are sequenced per field and the stale "Frodo-A" response is ignored
- **AND** the field and its status reflect the latest edit ("Frodo-B"), never the older response

#### Scenario: Validation uses the server's exact predicates

- **GIVEN** the client-side field validation
- **WHEN** the username or email is validated before a blur save
- **THEN** the same predicates the server applies are used (`isValidUsername`: 3–30 chars, letters/numbers/underscore; `isValidEmail`: the server's email regex)
- **AND** values are trimmed before validation, so `" Frodo "` validates as `Frodo`
- **AND** boundary lengths fail or pass exactly as the server treats them (2 and 31 chars invalid; 3 and 30 valid)

#### Scenario: Server conflict is shown inline

- **GIVEN** a username or email auto-save returns `409`
- **WHEN** the save resolves
- **THEN** the field shows "Username already exists" or "Email already registered" inline
- **AND** no global error banner is rendered
- **AND** the other settings remain usable

#### Scenario: Auto-save 401 redirects to login

- **GIVEN** the settings page with an expired or invalid session
- **WHEN** a username or email auto-save returns `401`
- **THEN** the browser is redirected to `/login`
- **AND** the field does not show a misleading "Saved" status

#### Scenario: In-flight save survives Back

- **GIVEN** a username or email auto-save is in flight
- **WHEN** the user activates Back to profile
- **THEN** navigation proceeds to `/profile`
- **AND** the save request uses `keepalive` so it can complete during navigation

#### Scenario: Journey switch confirm dialog preserved

- **GIVEN** the settings page
- **WHEN** the user selects a different journey
- **THEN** a confirmation dialog offers Cancel / Carry Distance / Start at 0
- **AND** confirming sends `PUT /api/user/storyline { storylineId, mode }` with the chosen mode
- **AND** the `storylineChanged` CustomEvent dispatches and the client map cache is cleared, as today

#### Scenario: Push settings live on the settings page

- **GIVEN** an authenticated user on `/profile/settings`
- **WHEN** the push island hydrates
- **THEN** the existing push notification controls are present and functional (same behaviour as today's profile page)

#### Scenario: Journey switching lives on the settings page

- **GIVEN** the profile view page and the settings page
- **WHEN** searching for journey-switch controls (journey select or switch CTA)
- **THEN** only the settings page provides them
- **AND** the view page shows the active journey title read-only

#### Scenario: Avatar opens the same picker modal

- **GIVEN** the settings page
- **WHEN** the user activates "Change avatar"
- **THEN** the shared avatar picker modal opens with the current avatar selected

#### Scenario: Session 401 redirects instead of a blank form

- **GIVEN** the settings page loads with an invalid or expired session token
- **WHEN** the session fetch (`GET /api/session`) returns 401
- **THEN** the browser is redirected to `/login`
- **AND** the blank username/email form is never shown

### Requirement: Settings navigation and logout

The settings page SHALL provide navigation and account actions: no Save control and no bottom action bar; outside the settings cards the styled Back to profile button is the only page-level navigation/commit control; and Logout SHALL live in `ProfileAccountIsland` mounted after the push island, which owns the existing logout flow.

#### Scenario: Logout lives in the Account island

- **GIVEN** an authenticated user on `/profile/settings`
- **WHEN** the user reaches the bottom of the page and activates Logout in the Account island's card
- **THEN** the existing logout flow and confirmation run (owned by `ProfileAccountIsland`) and the user is signed out
- **AND** the Account island is mounted after the push island, so sign-out is last on the page
- **AND** no Save Changes control is present
- **AND** no Logout control appears on the profile view page

#### Scenario: Back button is the only page-level navigation/commit control

- **GIVEN** the settings page is loaded
- **WHEN** the controls outside the settings cards are enumerated
- **THEN** there is no Save control and the styled Back to profile button is the only page-level navigation/commit action
- **AND** it renders as a secondary control with an icon and label, at least 44 px tall, with consistent padding, a border, and a visible focus ring
- **AND** activating it navigates to `/profile` (not `history.back()`)
- **AND** the settings cards themselves keep their interactive controls (Change avatar, toggles, journey select, push toggles, Logout)

#### Scenario: Visible return path to the view

- **GIVEN** the settings page is loaded (or fails with 401) before the islands hydrate
- **WHEN** the page is rendered
- **THEN** the SSR shell already shows the styled Back to profile button linking to `/profile` and the "Changes save automatically" note
- **AND** there is no bottom Save/Back action bar

### Requirement: Navigation loop and unauthenticated access

The profile surfaces SHALL form a closed navigation loop with no dead end, and `/profile/settings` SHALL be deep-linkable.

#### Scenario: Unauthenticated deep link to settings

- **GIVEN** a visitor without a valid session token directly opens `/profile/settings`
- **WHEN** the settings island's initial session request returns 401
- **THEN** the island redirects the browser to `/login`

#### Scenario: Session expires on the view page

- **GIVEN** the view page is open with an expired session
- **WHEN** `GET /api/profile/overview` returns 401
- **THEN** the view island redirects the browser to `/login`

#### Scenario: No dead ends between the pages

- **GIVEN** any of `/profile`, `/profile/settings`, or the drawer
- **WHEN** the user follows the profile-related links
- **THEN** every profile destination is reachable both ways and every page offers a forward or back path

### Requirement: Profile loading and error states

Each profile surface SHALL communicate its asynchronous state instead of showing blank or fabricated content.

#### Scenario: View stats skeleton

- **GIVEN** the view page is loading and `/api/profile/overview` has not answered
- **WHEN** the page renders
- **THEN** the hero area shows skeleton placeholders instead of empty input-like fields
- **AND** no layout jump occurs when the data arrives

#### Scenario: Overview load failure with retry

- **GIVEN** the view page
- **AND** `GET /api/profile/overview` fails with a network error or 5xx
- **WHEN** the view island reacts
- **THEN** an error message with a Retry button replaces the stats
- **AND** activating Retry re-requests the overview

#### Scenario: Settings loading state

- **GIVEN** the settings page before `/api/session` resolves
- **WHEN** the settings island renders
- **THEN** the loading indicator is shown (as ProfileIsland does today)

#### Scenario: Avatar gallery loading keeps the current avatar

- **GIVEN** the avatar picker modal is open and `/api/avatars` has not answered
- **WHEN** the modal renders
- **THEN** a loading indicator replaces the gallery grid
- **AND** the current avatar preview remains visible outside the gallery grid

### Requirement: Profile accessibility

The profile pages SHALL follow the app's accessibility conventions for labels, dialogs, headings, and touch targets.

#### Scenario: Avatar button is labelled

- **GIVEN** the view page is loaded
- **WHEN** the avatar is reached by screen reader
- **THEN** its accessible name communicates "Change avatar" intent (e.g. "Change avatar for FrodoBaggins")

#### Scenario: Modal is focus-trapped

- **GIVEN** the avatar picker modal is open
- **WHEN** the user Tabs forward from the last focusable element
- **THEN** focus wraps back into the modal rather than the page behind it
- **AND** the modal exposes `role="dialog"` with `aria-modal="true"` and an accessible title

#### Scenario: Heading order on the view page

- **GIVEN** the view page is loaded
- **WHEN** headings are enumerated
- **THEN** the page h1 is "Profile", the hero uses an h2 for the username, and badge/fellowship sections use h3 headings

#### Scenario: Touch targets on mobile

- **GIVEN** a 360 px wide viewport
- **WHEN** the view and settings pages are laid out
- **THEN** the avatar button, Settings button, Back to profile button, toggle rows, and Account logout button are at least 44 px tall
