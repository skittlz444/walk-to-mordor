-- Migration number: 0066    2026-02-02T12:10:00.000Z

-- Update image_id for goal: The beacon tower of Calenhad stands on a foothill of Calenhad peak (Distance: 2080)
UPDATE goals SET image_id = 'beacon-tower-of-calenhad' WHERE distance = 2080 * 1.60934;
