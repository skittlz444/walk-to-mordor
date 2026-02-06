-- Migration number: 0104    2026-02-06T00:00:00.000Z

-- Update image_id for goal: Pass the beacon hill of Eilenach (Distance: 1975 miles)
UPDATE goals SET image_id = 'beacon-hill-of-eilenach' WHERE distance = 1975 * 1.60934;
