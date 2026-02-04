-- Migration number: 0072    2026-02-03T00:00:00.000Z

-- Update image_id for goal: Camp at base of an out-thrust hill of Methedras (Distance: 2539)
UPDATE goals SET image_id = 'camp-hill-of-methedras' WHERE distance = 2539 * 1.60934;
