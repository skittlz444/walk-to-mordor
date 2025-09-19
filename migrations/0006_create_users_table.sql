--Migration number: 0006 	 2025-01-15T10:00:00.000Z

-- Create users table for OAuth authentication
CREATE TABLE users (
    id INTEGER PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    oauth_provider TEXT NOT NULL, -- 'google', etc.
    oauth_provider_id TEXT NOT NULL, -- unique ID from OAuth provider
    oauth_access_token TEXT, -- encrypted OAuth access token
    oauth_refresh_token TEXT, -- encrypted OAuth refresh token
    samsung_health_access_token TEXT, -- encrypted Samsung Health token
    samsung_health_refresh_token TEXT, -- encrypted Samsung Health refresh token
    samsung_health_linked_at DATETIME, -- when Samsung Health was linked
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(oauth_provider, oauth_provider_id)
);

-- Create sessions table for session management
CREATE TABLE sessions (
    id TEXT PRIMARY KEY NOT NULL, -- session ID (UUID)
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for session lookups
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);