--Migration number: 0005 	 2025-09-06T19:45:00.000Z

-- Add unique constraint to date column in progress table
-- Since we can't add UNIQUE constraint to existing column directly,
-- we need to recreate the table

-- Create new table with unique constraint
CREATE TABLE progress_new (
    id INTEGER PRIMARY KEY NOT NULL,
    date DATE NOT NULL UNIQUE,
    distance REAL NOT NULL
);

-- Copy data from old table, removing duplicates (keep the last entry for each date)
INSERT INTO progress_new (id, date, distance)
SELECT id, date, distance
FROM progress
WHERE id IN (
    SELECT MAX(id)
    FROM progress
    GROUP BY date
);

-- Drop old table and rename new one
DROP TABLE progress;
ALTER TABLE progress_new RENAME TO progress;
