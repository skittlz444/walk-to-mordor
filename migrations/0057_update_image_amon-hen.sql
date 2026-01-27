-- Migration number: 0057    2026-01-27T22:45:45.000Z

-- Update image_id for goal: Reach the lawn of Parth Galen below Amon Hen. “Rauros was calling with a great voice.” Camp there (Distance: 1309)
UPDATE goals SET image_id = 'amon-hen' WHERE distance = 1309 * 1.60934;
