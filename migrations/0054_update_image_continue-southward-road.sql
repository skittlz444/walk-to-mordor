-- Migration number: 0054    2026-02-02T00:00:00.000Z

-- Update image_id for goal: Continue on Southward Road (Distance: 1840)
UPDATE goals SET image_id = 'continue-southward-road' WHERE distance = 1840 * 1.60934;
