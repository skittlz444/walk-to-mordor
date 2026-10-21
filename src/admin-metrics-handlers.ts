import type { DbClient } from './db';
import { isValidDateFormat } from './validators';
import type {
  DashboardStats,
  AdminMetricsSummary,
  AdminLeaderboardRow,
  AdminLeaderboardResponse,
  AdminTimelinePoint,
  AdminTimelineResponse,
} from './admin-shared';
import {
  getIsoDateOffset,
} from './admin-shared';

/**
 * Handle GET /api/admin/dashboard — returns live system statistics.
 * Requires admin authentication (enforced by the route guard in index.ts).
 */
export async function handleAdminDashboard(_request: Request, db: DbClient): Promise<Response> {
  try {
    // Run all four stat queries in parallel for best performance
    const [usersResult, distanceResult, partiesResult, goalsResult] = await Promise.all([
      db.read.prepare('SELECT COUNT(*) as count FROM users WHERE email_verified = 1').first<{ count: number }>(),
      db.read.prepare('SELECT COALESCE(SUM(distance), 0) as total FROM progress').first<{ total: number }>(),
      db.read.prepare(
        `SELECT COUNT(DISTINCT p.id) as count
         FROM parties p
         INNER JOIN party_members pm ON pm.party_id = p.id
         WHERE pm.status = 'active'`
      ).first<{ count: number }>(),
      db.read.prepare('SELECT COUNT(*) as count FROM goals').first<{ count: number }>(),
    ]);

    const stats: DashboardStats = {
      totalUsers: usersResult?.count ?? 0,
      totalDistanceKm: Number((distanceResult?.total ?? 0).toFixed(1)),
      activeParties: partiesResult?.count ?? 0,
      totalGoals: goalsResult?.count ?? 0,
    };

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Database error fetching admin dashboard stats:', error);
    return new Response(JSON.stringify({ error: 'Internal server error while fetching dashboard stats' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle GET /api/admin/users — returns a paginated support view of user accounts.
 * Requires admin authentication (enforced by the route guard in index.ts).
 */

/**
 * Handle GET /api/admin/metrics — returns the community summary cards.
 */
export async function handleAdminMetricsSummary(_request: Request, db: DbClient): Promise<Response> {
  try {
    const [distanceResult, activeWalkersResult, goalsResult, userTotalsResult] = await Promise.all([
      db.read.prepare('SELECT COALESCE(SUM(distance), 0) as total_group_distance_km FROM progress').first<{ total_group_distance_km: number }>(),
      db.read.prepare(
        "SELECT COUNT(DISTINCT user_id) as active_walkers FROM progress WHERE date >= date('now', '-6 days')"
      ).first<{ active_walkers: number }>(),
      db.read.prepare('SELECT distance FROM goals ORDER BY distance ASC').all(),
      db.read.prepare('SELECT user_id, COALESCE(SUM(distance), 0) as total_distance_km FROM progress GROUP BY user_id').all(),
    ]);

    const goalDistances = (goalsResult.results as Array<{ distance: number }>).map((row) => row.distance);
    const userTotals = userTotalsResult.results as Array<{ user_id: number; total_distance_km: number }>;
    const milestonesUnlocked = userTotals.reduce((sum, row) => (
      sum + goalDistances.filter((goalDistance) => goalDistance <= row.total_distance_km).length
    ), 0);

    const response: AdminMetricsSummary = {
      totalGroupDistanceKm: Number(((distanceResult?.total_group_distance_km ?? 0)).toFixed(1)),
      activeWalkers: activeWalkersResult?.active_walkers ?? 0,
      milestonesUnlocked,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching admin metrics summary:', error);
    return new Response(JSON.stringify({ error: 'Internal server error while fetching metrics summary' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle GET /api/admin/metrics/leaderboard — returns distance totals for the chosen date range.
 */

/**
 * Handle GET /api/admin/metrics/leaderboard — returns distance totals for the chosen date range.
 */
export async function handleAdminMetricsLeaderboard(request: Request, db: DbClient): Promise<Response> {
  try {
    const url = new URL(request.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    if ((start && !end) || (!start && end)) {
      return new Response(JSON.stringify({ error: 'Both start and end dates are required for custom filters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if ((start && !isValidDateFormat(start)) || (end && !isValidDateFormat(end))) {
      return new Response(JSON.stringify({ error: 'Dates must use YYYY-MM-DD format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (start && end && start > end) {
      return new Response(JSON.stringify({ error: 'Start date must be on or before end date' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const joinDateFilters = start && end ? ' AND p.date >= ? AND p.date <= ?' : '';
    const bindings: string[] = start && end ? [start, end] : [];
    const result = await db.read.prepare(
      `SELECT
         u.id,
         u.username,
         u.email,
         COALESCE(SUM(p.distance), 0) as distance_km
       FROM users u
       LEFT JOIN progress p ON u.id = p.user_id${joinDateFilters}
       GROUP BY u.id, u.username, u.email
       ORDER BY distance_km DESC, u.username COLLATE NOCASE ASC`
    ).bind(...bindings).all();

    const rows: AdminLeaderboardRow[] = (result.results as Array<{
      id: number;
      username: string;
      email: string;
      distance_km: number | null;
    }>).map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      distance_km: Number(((row.distance_km ?? 0)).toFixed(1)),
    }));

    const response: AdminLeaderboardResponse = {
      rows,
      start,
      end,
      maxDistanceKm: rows[0]?.distance_km ?? 0,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching admin metrics leaderboard:', error);
    return new Response(JSON.stringify({ error: 'Internal server error while fetching leaderboard' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle GET /api/admin/metrics/timeline — returns the last 30 days of group activity.
 */

/**
 * Handle GET /api/admin/metrics/timeline — returns the last 30 days of group activity.
 */
export async function handleAdminMetricsTimeline(_request: Request, db: DbClient): Promise<Response> {
  try {
    const start = getIsoDateOffset(29);
    const end = getIsoDateOffset(0);
    const result = await db.read.prepare(
      `SELECT date, COALESCE(SUM(distance), 0) as distance_km
       FROM progress
       WHERE date >= ? AND date <= ?
       GROUP BY date
       ORDER BY date ASC`
    ).bind(start, end).all();

    const totalsByDate = new Map<string, number>();
    for (const row of result.results as Array<{ date: string; distance_km: number | null }>) {
      totalsByDate.set(row.date, Number(((row.distance_km ?? 0)).toFixed(1)));
    }

    const points: AdminTimelinePoint[] = [];
    for (let daysAgo = 29; daysAgo >= 0; daysAgo -= 1) {
      const date = getIsoDateOffset(daysAgo);
      points.push({
        date,
        distance_km: totalsByDate.get(date) ?? 0,
      });
    }

    const maxDistanceKm = points.reduce((currentMax, point) => Math.max(currentMax, point.distance_km), 0);
    const response: AdminTimelineResponse = { points, maxDistanceKm };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching admin metrics timeline:', error);
    return new Response(JSON.stringify({ error: 'Internal server error while fetching timeline' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle GET /api/admin/goals — returns a paginated, searchable, sortable list of goals.
 * Requires admin authentication (enforced by the route guard in index.ts).
 *
 * Query parameters:
 *   - page (default 1)
 *   - pageSize (default 25, max 100)
 *   - search (optional, performs a text search over goal fields)
 *   - imageFilter ('missing' optional, limits goals to rows without image_id)
 *   - order ('asc' | 'desc', default 'asc' — by distance)
 */
