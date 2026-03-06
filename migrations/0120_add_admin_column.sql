-- Add is_admin column to users table for role-based access control
-- All existing users default to non-admin (is_admin = 0)
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
