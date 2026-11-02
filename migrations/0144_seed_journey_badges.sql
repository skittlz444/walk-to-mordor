-- Migration 0144_seed_journey_badges.sql
-- Seed the first badge catalog: eight Frodo/Sam journey badges forming one
-- numbered, ranked collection, plus two global habit badges.
--
-- Catalog-only data. No schema change, no award hooks, no artwork. Slugs are
-- stable identifiers; rows are inserted with INSERT OR IGNORE so re-applying
-- the migration is a no-op. No explicit IDs are used, so this file is safe to
-- run before or after 0145_seed_catalog_expansion.sql.
--
-- metadata is JSON:
--   storyline       "frodo-sam" for journey badges, null for global habits
--   rank            fixed 1-4 (non-repeatable badges)
--   rank_thresholds four ascending earn counts (repeatable badges)
--   threshold_km    journey distance that awards the badge
--   collection      { slug, label, index, size } for the journey set
--   criteria        stable condition label consumed by the award hook
--   unit            display plural for repeatable progress

INSERT OR IGNORE INTO achievement_definitions
    (slug, name, description, image_slug, badge_type, is_repeatable, metadata)
VALUES
    (
        'habit-first-steps',
        'First Steps',
        'Log your first walk.',
        'habit-first-steps',
        'habit',
        0,
        '{"storyline":null,"rank":1,"criteria":"first_walk"}'
    ),
    (
        'habit-faithful-walker',
        'Faithful Walker',
        'Log a walk on every day (Monday through Sunday) of a calendar week.',
        'habit-faithful-walker',
        'habit',
        1,
        '{"storyline":null,"rank_thresholds":[1,4,12,26],"criteria":"seven_day_streak","unit":"weeks"}'
    ),
    (
        'journey-frodo-sam-buckleberry-ferry',
        'Across the Buckleberry Ferry',
        'Cross the Buckleberry Ferry and leave the Shire behind.',
        'journey-frodo-sam-buckleberry-ferry',
        'journey',
        0,
        '{"storyline":"frodo-sam","rank":1,"threshold_km":112.65,"collection":{"slug":"frodo-sam-journey","label":"The Road to Mordor","index":1,"size":8},"criteria":"distance_km >= 112.65"}'
    ),
    (
        'journey-frodo-sam-weathertop-survivor',
        'Survivor of Weathertop',
        'Survive the Nazgûl attack on Amon Sûl and carry on from Weathertop.',
        'journey-frodo-sam-weathertop-survivor',
        'journey',
        0,
        '{"storyline":"frodo-sam","rank":1,"threshold_km":387.85,"collection":{"slug":"frodo-sam-journey","label":"The Road to Mordor","index":2,"size":8},"criteria":"distance_km >= 387.85"}'
    ),
    (
        'journey-frodo-sam-through-khazad-dum',
        'Through Khazad-dûm',
        'Pass beneath the Doors of Durin and make the dark journey through Moria.',
        'journey-frodo-sam-through-khazad-dum',
        'journey',
        0,
        '{"storyline":"frodo-sam","rank":2,"threshold_km":1284.25,"collection":{"slug":"frodo-sam-journey","label":"The Road to Mordor","index":3,"size":8},"criteria":"distance_km >= 1284.25"}'
    ),
    (
        'journey-frodo-sam-lothlorien-guest',
        'Guest of the Golden Wood',
        'Rest for a while as a guest in the golden wood of Lothlórien.',
        'journey-frodo-sam-lothlorien-guest',
        'journey',
        0,
        '{"storyline":"frodo-sam","rank":2,"threshold_km":1375.98,"collection":{"slug":"frodo-sam-journey","label":"The Road to Mordor","index":4,"size":8},"criteria":"distance_km >= 1375.98"}'
    ),
    (
        'journey-frodo-sam-rauros-parting',
        'The Breaking of the Fellowship',
        'Reach the lawn of Parth Galen beneath Amon Hen, where the Fellowship is broken.',
        'journey-frodo-sam-rauros-parting',
        'journey',
        0,
        '{"storyline":"frodo-sam","rank":3,"threshold_km":2106.63,"collection":{"slug":"frodo-sam-journey","label":"The Road to Mordor","index":5,"size":8},"criteria":"distance_km >= 2106.63"}'
    ),
    (
        'journey-frodo-sam-mordor-threshold',
        'Standing at Mount Doom',
        'Stand at last on the slopes of Mount Doom, where the Ring is unmade.',
        'journey-frodo-sam-mordor-threshold',
        'journey',
        0,
        '{"storyline":"frodo-sam","rank":3,"threshold_km":2863.01,"collection":{"slug":"frodo-sam-journey","label":"The Road to Mordor","index":6,"size":8},"criteria":"distance_km >= 2863.01"}'
    ),
    (
        'journey-frodo-sam-glittering-caves',
        'The Glittering Caves',
        'Return to Helm''s Deep and descend into the Glittering Caves of Aglarond, where Legolas sees the stone-gardens Gimli spoke of.',
        'journey-frodo-sam-glittering-caves',
        'journey',
        0,
        '{"storyline":"frodo-sam","rank":4,"threshold_km":3827.0,"collection":{"slug":"frodo-sam-journey","label":"The Road to Mordor","index":7,"size":8},"criteria":"distance_km >= 3827.0"}'
    ),
    (
        'journey-frodo-sam-home-at-sunset',
        'Home Again at Sunset',
        'Return to Bag End at sunset, the long road home at last complete.',
        'journey-frodo-sam-home-at-sunset',
        'journey',
        0,
        '{"storyline":"frodo-sam","rank":4,"threshold_km":6422.49,"collection":{"slug":"frodo-sam-journey","label":"The Road to Mordor","index":8,"size":8},"criteria":"distance_km >= 6422.49"}'
    );
