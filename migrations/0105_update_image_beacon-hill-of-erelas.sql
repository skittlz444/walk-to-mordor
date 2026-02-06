-- Migration number: 0105    2026-02-06T00:00:00.000Z

-- Update image_id for goal: Pass the beacon hill of Erelas (Distance: 2025 miles)
UPDATE goals SET image_id = 'beacon-hill-of-erelas' WHERE distance = 2025 * 1.60934;
