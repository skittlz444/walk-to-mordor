-- Migration number: 0059    2026-01-27T22:45:45.000Z

-- Update image_id for goal: Reach the Desolation of the Morannon (Distance: 1463)
UPDATE goals SET image_id = 'desolation-of-morannon' WHERE distance = 1463 * 1.60934;
