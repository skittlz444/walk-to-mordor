-- Migration number: 0057    2026-02-02T00:00:00.000Z

-- Update image_id for goal: Camp by road north of the Drúadan Forest (Distance: 1949)
UPDATE goals SET image_id = 'road-north-of-druadan-forest' WHERE distance = 1949 * 1.60934;
