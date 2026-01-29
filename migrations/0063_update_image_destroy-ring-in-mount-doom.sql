-- Migration number: 0063    2026-01-29T09:40:00.000Z

-- Update image_id for goal: Destroy the ring in Mount Doom (Distance: 1779)
UPDATE goals SET image_id = 'destroy-ring-in-mount-doom' WHERE distance = 1779 * 1.60934;
