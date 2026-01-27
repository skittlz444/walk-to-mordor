-- Migration number: 0042    2026-01-27T00:00:00.000Z

-- Update image_id for goal: Almost at the foot of the Redhorn. Gandalf and Aragorn debate the path. Fearing snow everyone carries wood (Distance: 742)
UPDATE goals SET image_id = 'redhorn-foot-debate' WHERE distance = 742 * 1.60934;
