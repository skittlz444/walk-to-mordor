-- Migration 0154_create_daily_rolls.sql
-- One roll per user per UTC day. The row records whether an encounter was
-- offered, which definition was offered, the preview target shown in the modal,
-- and the user's accept/decline decision. UNIQUE(user_id, roll_date) makes the
-- daily roll endpoint idempotent and the status column keeps a declined offer
-- from reappearing after a page refresh.

CREATE TABLE IF NOT EXISTS daily_rolls (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id INTEGER NOT NULL,
    roll_date DATE NOT NULL,
    encounter_definition_id INTEGER,
    preview_target_distance REAL,
    status TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'declined')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (encounter_definition_id) REFERENCES personal_encounter_definitions(id),
    UNIQUE(user_id, roll_date)
);

-- idx_daily_rolls_roll_date: cooldown windows and date-scoped maintenance queries
CREATE INDEX IF NOT EXISTS idx_daily_rolls_roll_date ON daily_rolls(roll_date);
