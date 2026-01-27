-- Migration number: 0050    2026-01-27T00:00:00.000Z

-- Update image_id for goal: Reach the north edge of western South Undeep (Distance: 1142)
UPDATE goals SET image_id = 'western-south-undeep' WHERE distance = 1142 * 1.60934;
