-- Migration number: 0052    2026-02-02T00:00:00.000Z

-- Update image_id for goal: Camp along the road (Distance: 1798)
UPDATE goals SET image_id = 'camp-along-road' WHERE distance = 1798 * 1.60934;
