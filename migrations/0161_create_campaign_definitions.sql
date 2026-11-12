-- Migration 0161_create_campaign_definitions.sql
-- Public community campaign identity. A definition carries only copy, artwork,
-- badge linkage, and an enabled flag; the target distance, date window, and
-- lifecycle status for each cycle live on campaign_runs so a completed or
-- expired campaign can be retriggered without changing this row.

CREATE TABLE IF NOT EXISTS campaign_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    image_slug TEXT,
    badge_slug TEXT,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- idx_campaign_definitions_slug: stable campaign lookup and uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_definitions_slug ON campaign_definitions(slug);
-- idx_campaign_definitions_enabled: public listing scans only enabled campaigns
CREATE INDEX IF NOT EXISTS idx_campaign_definitions_enabled ON campaign_definitions(enabled);
