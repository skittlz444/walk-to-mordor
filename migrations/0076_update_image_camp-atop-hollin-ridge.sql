-- Migration number: 0076    2026-02-03T00:00:00.000Z

-- Update image_id for goal: Camp atop Hollin Ridge among the large smooth towering rocks (Distance: 2959)
UPDATE goals SET image_id = 'camp-atop-hollin-ridge' WHERE distance = 2959 * 1.60934;
