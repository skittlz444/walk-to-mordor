-- Migration 0134_add_pippin_storyline.sql
-- Add Peregrin Took's storyline and map it onto existing goal rows.

INSERT OR IGNORE INTO storylines (slug, title, description, path_key, sort_order, is_active, admin_only)
VALUES (
  'pippin',
  'Pippin',
  'Follow Peregrin Took from Bag End through Fangorn, Isengard, Minas Tirith, the Black Gate, and the long road home.',
  'pippin',
  10,
  1,
  0
);

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
    ('Treegarth of Orthanc, Isengard is no more', 1555, 1555),
    ('Reach the Gates of Minas Tirith', 2090, 2090),
    ('Reach the Desolation of the Morannon', 2212, 2212)
), pippin_goal_map(goal_id, distance, sort_order) AS (
  SELECT fg.goal_id, fg.distance, CAST(ROUND(fg.distance * 0.621371) AS INTEGER)
  FROM frodo_goals fg
  WHERE fg.distance <= 1309 * 1.60934

  UNION ALL

  SELECT fg.goal_id, bg.distance_miles * 1.60934, bg.sort_order
  FROM branch_goals bg
  JOIN frodo_goals fg ON fg.title = bg.title

  UNION ALL

  SELECT
    fg.goal_id,
    fg.distance + 414 * 1.60934,
    CAST(ROUND(fg.distance * 0.621371 + 414) AS INTEGER)
  FROM frodo_goals fg
  WHERE fg.distance > 1899 * 1.60934
    AND fg.distance <= 3991 * 1.60934
    AND fg.title <> 'Treegarth of Orthanc, Isengard is no more'
)
INSERT OR IGNORE INTO storyline_goals (storyline_id, goal_id, distance, sort_order)
SELECT s.id, pg.goal_id, pg.distance, pg.sort_order
FROM pippin_goal_map pg
JOIN storylines s ON s.slug = 'pippin';
