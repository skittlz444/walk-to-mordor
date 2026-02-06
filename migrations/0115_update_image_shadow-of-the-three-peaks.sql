-- Migration number: 0115    2026-02-06T00:00:00.000Z

-- Update image_id for goal: Camp in the shadow of the Three Peaks (Distance: 2987 miles)
UPDATE goals SET image_id = 'shadow-of-the-three-peaks' WHERE distance = 2987 * 1.60934;
