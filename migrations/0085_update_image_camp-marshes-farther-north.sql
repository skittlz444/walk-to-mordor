-- Migration number: 0085    2026-02-04T00:00:00.000Z

-- Update image_id for goal: Camp. Marshes farther north from the road (Distance: 3391)
UPDATE goals SET image_id = 'camp-marshes-farther-north' WHERE distance = 3391 * 1.60934;
