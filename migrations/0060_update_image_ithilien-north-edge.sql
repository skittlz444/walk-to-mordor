-- Migration number: 0060    2026-01-27T22:45:45.000Z

-- Update image_id for goal: Reach northern edge of Ithilien (Distance: 1499)
UPDATE goals SET image_id = 'ithilien-north-edge' WHERE distance = 1499 * 1.60934;
