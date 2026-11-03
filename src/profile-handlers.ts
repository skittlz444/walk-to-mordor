// Profile overview API handlers
import { validateSession } from "./auth-handlers";
import { calculateUserStorylineDistance } from "./goals-handlers";
import { listStorylineGoals } from "./storyline-utils";
import { createErrorResponse, createSuccessResponse } from "./validators";
import type { DbClient } from "./db";

/** D1 result row for the caller's own user data */
interface ProfileOverviewUserRow {
  username: string;
  avatar_id: string | null;
  created_at: string;
}

/** D1 result row for the caller's active fellowships */
interface ProfileOverviewFellowshipRow {
  id: number;
  name: string;
}

/**
 * Convert a SQLite `DATETIME` value (UTC, `YYYY-MM-DD HH:MM:SS`) to an ISO 8601
 * UTC string. Only values that already carry an explicit timezone (`Z` or a
 * numeric offset) pass through unchanged; naive values — space-separated SQLite
 * form and `T`-separated form without a zone — are normalized as UTC so they are
 * never parsed as local time. The raw SQLite format is never returned to clients.
 */
function toIsoUtc(value: string): string {
  const trimmed = value.trim();
  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const isoish = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const normalized = hasExplicitZone ? isoish : `${isoish}Z`;
  return new Date(normalized).toISOString();
}

/**
 * GET /api/profile/overview — the read-only profile view page's stats in one response.
 *
 * Requires authentication. Returns { username, avatarId, totalDistance, memberSince,
 * currentGoalTitle, activeStoryline, fellowships: [{ id, name }] }.
 *
 * `totalDistance` is storyline-adjusted (the value the journey page shows), and
 * `currentGoalTitle` is the next unreached goal of the active storyline (the last
 * goal's title once every goal is reached, `null` when the storyline has no goals).
 */
export async function handleGetProfileOverview(
  request: Request,
  db: DbClient,
  userId: number,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }

  try {
    const { totalDistance, activeStoryline } = await calculateUserStorylineDistance(db, userId);

    const user = await db.read.prepare(
      'SELECT username, avatar_id, created_at FROM users WHERE id = ?'
    ).bind(userId).first<ProfileOverviewUserRow>();

    if (!user) {
      return createErrorResponse('User not found', 404);
    }

    // listStorylineGoals() orders by distance, so the first unreached goal is the next one.
    const goals = await listStorylineGoals(db, activeStoryline.id);
    const currentGoalTitle = goals.length === 0
      ? null
      : goals.find((goal) => goal.distance > totalDistance)?.title ?? goals[goals.length - 1].title;

    // Active, non-dissolved fellowships — the same query as the friend profile,
    // without the is_shared flag (meaningless relative to yourself).
    const { results: fellowships } = await db.read.prepare(`
      SELECT p.id, p.name
      FROM party_members pm
      JOIN parties p ON p.id = pm.party_id
      WHERE pm.user_id = ?
        AND pm.status = 'active'
        AND p.dissolved_at IS NULL
      ORDER BY p.name COLLATE NOCASE ASC
    `).bind(userId).all<ProfileOverviewFellowshipRow>();

    return createSuccessResponse({
      username: user.username,
      avatarId: user.avatar_id,
      totalDistance,
      memberSince: toIsoUtc(user.created_at),
      currentGoalTitle,
      activeStoryline,
      fellowships: fellowships.map((fellowship) => ({ id: fellowship.id, name: fellowship.name })),
    });
  } catch (error) {
    console.error('Error fetching profile overview:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
