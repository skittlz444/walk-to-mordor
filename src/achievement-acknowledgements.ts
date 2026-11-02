// Achievement acknowledgement domain service.
//
// Acknowledgements are a projection over the append-only
// `user_achievement_instances` table: pending awards are earned instances with
// no acknowledgement row for the caller. Acknowledgement never mutates the
// earned instance rows themselves.
import type { DbClient } from './db';

/** A pending award: an earned instance plus its definition and award context. */
export interface PendingAchievement {
  instance_id: number;
  earned_at: string;
  /** Current total earned count for the definition (for repeat context). */
  earned_count: number;
  /**
   * 1-based position of this instance among the user's instances of the same
   * definition, ordered by instance id. Used as the awarding ordinal so
   * historical ranks survive backfills that share an `earned_at`.
   */
  awarding_ordinal: number;
  slug: string;
  name: string;
  description: string | null;
  image_slug: string | null;
  badge_type: string;
  is_repeatable: boolean;
  metadata: string | null;
}

interface PendingAchievementRow {
  instance_id: number;
  earned_at: string;
  earned_count: number;
  awarding_ordinal: number;
  slug: string;
  name: string;
  description: string | null;
  image_slug: string | null;
  badge_type: string;
  is_repeatable: number;
  metadata: string | null;
}

/**
 * SQLite's `CURRENT_TIMESTAMP` returns `YYYY-MM-DD HH:MM:SS` (UTC), which is
 * not valid HTML `<time datetime>` and parses inconsistently in browsers.
 * Normalize it to ISO 8601; already-ISO values pass through unchanged.
 */
function toIsoTimestamp(value: string): string {
  return value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
}

function toPendingAchievement(row: PendingAchievementRow): PendingAchievement {
  return {
    instance_id: row.instance_id,
    earned_at: toIsoTimestamp(row.earned_at),
    earned_count: row.earned_count,
    awarding_ordinal: row.awarding_ordinal,
    slug: row.slug,
    name: row.name,
    description: row.description,
    image_slug: row.image_slug,
    badge_type: row.badge_type,
    is_repeatable: row.is_repeatable === 1,
    metadata: row.metadata,
  };
}

/**
 * List a user's earned-but-unacknowledged awards, oldest-earned first.
 *
 * Each row carries its definition display fields, the definition's current
 * `earned_count`, and the instance's awarding ordinal (its position among the
 * user's instances of the same definition by instance id).
 */
export async function listPendingAchievements(
  db: DbClient,
  userId: number,
): Promise<PendingAchievement[]> {
  const { results } = await db.read.prepare(
    `SELECT
       uai.id AS instance_id,
       uai.earned_at,
       ad.slug, ad.name, ad.description, ad.image_slug, ad.badge_type,
       ad.is_repeatable, ad.metadata,
       (
         SELECT COUNT(*) FROM user_achievement_instances peer
         WHERE peer.user_id = uai.user_id
           AND peer.achievement_id = uai.achievement_id
           AND (
             peer.earned_at < uai.earned_at
             OR (peer.earned_at = uai.earned_at AND peer.id <= uai.id)
           )
       ) AS awarding_ordinal,
       (
         SELECT COUNT(*) FROM user_achievement_instances total
         WHERE total.user_id = uai.user_id
           AND total.achievement_id = uai.achievement_id
       ) AS earned_count
     FROM user_achievement_instances uai
     JOIN achievement_definitions ad ON ad.id = uai.achievement_id
     WHERE uai.user_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM user_achievement_acknowledgements uaa
         WHERE uaa.user_id = uai.user_id AND uaa.instance_id = uai.id
       )
     ORDER BY uai.earned_at ASC, uai.id ASC`,
  ).bind(userId).all<PendingAchievementRow>();

  return (results || []).map(toPendingAchievement);
}

/**
 * Acknowledge earned instances for a user, idempotently.
 *
 * Each ID is inserted only when it belongs to an instance owned by `userId`;
 * IDs owned by another user, stale IDs, and already-acknowledged instances are
 * silently ignored. The per-ID statements run as one atomic D1 batch, so a
 * failure cannot leave a partially acknowledged request. Returns the number of
 * rows actually inserted, so a replay reports `0` without duplicating state.
 */
export async function acknowledgeAchievementInstances(
  db: DbClient,
  userId: number,
  instanceIds: number[],
): Promise<{ acknowledged: number }> {
  if (instanceIds.length === 0) return { acknowledged: 0 };

  const statements = instanceIds.map((instanceId) => db.write.prepare(
    `INSERT INTO user_achievement_acknowledgements (user_id, instance_id)
     SELECT ?, id FROM user_achievement_instances WHERE id = ? AND user_id = ?
     ON CONFLICT DO NOTHING`,
  ).bind(userId, instanceId, userId));

  const results = await db.write.batch(statements);

  let acknowledged = 0;
  for (const result of results) {
    acknowledged += Number(result.meta.changes ?? 0);
  }

  return { acknowledged };
}
