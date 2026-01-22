-- Migration number: 0023    2026-01-22T09:55:00+08:00

-- Update image_id for goal: Cross The Great Road from the Brandywine Bridge. Enter Tookland. (Distance: 5)
UPDATE goals SET image_id = 'brandywine-bridge-tookland' WHERE distance = 5 * 1.60934;
