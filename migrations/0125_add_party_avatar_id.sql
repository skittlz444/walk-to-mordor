-- Add optional avatar_id to parties table (fellowship icon)
ALTER TABLE parties ADD COLUMN avatar_id TEXT DEFAULT NULL;
