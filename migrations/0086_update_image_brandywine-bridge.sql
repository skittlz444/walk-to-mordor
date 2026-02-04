-- Migration number: 0086    2026-02-04T00:00:00.000Z

-- Update image_id for goal: Reach the Brandywine Bridge (Distance: 3479)
UPDATE goals SET image_id = 'brandywine-bridge' WHERE distance = 3479 * 1.60934;
