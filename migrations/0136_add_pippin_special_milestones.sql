-- Migration 0136_add_pippin_special_milestones.sql
-- Add Pippin-specific milestones on route sections not shared with Frodo and Sam.

WITH pippin_branch_goals(distance_miles, title, description, special) AS (
  VALUES
    (1310, 'Pippin and Merry are seized by Orcs', 'At Parth Galen the Fellowship breaks apart in violence and confusion, and Pippin''s road turns suddenly away from Frodo''s. He and Merry are seized by Orcs and driven west across Rohan as captives, no longer choosing the path beneath their feet. The small signs they leave behind become threads for the hunters who follow, while their own courage narrows to endurance, secrecy, and the hope that a chance for escape will come.', 'Captured by Orcs'),
    (1450, 'Meet Treebeard in Fangorn', 'After the slaughter of the Orc-band, Pippin and Merry flee into Fangorn Forest and meet Treebeard, oldest of the Ents. What begins as desperate concealment becomes an unexpected alliance with a living memory of the elder world. In Treebeard''s deep speech and patient wrath, the hobbits discover that even the forests have been listening to the war.', NULL),
    (1485, 'Attend the Entmoot in Fangorn', 'Deep among the trees of Fangorn, the Ents gather for the Entmoot, slow to speak but terrible once roused. Pippin and Merry wait while ancient voices weigh Saruman''s ruin of the woods and the danger spreading from Isengard. The long deliberation becomes a turning point: the forest itself chooses to march.', 'The Entmoot'),
    (1555, 'See Isengard drowned by the Ents', 'The Ents and Huorns break upon Isengard like a green flood, tearing down its works and drowning Saruman''s furnaces. Pippin sees the stronghold of the White Hand humbled by roots, stone, and water, a victory unlike any battle of Men. The wizard''s fortress remains standing only as a tower in a wrecked and flooded ring.', 'Isengard Flooded'),
    (1562, 'Pippin looks into the palantir', 'In the uneasy night after Isengard, Pippin''s curiosity draws him to the palantir of Orthanc. Near Dol Baran, the stone opens a terrifying line to Sauron, and his brief struggle beneath that gaze changes the road at once. Gandalf understands the danger and the opportunity, and Pippin is swept away toward Minas Tirith before the Enemy can read the truth.', NULL),
    (2090, 'Reach Minas Tirith with Gandalf', 'Riding through the night on Shadowfax, Gandalf brings Pippin to Minas Tirith as war gathers around Gondor''s white city. The hobbit is no longer a passenger in the Fellowship''s larger errand; he stands before Denethor and offers service in payment for Boromir''s sacrifice. The city becomes his post, his trial, and the place where small courage must answer great despair.', 'Minas Tirith'),
    (2212, 'Stand before the Black Gate', 'Pippin marches with the Army of the West to the Morannon, not to conquer Mordor but to hold Sauron''s eye away from Frodo. Before the Black Gate, the last defiance of the free peoples becomes a deliberate act of hope against impossible numbers. In the battle that follows, Pippin is struck down beneath a troll, yet his stand helps buy the Ring-bearer the time on which all depends.', 'The Black Gate')
)
INSERT INTO goals (distance, title, description, special, image_id)
SELECT distance_miles * 1.60934, title, description, special, NULL
FROM pippin_branch_goals pbg
WHERE NOT EXISTS (
  SELECT 1
  FROM goals g
  WHERE g.title = pbg.title
);

UPDATE goals
SET special = NULL
WHERE title IN ('Meet Treebeard in Fangorn', 'Pippin looks into the palantir');

DELETE FROM storyline_goals
WHERE storyline_id = (SELECT id FROM storylines WHERE slug = 'pippin')
  AND goal_id IN (
    SELECT id
    FROM goals
    WHERE title = 'Run to save Faramir from the pyre'
  );

DELETE FROM goals
WHERE title = 'Run to save Faramir from the pyre';

DELETE FROM storyline_goals
WHERE storyline_id = (SELECT id FROM storylines WHERE slug = 'pippin')
  AND goal_id IN (
    SELECT id
    FROM goals
    WHERE title = 'Reach the Desolation of the Morannon'
  );

WITH pippin_branch_goal_order(title, distance_miles, sort_order) AS (
  VALUES
    ('Pippin and Merry are seized by Orcs', 1310, 1310),
    ('Meet Treebeard in Fangorn', 1450, 1450),
    ('Attend the Entmoot in Fangorn', 1485, 1485),
    ('See Isengard drowned by the Ents', 1555, 1555),
    ('Pippin looks into the palantir', 1562, 1562),
    ('Reach Minas Tirith with Gandalf', 2090, 2090),
    ('Stand before the Black Gate', 2212, 2212)
), pippin_goal_ids AS (
  SELECT MIN(g.id) AS goal_id, g.title
  FROM goals g
  JOIN pippin_branch_goal_order pbgo ON pbgo.title = g.title
  GROUP BY g.title
)
INSERT OR IGNORE INTO storyline_goals (storyline_id, goal_id, distance, sort_order)
SELECT s.id, pgi.goal_id, pbgo.distance_miles * 1.60934, pbgo.sort_order
FROM pippin_branch_goal_order pbgo
JOIN pippin_goal_ids pgi ON pgi.title = pbgo.title
JOIN storylines s ON s.slug = 'pippin';