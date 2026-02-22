-- Migration 0118_add_default_view_preference.sql
-- Add user preference for default landing page view
-- Default 0 = journey view (existing behavior)
-- Value 1 = map view

ALTER TABLE users ADD COLUMN default_view_map INTEGER NOT NULL DEFAULT 0;
