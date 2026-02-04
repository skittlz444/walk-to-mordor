-- Migration number: 0068    2026-02-03T00:00:00.000Z

-- Update image_id for goal: Leave the Folde (Distance: 2206)
UPDATE goals SET image_id = 'leave-the-folde' WHERE distance = 2206 * 1.60934;
