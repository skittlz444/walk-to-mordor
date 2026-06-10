## ADDED Requirements

### Requirement: Admin Field Guide region CRUD
The system SHALL provide admin APIs to list, create, read, update, and delete reusable Field Guide regions, SHALL validate region slugs, and SHALL reject requests from non-admin users.

#### Scenario: Admin lists all Field Guide regions
- **GIVEN** an authenticated admin
- **WHEN** the admin calls `GET /api/admin/field-guide/regions`
- **THEN** the response includes all regions with their slugs, titles, sort orders, and artwork metadata

#### Scenario: Admin creates a valid region
- **GIVEN** an authenticated admin submits valid region fields (slug, title, sort order)
- **WHEN** the admin calls `POST /api/admin/field-guide/regions`
- **THEN** the region is created and an audit log entry is recorded

#### Scenario: Admin create is rejected for invalid slug
- **GIVEN** an admin submits a region with an invalid or duplicate slug
- **WHEN** the admin calls `POST /api/admin/field-guide/regions`
- **THEN** the system returns a validation error

#### Scenario: Non-admin cannot manage regions
- **GIVEN** an authenticated non-admin user
- **WHEN** the user calls any `/api/admin/field-guide` endpoint
- **THEN** the system returns a 403 error

### Requirement: Admin storyline-region mapping CRUD
The system SHALL provide admin APIs to create, read, update, and delete storyline-to-region distance-band mappings, SHALL validate that mappings do not overlap within the same storyline, and SHALL return coverage validation results after each mutation.

#### Scenario: Admin maps a region to a storyline distance band
- **GIVEN** an authenticated admin
- **WHEN** the admin creates a mapping with storyline ID, start distance, and end distance
- **THEN** the mapping is saved and coverage validation results are returned

#### Scenario: Overlapping mapping is rejected
- **GIVEN** an existing mapping for storyline A from 100-200 km
- **WHEN** an admin tries to create a mapping for storyline A from 150-250 km
- **THEN** the system returns a validation error indicating the overlap

#### Scenario: Coverage validation shows gaps and overlaps
- **GIVEN** a storyline with multiple region mappings
- **WHEN** the admin views mapping coverage
- **THEN** the system reports any uncovered gaps or overlapping bands

### Requirement: Admin collectible catalog CRUD
The system SHALL provide admin APIs to create, read, update, and delete collectible catalog entries, SHALL validate category (flora/fauna), rarity tier (common/uncommon/rare), and slot ordering per region, and SHALL require artwork slugs and authored lore content.

#### Scenario: Admin creates a collectible entry
- **GIVEN** an authenticated admin editing a region
- **WHEN** the admin creates a collectible with category, rarity, slot order, image slug, silhouette slug, and lore text
- **THEN** the collectible is created and appears in the region's slot roster

#### Scenario: Duplicate slot order is rejected
- **GIVEN** a region with a collectible at slot order 3
- **WHEN** an admin creates another collectible at slot order 3
- **THEN** the system returns a validation error

#### Scenario: Invalid category or rarity is rejected
- **GIVEN** an admin submits a collectible with category "mineral" or rarity "legendary"
- **WHEN** the request is processed
- **THEN** the system returns a validation error

### Requirement: Admin Field Guide management page
The system SHALL render a dedicated admin Field Guide management page at `/admin/field-guide` with sections for regions, storyline mappings, and collectible catalog management, SHALL include a sidebar navigation link, and SHALL display mapping coverage validation visually.

#### Scenario: Admin views the Field Guide management page
- **GIVEN** an authenticated admin navigates to `/admin/field-guide`
- **WHEN** the page loads
- **THEN** three management sections are displayed: Regions, Mappings, and Collectibles

#### Scenario: Admin sidebar includes Field Guide link
- **GIVEN** any admin page is rendered
- **WHEN** the sidebar navigation is displayed
- **THEN** a "Field Guide" link is present linking to `/admin/field-guide`

#### Scenario: Mapping coverage is displayed visually
- **GIVEN** an admin viewing the mappings section for a storyline
- **WHEN** coverage data is loaded
- **THEN** covered distance ranges are shown in green, gaps in yellow, and overlaps in red
