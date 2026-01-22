-- Migration number: 0031    2026-01-22T00:00:10.000Z

-- Update image_id for goal: Following a wide shallow curving valley (Distance: 298)
UPDATE goals SET image_id = 'wide-curving-valley' WHERE distance = 298 * 1.60934;
