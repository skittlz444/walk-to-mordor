# calendar-week-display Specification

## Purpose
Defines how calendar-style week displays order and label weekdays, so the walk calendar, its map sheet, and the stats heatmap all present the same Monday-through-Sunday week that the app's weekly achievements measure.

## Requirements

### Requirement: Journey week view is Monday-first

The journey calendar's week view SHALL present each calendar week from Monday through Sunday, with weekday headers in that order and every date placed under its own weekday. Week navigation SHALL advance or retreat by exactly seven days.

#### Scenario: Weekday headers run Monday to Sunday

- **WHEN** the journey calendar is displayed in week view
- **THEN** the weekday headers read `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`, `Sun` from left to right

#### Scenario: Displayed week starts on Monday

- **WHEN** the user opens the week view on any day of the week
- **THEN** the first column shows the Monday of that week and the last column shows the following Sunday

#### Scenario: Today appears under its own weekday

- **WHEN** the week containing today is displayed
- **THEN** today's cell appears under the header whose label matches today's weekday

#### Scenario: Week navigation lands on a Monday

- **WHEN** the user selects the next or previous week
- **THEN** the displayed range moves by seven days and still begins on a Monday

### Requirement: Journey month view is Monday-first

The journey calendar's month view SHALL use Monday-through-Sunday weekday headers and SHALL begin each month grid with the Monday on or before the first day of the month, so every date falls under its own weekday header. Dates outside the displayed month SHALL remain visually de-emphasized.

#### Scenario: Month headers run Monday to Sunday

- **WHEN** the journey calendar is displayed in month view
- **THEN** the weekday headers read `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`, `Sun` from left to right

#### Scenario: Month starting on Sunday is padded from the previous Monday

- **WHEN** the first day of the displayed month falls on a Sunday
- **THEN** the first row begins with six dates from the previous month and the first of the month appears in the final column

#### Scenario: Every date aligns with its weekday

- **WHEN** any date is displayed in the month grid
- **THEN** it appears in the column whose header matches that date's weekday

#### Scenario: Neighbouring-month dates stay de-emphasized

- **WHEN** the month grid includes dates from the previous or next month
- **THEN** those cells remain visually distinct from dates belonging to the displayed month

### Requirement: Map calendar sheet matches the journey calendar

The map page's calendar sheet SHALL use the same Monday-through-Sunday week convention as the journey calendar in both its week and month views, including weekday header order, week boundaries, and month-grid alignment.

#### Scenario: Sheet week view is Monday-first

- **WHEN** the calendar sheet is opened on the map page in week view
- **THEN** its weekday headers read `Mon` through `Sun` and the first column is the Monday of the displayed week

#### Scenario: Sheet month view aligns dates to weekdays

- **WHEN** the calendar sheet is opened on the map page in month view
- **THEN** weekday headers read `Mon` through `Sun` and each date appears under its own weekday header

### Requirement: Heatmap weekday columns are Monday-first

The stats heatmap SHALL display weekday columns from Monday through Sunday and SHALL group each week row as a Monday-through-Sunday week. When the earliest displayed day is not a Monday, the leading columns of that partial week SHALL be empty so that each day still appears under its own weekday header.

#### Scenario: Heatmap headers run Monday to Sunday

- **WHEN** the heatmap is displayed
- **THEN** the weekday column labels read `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`, `Sun` from left to right

#### Scenario: Weeks are grouped Monday to Sunday

- **WHEN** a heatmap row contains a Monday and a Sunday of the same week
- **THEN** the Monday occupies the first day column and the Sunday occupies the last day column

#### Scenario: Partial first week is padded at the front

- **WHEN** the earliest displayed heatmap date is not a Monday
- **THEN** the preceding columns of that row are empty and the date appears under its own weekday header

#### Scenario: Heatmap date aligns with its weekday

- **WHEN** any logged day is displayed in the heatmap
- **THEN** it appears in the column whose header matches that date's weekday
