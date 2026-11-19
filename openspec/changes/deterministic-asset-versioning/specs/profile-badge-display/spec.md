# Spec Delta

## MODIFIED Requirements

### Requirement: Badge artwork resolution

The system SHALL resolve card artwork from the logical path `/img/achievements/<name>.webp`, thumbnails from `/img/achievements/<name>-thumb.webp`, and full artwork from `/img/achievements/full/<name>.webp`. `<name>` SHALL be `<image_slug>--<rank_label>` for repeatable badges and `<image_slug>` otherwise. Resolved URLs MAY include a deterministic `?v=<hash>` cache-busting query. This change SHALL commit the full artwork as an asset but SHALL NOT add a UI reference or click target for it.

#### Scenario: Fixed-rank image renders at all sizes
- **GIVEN** a badge with `image_slug` `journey-frodo-sam-buckleberry-ferry`
- **WHEN** the card, thumbnail, and full image are requested
- **THEN** the sources resolve to `/img/achievements/journey-frodo-sam-buckleberry-ferry.webp`, `/img/achievements/journey-frodo-sam-buckleberry-ferry-thumb.webp`, and `/img/achievements/full/journey-frodo-sam-buckleberry-ferry.webp`
- **AND** each source MAY include a `?v=<hash>` query

#### Scenario: Repeatable badge selects its rank variant
- **GIVEN** a repeatable badge with `image_slug` `habit-faithful-walker`, `presentation.rank` 3, and `presentation.rank_label` `gold`
- **WHEN** the card renders
- **THEN** the image source resolves to `/img/achievements/habit-faithful-walker--gold.webp`
- **AND** the full image asset resolves to `/img/achievements/full/habit-faithful-walker--gold.webp`
- **AND** either source MAY include a `?v=<hash>` query

#### Scenario: Thumbnail is available for compact previews
- **GIVEN** a badge with a valid artwork name
- **WHEN** a compact preview requests the thumbnail
- **THEN** the source resolves to `/img/achievements/<name>-thumb.webp`
- **AND** the source MAY include a `?v=<hash>` query

### Requirement: Badge artwork fallback

When the image slug is null, malformed, or an image fails to load, the card SHALL render a CSS placeholder without breaking layout. A repeatable badge whose rank variant fails SHALL retry the base image before falling back. Retried sources MAY include a deterministic `?v=<hash>` cache-busting query.

#### Scenario: Missing rank variant falls back to the base image
- **GIVEN** a repeatable badge whose rank-variant image is missing
- **WHEN** the card image fails to load
- **THEN** the image source is retried with the logical path `/img/achievements/<image_slug>.webp`
- **AND** the retry MAY include a `?v=<hash>` query

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
