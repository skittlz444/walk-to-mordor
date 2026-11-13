-- Migration 0168_add_community_campaigns_enabled.sql
-- Per-user toggle for community campaign push notifications (defaults to ON).
-- Defaulting to enabled means existing users start receiving run announcements
-- and completion notices until they opt out through PUT /api/push/settings.
ALTER TABLE users ADD COLUMN community_campaigns_enabled INTEGER NOT NULL DEFAULT 1;
