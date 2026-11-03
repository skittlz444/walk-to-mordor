-- Migration 0149_update_hundred_week_description.sql
-- Align the seeded Hundred-K Week display text with the calendar-week award
-- rule. 0145 uses INSERT OR IGNORE, so correcting the INSERT alone would not
-- update databases where the row already exists. This targeted UPDATE is
-- idempotent: it only matches the old description.

UPDATE achievement_definitions
SET description = 'Log at least 100 km within a Monday–Sunday calendar week.',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'habit-hundred-week'
  AND description = 'Log at least 100 km within a trailing seven-day window.';
