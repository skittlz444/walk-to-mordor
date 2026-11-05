-- Migration 0158_seed_nazgul_badge.sql
-- Seed the repeatable completion badge for the Nazgul personal encounter into
-- the shared achievement catalog. The encounter definition's badge_slug points
-- at this row; awardAchievement() resolves it through the shared infrastructure.
--
-- metadata follows the 0145 catalog conventions:
--   storyline        null (global badge)
--   rank_thresholds  four ascending earn counts (repeatable badges)
--   unit             display plural for repeatable progress
--   criteria         stable condition label consumed by the award hook
--
-- INSERT OR IGNORE keeps re-applying the migration a no-op.

INSERT OR IGNORE INTO achievement_definitions
    (slug, name, description, image_slug, badge_type, is_repeatable, metadata)
VALUES
    (
        'challenge-nazgul-outrun',
        'Outrunner of the Nazgûl',
        'Complete the Outrun the Nazgûl personal challenge.',
        'challenge-nazgul-outrun',
        'challenge',
        1,
        '{"storyline":null,"rank_thresholds":[1,3,7,15],"unit":"pursuits","criteria":"personal_encounter_completed"}'
    );
