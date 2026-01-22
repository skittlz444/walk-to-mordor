-- Migration number: 0028    2026-01-22T13:50:02.000Z

-- Update image_id for goal: Camp at the foot of the Weather Hills (Distance: 229)
UPDATE goals SET image_id = 'weathertop-camp' WHERE distance = 229 * 1.60934;
