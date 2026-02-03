-- Migration number: 0074    2026-02-03T00:00:00.000Z

-- Update image_id for goal: Reach the hill where the Fellowship had sheltered from the Warg attack (Distance: 2874)
UPDATE goals SET image_id = 'hill-where-fellowship-sheltered from-wargs' WHERE distance = 2874 * 1.60934;
