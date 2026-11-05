-- Migration 0153_create_encounter_occurrences.sql
-- One concrete personal challenge accepted by a user. The occurrence stores the
-- personalized target captured at roll time plus the coverage window and grace
-- deadline used for progress crediting and scheduled settlement.
--
-- daily_rolls is created by 0154; SQLite permits this forward reference because
-- foreign keys are resolved when rows are written, not when the table is created.

CREATE TABLE IF NOT EXISTS encounter_occurrences (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    definition_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    daily_roll_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
    personalized_target REAL NOT NULL CHECK (personalized_target >= 0),
    started_at DATE NOT NULL,
    coverage_end_date DATE NOT NULL,
    grace_deadline DATE NOT NULL,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (definition_id) REFERENCES personal_encounter_definitions(id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (daily_roll_id) REFERENCES daily_rolls(id) ON DELETE CASCADE,
    UNIQUE(daily_roll_id)
);

-- idx_encounter_occurrences_user_status: user-scoped active/complete lookups
CREATE INDEX IF NOT EXISTS idx_encounter_occurrences_user_status ON encounter_occurrences(user_id, status);
-- idx_encounter_occurrences_status_grace: scheduled settlement scans
CREATE INDEX IF NOT EXISTS idx_encounter_occurrences_status_grace ON encounter_occurrences(status, grace_deadline);
