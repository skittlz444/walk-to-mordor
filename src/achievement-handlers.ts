// Achievements API handlers.
import type { DbClient } from './db';
import {
  acknowledgeAchievementInstances,
  listPendingAchievements,
} from './achievement-acknowledgements';
import { getUserAchievementSummary } from './achievement-utils';
import { resolveBadgePresentation } from './badge-presentation';
import { createErrorResponse, createSuccessResponse } from './validators';

/** D1 row used to confirm an accepted friendship. */
interface FriendshipRow {
  id: number;
}

/** Matches a plain positive decimal integer, e.g. "42" (but not "0", "1.5", "12abc"). */
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;

/** Upper bound on one acknowledge request; the UI sends one ID at a time. */
const MAX_ACKNOWLEDGE_INSTANCES = 100;

/**
 * GET /api/achievements — return the caller's achievement summary, or a
 * friend's summary when `?userId=` names an accepted friend.
 *
 * - Absent or self `userId` resolves to the caller with no friendship check.
 * - Invalid `userId` returns 400.
 * - Non-friends and unknown users both return 404 (existence is not leaked).
 * - Every entry is mapped through `resolveBadgePresentation`; the raw
 *   definition `metadata` string is never returned.
 */
export async function handleGetAchievements(
  request: Request,
  db: DbClient,
  currentUserId: number,
): Promise<Response> {
  const url = new URL(request.url);
  const rawUserId = url.searchParams.get('userId');

  let targetUserId = currentUserId;
  if (rawUserId !== null) {
    if (!POSITIVE_INTEGER_PATTERN.test(rawUserId)) {
      return createErrorResponse('Invalid userId', 400);
    }
    const parsedUserId = Number(rawUserId);
    if (!Number.isSafeInteger(parsedUserId) || parsedUserId <= 0) {
      return createErrorResponse('Invalid userId', 400);
    }
    targetUserId = parsedUserId;
  }

  try {
    if (targetUserId !== currentUserId) {
      const friendship = await db.read.prepare(`
        SELECT id FROM friendships
        WHERE status = 'accepted'
          AND ((requester_id = ? AND addressee_id = ?)
            OR (requester_id = ? AND addressee_id = ?))
      `).bind(currentUserId, targetUserId, targetUserId, currentUserId).first<FriendshipRow>();

      if (!friendship) {
        return createErrorResponse('User not found or not a friend', 404);
      }
    }

    const summary = await getUserAchievementSummary(db, targetUserId);

    const achievements = summary.map((entry) => ({
      achievement_id: entry.achievement_id,
      slug: entry.slug,
      name: entry.name,
      description: entry.description,
      image_slug: entry.image_slug,
      badge_type: entry.badge_type,
      is_repeatable: entry.is_repeatable,
      earned_count: entry.earned_count,
      first_earned_at: entry.first_earned_at,
      last_earned_at: entry.last_earned_at,
      presentation: resolveBadgePresentation(entry.metadata, entry.earned_count),
    }));

    return createSuccessResponse({ achievements });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/**
 * GET /api/achievements/pending — return the caller's earned-but-unacknowledged
 * awards, oldest-earned first.
 *
 * Presentation is resolved with each instance's awarding ordinal (not the
 * definition's current `earned_count`) so queued instances that crossed a rank
 * threshold show the artwork of the rank they earned.
 */
export async function handleGetPendingAchievements(
  request: Request,
  db: DbClient,
  currentUserId: number,
): Promise<Response> {
  try {
    const rows = await listPendingAchievements(db, currentUserId);

    const pending = rows.map((entry) => ({
      instance_id: entry.instance_id,
      earned_at: entry.earned_at,
      earned_count: entry.earned_count,
      slug: entry.slug,
      name: entry.name,
      description: entry.description,
      image_slug: entry.image_slug,
      badge_type: entry.badge_type,
      is_repeatable: entry.is_repeatable,
      presentation: resolveBadgePresentation(entry.metadata, entry.awarding_ordinal),
    }));

    return createSuccessResponse({ pending });
  } catch (error) {
    console.error('Error fetching pending achievements:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * POST /api/achievements/acknowledge — acknowledge a list of the caller's earned
 * instances. Idempotent: foreign, stale, and already-acknowledged IDs are
 * ignored, and `acknowledged` counts only newly inserted rows.
 */
export async function handleAcknowledgeAchievements(
  request: Request,
  db: DbClient,
  currentUserId: number,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse('Invalid request body', 400);
  }

  if (!isPlainObject(body)) {
    return createErrorResponse('Invalid request body', 400);
  }

  const instanceIds = body.instance_ids;
  if (
    !Array.isArray(instanceIds)
    || instanceIds.length === 0
    || instanceIds.length > MAX_ACKNOWLEDGE_INSTANCES
  ) {
    return createErrorResponse(
      `instance_ids must contain between 1 and ${MAX_ACKNOWLEDGE_INSTANCES} positive integers`,
      400,
    );
  }
  if (!instanceIds.every(isPositiveSafeInteger)) {
    return createErrorResponse(
      `instance_ids must contain between 1 and ${MAX_ACKNOWLEDGE_INSTANCES} positive integers`,
      400,
    );
  }

  try {
    const { acknowledged } = await acknowledgeAchievementInstances(
      db,
      currentUserId,
      instanceIds,
    );
    return createSuccessResponse({ acknowledged });
  } catch (error) {
    console.error('Error acknowledging achievements:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
