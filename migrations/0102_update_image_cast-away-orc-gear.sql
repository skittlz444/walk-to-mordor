-- Migration number: 0102    2026-02-05T00:00:00.000Z

-- Update image_id for goal: Frodo and Sam cast away their orc-gear (Distance: 1717 miles)
UPDATE goals SET image_id = 'cast-away-orc-gear' WHERE distance = 1717 * 1.60934;
