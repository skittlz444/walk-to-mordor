-- Migration 0159_rebuild_legacy_event_tables.sql
-- Pre-release databases may still carry prototype `events-and-challenges`
-- tables from an earlier, unmerged experiment. That prototype created
-- `event_participants` with a foreign key to its own `event_occurrences`
-- table and `event_progress_ledger` with a `distance_credited` column.
--
-- 0155 and 0156 use CREATE TABLE IF NOT EXISTS, so on such a database those
-- statements silently keep the stale shape. The new personal-challenge code
-- then fails when it inserts a participant whose occurrence id is outside the
-- prototype occurrence ids, or when it writes `event_progress_ledger.distance`.
--
-- The prototype tables are not created by any migration in this repository and
-- hold no production data. Drop and recreate the two tables this capability
-- owns with the canonical 0155/0156 schema. The prototype `event_templates` and
-- `event_occurrences` tables are left untouched for the future community
-- campaign work, which must define its own schema migration.

DROP TABLE IF EXISTS event_progress_ledger;
DROP TABLE IF EXISTS event_participants;

CREATE TABLE event_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    occurrence_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    progress_distance REAL NOT NULL DEFAULT 0 CHECK (progress_distance >= 0),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (occurrence_id) REFERENCES encounter_occurrences(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, occurrence_id)
);

CREATE INDEX IF NOT EXISTS idx_event_participants_user_id ON event_participants(user_id);

CREATE TABLE event_progress_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    participant_id INTEGER NOT NULL,
    source_progress_id INTEGER NOT NULL,
    distance REAL NOT NULL CHECK (distance >= 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant_id) REFERENCES event_participants(id) ON DELETE CASCADE,
    FOREIGN KEY (source_progress_id) REFERENCES progress(id) ON DELETE CASCADE,
    UNIQUE(participant_id, source_progress_id)
);

CREATE INDEX IF NOT EXISTS idx_event_progress_ledger_participant_id ON event_progress_ledger(participant_id);
