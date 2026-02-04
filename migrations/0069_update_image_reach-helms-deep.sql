-- Migration number: 0069    2026-02-03T00:00:00.000Z

-- Update image_id for goal: Reach Helm's Deep (Distance: 2378)
UPDATE goals SET image_id = 'reach-helms-deep' WHERE distance = 2378 * 1.60934;
