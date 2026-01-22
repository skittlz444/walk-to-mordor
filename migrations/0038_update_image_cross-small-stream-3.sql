-- Migration number: 0038    2026-01-22T09:03:00.000Z

-- Update image_id for goal: Cross a small stream (Distance: 627)
UPDATE goals SET image_id = 'cross-small-stream-3' WHERE distance = 627 * 1.60934;
