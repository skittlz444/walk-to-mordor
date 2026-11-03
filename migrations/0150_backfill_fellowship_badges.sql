-- Migration 0150_backfill_fellowship_badges.sql
-- Award the fellowship badges that existing fellowships already qualify for.
-- The runtime hooks only fire on party creation/activation, so fellowships
-- created before this change would otherwise never award them.
--
-- One-time and idempotent:
--   * community-fellowship-founder goes to the current leader of every
--     non-dissolved fellowship. parties has no creator column, so the current
--     leader is the only persisted proxy; a founder who transferred leadership
--     is not retroactively identified.
--   * community-good-company goes to the active members of non-dissolved
--     fellowships that already have at least four active members.
--   * repeatable habit badges are deliberately NOT backfilled: their windows
--     stay on the log-time award path, matching 0148_backfill_existing_achievements.sql.
--   * INSERT OR IGNORE with the '__non_repeatable__' sentinel -- the same key
--     awardAchievement() stores for non-repeatable definitions -- makes a later
--     runtime award a no-op and re-applying this migration a no-op.

INSERT OR IGNORE INTO user_achievement_instances
    (user_id, achievement_id, context_metadata, idempotency_key)
SELECT
    p.leader_id,
    d.id,
    json_object('party_id', p.id),
    '__non_repeatable__'
FROM parties p
JOIN achievement_definitions d ON d.slug = 'community-fellowship-founder'
WHERE p.dissolved_at IS NULL;

WITH qualifying_parties AS (
    SELECT party_id
    FROM party_members
    WHERE status = 'active'
    GROUP BY party_id
    HAVING COUNT(*) >= 4
)
INSERT OR IGNORE INTO user_achievement_instances
    (user_id, achievement_id, context_metadata, idempotency_key)
SELECT
    pm.user_id,
    d.id,
    json_object('party_id', pm.party_id),
    '__non_repeatable__'
FROM party_members pm
JOIN qualifying_parties q ON q.party_id = pm.party_id
JOIN parties p ON p.id = pm.party_id
JOIN achievement_definitions d ON d.slug = 'community-good-company'
WHERE pm.status = 'active'
  AND p.dissolved_at IS NULL;
