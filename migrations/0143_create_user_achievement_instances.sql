-- Migration 0143_create_user_achievement_instances.sql
-- Append-only earned-achievement records. One row per award event. Rows are
-- never updated or deleted -- idempotency and repeat-count aggregation are
-- both derived from this table, never from a mutable counter.

CREATE TABLE IF NOT EXISTS user_achievement_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id INTEGER NOT NULL,
    achievement_id INTEGER NOT NULL,
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    context_metadata TEXT,
    idempotency_key TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievement_definitions(id),
    UNIQUE(user_id, achievement_id, idempotency_key)
);

-- idx_user_achievement_instances_user_id: user-scoped achievement lookups (getUserAchievements)
CREATE INDEX IF NOT EXISTS idx_user_achievement_instances_user_id ON user_achievement_instances(user_id);
-- idx_user_achievement_instances_user_achievement: is_repeatable enforcement and summary aggregation
CREATE INDEX IF NOT EXISTS idx_user_achievement_instances_user_achievement ON user_achievement_instances(user_id, achievement_id);
