-- Migration number: 0064    2026-02-02T12:00:00.000Z

-- Update image_id for goal: Pass the beacon on Nardol, the “Fire Hill” (Distance: 2000)
UPDATE goals SET image_id = 'beacon-on-nardol' WHERE distance = 2000 * 1.60934;
