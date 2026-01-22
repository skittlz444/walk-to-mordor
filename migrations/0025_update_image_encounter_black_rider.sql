-- Migration number: 0025    2026-01-22T13:45:00.000Z

-- Update image_id for goal: Encounter with Black Rider (Distance: 32)
UPDATE goals SET image_id = 'encounter-black-rider' WHERE distance = 32 * 1.60934;
