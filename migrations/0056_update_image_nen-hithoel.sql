-- Migration number: 0056    2026-01-27T22:45:45.000Z

-- Update image_id for goal: Pass out of the chasm into the lake: Nen Hithoel. (ca. 2 p.m.) (Distance: 1290)
UPDATE goals SET image_id = 'nen-hithoel' WHERE distance = 1290 * 1.60934;
