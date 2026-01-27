-- Migration number: 0046    2026-01-27T00:00:00.000Z

-- Update image_id for goal: Camp on small eyot near western shore. Sam and Frodo watch. Gollum appears during Frodo’s watch. Aragorn wakes. Watches until morning (Distance: 1083)
UPDATE goals SET image_id = 'camp-small-eyot' WHERE distance = 1083 * 1.60934;
