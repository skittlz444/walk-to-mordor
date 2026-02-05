-- Migration number: 0101    2026-02-05T00:00:00.000Z

-- Update image_id for goal: Camp within sight of the fortress of Durthang (Distance: 1675 miles)
UPDATE goals SET image_id = 'fortress-of-durthang' WHERE distance = 1675 * 1.60934;
