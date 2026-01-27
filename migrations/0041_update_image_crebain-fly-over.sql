-- Migration number: 0041    2026-01-27T00:00:00.000Z

-- Update image_id for goal: Top of Hollin Ridge. Crebain fly over. - Boarder of Eregion (Distance: 690)
UPDATE goals SET image_id = 'crebain-fly-over' WHERE distance = 690 * 1.60934;
