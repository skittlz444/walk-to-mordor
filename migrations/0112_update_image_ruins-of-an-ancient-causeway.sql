-- Migration number: 0112    2026-02-06T00:00:00.000Z

-- Update image_id for goal: Pass the ruins of an ancient causeway (Distance: 2696 miles)
UPDATE goals SET image_id = 'ruins-of-an-ancient-causeway' WHERE distance = 2696 * 1.60934;
