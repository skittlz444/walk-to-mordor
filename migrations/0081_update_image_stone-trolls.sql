-- Migration number: 0081    2026-02-04T00:00:00.000Z

-- Update image_id for goal: Reach pathway to Stone Trolls (Distance: 3185)
UPDATE goals SET image_id = 'stone-trolls' WHERE distance = 3185 * 1.60934;
