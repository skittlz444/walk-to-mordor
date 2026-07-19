-- Migration 0140_create_goal_content.sql
-- Create goal_content table for authored rich content attached directly to goals.
-- Content types: campfire story, poetry, and appendix. One ordered stream per goal.

CREATE TABLE IF NOT EXISTS goal_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    goal_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('story', 'poetry', 'appendix')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    author_attribution TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0 AND sort_order <= 999),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- Content renders as a single ordered stream per goal regardless of type.
    UNIQUE(goal_id, sort_order),
    FOREIGN KEY (goal_id) REFERENCES goals (id) ON DELETE CASCADE
);

-- idx_goal_content_goal_id: fast ordered reads of a goal's content stream
CREATE INDEX IF NOT EXISTS idx_goal_content_goal_id ON goal_content(goal_id, sort_order);
