-- Migration number: 0049    2026-01-27T00:00:00.000Z

-- Update image_id for goal: CAMP during DAY (Feb. 22) (Distance: 1205)
UPDATE goals SET image_id = 'camp-day-22' WHERE distance = 1205 * 1.60934;
