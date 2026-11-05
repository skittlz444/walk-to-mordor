-- Migration 0157_seed_nazgul_encounter.sql
-- Seed the first personal encounter: a three-day Nazgul pursuit. The definition
-- is globally eligible (no storyline or path-distance gating) and repeatable, so
-- the same configuration can generate future occurrences for the same walker.
--
-- INSERT OR IGNORE keeps re-applying the migration a no-op. No explicit id is
-- used, so this file is safe to run before or after the other seed migrations.

INSERT OR IGNORE INTO personal_encounter_definitions
    (slug, name, description, image_slug, badge_slug, duration_days,
     target_stretch_multiplier, target_min_distance, target_max_distance,
     is_repeatable, enabled)
VALUES
    (
        'nazgul-pursuit',
        'Outrun the Nazgûl',
        'The Black Riders have caught your scent on the road. Walk hard for three days and put enough distance between you and the Nazgûl to escape into the wild.',
        'nazgul-pursuit',
        'challenge-nazgul-outrun',
        3,
        1.3,
        3.0,
        50.0,
        1,
        1
    );
