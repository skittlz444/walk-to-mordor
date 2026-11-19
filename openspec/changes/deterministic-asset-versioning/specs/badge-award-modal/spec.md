# Spec Delta

## MODIFIED Requirements

### Requirement: Award modal presents the badge's full artwork

The modal SHALL display the badge's 1024 px full image at `/img/achievements/full/<name>.webp`, where `<name>` is the `image_slug` for fixed-rank badges and `<image_slug>--<rank_label>` for repeatables. In acknowledge mode `presentation` is the pending entry's awarding rank; in view-only mode it is the grid's current rank. The image SHALL use the grid's slug validation and fallback rules: no request for an invalid slug, base-image retry, and a fallback so the modal never breaks.

#### Scenario: Fixed-rank badge shows its full image
- **GIVEN** a fixed-rank badge whose `image_slug` matches the slug pattern
- **WHEN** the modal renders that badge
- **THEN** the image source resolves to `/img/achievements/full/<image_slug>.webp`
- **AND** the source MAY include a `?v=<hash>` query

#### Scenario: Repeatable badge shows its rank variant
- **GIVEN** a repeatable badge with `presentation.rank_label` `gold`
- **WHEN** the modal renders that badge
- **THEN** the image source resolves to `/img/achievements/full/<image_slug>--gold.webp`
- **AND** the source MAY include a `?v=<hash>` query

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
