-- Migration 0151_dedupe_non_repeatable_achievements.sql
-- One-time correction for duplicate non-repeatable badges.
--
-- Why they exist: 0148 backfilled already-earned badges under per-definition keys
-- ('habit-first-steps', 'journey:<slug>'), while the award service stores every
-- non-repeatable award under the '__non_repeatable__' sentinel and used to check
-- for an existing row by that key. The unique constraint is
-- (user_id, achievement_id, idempotency_key), so it could not collapse the two:
-- the next runtime award inserted a second row under the sentinel.
--
-- What this does, per (user, non-repeatable achievement) group, in order:
--   1. copy "already seen" across: if any instance in the group is acknowledged,
--      acknowledge the earliest instance before anything is deleted;
--   2. delete every instance except the earliest (MIN(id), the backfill row with
--      the earliest earned_at and its context);
--   3. re-key the survivor to '__non_repeatable__' so storage matches every other
--      non-repeatable award -- safe even if the fix ships after this migration,
--      because the old keyed check still finds the sentinel row.
--
-- Acknowledgements for deleted duplicates cascade via 0147's ON DELETE CASCADE.
-- Only definitions with is_repeatable = 0 are touched: repeatables are keyed per
-- window by design and their multiple rows are legitimate.
--
-- Idempotent: a second run finds each group already reduced to one sentinel-keyed
-- acknowledged-or-not row, so it inserts nothing, deletes nothing, and re-keys
-- nothing. Pure data correction: no schema, no new dependency.

-- 1. Preserve acknowledgement state: the survivor inherits "seen" from any duplicate.
--    The inner MIN(id) is computed over the whole (user, achievement) group, not just
--    the acknowledged rows, so it always points at the row step 2 keeps.
INSERT OR IGNORE INTO user_achievement_acknowledgements (user_id, instance_id)
SELECT ack.user_id, (
    SELECT MIN(i2.id)
    FROM user_achievement_instances i2
    WHERE i2.user_id = ack.user_id AND i2.achievement_id = uai.achievement_id
)
FROM user_achievement_acknowledgements ack
JOIN user_achievement_instances uai
    ON uai.user_id = ack.user_id AND uai.id = ack.instance_id
JOIN achievement_definitions ad ON ad.id = uai.achievement_id
WHERE ad.is_repeatable = 0;

-- 2. Drop the accidental duplicates, keeping the earliest row of each group.
DELETE FROM user_achievement_instances
WHERE id IN (
    SELECT uai.id
    FROM user_achievement_instances uai
    JOIN achievement_definitions ad ON ad.id = uai.achievement_id
    WHERE ad.is_repeatable = 0
      AND uai.id > (
          SELECT MIN(i2.id)
          FROM user_achievement_instances i2
          WHERE i2.user_id = uai.user_id AND i2.achievement_id = uai.achievement_id
      )
);

-- 3. Normalize the survivors onto the sentinel key.
UPDATE user_achievement_instances
SET idempotency_key = '__non_repeatable__'
WHERE id IN (
    SELECT uai.id
    FROM user_achievement_instances uai
    JOIN achievement_definitions ad ON ad.id = uai.achievement_id
    WHERE ad.is_repeatable = 0
      AND uai.idempotency_key <> '__non_repeatable__'
);
