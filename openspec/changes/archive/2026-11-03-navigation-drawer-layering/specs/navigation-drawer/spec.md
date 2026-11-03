# Spec Delta

## Purpose

Defines how the global navigation drawer layers above page content and below app-level dialogs, so navigation is never visually or interactively obstructed.

## ADDED Requirements

### Requirement: Drawer covers page content when open

The system SHALL paint the open navigation drawer and its backdrop above all page content and page-level overlays, so that no page element remains visible or interactive at a point covered by the drawer or its backdrop.

#### Scenario: Party legend does not float over the drawer

- **GIVEN** the map page is showing a fellowship view with the party distance legend visible
- **AND** the viewport is narrow enough that the party legend and the drawer overlap
- **WHEN** the user opens the navigation drawer
- **THEN** the party legend does not paint above the drawer at the overlapping area
- **AND** the topmost element at that point belongs to the drawer or its backdrop

#### Scenario: Map calendar sheet is covered

- **GIVEN** the map page has the calendar sheet open
- **WHEN** the user opens the navigation drawer
- **THEN** the calendar sheet is covered by the drawer or its backdrop
- **AND** the drawer remains the topmost interactive navigation surface

#### Scenario: Page overlay is covered on any page

- **GIVEN** any page renders a positioned overlay inside the page content
- **WHEN** the user opens the navigation drawer
- **THEN** that overlay does not paint above the drawer or its backdrop

### Requirement: App-level dialogs stay above the drawer

The system SHALL keep app-level modal dialogs and global banners that are defined above the navigation layer visible above an open drawer, so an active dialog is never buried by navigation.

#### Scenario: Modal dialog remains visible over the drawer

- **GIVEN** an app-level modal dialog is open
- **AND** the navigation drawer is also open
- **WHEN** the page paints
- **THEN** the modal dialog remains above the drawer and its backdrop
- **AND** the drawer does not receive pointer events over the dialog
