-- Migration 0166_seed_beacon_watch_run.sql
-- Seed run 1 of the Beacon Watch campaign: the 581 km beacon run between Edoras
-- and Minas Tirith on the Pippin path. The window is relative to migration time
-- so the run is always upcoming when deployed; the campaign is disabled, so the
-- admin adjusts the dates and target before enabling it.
--
-- The NOT EXISTS guard makes re-applying the migration a no-op instead of
-- tripping UNIQUE(campaign_id, run_number).

INSERT INTO campaign_runs
    (campaign_id, run_number, target_distance, start_date, end_date, status)
SELECT
    id,
    1,
    581.0,
    date('now', '+1 day'),
    date('now', '+14 day'),
    'upcoming'
FROM campaign_definitions
WHERE slug = 'beacon-watch'
  AND NOT EXISTS (
    SELECT 1 FROM campaign_runs WHERE campaign_id = campaign_definitions.id
  );
