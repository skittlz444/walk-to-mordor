## ADDED Requirements

### Requirement: Field Guide collection is global and region-based
The system SHALL provide one global Field Guide collection per user across all storylines, where reusable regions are authored once and can be mapped to one or more storyline distance bands.

#### Scenario: Same region appears on multiple storylines
- **GIVEN** an admin has mapped the same reusable region to multiple storylines at different distance bands
- **WHEN** a user views the Field Guide
- **THEN** the system shows one shared region section for that region rather than separate per-storyline copies

#### Scenario: Discovery persists across storyline switches
- **GIVEN** a user has discovered collectibles in a reusable region on one storyline
- **WHEN** the user switches to another storyline that also maps that same region
- **THEN** the previously discovered slots in that region remain revealed in the global Field Guide

### Requirement: Admins can manage regions, mappings, and collectible catalog entries
The system SHALL provide admin workflows to manage reusable Field Guide regions, storyline-to-region distance mappings, and collectible catalog entries for those regions.

#### Scenario: Admin defines a reusable region mapping
- **GIVEN** an admin is configuring Field Guide data
- **WHEN** the admin maps a reusable region to a storyline with a start and end distance band
- **THEN** the system saves that mapping independently of the region definition itself

#### Scenario: Admin creates a collectible slot
- **GIVEN** an admin is editing a reusable region
- **WHEN** the admin creates a collectible entry
- **THEN** the system requires a category of either `flora` or `fauna`, a rarity tier, a fixed slot order, and the authored content needed for that collectible's silhouette and revealed detail view

### Requirement: Positive walk distance triggers region-aware discovery attempts
The system SHALL evaluate collectible discovery only from positive walk distance added through walk create or walk update flows, using the active storyline's mapped regions across the traversed distance interval and rarity-tier-based odds with a slight rare-tier bump for unusually long walk entries.

#### Scenario: New walk entry creates discovery attempts
- **GIVEN** a user logs a new walk entry with positive distance
- **WHEN** the entry is saved successfully
- **THEN** the system evaluates discovery attempts from that positive distance against the mapped regions traversed by the user on the active storyline

#### Scenario: Walk update only uses newly added distance
- **GIVEN** a user has already saved a walk entry for a date
- **WHEN** the user increases that entry's distance later
- **THEN** the system evaluates discovery attempts only for the newly added distance above that date's previously processed high-water mark

#### Scenario: Crossing multiple mapped regions can yield discoveries from each
- **GIVEN** a saved walk entry moves the user through more than one mapped region band on the active storyline
- **WHEN** discovery attempts are evaluated
- **THEN** the system uses the traversed interval to make collectibles from each crossed mapped region eligible

#### Scenario: Long walk entries slightly improve rare finds
- **GIVEN** a saved walk entry meets the long-walk threshold
- **WHEN** discovery attempts are evaluated
- **THEN** the system applies a slight bump toward rarer collectible tiers compared with an otherwise equivalent shorter walk entry

### Requirement: Discoveries are immutable and duplicates are preserved
The system SHALL store discoveries as immutable collection events, reveal a collectible slot on first discovery, preserve duplicates as additional finds of the same collectible, and never revoke already found collectibles because of later walk edits or deletes.

#### Scenario: First discovery reveals a slot
- **GIVEN** a user has not previously found a collectible
- **WHEN** the user discovers that collectible for the first time
- **THEN** the system reveals that collectible in its authored slot and records a duplicate count of `1`

#### Scenario: Duplicate discovery increases count
- **GIVEN** a user has already found a collectible
- **WHEN** the user discovers the same collectible again
- **THEN** the system increases that collectible's duplicate count without creating a second Field Guide slot

#### Scenario: Walk reductions do not remove discoveries
- **GIVEN** a user has already earned one or more discoveries
- **WHEN** the user later reduces or deletes the walk entry that originally contributed to those discoveries
- **THEN** the previously found collectibles remain in the user's collection

#### Scenario: Existing users do not receive historical backfill
- **GIVEN** a user already has pre-launch walking history when the feature is introduced
- **WHEN** the Field Guide launches
- **THEN** the user starts with no backfilled discoveries and can discover collectibles only through post-launch walking activity

### Requirement: Field Guide page shows fixed silhouette slots and revealed details
The system SHALL present a dedicated Field Guide experience with region sections in authored order, fixed collectible slots visible from the start as silhouettes, revealed art and lore for discovered collectibles, duplicate counts, progress indicators, and flora/fauna filtering.

#### Scenario: Undiscovered slots are visible from the start
- **GIVEN** a user has not yet found every collectible in a region
- **WHEN** the user opens the Field Guide
- **THEN** the system shows the region's full authored slot layout with undiscovered entries rendered as locked silhouettes

#### Scenario: Discovered collectible shows detail view
- **GIVEN** a user has discovered a collectible
- **WHEN** the user opens that collectible from the Field Guide
- **THEN** the system shows the collectible's illustration, name, category, rarity, region, duplicate count, and authored lore content

#### Scenario: User filters the guide by category
- **GIVEN** the Field Guide contains both flora and fauna entries
- **WHEN** the user applies a `flora` or `fauna` filter
- **THEN** the system limits the visible collectible results to that category while preserving each region's authored slot order

### Requirement: Field Guide unread badge counts unseen discoveries and duplicates
The system SHALL track Field Guide unread state server-side and SHALL count both first discoveries and duplicate finds that occurred since the user last viewed or marked the Field Guide as seen.

#### Scenario: Duplicate find increments unread badge
- **GIVEN** a user has already discovered a collectible and has previously cleared their Field Guide unread count
- **WHEN** the user finds that same collectible again
- **THEN** the system increments the Field Guide unread badge for that new duplicate discovery

#### Scenario: Viewing the guide clears current unread discoveries
- **GIVEN** a user has one or more unread Field Guide discoveries
- **WHEN** the user visits the Field Guide and the system marks the collection as seen
- **THEN** the unread badge resets until a later discovery occurs

### Requirement: First discoveries appear as map markers on compatible paths
The system SHALL show map markers for first-discovery locations only, using the path context recorded at the moment of first discovery, and SHALL not create additional map markers for later duplicates.

#### Scenario: First discovery shows a marker on the matching path
- **GIVEN** a user first discovered a collectible on a map path that matches the currently viewed storyline path
- **WHEN** the user opens the map
- **THEN** the system shows a marker for that collectible at its recorded first-discovery location

#### Scenario: Duplicate discoveries do not create extra markers
- **GIVEN** a user has already received a first-discovery map marker for a collectible
- **WHEN** the user finds the same collectible again
- **THEN** the system keeps the existing first-discovery marker and does not add another marker for that duplicate

#### Scenario: Non-matching paths do not project markers onto another route
- **GIVEN** a user's first discovery for a collectible was recorded on a different map path than the one currently being viewed
- **WHEN** the user opens the current map path
- **THEN** the system does not project that first-discovery marker onto the incompatible route

### Requirement: Dev mode renders region distance bands on the map path
The system SHALL render active storyline region distance bands as visual overlays on the map path when the existing map dev mode flag (`window.__MAP_DEV_LOG`) is enabled, so admins and developers can inspect mapping coverage and boundary placement during debugging and testing.

#### Scenario: Dev mode shows region bands on the active path
- **GIVEN** map dev mode is active and the active storyline has one or more mapped Field Guide region bands
- **WHEN** the user opens the map
- **THEN** the system renders visual indicators for each mapped region band along the rendered path

#### Scenario: Dev mode off hides region bands
- **GIVEN** map dev mode is not active
- **WHEN** the user opens the map
- **THEN** the system does not render region band overlays