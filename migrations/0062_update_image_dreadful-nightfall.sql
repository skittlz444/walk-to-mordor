-- Migration number: 0062    2026-01-27T22:45:45.000Z

-- Update image_id for goal: The Dreadful Nightfall (Distance: 1755)
UPDATE goals SET image_id = 'dreadful-nightfall' WHERE distance = 1755 * 1.60934;
