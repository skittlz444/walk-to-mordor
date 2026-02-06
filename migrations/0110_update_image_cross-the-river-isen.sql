-- Migration number: 0110    2026-02-06T00:00:00.000Z

-- Update image_id for goal: Cross the River Isen (Distance: 2455 miles)
UPDATE goals SET image_id = 'cross-the-river-isen' WHERE distance = 2455 * 1.60934;
