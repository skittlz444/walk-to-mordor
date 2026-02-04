-- Migration number: 0080    2026-02-04T00:00:00.000Z

-- Update image_id for goal: Bruinen turns more to the south (Distance: 3156)
UPDATE goals SET image_id = 'bruinen-turns-south' WHERE distance = 3156 * 1.60934;
