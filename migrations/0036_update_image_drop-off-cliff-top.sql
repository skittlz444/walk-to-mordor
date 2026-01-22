-- Migration number: 0036    2026-01-22T09:01:00.000Z

-- Update image_id for goal: Path comes to a steep drop-off, go along cliff top (Distance: 548)
UPDATE goals SET image_id = 'drop-off-cliff-top' WHERE distance = 548 * 1.60934;
