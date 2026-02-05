-- Migration number: 0098    2026-02-05T00:00:00.000Z

-- Update image_id for goal: Sam arrives at Bag End at sunset: Home (Distance: 3991 miles)
UPDATE goals SET image_id = 'home' WHERE distance = 3991 * 1.60934;
