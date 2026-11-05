-- Migration 0155_create_event_participants.sql
-- Per-user enrollment in an encounter occurrence. The participant row is
-- created at acceptance time, which naturally excludes walks logged before the
-- challenge began. progress_distance is a cached total recomputed from
-- event_progress_ledger on every eligible walk change.

CREATE TABLE IF NOT EXISTS event_participants (
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

-- idx_event_participants_user_id: active participant lookup during reconciliation
CREATE INDEX IF NOT EXISTS idx_event_participants_user_id ON event_participants(user_id);
