-- Migration number: 0087    2026-02-04T00:00:00.000Z

-- Update image_id for goal: Frogmorton (Distance: 3501)
UPDATE goals SET image_id = 'frogmorton' WHERE distance = 3501 * 1.60934;
