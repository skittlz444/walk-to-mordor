-- Track "One More Mile" push notifications sent per user per goal
-- Prevents re-sending the same nudge for the same milestone
CREATE TABLE IF NOT EXISTS one_more_mile_sent (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, goal_id)
);

