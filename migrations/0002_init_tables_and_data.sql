--Migration number: 0002 	 2025-09-02T04:39:10.283Z

DROP TABLE IF EXISTS comments;

CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY NOT NULL,
    date DATE NOT NULL,
    distance REAL NOT NULL
);

INSERT INTO progress (date, distance)
VALUES
    ('2025-08-21', 5.6),
    ('2025-08-22', 0.58),
    ('2025-08-23', 5.05),
    ('2025-08-24', 3.64),
    ('2025-08-25', 1.59),
    ('2025-08-26', 0.32),
    ('2025-08-27', 0.18),
    ('2025-08-28', 6.8),
    ('2025-08-29', 7.47),
    ('2025-08-30', 0.4),
    ('2025-08-31', 1.86),
    ('2025-09-01', 6.66);