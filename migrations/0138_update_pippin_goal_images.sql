-- Migration 0138_update_pippin_goal_images.sql
-- Assign generated Pippin image assets to their route-specific goals.

WITH pippin_goal_images(distance_miles, title, image_id) AS (
  VALUES
    (1310, 'Pippin and Merry are seized by Orcs', 'pippin-merry-captured-by-orcs'),
    (1348, 'Driven across the Wold', 'pippin-driven-across-the-wold'),
    (1374, 'The Orcs quarrel over their captives', 'pippin-orcs-quarrel-over-captives'),
    (1396, 'Pippin drops his elven brooch', 'pippin-elven-brooch'),
    (1436, 'Eomer''s riders overtake the Orcs', 'pippin-eomer-overtakes-orcs'),
    (1442, 'Merry and Pippin escape into Fangorn', 'pippin-escape-into-fangorn'),
    (1450, 'Meet Treebeard in Fangorn', 'pippin-treebeard-fangorn'),
    (1485, 'Attend the Entmoot in Fangorn', 'pippin-entmoot-fangorn'),
    (1515, 'Entmoot voices fill Derndingle', 'pippin-derndingle-entmoot'),
    (1535, 'The Last March of the Ents begins', 'pippin-last-march-of-the-ents'),
    (1555, 'See Isengard drowned by the Ents', 'pippin-isengard-flooded'),
    (1562, 'Pippin looks into the palantir', 'pippin-looks-into-palantir'),
    (1605, 'Shadowfax races through the night', 'pippin-shadowfax-night-ride'),
    (1643, 'Ride through the Westfold dark', 'pippin-westfold-night-ride'),
    (1673, 'Cross the streams of western Rohan', 'pippin-streams-of-western-rohan'),
    (1701, 'The White Mountains run beside the road', 'pippin-white-mountains-road'),
    (1729, 'Pass Edoras and the Snowbourn', 'pippin-edoras-snowbourn'),
    (1756, 'Ride east across the Folde', 'pippin-folde-east-road'),
    (1783, 'Leave the Folde behind', 'pippin-leaves-the-folde'),
    (1823, 'The Entwash lies north of the road', 'pippin-entwash-north-of-road'),
    (1866, 'Pass Halifirien and the Firien Wood', 'pippin-halifirien-firien-wood'),
    (1909, 'Pass the beacon of Calenhad', 'pippin-calenhad-beacon'),
    (1938, 'Pass the beacon hill of Min-Rimmon', 'pippin-min-rimmon-beacon'),
    (1964, 'Pass Erelas on the beacon-road', 'pippin-erelas-beacon-road'),
    (1989, 'Pass the beacon hill of Nardol', 'pippin-nardol-beacon'),
    (2014, 'Pass the dark peak of Eilenach', 'pippin-eilenach-dark-peak'),
    (2040, 'Ride north of the Druadan Forest', 'pippin-north-of-druadan-forest'),
    (2070, 'First sight of the Rammas Echor', 'pippin-rammas-echor-first-sight'),
    (2090, 'Reach Minas Tirith with Gandalf', 'pippin-minas-tirith-arrival'),
    (2132, 'March north through Ithilien', 'pippin-march-through-ithilien'),
    (2173, 'The Army of the West nears the Morannon', 'pippin-nears-the-morannon'),
    (2212, 'Stand before the Black Gate', 'pippin-black-gate-stand'),
    (2249, 'Recover in the Field of Cormallen', 'pippin-field-of-cormallen'),
    (2277, 'Return through Ithilien toward Minas Tirith', 'pippin-return-through-ithilien'),
    (2300, 'Cross the ruins of Osgiliath', 'pippin-osgiliath-ruins')
)
UPDATE goals
SET image_id = (
  SELECT pgi.image_id
  FROM pippin_goal_images pgi
  WHERE pgi.title = goals.title
    AND ABS(goals.distance - pgi.distance_miles * 1.60934) < 0.001
)
WHERE EXISTS (
  SELECT 1
  FROM pippin_goal_images pgi
  WHERE pgi.title = goals.title
    AND ABS(goals.distance - pgi.distance_miles * 1.60934) < 0.001
);
