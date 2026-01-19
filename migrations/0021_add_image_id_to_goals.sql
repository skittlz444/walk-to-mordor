-- Migration number: 0021 	 2026-01-19T08:00:00.000Z

-- Add image_id column to goals table
-- This decouples image assets from the auto-increment id,
-- allowing intermediary goals to be inserted without breaking image references
ALTER TABLE goals ADD COLUMN image_id TEXT;

-- Populate image_id with existing id values (as text) for backward compatibility
-- This ensures existing image links continue to work
UPDATE goals SET image_id = CAST(id AS TEXT);
