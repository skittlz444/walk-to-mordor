## ADDED Requirements

### Requirement: Book list display in storyline detail
The system SHALL display an ordered list of books for the selected storyline in the admin detail view, showing book slug, title, start distance, end distance, and linked badge name.

#### Scenario: Admin views books for a storyline
- **GIVEN** an authenticated admin selects a storyline in the admin storylines page
- **WHEN** the storyline detail loads
- **THEN** a Books section is displayed below the goals list
- **AND** books are shown in sort order with their boundary distances and badge names

#### Scenario: Storyline with no books shows an empty state
- **GIVEN** a storyline with no defined books
- **WHEN** the admin views the storyline detail
- **THEN** the Books section shows an empty state with a "Add First Book" action

### Requirement: Book CRUD in admin UI
The system SHALL let admins create, edit, reorder, and delete storyline books inline within the storylines admin page, SHALL provide milestone-anchor boundary pickers, and SHALL log all mutations to the audit log.

#### Scenario: Admin creates a new book
- **GIVEN** an admin viewing a storyline's books
- **WHEN** the admin fills in the create form with slug, title, start distance, end distance, and badge slug
- **THEN** the book is created and appears in the ordered list

#### Scenario: Admin edits an existing book
- **GIVEN** an admin viewing an existing book
- **WHEN** the admin opens the edit form, changes fields, and submits
- **THEN** the book is updated
- **AND** the list reflects the changes

#### Scenario: Admin reorders books
- **GIVEN** a storyline with multiple books
- **WHEN** the admin changes the sort order of books
- **THEN** the books are reordered in the list

#### Scenario: Admin deletes a book
- **GIVEN** an admin viewing an existing book
- **WHEN** the admin confirms deletion
- **THEN** the book is removed from the storyline

#### Scenario: Milestone-anchor picker pre-fills distance from goal
- **GIVEN** an admin creating or editing a book
- **WHEN** the admin selects a goal from the boundary anchor dropdown
- **THEN** the distance field is pre-filled with that goal's distance

### Requirement: Coverage validation display
The system SHALL display coverage validation results inline after each book mutation, showing gaps, overlaps, shared endpoint issues, and out-of-range milestone warnings.

#### Scenario: Valid coverage shows green confirmation
- **GIVEN** a storyline with complete, non-overlapping book coverage
- **WHEN** the admin views the validation summary
- **THEN** a green checkmark indicates valid coverage

#### Scenario: Gap in coverage shows red warning
- **GIVEN** a storyline with a gap between two books
- **WHEN** the admin views the validation summary
- **THEN** the gap is reported with the uncovered distance range

#### Scenario: Overlap in coverage shows red warning
- **GIVEN** a storyline with overlapping book boundaries beyond shared endpoints
- **WHEN** the admin views the validation summary
- **THEN** the overlap is reported with the affected books

### Requirement: Badge metadata per book
The system SHALL provide inline badge metadata fields (name, image slug, description) for each book, SHALL auto-create or update the linked achievement definition on save, and SHALL reuse the established inline badge management pattern.

#### Scenario: Admin sets badge metadata when creating a book
- **GIVEN** an admin filling in the book create form
- **WHEN** the admin enters badge name, description, and image slug alongside the book fields
- **THEN** the linked achievement definition is auto-created or updated on save

#### Scenario: Admin edits badge metadata for an existing book
- **GIVEN** an admin editing an existing book
- **WHEN** the admin changes badge fields
- **THEN** the linked achievement definition is updated on save
