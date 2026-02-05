-- Migration number: 0099    2026-02-05T00:00:00.000Z

-- Update image_id for goal: Camp in the Naith of Lórien (Distance: 883.5 miles)
UPDATE goals SET image_id = 'camp-in-naith-of-lorien' WHERE distance = 883.5 * 1.60934;
