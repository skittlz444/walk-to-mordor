-- Migration 0162_create_campaign_runs.sql
-- One cycle of a community campaign. Runs are immutable per cycle: retriggering
-- adds the next run_number instead of resetting a row, which keeps past-run
-- history and per-run badge keys intact. The final snapshot columns are written
-- once, at the terminal transition, so history stays queryable even if
-- participants or ledger rows change afterwards.
--
-- At most one run per campaign may be upcoming or active; the partial unique
-- index below enforces that invariant in the database.

CREATE TABLE IF NOT EXISTS campaign_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    campaign_id INTEGER NOT NULL,
    run_number INTEGER NOT NULL CHECK (run_number > 0),
    target_distance REAL NOT NULL CHECK (target_distance > 0),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'expired')),
    completed_at DATETIME,
    announced_at DATETIME,
    participant_count INTEGER,
    contributor_count INTEGER,
    total_distance REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaign_definitions(id),
    UNIQUE(campaign_id, run_number),
    CHECK (end_date >= start_date)
);

-- idx_campaign_runs_campaign_status: active-run resolution and history listing
CREATE INDEX IF NOT EXISTS idx_campaign_runs_campaign_status ON campaign_runs(campaign_id, status);
-- idx_campaign_runs_one_current: at most one upcoming/active run per campaign
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_runs_one_current
    ON campaign_runs(campaign_id)
    WHERE status IN ('upcoming', 'active');
