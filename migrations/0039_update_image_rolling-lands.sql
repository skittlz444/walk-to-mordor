-- Migration number: 0039    2026-01-27T00:00:00.000Z

-- Update image_id for goal: Rolling Lands (Distance: 638)
UPDATE goals SET image_id = 'rolling-lands' WHERE distance = 638 * 1.60934;
