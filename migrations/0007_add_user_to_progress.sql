--Migration number: 0007 	 2024-12-19T08:55:00.000Z

-- Add user_id column to progress table and handle existing data
-- First, create a default "anonymous" user for existing progress entries
INSERT OR IGNORE INTO users (id, email, oauth_provider, oauth_id, created_at)
VALUES (1, 'anonymous@walkto.mordor', 'anonymous', 'anonymous-user', CURRENT_TIMESTAMP);

-- Create new progress table with user_id
CREATE TABLE progress_new (
    id INTEGER PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL DEFAULT 1,
    date DATE NOT NULL,
    distance REAL NOT NULL,
    synced_from_samsung BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, date)
);

-- Copy existing data to new table (all assigned to anonymous user)
INSERT INTO progress_new (id, user_id, date, distance, synced_from_samsung, created_at, updated_at)
SELECT id, 1, date, distance, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM progress;

-- Drop old table and rename new one
DROP TABLE progress;
ALTER TABLE progress_new RENAME TO progress;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_progress_user_date ON progress(user_id, date);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);