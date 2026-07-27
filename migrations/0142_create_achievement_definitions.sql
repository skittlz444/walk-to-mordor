-- Migration 0142_create_achievement_definitions.sql
-- Shared achievement/badge definition table. Consuming features (personal
-- challenges, storyline books, Field Guide) register badge metadata here
-- instead of each inventing its own definition table.

CREATE TABLE IF NOT EXISTS achievement_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    image_slug TEXT,
    badge_type TEXT NOT NULL,
    is_repeatable INTEGER NOT NULL DEFAULT 0 CHECK (is_repeatable IN (0, 1)),
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- idx_achievement_definitions_slug: enforce unique slugs and support fast slug lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_achievement_definitions_slug ON achievement_definitions(slug);
-- idx_achievement_definitions_badge_type: support badge-type grouping queries
CREATE INDEX IF NOT EXISTS idx_achievement_definitions_badge_type ON achievement_definitions(badge_type);
