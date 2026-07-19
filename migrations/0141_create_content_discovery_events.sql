-- Migration 0141_create_content_discovery_events.sql
-- Append-only table for lightweight, best-effort goal-content discovery analytics.
-- Records teaser impressions and content opens. Writes are best-effort and may be
-- dropped without affecting user-facing flows, so no foreign-key constraints are used.

CREATE TABLE IF NOT EXISTS content_discovery_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id INTEGER,
    party_id INTEGER,
    goal_id INTEGER NOT NULL,
    content_id INTEGER,
    event_type TEXT NOT NULL CHECK (event_type IN ('teaser_impression', 'content_open')),
    context_type TEXT NOT NULL CHECK (context_type IN ('personal', 'fellowship')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- idx_content_discovery_events_goal_id: aggregate discovery metrics per goal
CREATE INDEX IF NOT EXISTS idx_content_discovery_events_goal_id ON content_discovery_events(goal_id);
-- idx_content_discovery_events_created_at: time-window aggregation
CREATE INDEX IF NOT EXISTS idx_content_discovery_events_created_at ON content_discovery_events(created_at);
