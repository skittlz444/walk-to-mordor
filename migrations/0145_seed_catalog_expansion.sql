-- Migration 0145_seed_catalog_expansion.sql
-- First catalog expansion beyond the ten badges seeded by 0144 (eight journey
-- plus two habit): three global habit definitions and a two-badge community
-- fellowship collection.
--
-- Catalog-only data. No schema change, no award hooks, no artwork. Slugs are
-- stable identifiers; rows are inserted with INSERT OR IGNORE so re-applying
-- the migration is a no-op. No explicit IDs are used, so this file is safe to
-- run before or after 0144_seed_journey_badges.sql.
--
-- metadata is JSON:
--   storyline       null for global badges
--   rank_thresholds four ascending earn counts (repeatable badges)
--   rank            fixed 1-4 (non-repeatable badges)
--   collection      { slug, label, index, size }
--   criteria        stable condition label consumed by a future award hook
--   unit            display plural for repeatable progress

INSERT OR IGNORE INTO achievement_definitions
    (slug, name, description, image_slug, badge_type, is_repeatable, metadata)
VALUES
    (
        'habit-weekend-warrior',
        'Weekend Warrior',
        'Log a walk on both Saturday and Sunday of the same week.',
        'habit-weekend-warrior',
        'habit',
        1,
        '{"storyline":null,"rank_thresholds":[1,4,12,26],"criteria":"weekend_both_days","unit":"weekends"}'
    ),
    (
        'habit-steady-month',
        'Steady Month',
        'Log at least 20 distinct days in a calendar month.',
        'habit-steady-month',
        'habit',
        1,
        '{"storyline":null,"rank_thresholds":[1,3,6,12],"criteria":"distinct_days_month >= 20","unit":"months"}'
    ),
    (
        'habit-hundred-week',
        'Hundred-K Week',
        'Log at least 100 km within a trailing seven-day window.',
        'habit-hundred-week',
        'habit',
        1,
        '{"storyline":null,"rank_thresholds":[1,4,12,26],"criteria":"trailing_7d_km >= 100","unit":"weeks"}'
    ),
    (
        'community-fellowship-founder',
        'Fellowship Founder',
        'Create a fellowship.',
        'community-fellowship-founder',
        'community',
        0,
        '{"storyline":null,"rank":1,"collection":{"slug":"community-fellowship","label":"The Fellowship","index":1,"size":2},"criteria":"party_created"}'
    ),
    (
        'community-good-company',
        'Good Company',
        'Be part of a fellowship with at least four active members.',
        'community-good-company',
        'community',
        0,
        '{"storyline":null,"rank":2,"collection":{"slug":"community-fellowship","label":"The Fellowship","index":2,"size":2},"criteria":"party_active_members >= 4"}'
    );
