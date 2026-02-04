-- Migration number: 0083    2026-02-04T00:00:00.000Z

-- Update image_id for goal: Land rises slowly toward Hills (Distance: 3294)
UPDATE goals SET image_id = 'land-rises-slowly' WHERE distance = 3294 * 1.60934;
