-- Migration 0148_backfill_existing_achievements.sql
-- Award badges to users whose distance already qualifies before the badge
-- system shipped. The log-time award path only runs on progress writes, so
-- these users would otherwise see an empty badge grid until their next walk.
--
-- One-time and idempotent:
--   * first-steps and non-repeatable journey badges are derived from current
--     progress + the active storyline offset;
--   * repeatable habits (faithful-walker) stay on the normal log-time path so
--     historical weeks cannot flood the award queue with retroactive instances;
--   * existing instances are never duplicated.

INSERT OR IGNORE INTO user_achievement_instances
    (user_id, achievement_id, context_metadata, idempotency_key)
SELECT
    u.id,
    d.id,
    NULL,
    'habit-first-steps'
FROM users u
JOIN achievement_definitions d ON d.slug = 'habit-first-steps'
WHERE EXISTS (
        SELECT 1 FROM progress p WHERE p.user_id = u.id
    )
    AND NOT EXISTS (
        SELECT 1
        FROM user_achievement_instances i
        WHERE i.user_id = u.id AND i.achievement_id = d.id
    );

INSERT OR IGNORE INTO user_achievement_instances
    (user_id, achievement_id, context_metadata, idempotency_key)
SELECT
    u.id,
    d.id,
    json_object(
        'storyline', s.slug,
        'distance_km', ROUND(
            COALESCE(p.total_distance, 0)
                + CASE WHEN s.id = u.active_storyline_id THEN u.storyline_distance_offset ELSE 0 END,
            2
        )
    ),
    'journey:' || d.slug
FROM users u
JOIN storylines s ON s.id = COALESCE(
    (
        SELECT s2.id
        FROM storylines s2
        WHERE s2.id = u.active_storyline_id
          AND s2.is_active = 1
          AND (s2.admin_only = 0 OR u.is_admin = 1)
    ),
    (SELECT s3.id FROM storylines s3 WHERE s3.slug = 'frodo-sam' AND s3.is_active = 1)
)
JOIN achievement_definitions d
    ON d.badge_type = 'journey'
    AND json_extract(d.metadata, '$.storyline') = s.slug
LEFT JOIN (
    SELECT user_id, SUM(distance) AS total_distance
    FROM progress
    GROUP BY user_id
) p ON p.user_id = u.id
WHERE json_extract(d.metadata, '$.threshold_km') IS NOT NULL
  AND COALESCE(p.total_distance, 0)
        + CASE WHEN s.id = u.active_storyline_id THEN u.storyline_distance_offset ELSE 0 END
      >= json_extract(d.metadata, '$.threshold_km')
  AND NOT EXISTS (
      SELECT 1
      FROM user_achievement_instances i
      WHERE i.user_id = u.id AND i.achievement_id = d.id
  );
