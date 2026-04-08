// Stats API handlers
import { validateSession } from './auth-handlers';
import { createErrorResponse, createSuccessResponse } from './validators';
import type { DbClient } from './db';

/** Row from the 30-day activity pre-requisite check */
interface ActivityCountRow {
  count: number;
}

/** Row from weekly distance summation queries */
interface DistanceSumRow {
  total: number | null;
}

/** Row from the goals table for projection calculation */
interface GoalRow {
  id: number;
  title: string;
  distance: number;
  special: string | null;
}

/** Row from the fellowship contribution query */
interface FellowshipContributionRow {
  party_id: number;
  party_name: string;
  user_week_km: number | null;
  party_week_km: number | null;
}

interface UserCreatedAtRow {
  created_at: string | null;
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  result.setUTCDate(result.getUTCDate() - days);
  return result;
}

/**
 * GET /api/stats/weekly — Weekly stats summary for the Palantír insight component.
 *
 * Returns:
 * - has_activity: whether user has any walks in the past 30 days
 * - no_walks_this_week: true if has_activity but 0 km this week
 * - this_week_km: distance sum for the last 7 days
 * - prev_week_km: distance sum for the 7 days prior to that
 * - pace_trend: 'up' | 'down' | 'same'
 * - pace_change_pct: percentage change (positive = up)
 * - projection: { title, distance, days_away } for the next milestone (major if < 2 weeks, else regular)
 * - fellowships: top 2 fellowship contributions by percentage [ { party_id, party_name, contribution_pct } ]
 */
export async function handleWeeklyStats(
  request: Request,
  db: DbClient,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  try {
    // Dates for time-range calculations (formatted as YYYY-MM-DD for SQLite `date` comparison)
    // Current week includes today plus the previous 6 days; previous week is the 7 days before that.
    const now = new Date();
    const todayStr = formatDate(now);
    const thisWeekStartStr = formatDate(subtractDays(now, 6));
    const prevWeekStartStr = formatDate(subtractDays(now, 13));
    const thirtyDayStartStr = formatDate(subtractDays(now, 29));

    // Subtask 1.1a: Check 30-day activity pre-requisite
    const activityRow = await db.read
      .prepare(
        `SELECT COUNT(*) as count FROM progress WHERE user_id = ? AND date >= ? AND date <= ?`,
      )
      .bind(userId, thirtyDayStartStr, todayStr)
      .first<ActivityCountRow>();

    if (!activityRow || activityRow.count === 0) {
      return createSuccessResponse({ has_activity: false });
    }

    // Subtask 1.1b: This week's distance (last 7 days)
    const thisWeekRow = await db.read
      .prepare(
        `SELECT COALESCE(SUM(distance), 0) as total FROM progress WHERE user_id = ? AND date >= ? AND date <= ?`,
      )
      .bind(userId, thisWeekStartStr, todayStr)
      .first<DistanceSumRow>();
    const thisWeekKm = Number((thisWeekRow?.total ?? 0).toFixed(2));

    // Subtask 1.1c: Previous week's distance (the 7 days before the current week window)
    const prevWeekRow = await db.read
      .prepare(
        `SELECT COALESCE(SUM(distance), 0) as total FROM progress WHERE user_id = ? AND date >= ? AND date < ?`,
      )
      .bind(userId, prevWeekStartStr, thisWeekStartStr)
      .first<DistanceSumRow>();
    const prevWeekKm = Number((prevWeekRow?.total ?? 0).toFixed(2));

    // Subtask 1.2a: Pace trend
    let paceTrend: 'up' | 'down' | 'same' = 'same';
    let paceChangePct: number | null = null;
    if (prevWeekKm === 0) {
      paceTrend = thisWeekKm > 0 ? 'up' : 'same';
    } else {
      const change = thisWeekKm - prevWeekKm;
      paceChangePct = Math.round((change / prevWeekKm) * 100);
      if (paceChangePct > 0) paceTrend = 'up';
      else if (paceChangePct < 0) paceTrend = 'down';
    }

    // Subtask 1.2b: Total distance for projection base
    const totalDistRow = await db.read
      .prepare(`SELECT COALESCE(SUM(distance), 0) as total FROM progress WHERE user_id = ?`)
      .bind(userId)
      .first<DistanceSumRow>();
    const totalKm = Number((totalDistRow?.total ?? 0).toFixed(2));

    // Subtask 1.2c: Projection — evaluate goals ahead of user
    const { results: allGoals } = await db.read
      .prepare(
        `SELECT id, title, distance, special FROM goals WHERE distance > ? ORDER BY distance ASC`,
      )
      .bind(totalKm)
      .all<GoalRow>();

    // Pace is based solely on the last 7 days; if no walks this week there is no projection.
    const weeklyPace = thisWeekKm; // km/week
    let projection: { title: string; distance: number; km_to_next: number; days_away: number } | null = null;

    if (allGoals.length > 0 && weeklyPace > 0) {
      const nextMajor = allGoals.find((g) => g.special !== null);
      const nextRegular = allGoals[0]; // first goal ahead regardless

      if (nextMajor) {
        const kmToMajor = nextMajor.distance - totalKm;
        const daysToMajor = Math.round((kmToMajor / weeklyPace) * 7);
        if (daysToMajor <= 14) {
          projection = { title: nextMajor.title, distance: nextMajor.distance, km_to_next: Number(kmToMajor.toFixed(1)), days_away: daysToMajor };
        }
      }

      if (!projection && nextRegular) {
        const kmToNext = nextRegular.distance - totalKm;
        const daysToNext = Math.round((kmToNext / weeklyPace) * 7);
        projection = { title: nextRegular.title, distance: nextRegular.distance, km_to_next: Number(kmToNext.toFixed(1)), days_away: daysToNext };
      }
    }

    // Subtask 1.3: Fellowship contribution (top 2 by percentage)
    const { results: fellowshipRows } = await db.read
      .prepare(
        `SELECT
           p.id as party_id,
           p.name as party_name,
           COALESCE(SUM(CASE WHEN ppl.logged_by_user_id = ? THEN ppl.distance ELSE 0 END), 0) as user_week_km,
           COALESCE(SUM(ppl.distance), 0) as party_week_km
         FROM party_members pm
         JOIN parties p ON pm.party_id = p.id
         LEFT JOIN party_progress_log ppl ON ppl.party_id = p.id AND ppl.date >= ? AND ppl.date <= ?
         WHERE pm.user_id = ? AND pm.status = 'active' AND p.dissolved_at IS NULL
         GROUP BY p.id, p.name`,
      )
      .bind(userId, thisWeekStartStr, todayStr, userId)
      .all<FellowshipContributionRow>();

    const fellowships = fellowshipRows
      .map((row) => {
        const userKm = Number(row.user_week_km ?? 0);
        const partyKm = Number(row.party_week_km ?? 0);
        const pct = partyKm > 0 ? Math.round((userKm / partyKm) * 100) : 0;
        return { party_id: row.party_id, party_name: row.party_name, contribution_pct: pct };
      })
      .sort((a, b) => b.contribution_pct - a.contribution_pct)
      .slice(0, 2);

    return createSuccessResponse({
      has_activity: true,
      no_walks_this_week: thisWeekKm === 0,
      this_week_km: thisWeekKm,
      prev_week_km: prevWeekKm,
      pace_trend: paceTrend,
      pace_change_pct: paceChangePct,
      projection,
      fellowships,
    });
  } catch (error: unknown) {
    console.error('Database error during weekly stats retrieval:', error);
    return createErrorResponse('Internal server error while retrieving weekly stats', 500);
  }
}

/** Row returned from the heatmap progress query */
interface HeatmapDayRow {
  date: string;
  distance: number;
}

/**
 * GET /api/stats/heatmap — Walk heatmap data and streak information.
 *
 * Returns:
 * - days: array of { date, distance } for the past 365 days
 * - currentStreak: number of consecutive days (up to today) with ≥ 1 walk
 * - longestStreak: longest-ever consecutive-day streak
 */
export async function handleHeatmap(
  request: Request,
  db: DbClient,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  try {
    const now = new Date();
    const todayStr = formatDate(now);
    const yearAgoStr = formatDate(subtractDays(now, 364));

    const { results: rows } = await db.read
      .prepare(
        `SELECT date, distance FROM progress WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC`,
      )
      .bind(userId, yearAgoStr, todayStr)
      .all<HeatmapDayRow>();

    const days = rows.map((r) => ({ date: r.date, distance: Number(r.distance) }));

    // Longest streak and uncapped current streak both need all-time walked dates.
    const { results: allRows } = await db.read
      .prepare(
        `SELECT date FROM progress WHERE user_id = ? AND distance > 0 ORDER BY date ASC`,
      )
      .bind(userId)
      .all<{ date: string }>();

    const walkedDates = new Set(allRows.map((row) => row.date));

    let currentStreak = 0;
    const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    while (walkedDates.has(formatDate(cursor))) {
      currentStreak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    let longestStreak = 0;
    let streak = 0;
    let prevDate: Date | null = null;

    for (const row of allRows) {
      const d = new Date(row.date + 'T00:00:00Z');
      if (prevDate) {
        const diff = (d.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          streak++;
        } else {
          streak = 1;
        }
      } else {
        streak = 1;
      }
      if (streak > longestStreak) {
        longestStreak = streak;
      }
      prevDate = d;
    }

    const userRow = await db.read
      .prepare(`SELECT date(created_at) as created_at FROM users WHERE id = ?`)
      .bind(userId)
      .first<UserCreatedAtRow>();

    const startDate = userRow?.created_at && userRow.created_at > yearAgoStr
      ? userRow.created_at
      : yearAgoStr;

    return createSuccessResponse({ days, currentStreak, longestStreak, startDate });
  } catch (error: unknown) {
    console.error('Database error during heatmap stats retrieval:', error);
    return createErrorResponse('Internal server error while retrieving heatmap stats', 500);
  }
}

/** Format a Date as YYYY-MM-DD in UTC for stable SQLite date comparisons */
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
