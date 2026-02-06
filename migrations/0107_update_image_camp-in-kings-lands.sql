-- Migration number: 0107    2026-02-06T00:00:00.000Z

-- Update image_id for goal: Camp in the King's Lands (Distance: 2230 miles)
UPDATE goals SET image_id = 'camp-in-kings-lands' WHERE distance = 2230 * 1.60934;
