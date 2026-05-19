-- Migration 0132_multi_storyline_foundation.sql
-- Multi-storyline foundation (previous plan + "Keep carries personal progress forward" delta)
--
-- Additive only. Existing single-journey behavior is preserved by seeding one
-- default storyline ("Frodo to Mount Doom") and backfilling every user, party,
-- and goal onto it. The existing `goals.distance` column is intentionally
-- left in place; per-storyline placements live in `storyline_goals`.
--
-- Personal progress model (per "Keep carries personal progress forward" delta):
--   * users.active_storyline_id           — user's current storyline
--   * users.active_storyline_distance_km  — cumulative distance on current storyline
--   * progress                            — unchanged; raw activity log
--   * No per-(user, storyline) bucket table. On switch, the personal total
--     either carries over ("keep") or resets to 0 ("discard"). An optional
--     audit table records each switch.
--
-- Fellowship model (unchanged from the prior plan):
--   * parties.storyline_id                — fellowship's current storyline
--   * party_progress_log.superseded_at    — non-NULL marks rows ignored by
--                                           the current storyline's totals
--                                           (set on "reset" storyline change)

-- 1. Storylines: a single named journey (path + goals).
CREATE TABLE IF NOT EXISTS storylines (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_storylines_sort_order ON storylines(sort_order);

-- 2. Paths: geometry for a storyline's route.
--    path_data is a JSON-encoded array of points/segments; the schema is kept
--    deliberately flexible because the geometry format is owned by the Map
--    island (Konva) and may evolve. One path per storyline (for now).
CREATE TABLE IF NOT EXISTS paths (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    storyline_id INTEGER NOT NULL,
    path_data TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(storyline_id),
    FOREIGN KEY (storyline_id) REFERENCES storylines (id) ON DELETE CASCADE
);

-- 3. Per-storyline placement of canonical goals.
--    Each storyline picks goals (from the shared `goals` table) and assigns
--    them per-storyline distances + flags. `is_challenge_end` marks
--    storyline-specific challenge/chapter boundaries.
CREATE TABLE IF NOT EXISTS storyline_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    storyline_id INTEGER NOT NULL,
    goal_id INTEGER NOT NULL,
    distance REAL NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_challenge_end INTEGER NOT NULL DEFAULT 0 CHECK(is_challenge_end IN (0, 1)),
    UNIQUE(storyline_id, goal_id),
    FOREIGN KEY (storyline_id) REFERENCES storylines (id) ON DELETE CASCADE,
    FOREIGN KEY (goal_id) REFERENCES goals (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_storyline_goals_storyline_distance
    ON storyline_goals(storyline_id, distance);

-- 4. Audit history of personal storyline switches (optional, recommended).
--    One row appended every time a user switches storylines. Lets a future
--    "journey timeline" view reconstruct chapters without hot-path work.
CREATE TABLE IF NOT EXISTS user_storyline_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id INTEGER NOT NULL,
    storyline_id INTEGER NOT NULL,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME DEFAULT NULL,
    distance_at_end_km REAL DEFAULT NULL,
    carry_over INTEGER DEFAULT NULL CHECK(carry_over IS NULL OR carry_over IN (0, 1)),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (storyline_id) REFERENCES storylines (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_storyline_history_user_id
    ON user_storyline_history(user_id);

-- 5. Column additions on existing tables.

-- goals.canonical_slug: stable cross-storyline identifier for shared landmarks
-- (e.g. Rivendell appearing on both Frodo's and Aragorn's storylines). Nullable
-- because backfilling slugs for the 100+ existing goals is deferred to a
-- future migration / admin tooling and the default storyline doesn't need
-- cross-storyline matching to function.
ALTER TABLE goals ADD COLUMN canonical_slug TEXT;
CREATE INDEX IF NOT EXISTS idx_goals_canonical_slug ON goals(canonical_slug);

-- users: active storyline + cumulative distance on that storyline.
-- active_storyline_distance_km is the single "personal total" the UI shows.
ALTER TABLE users ADD COLUMN active_storyline_id INTEGER REFERENCES storylines(id);
ALTER TABLE users ADD COLUMN active_storyline_distance_km REAL NOT NULL DEFAULT 0;

-- parties: which storyline this fellowship is travelling along.
ALTER TABLE parties ADD COLUMN storyline_id INTEGER REFERENCES storylines(id);

-- party_progress_log: rows with superseded_at IS NOT NULL are excluded from
-- the fellowship's current-storyline total. Stamped on "reset" storyline
-- changes; preserves an audit trail rather than hard-deleting log rows.
ALTER TABLE party_progress_log ADD COLUMN superseded_at DATETIME DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_party_progress_log_superseded_at
    ON party_progress_log(superseded_at);

-- 6. Seed the default storyline so every existing user/party/goal lands
--    somewhere sensible on first deploy.
INSERT INTO storylines (id, slug, name, description, sort_order)
SELECT 1, 'frodo-to-mount-doom',
       'Frodo to Mount Doom',
       'The original journey from Bag End to Mount Doom and back again — the canonical Walk to Mordor route.',
       0
WHERE NOT EXISTS (SELECT 1 FROM storylines WHERE id = 1);

-- 7. Backfill storyline_goals from the existing goals table.
--    is_challenge_end is derived from the legacy `special` column: any goal
--    flagged as a "Challenge N End" in the seed data, plus the closing
--    "Final Farewell" and "Closing Credits" markers.
INSERT INTO storyline_goals (storyline_id, goal_id, distance, sort_order, is_challenge_end)
SELECT
    1 AS storyline_id,
    g.id AS goal_id,
    g.distance AS distance,
    ROW_NUMBER() OVER (ORDER BY g.distance ASC, g.id ASC) AS sort_order,
    CASE
        WHEN g.special LIKE '%Challenge%End%' THEN 1
        WHEN g.special LIKE '%Final Farewell%' THEN 1
        WHEN g.special LIKE '%Closing Credits%' THEN 1
        ELSE 0
    END AS is_challenge_end
FROM goals g
WHERE NOT EXISTS (
    SELECT 1 FROM storyline_goals sg
    WHERE sg.storyline_id = 1 AND sg.goal_id = g.id
);

-- 8. Backfill every user onto the default storyline, with their lifetime
--    progress sum as the starting active_storyline_distance_km.
UPDATE users
SET active_storyline_id = 1,
    active_storyline_distance_km = COALESCE(
        (SELECT SUM(distance) FROM progress WHERE progress.user_id = users.id),
        0
    )
WHERE active_storyline_id IS NULL;

-- 9. Backfill every party onto the default storyline.
UPDATE parties
SET storyline_id = 1
WHERE storyline_id IS NULL;
