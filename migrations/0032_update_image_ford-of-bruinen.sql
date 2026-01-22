-- Migration number: 0032    2026-01-22T00:00:20.000Z

-- Update image_id for goal: Reach Ford of Bruinen (Distance: 466)
UPDATE goals SET image_id = 'ford-of-bruinen' WHERE distance = 466 * 1.60934;
