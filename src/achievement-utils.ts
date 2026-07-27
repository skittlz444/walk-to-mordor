// Shared achievement/badge domain service: definitions, idempotent award,
// and aggregated summaries. Consumed by personal challenges, storyline
// books, and the Field Guide -- all through this same path.
import type { DbClient } from './db';

// ── Types ──────────────────────────────────────────────────────────────────

/** Reusable badge metadata registered by a consuming feature. */
export interface AchievementDefinition {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  image_slug: string | null;
  badge_type: string;
  is_repeatable: boolean;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

/** One earned-badge record. Append-only: never updated or deleted. */
export interface UserAchievementInstance {
  id: number;
  user_id: number;
  achievement_id: number;
  earned_at: string;
  context_metadata: string | null;
  idempotency_key: string;
  created_at: string;
}

/** An earned instance joined with its definition metadata, for display/read-back. */
export interface UserAchievementInstanceWithDefinition extends UserAchievementInstance {
  slug: string;
  name: string;
  description: string | null;
  image_slug: string | null;
  badge_type: string;
  is_repeatable: boolean;
}

/** Aggregated view of a user's earned achievements, grouped by definition. */
export interface AchievementSummary {
  achievement_id: number;
  slug: string;
  name: string;
  description: string | null;
  image_slug: string | null;
  badge_type: string;
  is_repeatable: boolean;
  earned_count: number;
  first_earned_at: string;
  last_earned_at: string;
}

/** Result of an awardAchievement() call. */
export interface AwardAchievementResult {
  instanceId: number;
  isNew: boolean;
}

/** Thrown when awardAchievement() is called with a slug that has no matching definition. */
export class AchievementDefinitionNotFoundError extends Error {
  constructor(slug: string) {
    super(`No achievement definition found for slug "${slug}"`);
    this.name = 'AchievementDefinitionNotFoundError';
  }
}

/**
 * Sentinel idempotency_key used to store non-repeatable awards, in place of the
 * caller-supplied key. This makes the `UNIQUE(user_id, achievement_id, idempotency_key)`
 * constraint behave as `UNIQUE(user_id, achievement_id)` for non-repeatable badges,
 * so the database -- not just the pre-insert SELECT -- rejects a second concurrent
 * award even when two racing callers pass different idempotency keys.
 */
const NON_REPEATABLE_IDEMPOTENCY_KEY = '__non_repeatable__';

/** True if `error` (or its `.cause`) looks like a UNIQUE constraint violation. This is a
 * best-effort string match against the underlying D1/SQLite driver's error wording --
 * keep in sync with the driver if that phrasing ever changes. */
function isUniqueConstraintViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const causeMessage = error instanceof Error && error.cause instanceof Error ? error.cause.message : '';
  return message.includes('UNIQUE constraint') || causeMessage.includes('UNIQUE constraint');
}

// ── Row shapes ─────────────────────────────────────────────────────────────

interface AchievementDefinitionRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  image_slug: string | null;
  badge_type: string;
  is_repeatable: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

interface UserAchievementInstanceRow {
  id: number;
  user_id: number;
  achievement_id: number;
  earned_at: string;
  context_metadata: string | null;
  idempotency_key: string;
  created_at: string;
}

interface UserAchievementInstanceWithDefinitionRow extends UserAchievementInstanceRow {
  slug: string;
  name: string;
  description: string | null;
  image_slug: string | null;
  badge_type: string;
  is_repeatable: number;
}

interface AchievementSummaryRow {
  achievement_id: number;
  slug: string;
  name: string;
  description: string | null;
  image_slug: string | null;
  badge_type: string;
  is_repeatable: number;
  earned_count: number;
  first_earned_at: string;
  last_earned_at: string;
}

function toDefinition(row: AchievementDefinitionRow): AchievementDefinition {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    image_slug: row.image_slug,
    badge_type: row.badge_type,
    is_repeatable: row.is_repeatable === 1,
    metadata: row.metadata,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toInstanceWithDefinition(
  row: UserAchievementInstanceWithDefinitionRow,
): UserAchievementInstanceWithDefinition {
  return {
    id: row.id,
    user_id: row.user_id,
    achievement_id: row.achievement_id,
    earned_at: row.earned_at,
    context_metadata: row.context_metadata,
    idempotency_key: row.idempotency_key,
    created_at: row.created_at,
    slug: row.slug,
    name: row.name,
    description: row.description,
    image_slug: row.image_slug,
    badge_type: row.badge_type,
    is_repeatable: row.is_repeatable === 1,
  };
}

function toSummary(row: AchievementSummaryRow): AchievementSummary {
  return {
    achievement_id: row.achievement_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    image_slug: row.image_slug,
    badge_type: row.badge_type,
    is_repeatable: row.is_repeatable === 1,
    earned_count: row.earned_count,
    first_earned_at: row.first_earned_at,
    last_earned_at: row.last_earned_at,
  };
}

// ── Domain service ─────────────────────────────────────────────────────────

/** Fetch an achievement definition by its slug. Returns null if not found. */
export async function getAchievementDefinitionBySlug(
  db: DbClient,
  slug: string,
): Promise<AchievementDefinition | null> {
  const row = await db.read.prepare(
    `SELECT id, slug, name, description, image_slug, badge_type, is_repeatable, metadata, created_at, updated_at
     FROM achievement_definitions
     WHERE slug = ?`,
  ).bind(slug).first<AchievementDefinitionRow>();

  return row ? toDefinition(row) : null;
}

/**
 * Award an achievement to a user, idempotently.
 *
 * - Resolves `achievementSlug` to a definition; throws `AchievementDefinitionNotFoundError`
 *   if no definition exists for that slug.
 * - For non-repeatable definitions, the caller-supplied idempotency key is ignored for
 *   storage purposes and replaced with a fixed sentinel (`NON_REPEATABLE_IDEMPOTENCY_KEY`).
 *   This means the `UNIQUE(user_id, achievement_id, idempotency_key)` constraint alone
 *   is enough to block a second award, even when two concurrent requests race each
 *   other using different caller-supplied keys -- there is no window where the
 *   pre-insert SELECT can be fooled by mismatched keys.
 * - For repeatable definitions, the caller-supplied idempotency key is stored as-is;
 *   the same constraint guards against duplicate awards for the same logical event.
 * - Never mutates or deletes an existing row.
 */
export async function awardAchievement(
  db: DbClient,
  userId: number,
  achievementSlug: string,
  idempotencyKey: string,
  contextMetadata?: string | null,
): Promise<AwardAchievementResult> {
  const definition = await getAchievementDefinitionBySlug(db, achievementSlug);
  if (!definition) {
    throw new AchievementDefinitionNotFoundError(achievementSlug);
  }

  const storageKey = definition.is_repeatable ? idempotencyKey : NON_REPEATABLE_IDEMPOTENCY_KEY;

  const existing = await db.read.prepare(
    `SELECT id FROM user_achievement_instances
     WHERE user_id = ? AND achievement_id = ? AND idempotency_key = ?
     LIMIT 1`,
  ).bind(userId, definition.id, storageKey).first<{ id: number }>();

  if (existing) {
    return { instanceId: existing.id, isNew: false };
  }

  try {
    const result = await db.write.prepare(
      `INSERT INTO user_achievement_instances (user_id, achievement_id, context_metadata, idempotency_key)
       VALUES (?, ?, ?, ?)`,
    ).bind(userId, definition.id, contextMetadata ?? null, storageKey).run();

    return { instanceId: result.meta.last_row_id as number, isNew: true };
  } catch (error: unknown) {
    // Concurrent duplicate award request raced us — read back the row that won.
    if (isUniqueConstraintViolation(error)) {
      const existing = await db.read.prepare(
        `SELECT id FROM user_achievement_instances
         WHERE user_id = ? AND achievement_id = ? AND idempotency_key = ?
         LIMIT 1`,
      ).bind(userId, definition.id, storageKey).first<{ id: number }>();

      if (existing) {
        return { instanceId: existing.id, isNew: false };
      }
    }
    throw error;
  }
}

/** Fetch all earned instances for a user, joined with their definition metadata. */
export async function getUserAchievements(
  db: DbClient,
  userId: number,
): Promise<UserAchievementInstanceWithDefinition[]> {
  const { results } = await db.read.prepare(
    `SELECT
       uai.id, uai.user_id, uai.achievement_id, uai.earned_at, uai.context_metadata,
       uai.idempotency_key, uai.created_at,
       ad.slug, ad.name, ad.description, ad.image_slug, ad.badge_type, ad.is_repeatable
     FROM user_achievement_instances uai
     JOIN achievement_definitions ad ON ad.id = uai.achievement_id
     WHERE uai.user_id = ?
     ORDER BY uai.earned_at ASC, uai.id ASC`,
  ).bind(userId).all<UserAchievementInstanceWithDefinitionRow>();

  return (results || []).map(toInstanceWithDefinition);
}

/**
 * Return a user's earned achievements grouped by definition, with an
 * `earned_count` derived by aggregation (never a mutable counter).
 */
export async function getUserAchievementSummary(
  db: DbClient,
  userId: number,
): Promise<AchievementSummary[]> {
  const { results } = await db.read.prepare(
    `SELECT
       ad.id AS achievement_id, ad.slug, ad.name, ad.description, ad.image_slug,
       ad.badge_type, ad.is_repeatable,
       COUNT(uai.id) AS earned_count,
       MIN(uai.earned_at) AS first_earned_at,
       MAX(uai.earned_at) AS last_earned_at
     FROM user_achievement_instances uai
     JOIN achievement_definitions ad ON ad.id = uai.achievement_id
     WHERE uai.user_id = ?
     GROUP BY ad.id
     ORDER BY MAX(uai.earned_at) DESC`,
  ).bind(userId).all<AchievementSummaryRow>();

  return (results || []).map(toSummary);
}
