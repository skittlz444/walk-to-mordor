--Migration number: 0006 	 2025-09-22T08:15:00.000Z

-- Create users table with encrypted passwords (no email required)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create sessions table for session management
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Add user_id to progress table for user isolation and update unique constraint
-- First, we need to recreate the progress table to modify the unique constraint

-- Create new progress table with user_id and composite unique constraint
CREATE TABLE progress_new (
    id INTEGER PRIMARY KEY NOT NULL,
    date DATE NOT NULL,
    distance REAL NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(date, user_id)
);

-- Copy existing data to new table (all existing entries will have NULL user_id initially)
INSERT INTO progress_new (id, date, distance, user_id)
SELECT id, date, distance, NULL
FROM progress;

-- Drop old table and rename new one
DROP TABLE progress;
ALTER TABLE progress_new RENAME TO progress;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_progress_user_id ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_date ON progress(date);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);