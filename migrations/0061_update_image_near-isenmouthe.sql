-- Migration number: 0061    2026-01-27T22:45:45.000Z

-- Update image_id for goal: Out on the plain, drawing near Isenmouthe (Distance: 1698)
UPDATE goals SET image_id = 'near-isenmouthe' WHERE distance = 1698 * 1.60934;
