-- Migration 0132_add_storyline_infrastructure.sql
-- Add storyline infrastructure while preserving the existing Frodo/Sam route as the default.

CREATE TABLE IF NOT EXISTS storylines (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  path_key TEXT NOT NULL DEFAULT 'fellowship',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO storylines (slug, title, description, path_key, sort_order, is_active)
VALUES (
  'frodo-sam',
  'Frodo & Sam',
  'Follow the current Walk to Mordor route from Bag End to Mount Doom, the Grey Havens, and Sam''s return home.',
  'fellowship',
  0,
  1
);

CREATE TABLE IF NOT EXISTS storyline_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  storyline_id INTEGER NOT NULL,
  goal_id INTEGER NOT NULL,
  distance REAL NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(storyline_id, goal_id),
  FOREIGN KEY (storyline_id) REFERENCES storylines(id) ON DELETE CASCADE,
  FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO storyline_goals (storyline_id, goal_id, distance, sort_order)
SELECT s.id, g.id, g.distance, g.id
FROM goals g
JOIN storylines s ON s.slug = 'frodo-sam';

CREATE INDEX IF NOT EXISTS idx_storylines_active_sort ON storylines(is_active, sort_order, title);
CREATE INDEX IF NOT EXISTS idx_storyline_goals_storyline_distance ON storyline_goals(storyline_id, distance, sort_order);
CREATE INDEX IF NOT EXISTS idx_storyline_goals_goal_id ON storyline_goals(goal_id);

ALTER TABLE users ADD COLUMN active_storyline_id INTEGER DEFAULT NULL;
ALTER TABLE users ADD COLUMN storyline_distance_offset REAL NOT NULL DEFAULT 0;

UPDATE users
SET active_storyline_id = (SELECT id FROM storylines WHERE slug = 'frodo-sam')
WHERE active_storyline_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_active_storyline_id ON users(active_storyline_id);

ALTER TABLE parties ADD COLUMN active_storyline_id INTEGER DEFAULT NULL;
ALTER TABLE parties ADD COLUMN storyline_distance_offset REAL NOT NULL DEFAULT 0;

UPDATE parties
SET active_storyline_id = (SELECT id FROM storylines WHERE slug = 'frodo-sam')
WHERE active_storyline_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_parties_active_storyline_id ON parties(active_storyline_id);
