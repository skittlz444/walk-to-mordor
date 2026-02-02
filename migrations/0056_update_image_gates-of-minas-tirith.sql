-- Migration number: 0056    2026-02-02T00:00:00.000Z

-- Update image_id for goal: Reach the Gates of Minas Tirith (Distance: 1899)
UPDATE goals SET image_id = 'gates-of-minas-tirith' WHERE distance = 1899 * 1.60934;
