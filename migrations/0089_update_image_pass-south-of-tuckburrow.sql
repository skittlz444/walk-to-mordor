-- Migration number: 0089    2026-02-04T00:00:00.000Z

-- Update image_id for goal: Pass south of Tuckburrow (Distance: 3626)
UPDATE goals SET image_id = 'pass-south-of-tuckburrow' WHERE distance = 3626 * 1.60934;
