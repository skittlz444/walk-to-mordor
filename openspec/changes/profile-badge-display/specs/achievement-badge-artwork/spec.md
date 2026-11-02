# Spec Delta

## Purpose

Defines the durable badge artwork set and the visual composition rules every current and future achievement badge must follow.

## ADDED Requirements

### Requirement: Badge artwork has card, thumbnail, and full-size WebP variants

Every achievement badge SHALL ship three transparency-preserving WebP images: a 512×512 card image, a 200×200 thumbnail, and a 1024×1024 full image. The card SHALL be used in the profile grid, the thumbnail SHALL be available for compact or preview use, and the full image SHALL be available for inspection.

#### Scenario: Fixed-rank badge exposes all three sizes
- **WHEN** a fixed-rank badge is published
- **THEN** `/img/achievements/<slug>.webp`, `/img/achievements/<slug>-thumb.webp`, and `/img/achievements/full/<slug>.webp` exist at 512, 200, and 1024 pixels

#### Scenario: Repeatable badge exposes rank variants at all sizes
- **WHEN** a repeatable badge is published
- **THEN** each rank has `<slug>--<rank>.webp`, `<slug>--<rank>-thumb.webp`, and `full/<slug>--<rank>.webp`
- **AND** the base `<slug>` images remain a no-boss fallback

#### Scenario: Artwork budgets are met
- **WHEN** badge artwork is committed
- **THEN** each card is at most 120 KiB
- **AND** each thumbnail is at most 20 KiB
- **AND** each full image is at most 500 KiB

### Requirement: Badge composition uses the locked circular F1 stack

Every badge composite SHALL be circular and SHALL stack the emblem at 800 px inside an opaque dark well at 880 px, inside the family frame at 1016 px outer / 880 px inner, with the selected rank boss at 6 o'clock. There SHALL be no rank ring and no hexagonal badge silhouette. The boss and its shadow SHALL be clipped to the badge alpha.

#### Scenario: Composite follows the locked stack
- **WHEN** a badge is composited
- **THEN** the emblem, opaque well, family frame, and rank boss appear in that order
- **AND** the area outside the badge silhouette is transparent

#### Scenario: Opaque well covers the emblem-frame gap
- **WHEN** the badge is rendered on a light background
- **THEN** no transparent moat is visible between the emblem and the family frame

#### Scenario: Boss stays inside the badge silhouette
- **WHEN** the rank boss and contact shadow are placed at 6 o'clock
- **THEN** neither extends outside the badge alpha
- **AND** the dark bezel remains visible at card size

### Requirement: Future badges reuse the locked family frames and rank bosses

A new badge SHALL use the locked family frame for its `badge_type` and the locked rank boss for its rank. It SHALL NOT introduce a per-badge frame, a per-badge rank boss, or a rank ring. A new family or rank SHALL require a recorded design decision before artwork is produced.

#### Scenario: New badge uses its family frame
- **WHEN** a badge with `badge_type: "book"` is added
- **THEN** its artwork uses the locked book family frame

#### Scenario: Rank boss matches the badge rank
- **WHEN** a fixed-rank badge is added at gold rank
- **THEN** its composite uses the locked gold rank boss

#### Scenario: Repeatable badge ships four boss variants
- **WHEN** a repeatable badge is added
- **THEN** its artwork includes bronze, silver, gold, and mithril variants
- **AND** the client selects the variant from `presentation.rank`

### Requirement: Reusable frame and boss source layers are retained

The repository SHALL retain the six family frame masters and the four rank boss masters as transparent source layers for future badges. The retained layers SHALL be independent of gitignored working files and SHALL NOT be served to clients.

#### Scenario: Frame layers are retained
- **WHEN** the repository is checked out
- **THEN** one transparent 1024 px master exists for each family frame

#### Scenario: Boss layers are retained
- **WHEN** the repository is checked out
- **THEN** each rank has a master, a placement tile, and a contact shadow

#### Scenario: Retained layers survive working-file cleanup
- **WHEN** the gitignored `raw_assets/` workspace is removed
- **THEN** the retained frame and boss layers remain available for future compositing

### Requirement: Artwork selections are recorded and reproducible

Each badge SHALL have a recorded family frame, emblem candidate, and rank boss selection. A rebuild from the recorded selections SHALL produce artwork that matches the committed badge assets.

#### Scenario: Selections cover every badge
- **WHEN** the selection record is inspected
- **THEN** every badge has an emblem candidate and a frame family
- **AND** every rank has a boss candidate

#### Scenario: Rebuild uses recorded selections
- **WHEN** the badge artwork is rebuilt from the selection record
- **THEN** each composite uses its recorded frame and boss
- **AND** the outputs match the committed card, thumbnail, and full images
