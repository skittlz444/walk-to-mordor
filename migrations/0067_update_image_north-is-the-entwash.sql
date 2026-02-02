-- Migration number: 0067    2026-02-02T12:15:00.000Z

-- Update image_id for goal: North of the road, is the Entwash (Distance: 2166)
UPDATE goals SET image_id = 'north-is-the-entwash' WHERE distance = 2166 * 1.60934;
