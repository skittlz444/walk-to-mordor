-- Migration 0133_add_storyline_admin_only.sql
-- Allow admins to stage in-progress storylines before releasing them to users.

ALTER TABLE storylines ADD COLUMN admin_only INTEGER NOT NULL DEFAULT 0 CHECK(admin_only IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_storylines_visibility_sort ON storylines(is_active, admin_only, sort_order, title);
