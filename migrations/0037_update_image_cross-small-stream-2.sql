-- Migration number: 0037    2026-01-22T09:02:00.000Z

-- Update image_id for goal: Cross a small stream (Distance: 560)
UPDATE goals SET image_id = 'cross-small-stream-2' WHERE distance = 560 * 1.60934;
