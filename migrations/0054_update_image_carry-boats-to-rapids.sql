-- Migration number: 0054    2026-01-27T22:45:45.000Z

-- Update image_id for goal: Foggy. Carry boats and packs to foot of rapids – 2 trips. Camp by pool that night (Distance: 1269)
UPDATE goals SET image_id = 'carry-boats-to-rapids' WHERE distance = 1269 * 1.60934;
