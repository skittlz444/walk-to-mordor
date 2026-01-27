-- Migration number: 0045    2026-01-27T00:00:00.000Z

-- Update image_id for goal: Camp on flats north of the Field of Celebrant (Distance: 1023)
UPDATE goals SET image_id = 'flats-north-celebrant' WHERE distance = 1023 * 1.60934;
