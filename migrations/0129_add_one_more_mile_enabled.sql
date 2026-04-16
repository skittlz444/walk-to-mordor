-- Per-user toggle for "One More Mile" push notifications (defaults to ON)
ALTER TABLE users ADD COLUMN one_more_mile_enabled INTEGER NOT NULL DEFAULT 1;
