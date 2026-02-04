-- Migration number: 0088    2026-02-04T00:00:00.000Z

-- Update image_id for goal: Reach the point where the road splits (Distance: 3561)
UPDATE goals SET image_id = 'point-where-the-road-splits' WHERE distance = 3561 * 1.60934;
