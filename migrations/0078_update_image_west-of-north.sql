-- Migration number: 0078    2026-02-03T00:00:00.000Z

-- Update image_id for goal: Turn slightly west of north (Distance: 3099)
UPDATE goals SET image_id = 'west-of-north' WHERE distance = 3099 * 1.60934;
