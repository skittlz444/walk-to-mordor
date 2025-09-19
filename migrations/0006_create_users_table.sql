--Migration number: 0006 	 2024-12-19T08:54:00.000Z

-- Create users table for OAuth authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    oauth_provider TEXT NOT NULL, -- 'google'
    oauth_id TEXT NOT NULL, -- ID from OAuth provider
    oauth_token TEXT, -- OAuth access token (encrypted)
    oauth_refresh_token TEXT, -- OAuth refresh token (encrypted)
    samsung_health_token TEXT, -- Samsung Health access token (encrypted)
    samsung_health_refresh_token TEXT, -- Samsung Health refresh token (encrypted)
    samsung_health_linked BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(oauth_provider, oauth_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);