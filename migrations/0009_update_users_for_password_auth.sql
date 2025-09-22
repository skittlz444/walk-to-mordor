--Migration number: 0009 	 2024-12-19T10:00:00.000Z

-- Update users table to support username/password authentication instead of OAuth
-- Create new table with updated schema
CREATE TABLE users_new (
    id INTEGER PRIMARY KEY NOT NULL,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    samsung_health_token TEXT, -- Samsung Health access token (encrypted)
    samsung_health_refresh_token TEXT, -- Samsung Health refresh token (encrypted)
    samsung_health_linked BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Migrate existing data (convert OAuth users to username/password users)
-- For existing users, we'll create temporary accounts that users can claim
INSERT INTO users_new (id, username, email, password_hash, samsung_health_token, samsung_health_refresh_token, samsung_health_linked, created_at, updated_at)
SELECT 
    id,
    CASE 
        WHEN oauth_provider = 'anonymous' THEN 'anonymous'
        ELSE LOWER(REPLACE(email, '@', '_at_'))
    END as username,
    email,
    -- Use a placeholder hash that will force password reset for existing OAuth users
    '$2a$12$placeholder.hash.requires.password.reset' as password_hash,
    samsung_health_token,
    samsung_health_refresh_token,
    samsung_health_linked,
    created_at,
    updated_at
FROM users;

-- Drop old table and rename new one
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);