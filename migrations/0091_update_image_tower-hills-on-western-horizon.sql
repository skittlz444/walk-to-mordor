-- Migration number: 0091    2026-02-04T00:00:00.000Z

-- Update image_id for goal: Can see the Tower Hills on the western horizon (Distance: 3684)
UPDATE goals SET image_id = 'tower-hills-on-western-horizon' WHERE distance = 3684 * 1.60934;
