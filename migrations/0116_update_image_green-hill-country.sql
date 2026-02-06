-- Migration number: 0116    2026-02-06T00:00:00.000Z

-- Update image_id for goal: Travel through the Green Hill Country (Distance: 3588 miles)
UPDATE goals SET image_id = 'green-hill-country' WHERE distance = 3588 * 1.60934;
