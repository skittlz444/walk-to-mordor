-- Migration 0137_add_pippin_intermediary_goals.sql
-- Add regular Pippin-specific goals to keep non-overlapping path gaps under roughly 70 km.

WITH pippin_intermediary_goals(distance_miles, title, description) AS (
  VALUES
    (1348, 'Driven across the Wold', 'The Orc-band drove Merry and Pippin westward across the open Wold of Rohan, forcing the captives onward with little rest and less mercy. Around them the land lay wide and exposed, giving the hobbits few places to hide and few chances to slow their enemies. Pippin''s road had become a forced march, measured not by choice but by the harsh pace of Saruman''s Uruk-hai.'),
    (1374, 'The Orcs quarrel over their captives', 'As the march wore on, the captors'' uneasy alliance began to fray. Saruman''s Uruk-hai, Mordor-orcs, and northern Orcs argued over orders, speed, and the prisoners, revealing that the servants of evil were bound more by fear than loyalty. Merry and Pippin listened closely, learning that division among their enemies might become their only chance.'),
    (1396, 'Pippin drops his elven brooch', 'Pippin found a moment of desperate clarity while the Orcs hurried across Rohan. With great effort he freed his hands just enough to cut his bonds and let his elven brooch fall where Aragorn might find it. The small token became a deliberate sign in the grass, proof that the hobbits were alive and still resisting.'),
    (1436, 'Eomer''s riders overtake the Orcs', 'Near the eaves of Fangorn, Eomer''s riders closed around the Orc-band and brought its brutal march to an end. The night filled with shouts, hooves, and fire as the Rohirrim surrounded enemies they had hunted across the plains. For Merry and Pippin, the battle was both danger and deliverance, chaos opening a narrow path toward escape.'),
    (1442, 'Merry and Pippin escape into Fangorn', 'In the confusion of the riders'' attack, Merry and Pippin slipped away from the wreck of the Orc-band. Grishnakh''s final attempt to drag them off ended in darkness and violence, leaving the hobbits alone at the forest''s edge. They fled beneath the trees of Fangorn, passing from one peril into an older and stranger world.'),
    (1515, 'Entmoot voices fill Derndingle', 'In Derndingle, the Entmoot continued in voices slow, deep, and resonant as old roots under stone. Merry and Pippin waited while the Ents weighed Saruman''s crimes against the long patience of the forest. What seemed endless to hobbits was, for the Ents, the necessary turning of ancient thought toward action.'),
    (1535, 'The Last March of the Ents begins', 'When the Entmoot ended, the decision came not as a quick command but as a great release of stored wrath. Treebeard led the Ents out of Fangorn, and the forest itself seemed to move toward Isengard. Merry and Pippin rode with them, carried into a war that no council of Men had foreseen.'),
    (1605, 'Shadowfax races through the night', 'After the palantir, Gandalf took Pippin before him on Shadowfax and rode into the dark with terrible urgency. The others fell behind while the white horse devoured the road eastward, swift beyond the pace of ordinary steeds. Pippin''s fear of the stone gave way to a new dread: Minas Tirith and the war were rushing toward him.'),
    (1643, 'Ride through the Westfold dark', 'Gandalf and Pippin passed through the dark lands of the Westfold with the mountains looming to their right. Rohan slept or stirred uneasily beneath the threat of war, while Shadowfax kept his relentless course. The road gave Pippin little comfort, only wind, speed, and the sense that every mile now mattered.'),
    (1673, 'Cross the streams of western Rohan', 'The night-ride carried Gandalf and Pippin over the streams and folds of western Rohan. Water flashed briefly under Shadowfax before vanishing behind them, each crossing another sign of the distance opening between Pippin and his friends. The land itself seemed to blur, but the wizard''s purpose did not falter.'),
    (1701, 'The White Mountains run beside the road', 'As the road bent eastward, the White Mountains ran like a dark wall beside Gandalf and Pippin. Their long line guided the way toward Gondor, beautiful and severe beneath the night. For Pippin, the mountains marked the edge of a world he barely knew and the approach of a city already bracing for siege.'),
    (1729, 'Pass Edoras and the Snowbourn', 'Shadowfax bore Gandalf and Pippin past Edoras and the waters of the Snowbourn without pause. The golden hall of Meduseld lay behind them in the dark, no place now for counsel or rest. The errand to Minas Tirith had become too urgent for any halt in the king''s land.'),
    (1756, 'Ride east across the Folde', 'Across the Folde, the heartland of Rohan stretched under the shadow of the White Mountains. Gandalf and Pippin followed the road through country that would soon send its own riders to war. The fields and homesteads passed quickly, quiet witnesses to a storm gathering far beyond them.'),
    (1783, 'Leave the Folde behind', 'The ride pressed beyond the green centre of the Mark, leaving the Folde behind on the long road east. Pippin had little chance to understand the lands he crossed, yet each change in the country drew him nearer to Gondor. Behind him lay Isengard and Fangorn; ahead lay the white city and the judgement of Denethor.'),
    (1823, 'The Entwash lies north of the road', 'The road carried Gandalf and Pippin through Rohan while the Entwash lay away to the north, running from the very forest where the hobbits had found unexpected allies. Its unseen course linked this hard ride to the larger turning of the war. Far behind them, the Ents had broken Saruman; far ahead, Gondor still waited for aid.'),
    (1866, 'Pass Halifirien and the Firien Wood', 'Near Halifirien and the dark Firien Wood, Gandalf and Pippin reached the borderlands between Rohan and Gondor. The beacon-hill stood over a place of old oaths and guarded passage, where the road left one realm and entered the keeping of another. For Pippin, the crossing deepened the feeling that he was being carried into the affairs of kings.'),
    (1909, 'Pass the beacon of Calenhad', 'The beacon of Calenhad rose along the high road through Anorien, one of Gondor''s chain of warning fires. No flame was needed to tell Gandalf what was coming; the danger already pressed on every league of the ride. Pippin passed beneath the silent signal hill, a small traveller beneath the machinery of a realm preparing for war.'),
    (1938, 'Pass the beacon hill of Min-Rimmon', 'Min-Rimmon stood among the beacon hills as the road drew Gandalf and Pippin further into Gondor. The hill marked another stage in the warning chain that could summon help from the west. Its silence made the haste of Shadowfax feel sharper, as though the land itself were holding its breath.'),
    (1964, 'Pass Erelas on the beacon-road', 'At Erelas, the beacon-road continued through the uplands of Anorien. Gandalf and Pippin had no time to climb or look back, but the hill''s presence spoke of watchfulness and old preparation. Gondor had built its warnings into the land, and now the warning had nearly become war.'),
    (1989, 'Pass the beacon hill of Nardol', 'Nardol rose ahead on the road to Minas Tirith, another cold summit in the chain of beacons. Gandalf drove Shadowfax onward beneath it, unwilling to spend even a moment more than the road demanded. Pippin saw only fragments of the country, but each hill seemed to carry the same message: the city must be reached before the storm broke.'),
    (2014, 'Pass the dark peak of Eilenach', 'The dark peak of Eilenach stood above the road near the woods of Anorien, stern and unmistakable among the beacon hills. Gandalf and Pippin passed it at speed, with the eastern sky drawing them on toward Minas Tirith. The hill''s shadow gave the road a harsher mood, as if Gondor''s peril were taking shape in the land itself.'),
    (2040, 'Ride north of the Druadan Forest', 'The road ran north of the Druadan Forest, where ancient trees and hidden paths lay beyond Pippin''s sight. Gandalf kept to the great road, trusting speed more than secrecy as the white horse flew toward the city. The forest marked the last wild margin before the approach to Minas Tirith narrowed into urgency.'),
    (2070, 'First sight of the Rammas Echor', 'At last the outworks of the Pelennor came into view, with the Rammas Echor guarding the fields before Minas Tirith. The walls and lands of Gondor were no longer distant names from council and song, but real stone and earth before Pippin''s eyes. Beyond them rose the white city, where his small service would soon be demanded.'),
    (2132, 'March north through Ithilien', 'After the battle of the Pelennor, Pippin marched with the Army of the West into Ithilien. The host did not go to conquer Mordor by strength, but to draw Sauron''s gaze away from the true peril moving within his own land. Through fair country scarred by war, Pippin followed captains who had chosen hope over safety.'),
    (2173, 'The Army of the West nears the Morannon', 'As the host drew nearer to the Black Gate, the purpose of the march became more terrible and more plain. Pippin walked among Men of Gondor and Rohan who knew they were hopelessly outnumbered, yet still held their course. Every step toward the Morannon was a wager that Frodo and Sam were still alive somewhere beyond sight.'),
    (2249, 'Recover in the Field of Cormallen', 'After the fall of Sauron, Pippin was found beneath the troll that had struck him down before the Black Gate. In the Field of Cormallen he recovered among songs, banners, and the astonished joy of victory. The field became a place of healing, where the small courage of hobbits was honoured by the great captains of the West.'),
    (2277, 'Return through Ithilien toward Minas Tirith', 'The road back from the shadow passed through Ithilien, no longer merely a land watched by enemies and haunted by war. Pippin travelled with the victorious company toward Minas Tirith, bearing wounds and memories from the Morannon. The green land between Mordor and Gondor seemed changed by the fall of the Dark Tower.'),
    (2300, 'Cross the ruins of Osgiliath', 'On the return to Minas Tirith, Pippin passed through the ruins of Osgiliath, the broken city that had long stood between Gondor and the Enemy. Its shattered stones marked the cost of the war more plainly than any song of triumph could. Beyond the ruins lay the white city, coronation, and the beginning of a different age.')
)
INSERT INTO goals (distance, title, description, special, image_id)
SELECT distance_miles * 1.60934, title, description, NULL, NULL
FROM pippin_intermediary_goals pig
WHERE NOT EXISTS (
  SELECT 1
  FROM goals g
  WHERE g.title = pig.title
);

WITH pippin_intermediary_goal_order(title, distance_miles, sort_order) AS (
  VALUES
    ('Driven across the Wold', 1348, 1348),
    ('The Orcs quarrel over their captives', 1374, 1374),
    ('Pippin drops his elven brooch', 1396, 1396),
    ('Eomer''s riders overtake the Orcs', 1436, 1436),
    ('Merry and Pippin escape into Fangorn', 1442, 1442),
    ('Entmoot voices fill Derndingle', 1515, 1515),
    ('The Last March of the Ents begins', 1535, 1535),
    ('Shadowfax races through the night', 1605, 1605),
    ('Ride through the Westfold dark', 1643, 1643),
    ('Cross the streams of western Rohan', 1673, 1673),
    ('The White Mountains run beside the road', 1701, 1701),
    ('Pass Edoras and the Snowbourn', 1729, 1729),
    ('Ride east across the Folde', 1756, 1756),
    ('Leave the Folde behind', 1783, 1783),
    ('The Entwash lies north of the road', 1823, 1823),
    ('Pass Halifirien and the Firien Wood', 1866, 1866),
    ('Pass the beacon of Calenhad', 1909, 1909),
    ('Pass the beacon hill of Min-Rimmon', 1938, 1938),
    ('Pass Erelas on the beacon-road', 1964, 1964),
    ('Pass the beacon hill of Nardol', 1989, 1989),
    ('Pass the dark peak of Eilenach', 2014, 2014),
    ('Ride north of the Druadan Forest', 2040, 2040),
    ('First sight of the Rammas Echor', 2070, 2070),
    ('March north through Ithilien', 2132, 2132),
    ('The Army of the West nears the Morannon', 2173, 2173),
    ('Recover in the Field of Cormallen', 2249, 2249),
    ('Return through Ithilien toward Minas Tirith', 2277, 2277),
    ('Cross the ruins of Osgiliath', 2300, 2300)
), pippin_goal_ids AS (
  SELECT MIN(g.id) AS goal_id, g.title
  FROM goals g
  JOIN pippin_intermediary_goal_order pigo ON pigo.title = g.title
  GROUP BY g.title
)
INSERT OR IGNORE INTO storyline_goals (storyline_id, goal_id, distance, sort_order)
SELECT s.id, pgi.goal_id, pigo.distance_miles * 1.60934, pigo.sort_order
FROM pippin_intermediary_goal_order pigo
JOIN pippin_goal_ids pgi ON pgi.title = pigo.title
JOIN storylines s ON s.slug = 'pippin';