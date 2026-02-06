-- Migration number: 0100    2026-02-05T00:00:00.000Z

-- Update image_id for goal: Camp under the holm-oaks in Ithilien (Distance: 1555 miles)
UPDATE goals SET image_id = 'holm-oaks-in-ithilien' WHERE distance = 1555 * 1.60934;
