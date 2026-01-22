-- Migration number: 0024    2026-01-22T10:30:00+08:00

-- Update image_id for goal: Meet Elves (Distance: 41)
UPDATE goals SET image_id = 'meet-elves' WHERE distance = 41 * 1.60934;
