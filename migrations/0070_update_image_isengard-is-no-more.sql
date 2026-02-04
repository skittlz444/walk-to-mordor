-- Migration number: 0070    2026-02-03T00:00:00.000Z

-- Update image_id for goal: Treegarth of Orthanc, Isengard is no more (Distance: 2434)
UPDATE goals SET image_id = 'isengard-is-no-more' WHERE distance = 2434 * 1.60934;
