-- Migration number: 0090    2026-02-04T00:00:00.000Z

-- Update image_id for goal: Camp in the open lands (Distance: 3614)
UPDATE goals SET image_id = 'camp-in-open-lands' WHERE distance = 3614 * 1.60934;
