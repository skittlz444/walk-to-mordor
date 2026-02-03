-- Migration number: 0071    2026-02-03T00:00:00.000Z

-- Update image_id for goal: Camp by a small stream (Distance: 2509)
UPDATE goals SET image_id = 'camp-small-stream' WHERE distance = 2509 * 1.60934;
