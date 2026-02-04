-- Migration number: 0073    2026-02-03T00:00:00.000Z

-- Update image_id for goal: Reach the remains of the roadway to Tharbad (Distance: 2569)
UPDATE goals SET image_id = 'remains-of-tharbad-roadway' WHERE distance = 2569 * 1.60934;
