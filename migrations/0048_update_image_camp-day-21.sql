-- Migration number: 0048    2026-01-27T00:00:00.000Z

-- Update image_id for goal: CAMP during DAY (Feb. 21). Downs on both sides of the river (Distance: 1155)
UPDATE goals SET image_id = 'camp-day-21' WHERE distance = 1155 * 1.60934;
