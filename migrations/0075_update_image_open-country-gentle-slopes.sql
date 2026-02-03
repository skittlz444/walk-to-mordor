-- Migration number: 0075    2026-02-03T00:00:00.000Z

-- Update image_id for goal: Open country. Gentle slopes, easier for the ponies (Distance: 2909)
UPDATE goals SET image_id = 'open-country-gentle-slopes' WHERE distance = 2909 * 1.60934;
