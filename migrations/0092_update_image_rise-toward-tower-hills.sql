-- Migration number: 0092    2026-02-04T00:00:00.000Z

-- Update image_id for goal: Land begins to rise toward the Tower Hills (Distance: 3704)
UPDATE goals SET image_id = 'rise-toward-tower-hills' WHERE distance = 3704 * 1.60934;
