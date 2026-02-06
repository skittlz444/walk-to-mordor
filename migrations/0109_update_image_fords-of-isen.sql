-- Migration number: 0109    2026-02-06T00:00:00.000Z

-- Update image_id for goal: Halt at the Fords of Isen (Distance: 2410 miles)
UPDATE goals SET image_id = 'fords-of-isen' WHERE distance = 2410 * 1.60934;
