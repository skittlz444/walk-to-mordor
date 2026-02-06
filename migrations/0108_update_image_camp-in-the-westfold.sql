-- Migration number: 0108    2026-02-06T00:00:00.000Z

-- Update image_id for goal: Camp in the Westfold (Distance: 2295 miles)
UPDATE goals SET image_id = 'camp-in-the-westfold' WHERE distance = 2295 * 1.60934;
