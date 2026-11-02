-- Migration 0146_update_faithful_walker_description.sql
-- Align the seeded Faithful Walker display text with the calendar-week award
-- rule. 0144 uses INSERT OR IGNORE, so correcting the INSERT alone would not
-- update databases where the row already exists. This targeted UPDATE is
-- idempotent: it only matches the old description.

UPDATE achievement_definitions
SET description = 'Log a walk on every day (Monday through Sunday) of a calendar week.',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'habit-faithful-walker'
  AND description = 'Walk on seven distinct days within a trailing seven-day window.';
