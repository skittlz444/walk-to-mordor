-- Migration number: 0051    2026-01-27T00:00:00.000Z

-- Update image_id for goal: Camp on west bank of river (Distance: 987)
UPDATE goals SET image_id = 'camp-west-bank' WHERE distance = 987 * 1.60934;
