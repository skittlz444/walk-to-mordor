--Migration number: 0008 	 2024-12-19T09:00:00.000Z

-- Create user sessions table for session management
CREATE TABLE IF NOT EXISTS user_sessions (
    token TEXT PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for faster session lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);