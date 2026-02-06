-- Migration number: 0114    2026-02-06T00:00:00.000Z

-- Update image_id for goal: The Mountains of Moria loom ahead (Distance: 2934 miles)
UPDATE goals SET image_id = 'mountains-of-moria-ahead' WHERE distance = 2934 * 1.60934;
