-- Migration number: 0103    2026-02-05T00:00:00.000Z

-- Update image_id for goal: Camp in the green lands of Anórien (Distance: 1924 miles)
UPDATE goals SET image_id = 'green-lands-of-anorien' WHERE distance = 1924 * 1.60934;
