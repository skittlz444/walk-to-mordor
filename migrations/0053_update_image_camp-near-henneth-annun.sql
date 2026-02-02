-- Migration number: 0053    2026-02-02T00:00:00.000Z

-- Update image_id for goal: Camp near Henneth Annûn (Distance: 1835)
UPDATE goals SET image_id = 'camp-near-henneth-annun' WHERE distance = 1835 * 1.60934;
