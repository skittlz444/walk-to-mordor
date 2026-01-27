-- Migration number: 0047    2026-01-27T00:00:00.000Z

-- Update image_id for goal: North edge of eastern South Undeep (Distance: 1122)
UPDATE goals SET image_id = 'eastern-south-undeep' WHERE distance = 1122 * 1.60934;
