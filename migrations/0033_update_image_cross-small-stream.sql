-- Migration number: 0033    2026-01-22T00:00:00.000Z

-- Update image_id for goal: Cross a small stream (Distance: 484)
UPDATE goals SET image_id = 'cross-small-stream' WHERE distance = 484 * 1.60934;
