// Stats API handlers
import { validateSession, validateAdminSession } from './auth-handlers';
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

    // Longest streak and uncapped current streak both need all-time walked dates,
    // but future-dated rows must be ignored so streaks cannot be inflated.
    const { results: allRows } = await db.read
      .prepare(
        `SELECT date FROM progress WHERE user_id = ? AND distance > 0 AND date <= ? ORDER BY date ASC`,
      )
      .bind(userId, todayStr)
      .all<{ date: string }>();

    const walkedRows = allRows.filter((row) => row.date <= todayStr);
    const walkedDates = new Set(walkedRows.map((row) => row.date));

    let currentStreak = 0;
    const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    while (walkedDates.has(formatDate(cursor))) {
      currentStreak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    let longestStreak = 0;
    let streak = 0;
    let prevDate: Date | null = null;

    for (const row of walkedRows) {
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

// ──────────────────────────────────────────────────────────
// Wrapped (Year-End Review) types & handler
// ──────────────────────────────────────────────────────────

/** Row for monthly distance aggregation */
interface MonthDistanceRow {
  month: string;
  total: number;
}

/** Row for the first walk date query */
interface FirstWalkRow {
  first_date: string;
}

/** Row for milestones unlocked during the year */
interface MilestoneRow {
  id: number;
  title: string;
  distance: number;
  special: string | null;
  image_id: string | null;
}

/** Row for fellowship year total */
interface FellowshipYearRow {
  party_id: number;
  party_name: string;
  party_year_km: number;
}

/** Threshold above which only special milestones are displayed */
const SPECIAL_MILESTONE_THRESHOLD = 10;

/**
 * GET /api/stats/wrapped?year=YYYY — Year-end review data (admin-only).
 *
 * Returns:
 * - year: the requested calendar year
 * - total_distance_km: total km walked in the year
 * - journey_pct: percentage of total Mordor distance (1797.28 km)
 * - walk_count: total number of walk entries in the year
 * - active_days: number of distinct days with walks
 * - best_streak: longest consecutive-day streak within the year
 * - favorite_month: { month (1-12), name, total_km }
 * - milestones: array of milestones unlocked this year (filtered to special-only when > threshold)
 * - fellowship_highlights: array of { party_name, party_year_km }
 * - first_walk_date: first walk date in the year
 * - narrative: Tolkien-flavored template narrative
 */
export async function handleWrappedStats(
  request: Request,
  db: DbClient,
  allowTestAuth?: string,
): Promise<Response> {
  const adminValidation = await validateAdminSession(request, db, allowTestAuth);
  if (!adminValidation.valid) {
    return adminValidation.error;
  }
  const userId = adminValidation.userId;

  const url = new URL(request.url);
  const yearParam = url.searchParams.get('year');
  if (yearParam !== null && !/^\d{4}$/.test(yearParam)) {
    return createErrorResponse('Invalid year parameter', 400);
  }

  const year = yearParam ? Number(yearParam) : new Date().getUTCFullYear();

  if (isNaN(year) || year < 2000 || year > 2100) {
    return createErrorResponse('Invalid year parameter', 400);
  }

  const yearStr = String(year);

  try {
    // 1. Total distance for the year
    const totalRow = await db.read
      .prepare(
        `SELECT COALESCE(SUM(distance), 0) as total FROM progress WHERE user_id = ? AND strftime('%Y', date) = ?`,
      )
      .bind(userId, yearStr)
      .first<DistanceSumRow>();
    const totalDistanceKm = Number((totalRow?.total ?? 0).toFixed(2));

    const MORDOR_DISTANCE_KM = 1797.28;
    const journeyPct = Number(((totalDistanceKm / MORDOR_DISTANCE_KM) * 100).toFixed(1));

    // 2. Walk count and active days
    const countRow = await db.read
      .prepare(
        `SELECT COUNT(*) as count FROM progress WHERE user_id = ? AND strftime('%Y', date) = ? AND distance > 0`,
      )
      .bind(userId, yearStr)
      .first<ActivityCountRow>();
    const walkCount = countRow?.count ?? 0;

    const activeDaysRow = await db.read
      .prepare(
        `SELECT COUNT(DISTINCT date) as count FROM progress WHERE user_id = ? AND strftime('%Y', date) = ? AND distance > 0`,
      )
      .bind(userId, yearStr)
      .first<ActivityCountRow>();
    const activeDays = activeDaysRow?.count ?? 0;

    // 3. Best streak within the year
    const { results: yearWalks } = await db.read
      .prepare(
        `SELECT DISTINCT date FROM progress WHERE user_id = ? AND strftime('%Y', date) = ? AND distance > 0 ORDER BY date ASC`,
      )
      .bind(userId, yearStr)
      .all<{ date: string }>();

    let bestStreak = 0;
    let streak = 0;
    let prevDate: Date | null = null;
    for (const row of yearWalks) {
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
      if (streak > bestStreak) bestStreak = streak;
      prevDate = d;
    }

    // 4. Favorite month (month with highest total distance)
    const { results: monthRows } = await db.read
      .prepare(
        `SELECT strftime('%m', date) as month, SUM(distance) as total 
         FROM progress WHERE user_id = ? AND strftime('%Y', date) = ? AND distance > 0
         GROUP BY strftime('%m', date) ORDER BY total DESC, month ASC`,
      )
      .bind(userId, yearStr)
      .all<MonthDistanceRow>();

    const monthNames = [
      '', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const favoriteMonth = monthRows.length > 0
      ? {
          month: parseInt(monthRows[0].month, 10),
          name: monthNames[parseInt(monthRows[0].month, 10)],
          total_km: Number(Number(monthRows[0].total).toFixed(2)),
        }
      : null;

    // 5. Milestones unlocked this year
    // A milestone is "unlocked" when the user's cumulative distance (from Jan 1 of year start to a given date)
    // crossed that milestone's distance threshold during this year.
    // We compare: total distance at start of year vs total distance at end of year.
    const startOfYear = `${yearStr}-01-01`;
    const endOfYear = `${yearStr}-12-31`;

    const distBeforeYearRow = await db.read
      .prepare(
        `SELECT COALESCE(SUM(distance), 0) as total FROM progress WHERE user_id = ? AND date < ?`,
      )
      .bind(userId, startOfYear)
      .first<DistanceSumRow>();
    const distBeforeYear = distBeforeYearRow?.total ?? 0;

    const distEndOfYearRow = await db.read
      .prepare(
        `SELECT COALESCE(SUM(distance), 0) as total FROM progress WHERE user_id = ? AND date <= ?`,
      )
      .bind(userId, endOfYear)
      .first<DistanceSumRow>();
    const distEndOfYear = distEndOfYearRow?.total ?? 0;

    const { results: allMilestones } = await db.read
      .prepare(
        `SELECT id, title, distance, special, image_id FROM goals WHERE distance > ? AND distance <= ? ORDER BY distance ASC`,
      )
      .bind(distBeforeYear, distEndOfYear)
      .all<MilestoneRow>();

    // Apply threshold: if > SPECIAL_MILESTONE_THRESHOLD milestones, only show special ones
    const milestones = allMilestones.length > SPECIAL_MILESTONE_THRESHOLD
      ? allMilestones.filter((m) => m.special !== null)
      : allMilestones;

    // 6. Fellowship highlights
    const { results: fellowshipRows } = await db.read
      .prepare(
        `SELECT
           p.id as party_id,
           p.name as party_name,
           COALESCE(SUM(ppl.distance), 0) as party_year_km
         FROM party_members pm
         JOIN parties p ON pm.party_id = p.id
         LEFT JOIN party_progress_log ppl ON ppl.party_id = p.id AND strftime('%Y', ppl.date) = ?
         WHERE pm.user_id = ? AND pm.status = 'active' AND p.dissolved_at IS NULL
         GROUP BY p.id, p.name
         HAVING party_year_km > 0`,
      )
      .bind(yearStr, userId)
      .all<FellowshipYearRow>();

    const fellowshipHighlights = fellowshipRows.map((row) => ({
      party_name: row.party_name,
      party_year_km: Number(Number(row.party_year_km).toFixed(2)),
    }));

    // 7. First walk date in year
    const firstWalkRow = await db.read
      .prepare(
        `SELECT MIN(date) as first_date FROM progress WHERE user_id = ? AND strftime('%Y', date) = ? AND distance > 0`,
      )
      .bind(userId, yearStr)
      .first<FirstWalkRow>();
    const firstWalkDate = firstWalkRow?.first_date ?? null;

    // 8. Build Tolkien-flavored narrative
    const narrative = buildWrappedNarrative({      distBeforeYear,      totalDistanceKm,
      journeyPct,
      walkCount,
      activeDays,
      bestStreak,
      favoriteMonth,
      milestones,
      fellowshipHighlights,
      firstWalkDate,
      year,
    });

    return createSuccessResponse({
      year,
      total_distance_km: totalDistanceKm,
      journey_pct: journeyPct,
      walk_count: walkCount,
      active_days: activeDays,
      best_streak: bestStreak,
      favorite_month: favoriteMonth,
      milestones: milestones.map((m) => ({
        id: m.id,
        title: m.title,
        distance: m.distance,
        special: m.special,
        image_id: m.image_id,
      })),
      fellowship_highlights: fellowshipHighlights,
      first_walk_date: firstWalkDate,
      narrative,
    });
  } catch (error: unknown) {
    console.error('Database error during wrapped stats retrieval:', error);
    return createErrorResponse('Internal server error while retrieving wrapped stats', 500);
  }
}

interface NarrativeInput {
  distBeforeYear: number;
  totalDistanceKm: number;
  journeyPct: number;
  walkCount: number;
  activeDays: number;
  bestStreak: number;
  favoriteMonth: { month: number; name: string; total_km: number } | null;
  milestones: MilestoneRow[];
  fellowshipHighlights: { party_name: string; party_year_km: number }[];
  firstWalkDate: string | null;
  year: number;
}

function buildWrappedNarrative(input: NarrativeInput): string {
  const parts: string[] = [];

  if (input.firstWalkDate) {
    if (input.distBeforeYear > 0) {
      parts.push(
        `Your adventure was already underway as ${input.year} began — ` +
        `${Math.round(input.distBeforeYear)} km behind you before the year even started. ` +
        `You pressed on, undaunted.`,
      );
    } else {
      parts.push(
        `Like Bilbo in the Shire, you took your first step on ${input.firstWalkDate}. ` +
        `And what a journey it has been!`,
      );
    }
  }

  parts.push(
    `In ${input.year}, you walked ${input.totalDistanceKm} km — ` +
    `that's ${input.journeyPct}% of the journey to Mordor!`,
  );

  if (input.walkCount > 0) {
    parts.push(
      `You logged ${input.walkCount} walks across ${input.activeDays} days. ` +
      `Even the smallest step carries great purpose.`,
    );
  }

  if (input.bestStreak > 1) {
    const streakDesc = input.bestStreak >= 90
      ? 'the unbreakable will of Frodo bearing the Ring!'
      : input.bestStreak >= 30
        ? 'the tireless endurance of the Fellowship on a long march.'
        : input.bestStreak >= 14
          ? 'the steady resolve of a Ranger pacing the wild.'
          : input.bestStreak >= 5
            ? 'the hearty determination of a hobbit stepping out their front door.'
            : 'the leisurely pace of a hobbit content to stay in the Shire—and there\'s nothing wrong with that!';

    parts.push(
      `Your best streak was ${input.bestStreak} consecutive days — ${streakDesc}`,
    );
  }

  if (input.favoriteMonth) {
    parts.push(
      `Your strongest month was ${input.favoriteMonth.name}, ` +
      `when you covered ${input.favoriteMonth.total_km} km.`,
    );
  }

  // Focus on special milestones for narrative
  const specialMilestones = input.milestones.filter((m) => m.special !== null);
  if (specialMilestones.length > 0) {
    const milestoneNames = specialMilestones.map((m) => m.title).join(', ');
    parts.push(
      `Along the way, you passed through ${milestoneNames}. Each milestone a memory, each step a victory.`,
    );
  } else if (input.milestones.length > 0) {
    parts.push(
      `You unlocked ${input.milestones.length} milestones this year. Every waypoint marks progress on the road ahead.`,
    );
  }

  if (input.fellowshipHighlights.length > 0) {
    const fellowshipParts = input.fellowshipHighlights
      .map((f) => `${f.party_name} (${f.party_year_km} km)`)
      .join(', ');
    parts.push(
      `Your fellowships walked together: ${fellowshipParts}. ` +
      `The road is easier when shared with friends.`,
    );
  }

  parts.push('The road goes ever on. Here\'s to another year of walking!');

  return parts.join('\n\n');
}

/** Format a Date as YYYY-MM-DD in UTC for stable SQLite date comparisons */
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
