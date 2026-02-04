-- Migration number: 0077    2026-02-03T00:00:00.000Z

-- Update image_id for goal: Climb northeast up a slope. In the west, the marsh ends (Distance: 3049)
UPDATE goals SET image_id = 'in-the-west-marsh-ends' WHERE distance = 3049 * 1.60934;
