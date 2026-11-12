-- Migration 0163_create_campaign_participants.sql
-- Per-run opt-in. A participant row is scoped to one run, so joining a new run
-- is always explicit and an admin-cancelled participant of a previous run can
-- join the next one. progress_distance is a cache derived from
-- campaign_progress_ledger, never the source of truth.

CREATE TABLE IF NOT EXISTS campaign_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    campaign_id INTEGER NOT NULL,
    run_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    progress_distance REAL NOT NULL DEFAULT 0 CHECK (progress_distance >= 0),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
    removed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaign_definitions(id),
    FOREIGN KEY (run_id) REFERENCES campaign_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, campaign_id, run_id)
);

-- idx_campaign_participants_run_id: community progress aggregation by run
CREATE INDEX IF NOT EXISTS idx_campaign_participants_run_id ON campaign_participants(run_id);
