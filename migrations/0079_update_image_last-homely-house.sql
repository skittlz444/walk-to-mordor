-- Migration number: 0079    2026-02-04T00:00:00.000Z

-- Update image_id for goal: Reach the Last Homely House (Distance: 3127)
UPDATE goals SET image_id = 'last-homely-house' WHERE distance = 3127 * 1.60934;
