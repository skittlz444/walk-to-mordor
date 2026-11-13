-- Migration 0167_seed_beacon_watch_badge.sql
-- Seed the repeatable completion badge for the Beacon Watch campaign into the
-- shared achievement catalog. The campaign definition's badge_slug points here;
-- awardAchievement() resolves it through the shared infrastructure with the
-- per-run key campaign:<slug>:run:<run_id> (community-campaigns change 4.2).
--
-- metadata follows the 0145 catalog conventions:
--   storyline        null (global badge)
--   rank_thresholds  four ascending earn counts (repeatable badges); no `rank`
--                    key, which would override the thresholds
--   unit             display plural for repeatable progress
--   criteria         stable condition label consumed by the award hook
--
-- INSERT OR IGNORE keeps re-applying the migration a no-op.

INSERT OR IGNORE INTO achievement_definitions
    (slug, name, description, image_slug, badge_type, is_repeatable, metadata)
VALUES
    (
        'community-beacon-watch',
        'Beacon Warden',
        'Complete a Beacon Watch community campaign.',
        'community-beacon-watch',
        'community',
        1,
        '{"storyline":null,"rank_thresholds":[1,3,7,15],"unit":"beacons","criteria":"community_campaign_completed"}'
    );
