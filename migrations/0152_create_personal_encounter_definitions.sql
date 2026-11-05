-- Migration 0152_create_personal_encounter_definitions.sql
-- Reusable personal-encounter configuration. A definition describes the copy,
-- artwork, badge, duration, and target-calculation brackets for one kind of
-- personal challenge. Concrete user instances live in encounter_occurrences so
-- the same definition can generate repeat encounters.

CREATE TABLE IF NOT EXISTS personal_encounter_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    image_slug TEXT,
    badge_slug TEXT,
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    target_stretch_multiplier REAL NOT NULL DEFAULT 1.3 CHECK (target_stretch_multiplier > 0),
    target_min_distance REAL NOT NULL DEFAULT 3.0 CHECK (target_min_distance >= 0),
    target_max_distance REAL NOT NULL DEFAULT 50.0 CHECK (target_max_distance >= target_min_distance),
    is_repeatable INTEGER NOT NULL DEFAULT 1 CHECK (is_repeatable IN (0, 1)),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- idx_personal_encounter_definitions_slug: stable definition lookup and uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_encounter_definitions_slug ON personal_encounter_definitions(slug);
-- idx_personal_encounter_definitions_enabled: fast enabled-definition scans for daily rolls
CREATE INDEX IF NOT EXISTS idx_personal_encounter_definitions_enabled ON personal_encounter_definitions(enabled);
