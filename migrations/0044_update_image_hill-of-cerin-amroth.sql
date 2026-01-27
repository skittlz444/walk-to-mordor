-- Migration number: 0044    2026-01-27T00:00:00.000Z

-- Update image_id for goal: Reach the hill of Cerin Amroth (Distance: 906)
UPDATE goals SET image_id = 'hill-of-cerin-amroth' WHERE distance = 906 * 1.60934;
