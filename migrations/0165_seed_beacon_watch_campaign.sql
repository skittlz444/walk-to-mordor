-- Migration 0165_seed_beacon_watch_campaign.sql
-- Seed the first community campaign. The definition starts disabled so it stays
-- out of public listings until an admin enables it (community-campaigns-admin).
--
-- INSERT OR IGNORE keeps re-applying the migration a no-op, and no explicit id
-- is used so this file is safe to run before or after the run/badge seeds.

INSERT OR IGNORE INTO campaign_definitions
    (slug, name, description, image_slug, badge_slug, enabled)
VALUES
    (
        'beacon-watch',
        'Beacon Watch',
        'The beacons of Gondor are lit one hilltop at a time. Rally the community, log your kilometres, and light the next beacon together.',
        'beacon-watch',
        'community-beacon-watch',
        0
    );
