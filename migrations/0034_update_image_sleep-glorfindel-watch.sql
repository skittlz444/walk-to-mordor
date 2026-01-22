-- Migration number: 0034    2026-01-22T00:00:00.000Z

-- Update image_id for goal: Camp under Glorfindel's Watch (Distance: 435)
UPDATE goals SET image_id = 'sleep-glorfindel-watch' WHERE distance = 435 * 1.60934;
