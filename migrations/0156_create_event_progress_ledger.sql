-- Migration 0156_create_event_progress_ledger.sql
-- Idempotent credit ledger for personal challenge progress. Each canonical walk
-- row contributes at most once per participant; editing a walk updates the
-- ledger row and deleting the walk cascades the row away. Participant totals are
-- always derived by summing this table, never incremented in place.

CREATE TABLE IF NOT EXISTS event_progress_ledger (
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

-- idx_event_progress_ledger_participant_id: fast cached-total recomputation
CREATE INDEX IF NOT EXISTS idx_event_progress_ledger_participant_id ON event_progress_ledger(participant_id);
