-- Migration 0117_add_goal_visibility_preference.sql
-- Add user preference for goal visibility style
-- Default 1 = unlocked (new global default once shipped)
-- Value 0 = locked (opt-in surprise mode)

ALTER TABLE users ADD COLUMN show_future_goals_unlocked INTEGER NOT NULL DEFAULT 1;
