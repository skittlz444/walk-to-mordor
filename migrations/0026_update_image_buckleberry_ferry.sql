-- Migration number: 0026    2026-01-22T13:50:00.000Z

-- Update image_id for goal: Cross on the Buckleberry Ferry (Distance: 70)
UPDATE goals SET image_id = 'buckleberry-ferry' WHERE distance = 70 * 1.60934;
