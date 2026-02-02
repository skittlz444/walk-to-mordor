-- Migration number: 0055    2026-02-02T00:00:00.000Z

-- Update image_id for goal: Can see Amon Dîn due west (Distance: 1863)
UPDATE goals SET image_id = 'amon-din-due-west' WHERE distance = 1863 * 1.60934;
