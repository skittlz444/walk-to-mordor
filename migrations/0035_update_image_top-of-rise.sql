-- Migration number: 0035    2026-01-22T09:00:00.000Z

-- Update image_id for goal: Reached the top of a rise, heading Southeast (Distance: 528)
UPDATE goals SET image_id = 'top-of-rise' WHERE distance = 528 * 1.60934;
