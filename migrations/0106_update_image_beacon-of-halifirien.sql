-- Migration number: 0106    2026-02-06T00:00:00.000Z

-- Update image_id for goal: Pass the beacon of Halifirien and the Firien Wood (Distance: 2124 miles)
UPDATE goals SET image_id = 'beacon-of-halifirien' WHERE distance = 2124 * 1.60934;
