-- Migration number: 0084    2026-02-04T00:00:00.000Z

-- Update image_id for goal: Weathertop immediately north of road (Distance: 3324)
UPDATE goals SET image_id = 'weathertop-immediately-north-of-road' WHERE distance = 3324 * 1.60934;
