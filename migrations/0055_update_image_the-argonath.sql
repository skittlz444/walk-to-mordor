-- Migration number: 0055    2026-01-27T22:45:45.000Z

-- Update image_id for goal: The Argonath. Boats are swept through the narrow gap between (Distance: 1288)
UPDATE goals SET image_id = 'the-argonath' WHERE distance = 1288 * 1.60934;
