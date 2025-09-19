--Migration number: 0007 	 2025-01-15T10:01:00.000Z

-- Add user_id and Samsung Health sync tracking to progress table
-- Since we can't add foreign key constraints to existing tables in SQLite,
-- we need to recreate the table

-- Create new progress table with user_id and sync tracking
CREATE TABLE progress_new (
    id INTEGER PRIMARY KEY NOT NULL,
    date DATE NOT NULL,
    distance REAL NOT NULL,
    user_id INTEGER, -- NULL for existing anonymous entries
    synced_from_samsung BOOLEAN DEFAULT FALSE,
    samsung_sync_date DATETIME, -- when this entry was synced from Samsung Health
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(date, user_id) -- unique constraint per user per date
);

-- Copy existing data from old table (these will be anonymous entries with user_id = NULL)
INSERT INTO progress_new (id, date, distance, user_id, synced_from_samsung, created_at, updated_at)
SELECT id, date, distance, NULL, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM progress;

-- Drop old table and rename new one
DROP TABLE progress;
ALTER TABLE progress_new RENAME TO progress;

-- Create indexes for performance
CREATE INDEX idx_progress_user_id ON progress(user_id);
CREATE INDEX idx_progress_date ON progress(date);
CREATE INDEX idx_progress_user_date ON progress(user_id, date);