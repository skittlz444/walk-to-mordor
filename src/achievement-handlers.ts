// Achievements API handlers.
import type { DbClient } from './db';
import { getUserAchievementSummary } from './achievement-utils';
import { resolveBadgePresentation } from './badge-presentation';
import { createErrorResponse, createSuccessResponse } from './validators';

/** D1 row used to confirm an accepted friendship. */
interface FriendshipRow {
  id: number;
}

/** Matches a plain positive decimal integer, e.g. "42" (but not "0", "1.5", "12abc"). */
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;

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
