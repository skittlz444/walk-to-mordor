--Migration number: 0020 	 2026-01-17T17:00:00.000Z

-- Add email_verified column to users table
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

-- Migrate existing users to email_verified = 1 (backward compatibility)
UPDATE users SET email_verified = 1;

-- Create email_confirmation_tokens table for managing email verification
CREATE TABLE IF NOT EXISTS email_confirmation_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_confirmation_tokens_user_id ON email_confirmation_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_confirmation_tokens_token ON email_confirmation_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_confirmation_tokens_expires ON email_confirmation_tokens(expires_at);
