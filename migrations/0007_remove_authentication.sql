--Migration number: 0007 	 2025-10-05T10:45:00.000Z

-- Remove authentication: drop users and sessions tables, remove user_id from progress

-- Drop sessions table first (has foreign key to users)
DROP TABLE IF EXISTS sessions;

-- Drop users table
DROP TABLE IF EXISTS users;

-- Remove user_id from progress table by recreating it
CREATE TABLE progress_new (
    id INTEGER PRIMARY KEY NOT NULL,
    date DATE NOT NULL UNIQUE,
    distance REAL NOT NULL
);

-- Copy existing data to new table (excluding user_id)
INSERT INTO progress_new (id, date, distance)
SELECT id, date, distance
FROM progress;

-- Drop old table and rename new one
DROP TABLE progress;
ALTER TABLE progress_new RENAME TO progress;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_progress_date ON progress(date);
