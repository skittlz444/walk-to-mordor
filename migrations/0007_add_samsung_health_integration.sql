--Migration number: 0007   2025-09-23T14:20:00.000Z

-- Add Samsung Health integration fields to users table
ALTER TABLE users ADD COLUMN samsung_health_token TEXT;
ALTER TABLE users ADD COLUMN samsung_health_refresh_token TEXT;
ALTER TABLE users ADD COLUMN samsung_health_linked_at DATETIME;

-- Add sync source tracking to progress table
ALTER TABLE progress ADD COLUMN sync_source TEXT DEFAULT 'manual' CHECK (sync_source IN ('manual', 'samsung_health'));

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_users_samsung_health_linked ON users(samsung_health_linked_at);
CREATE INDEX IF NOT EXISTS idx_progress_sync_source ON progress(sync_source);