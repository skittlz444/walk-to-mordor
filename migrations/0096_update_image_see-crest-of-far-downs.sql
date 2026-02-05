-- Migration number: 0096    2026-02-05T00:00:00.000Z

-- Update image_id for goal: Ahead to the east, see the crest of the Far Downs (Distance: 3864 miles)
UPDATE goals SET image_id = 'see-crest-of-far-downs' WHERE distance = 3864 * 1.60934;
