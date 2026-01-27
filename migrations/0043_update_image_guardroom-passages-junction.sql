-- Migration number: 0043    2026-01-27T00:00:00.000Z

-- Update image_id for goal: Reach junction of 3 passages with guardroom (Distance: 818)
UPDATE goals SET image_id = 'guardroom-passages-junction' WHERE distance = 818 * 1.60934;
