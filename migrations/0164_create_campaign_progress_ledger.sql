-- Migration 0164_create_campaign_progress_ledger.sql
-- Idempotent community campaign credit ledger. Each canonical walk row
-- contributes at most once per participant; editing a walk updates the row and
-- deleting the walk removes it. Rows are never deleted by retriggering, so past
-- runs keep their leaderboard and final snapshot inputs.

CREATE TABLE IF NOT EXISTS campaign_progress_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    participant_id INTEGER NOT NULL,
    run_id INTEGER NOT NULL,
    source_progress_id INTEGER NOT NULL,
    distance REAL NOT NULL CHECK (distance >= 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant_id) REFERENCES campaign_participants(id) ON DELETE CASCADE,
    FOREIGN KEY (run_id) REFERENCES campaign_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (source_progress_id) REFERENCES progress(id) ON DELETE CASCADE,
    UNIQUE(participant_id, source_progress_id)
);

-- idx_campaign_progress_ledger_participant_id: cached-total recomputation
CREATE INDEX IF NOT EXISTS idx_campaign_progress_ledger_participant_id ON campaign_progress_ledger(participant_id);
