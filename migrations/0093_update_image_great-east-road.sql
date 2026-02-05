-- Migration number: 0093    2026-02-05T00:00:00.000Z

-- Update image_id for goal: Reach the Great East Road (Distance: 3724 miles)
UPDATE goals SET image_id = 'great-east-road' WHERE distance = 3724 * 1.60934;
