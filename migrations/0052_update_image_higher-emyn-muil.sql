-- Migration number: 0052    2026-01-27T22:45:45.000Z

-- Update image_id for goal: They reach the higher Emyn Muil (Distance: 1234)
UPDATE goals SET image_id = 'higher-emyn-muil' WHERE distance = 1234 * 1.60934;
