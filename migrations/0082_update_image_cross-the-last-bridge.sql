-- Migration number: 0082    2026-02-04T00:00:00.000Z

-- Update image_id for goal: Cross The Last Bridge (Distance: 3199)
UPDATE goals SET image_id = 'cross-the-last-bridge' WHERE distance = 3199 * 1.60934;
