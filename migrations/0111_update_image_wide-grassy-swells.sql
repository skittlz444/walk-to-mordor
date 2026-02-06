-- Migration number: 0111    2026-02-06T00:00:00.000Z

-- Update image_id for goal: Camp among the wide grassy swells (Distance: 2651 miles)
UPDATE goals SET image_id = 'wide-grassy-swells' WHERE distance = 2651 * 1.60934;
