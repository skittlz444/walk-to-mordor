-- Migration 0139_create_milestone_journals.sql
-- Create milestone_journals table for personal goal reflections.
-- One plain-text journal entry per user per canonical goal, shared across all storylines.

CREATE TABLE IF NOT EXISTS milestone_journals (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id INTEGER NOT NULL,
    goal_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, goal_id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (goal_id) REFERENCES goals (id) ON DELETE CASCADE
);

-- Indexes for milestone_journals
-- idx_milestone_journals_goal_id: fast goal-scoped reads for friend entries
-- idx_milestone_journals_user_id_goal_id: covering index for the dominant lookup pattern (own entry + friend entries per goal)
CREATE INDEX IF NOT EXISTS idx_milestone_journals_goal_id ON milestone_journals(goal_id);
CREATE INDEX IF NOT EXISTS idx_milestone_journals_user_id_goal_id ON milestone_journals(user_id, goal_id);
