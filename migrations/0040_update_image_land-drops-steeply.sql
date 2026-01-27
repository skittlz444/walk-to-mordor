-- Migration number: 0040    2026-01-27T00:00:00.000Z

-- Update image_id for goal: Land drops more steeply, go Southeast into a valley (Distance: 668)
UPDATE goals SET image_id = 'land-drops-steeply' WHERE distance = 668 * 1.60934;
