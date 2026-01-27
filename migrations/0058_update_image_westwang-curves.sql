-- Migration number: 0058    2026-01-27T22:45:45.000Z

-- Update image_id for goal: The Wetwang curves south (Distance: 1341)
UPDATE goals SET image_id = 'westwang-curves' WHERE distance = 1341 * 1.60934;
