-- Migration number: 0094    2026-02-05T00:00:00.000Z

-- Update image_id for goal: Land drops gently down toward the Gulf (Distance: 3764 miles)
UPDATE goals SET image_id = 'down-toward-the-gulf' WHERE distance = 3764 * 1.60934;
