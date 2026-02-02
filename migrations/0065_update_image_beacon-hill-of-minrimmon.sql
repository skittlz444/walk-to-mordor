-- Migration number: 0065    2026-02-02T12:05:00.000Z

-- Update image_id for goal: The beacon hill of Minrimmon is on the left (Distance: 2051)
UPDATE goals SET image_id = 'beacon-hill-of-minrimmon' WHERE distance = 2051 * 1.60934;
