-- Migration number: 0097    2026-02-05T00:00:00.000Z

-- Update image_id for goal: Reach the steep western face of the Far Downs (Distance: 3884 miles)
UPDATE goals SET image_id = 'western-face-of-far-downs' WHERE distance = 3884 * 1.60934;
