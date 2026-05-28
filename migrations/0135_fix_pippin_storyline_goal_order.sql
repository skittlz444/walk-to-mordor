-- Migration 0135_fix_pippin_storyline_goal_order.sql
-- Repair Pippin's reused goals so return-story milestones do not appear on the outbound branch.

DELETE FROM storyline_goals
WHERE storyline_id = (SELECT id FROM storylines WHERE slug = 'pippin');

WITH frodo_goals(goal_id, distance, title) AS (
  SELECT g.id, sg.distance, g.title
  FROM storyline_goals sg
  JOIN storylines s ON s.id = sg.storyline_id
  JOIN goals g ON g.id = sg.goal_id
  WHERE s.slug = 'frodo-sam'
), branch_goals(title, distance_miles, sort_order) AS (
  VALUES
    ('Reach the Desolation of the Morannon', 2212, 2212)
), return_goals(title, distance_miles, sort_order) AS (
  VALUES
    ('Reach the Gates of Minas Tirith', 2313, 2313)
), pippin_goal_map(goal_id, distance, sort_order) AS (
  SELECT fg.goal_id, fg.distance, CAST(ROUND(fg.distance * 0.621371) AS INTEGER)
  FROM frodo_goals fg
  WHERE fg.distance <= 1309 * 1.60934

  UNION ALL

  SELECT fg.goal_id, bg.distance_miles * 1.60934, bg.sort_order
  FROM branch_goals bg
  JOIN frodo_goals fg ON fg.title = bg.title

  UNION ALL

  SELECT fg.goal_id, rg.distance_miles * 1.60934, rg.sort_order
  FROM return_goals rg
  JOIN frodo_goals fg ON fg.title = rg.title

  UNION ALL

  SELECT
    fg.goal_id,
    fg.distance + 414 * 1.60934,
    CAST(ROUND(fg.distance * 0.621371 + 414) AS INTEGER)
  FROM frodo_goals fg
  WHERE fg.distance > 1899 * 1.60934
    AND fg.distance <= 3991 * 1.60934
)
INSERT OR IGNORE INTO storyline_goals (storyline_id, goal_id, distance, sort_order)
SELECT s.id, pg.goal_id, pg.distance, pg.sort_order
FROM pippin_goal_map pg
JOIN storylines s ON s.slug = 'pippin';