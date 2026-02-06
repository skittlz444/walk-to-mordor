-- Migration number: 0095    2026-02-05T00:00:00.000Z

-- Update image_id for goal: Say farewell. The White Ship sails Into the West (Distance: 3784 miles)
UPDATE goals SET image_id = 'say-farewell' WHERE distance = 3784 * 1.60934;
