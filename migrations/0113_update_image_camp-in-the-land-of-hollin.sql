-- Migration number: 0113    2026-02-06T00:00:00.000Z

-- Update image_id for goal: Camp in the quiet land of Hollin (Distance: 2784 miles)
UPDATE goals SET image_id = 'camp-in-the-land-of-hollin' WHERE distance = 2784 * 1.60934;
