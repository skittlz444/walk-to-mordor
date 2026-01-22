-- Migration number: 0029    2026-01-22T13:50:03.000Z

-- Update image_id for goal: Camp in thickets south of the Great East Road (Distance: 260)
UPDATE goals SET image_id = 'thicket-south-great-road' WHERE distance = 260 * 1.60934;
