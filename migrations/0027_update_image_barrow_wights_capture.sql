-- Migration number: 0027    2026-01-22T13:50:01.000Z

-- Update image_id for goal: The Hobbits are captured by Wights (Distance: 115)
UPDATE goals SET image_id = 'barrow-wights-capture' WHERE distance = 115 * 1.60934;
