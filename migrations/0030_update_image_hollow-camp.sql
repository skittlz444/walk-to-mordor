-- Migration number: 0030    2026-01-22T00:00:00.000Z

-- Update image_id for goal: Camp (Distance: 271)
UPDATE goals SET image_id = 'hollow-camp' WHERE distance = 271 * 1.60934;
