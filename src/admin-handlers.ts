import { generatePasswordResetToken, getPasswordResetExpiry } from './auth-utils';
import type { DbClient } from './db';
import { sendPasswordResetEmail } from './email-utils';
import { isValidDateFormat } from './validators';

// Admin API handlers

/**
 * A single goal row returned by the admin goals list API.
 */
export interface AdminGoalRow {
  id: number;
  title: string;
  distance: number;
  description: string | null;
  special: string | null;
  image_id: string | null;
  has_image: boolean;
}

/**
 * Paginated response returned by GET /api/admin/goals.
 */
export interface AdminGoalsListResponse {
  goals: AdminGoalRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Dashboard statistics returned by the admin dashboard API.
 */
export interface DashboardStats {
  totalUsers: number;
  totalDistanceKm: number;
  activeParties: number;
  totalGoals: number;
}

/**
 * Parameters for logging an admin action to the audit log.
 */
export interface AdminActionParams {
  adminUserId: number;
  action: string;
  targetType?: string;
  targetId?: number;
  details?: string;
  ipAddress?: string;
  success: boolean;
}

export interface AdminUserRow {
  id: number;
  username: string;
  email: string;
  email_verified: boolean;
  is_admin: boolean;
  total_distance_km: number;
  last_active_date: string | null;
  fellowship_names: string[];
}

export interface AdminUsersListResponse {
  users: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminMetricsSummary {
  totalGroupDistanceKm: number;
  activeWalkers: number;
  milestonesUnlocked: number;
}

export interface AdminLeaderboardRow {
  id: number;
  username: string;
  email: string;
  distance_km: number;
}

export interface AdminLeaderboardResponse {
  rows: AdminLeaderboardRow[];
  start: string | null;
  end: string | null;
  maxDistanceKm: number;
}

export interface AdminTimelinePoint {
  date: string;
  distance_km: number;
}

export interface AdminTimelineResponse {
  points: AdminTimelinePoint[];
  maxDistanceKm: number;
}

function escapeLikeSearch(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function getIsoDateOffset(daysAgo: number): string {
  const now = new Date();
  const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  utcDate.setUTCDate(utcDate.getUTCDate() - daysAgo);
  return utcDate.toISOString().slice(0, 10);
}

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
export async function handleAdminUsersList(request: Request, db: DbClient): Promise<Response> {
  try {
    const url = new URL(request.url);
    const rawPage = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '25', 10) || 25));
    const search = url.searchParams.get('search')?.trim() ?? '';

    let whereClause = '';
    const searchBindings: string[] = [];

    if (search) {
      const escapedSearch = `%${escapeLikeSearch(search)}%`;
      whereClause = ` WHERE (u.username LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\' OR membership.fellowship_names LIKE ? ESCAPE '\\')`;
      searchBindings.push(escapedSearch, escapedSearch, escapedSearch);
    }

    const membershipJoinSql = `
      LEFT JOIN (
        SELECT
          pm.user_id,
          JSON_GROUP_ARRAY(p.name) as fellowship_names
        FROM party_members pm
        INNER JOIN parties p ON p.id = pm.party_id
        WHERE pm.status = 'active' AND p.dissolved_at IS NULL
        GROUP BY pm.user_id
      ) membership ON membership.user_id = u.id`;

    const countSql = search
      ? `SELECT COUNT(*) as total FROM users u${membershipJoinSql}${whereClause}`
      : `SELECT COUNT(*) as total FROM users u${whereClause}`;
    const countResult = searchBindings.length > 0
      ? await db.read.prepare(countSql).bind(...searchBindings).first<{ total: number }>()
      : await db.read.prepare(countSql).first<{ total: number }>();

    const total = countResult?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(rawPage, totalPages);
    const offset = (page - 1) * pageSize;

    const dataSql = `
      SELECT
        u.id,
        u.username,
        u.email,
        u.email_verified,
        u.is_admin,
        COALESCE(progress_stats.total_distance_km, 0) as total_distance_km,
        progress_stats.last_active_date as last_active_date,
        membership.fellowship_names as fellowship_names
      FROM users u
      LEFT JOIN (
        SELECT
          user_id,
          COALESCE(SUM(distance), 0) as total_distance_km,
          MAX(date) as last_active_date
        FROM progress
        GROUP BY user_id
      ) progress_stats ON progress_stats.user_id = u.id
      LEFT JOIN (
        SELECT
          pm.user_id,
          JSON_GROUP_ARRAY(p.name) as fellowship_names
        FROM party_members pm
        INNER JOIN parties p ON p.id = pm.party_id
        WHERE pm.status = 'active' AND p.dissolved_at IS NULL
        GROUP BY pm.user_id
      ) membership ON membership.user_id = u.id
      ${whereClause}
      ORDER BY u.created_at DESC, u.id DESC
      LIMIT ? OFFSET ?`;

    const dataBindings: Array<string | number> = [...searchBindings, pageSize, offset];
    const result = await db.read.prepare(dataSql).bind(...dataBindings).all();
    const users: AdminUserRow[] = (result.results as Array<{
      id: number;
      username: string;
      email: string;
      email_verified: number;
      is_admin: number;
      total_distance_km: number | null;
      last_active_date: string | null;
      fellowship_names: string | null;
    }>).map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      email_verified: row.email_verified === 1,
      is_admin: row.is_admin === 1,
      total_distance_km: Number(((row.total_distance_km ?? 0)).toFixed(1)),
      last_active_date: row.last_active_date,
      fellowship_names: row.fellowship_names ? JSON.parse(row.fellowship_names) as string[] : [],
    }));

    const response: AdminUsersListResponse = {
      users,
      total,
      page,
      pageSize,
      totalPages,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Database error fetching admin users list:', error);
    return new Response(JSON.stringify({ error: 'Internal server error while fetching users' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle PUT /api/admin/users/:id/verify — marks a user's email as verified.
 */
export async function handleAdminUserVerify(
  request: Request,
  db: DbClient,
  userId: number,
  adminUserId: number,
): Promise<Response> {
  try {
    const existing = await db.read.prepare(
      'SELECT id, username, email_verified FROM users WHERE id = ?'
    ).bind(userId).first<{ id: number; username: string; email_verified: number }>();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await db.write.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').bind(userId).run();

    await logAdminAction(db, {
      adminUserId,
      action: 'verify_user_email',
      targetType: 'user',
      targetId: userId,
      details: JSON.stringify({
        username: existing.username,
        previous_email_verified: existing.email_verified === 1,
        new_email_verified: true,
      }),
      ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
      success: true,
    });

    return new Response(JSON.stringify({ success: true, email_verified: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error verifying admin user email:', error);
    return new Response(JSON.stringify({ error: 'Internal server error while verifying email' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle PUT /api/admin/users/:id/reset — sends the password reset email directly.
 */
export async function handleAdminUserResetPassword(
  request: Request,
  db: DbClient,
  userId: number,
  adminUserId: number,
  resendApiKey?: string,
): Promise<Response> {
  try {
    const user = await db.read.prepare(
      'SELECT id, username, email FROM users WHERE id = ?'
    ).bind(userId).first<{ id: number; username: string; email: string }>();

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = generatePasswordResetToken();
    const expiresAt = getPasswordResetExpiry();

    await db.write.prepare(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(userId, token, expiresAt).run();

    const origin = new URL(request.url).origin;
    const emailResult = await sendPasswordResetEmail({ RESEND_API_KEY: resendApiKey } as Env, user.email, user.username, token, origin);

    if (!emailResult.success) {
      await db.write.prepare('DELETE FROM password_reset_tokens WHERE token = ?').bind(token).run();

      await logAdminAction(db, {
        adminUserId,
        action: 'trigger_password_reset',
        targetType: 'user',
        targetId: userId,
        details: JSON.stringify({ username: user.username, email: user.email, error: emailResult.error ?? 'unknown' }),
        ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
        success: false,
      });

      return new Response(JSON.stringify({ error: 'Failed to send password reset email' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await logAdminAction(db, {
      adminUserId,
      action: 'trigger_password_reset',
      targetType: 'user',
      targetId: userId,
      details: JSON.stringify({ username: user.username, email: user.email }),
      ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
      success: true,
    });

    return new Response(JSON.stringify({ success: true, message: 'Password reset email sent' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error triggering admin password reset:', error);
    return new Response(JSON.stringify({ error: 'Internal server error while sending password reset' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle PUT /api/admin/users/:id/admin — toggles admin privileges.
 */
export async function handleAdminUserToggleAdmin(
  request: Request,
  db: DbClient,
  userId: number,
  adminUserId: number,
): Promise<Response> {
  try {
    const existing = await db.read.prepare(
      'SELECT id, username, is_admin FROM users WHERE id = ?'
    ).bind(userId).first<{ id: number; username: string; is_admin: number }>();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (userId === adminUserId && existing.is_admin === 1) {
      return new Response(JSON.stringify({ error: 'You cannot remove your own admin access' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const nextValue = existing.is_admin === 1 ? 0 : 1;
    await db.write.prepare('UPDATE users SET is_admin = ? WHERE id = ?').bind(nextValue, userId).run();

    await logAdminAction(db, {
      adminUserId,
      action: 'toggle_admin_access',
      targetType: 'user',
      targetId: userId,
      details: JSON.stringify({
        username: existing.username,
        previous_is_admin: existing.is_admin === 1,
        new_is_admin: nextValue === 1,
      }),
      ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
      success: true,
    });

    return new Response(JSON.stringify({ success: true, is_admin: nextValue === 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error toggling admin access:', error);
    return new Response(JSON.stringify({ error: 'Internal server error while updating admin access' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle DELETE /api/admin/users/:id — hard deletes a user account after confirmation.
 */
export async function handleAdminUserDelete(
  request: Request,
  db: DbClient,
  userId: number,
  body: unknown,
  adminUserId: number,
): Promise<Response> {
  try {
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = body as Record<string, unknown>;
    const confirmation = typeof data.confirmation === 'string' ? data.confirmation.trim() : '';

    const existing = await db.read.prepare(
      'SELECT id, username, email FROM users WHERE id = ?'
    ).bind(userId).first<{ id: number; username: string; email: string }>();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (userId === adminUserId) {
      return new Response(JSON.stringify({ error: 'You cannot delete your own account from admin' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (confirmation !== existing.username) {
      return new Response(JSON.stringify({ error: 'Confirmation text must match the username exactly' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [, deleteResult] = await db.write.batch([
      db.write.prepare(
        `DELETE FROM admin_audit_log
         WHERE admin_user_id = ?`
      ).bind(userId),
      db.write.prepare('DELETE FROM users WHERE id = ?').bind(userId),
    ]);
    const deletedRows = Number((deleteResult.meta as Record<string, unknown>).changes ?? 0);

    if (deletedRows === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await logAdminAction(db, {
      adminUserId,
      action: 'delete_user',
      targetType: 'user',
      targetId: userId,
      details: JSON.stringify({ username: existing.username, email: existing.email }),
      ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
      success: true,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error deleting admin user:', error);
    return new Response(JSON.stringify({ error: 'Internal server error while deleting user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

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
 *   - order ('asc' | 'desc', default 'asc' — by distance)
 */
export async function handleAdminGoalsList(request: Request, db: DbClient): Promise<Response> {
  try {
    const url = new URL(request.url);
    const rawPage = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '25', 10) || 25));
    const search = url.searchParams.get('search')?.trim() ?? '';
    const order = url.searchParams.get('order') === 'desc' ? 'DESC' : 'ASC';

    // Build queries with parameterized bindings
    let countSql = 'SELECT COUNT(*) as total FROM goals';
    let dataSql = 'SELECT id, title, distance, description, special, image_id FROM goals';
    const countBindings: (string | number)[] = [];
    const dataBindings: (string | number)[] = [];

    if (search) {
      // Search across all goal fields: title, description, special, image_id, id, distance
      const searchFields = [
        'title', 'description', 'special', 'image_id', 'CAST(id AS TEXT)', 'CAST(distance AS TEXT)',
      ];
      const whereClause = ` WHERE (${searchFields.map((f) => `${f} LIKE ? ESCAPE '\\'`).join(' OR ')})`;
      countSql += whereClause;
      dataSql += whereClause;
      // Escape LIKE wildcards in user input to prevent unintended pattern matching
      const escapedSearch = escapeLikeSearch(search);
      const searchParam = `%${escapedSearch}%`;
      for (let i = 0; i < searchFields.length; i++) {
        countBindings.push(searchParam);
        dataBindings.push(searchParam);
      }
    }

    dataSql += ` ORDER BY distance ${order} LIMIT ? OFFSET ?`;
    dataBindings.push(pageSize);

    // Get total count first to clamp page
    const countResult = countBindings.length > 0
      ? await db.read.prepare(countSql).bind(...countBindings).first<{ total: number }>()
      : await db.read.prepare(countSql).first<{ total: number }>();

    const total = countResult?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // Clamp page to valid range so clients never see "Page 999 of 8"
    const page = Math.min(rawPage, totalPages);
    const offset = (page - 1) * pageSize;
    dataBindings.push(offset);

    const dataResult = await db.read.prepare(dataSql).bind(...dataBindings).all();

    // Map results with computed has_image field
    const goals: AdminGoalRow[] = (dataResult.results as Array<{
      id: number;
      title: string;
      distance: number;
      description: string | null;
      special: string | null;
      image_id: string | null;
    }>).map((row) => ({
      id: row.id,
      title: row.title,
      distance: row.distance,
      description: row.description,
      special: row.special,
      image_id: row.image_id,
      has_image: row.image_id !== null && row.image_id !== '',
    }));

    const response: AdminGoalsListResponse = {
      goals,
      total,
      page,
      pageSize,
      totalPages,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Database error fetching admin goals list:', error);
    return new Response(JSON.stringify({ error: 'Internal server error while fetching goals' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * A single goal's full data for the admin goal edit API.
 */
export interface AdminGoalDetail {
  id: number;
  title: string;
  distance: number;
  description: string | null;
  special: string | null;
  image_id: string | null;
}

/**
 * Handle GET /api/admin/goals/:id — returns a single goal's full details.
 * Requires admin authentication (enforced by the route guard in index.ts).
 */
export async function handleAdminGoalGet(_request: Request, db: DbClient, goalId: number): Promise<Response> {
  try {
    const goal = await db.read.prepare(
      'SELECT id, title, distance, description, special, image_id FROM goals WHERE id = ?'
    ).bind(goalId).first<AdminGoalDetail>();

    if (!goal) {
      return new Response(JSON.stringify({ error: 'Goal not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(goal), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching goal:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/** Slug validation regex: lowercase alphanumeric segments separated by single hyphens */
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Handle PUT /api/admin/goals/:id — update a goal's editable fields.
 * Requires admin authentication (enforced by the route guard in index.ts).
 * The adminUserId is needed for audit logging.
 */
export async function handleAdminGoalUpdate(
  request: Request,
  db: DbClient,
  goalId: number,
  body: unknown,
  adminUserId: number,
): Promise<Response> {
  try {
    // 1. Validate body shape and fields
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const data = body as Record<string, unknown>;
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const distance = typeof data.distance === 'number' ? data.distance : NaN;
    const description = typeof data.description === 'string' ? data.description.trim() : '';
    const special = typeof data.special === 'string' && data.special.trim() !== '' ? data.special.trim() : null;
    const imageId = typeof data.image_id === 'string' && data.image_id.trim() !== '' ? data.image_id.trim() : null;

    if (!title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (isNaN(distance) || !isFinite(distance) || distance <= 0) {
      return new Response(JSON.stringify({ error: 'Distance must be a positive number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!description) {
      return new Response(JSON.stringify({ error: 'Description is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (imageId && !SLUG_REGEX.test(imageId)) {
      return new Response(JSON.stringify({ error: 'Image ID must be a valid slug format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch existing goal for 404 check and audit diff
    const existing = await db.read.prepare(
      'SELECT id, title, distance, description, special, image_id FROM goals WHERE id = ?'
    ).bind(goalId).first<AdminGoalDetail>();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Goal not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Update
    await db.write.prepare(
      'UPDATE goals SET title=?, distance=?, description=?, special=?, image_id=? WHERE id = ?'
    ).bind(title, distance, description, special, imageId, goalId).run();

    // 4. Audit log — compute changed fields
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    if (existing.title !== title) changes.title = { old: existing.title, new: title };
    if (existing.distance !== distance) changes.distance = { old: existing.distance, new: distance };
    if (existing.description !== description) changes.description = { old: '(truncated)', new: '(truncated)' };
    if (existing.special !== special) changes.special = { old: existing.special, new: special };
    if (existing.image_id !== imageId) changes.image_id = { old: existing.image_id, new: imageId };

    await logAdminAction(db, {
      adminUserId,
      action: 'update_goal',
      targetType: 'goal',
      targetId: goalId,
      details: JSON.stringify(changes),
      ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
      success: true,
    });

    // 5. Return updated goal
    const updated = await db.read.prepare(
      'SELECT id, title, distance, description, special, image_id FROM goals WHERE id = ?'
    ).bind(goalId).first<AdminGoalDetail>();

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error updating goal:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Request body for POST /api/admin/goals.
 */
export interface CreateGoalRequest {
  title: string;
  distance_miles: number;
  description?: string;
  special?: string;
  image_id?: string;
}

/**
 * Handle POST /api/admin/goals — create a new goal.
 * Requires admin authentication (enforced by the route guard in index.ts).
 * The adminUserId is needed for audit logging.
 */
export async function handleAdminGoalCreate(
  request: Request,
  db: DbClient,
  body: unknown,
  adminUserId: number,
): Promise<Response> {
  try {
    // 1. Validate body shape and fields
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const data = body as Record<string, unknown>;
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const rawDistance = data.distance_miles;
    const distanceMiles = typeof rawDistance === 'number' ? rawDistance : NaN;
    const description = typeof data.description === 'string' ? data.description.trim() : '';
    const special = typeof data.special === 'string' && data.special.trim() !== '' ? data.special.trim() : null;
    const imageId = typeof data.image_id === 'string' && data.image_id.trim() !== '' ? data.image_id.trim() : null;

    if (!title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (rawDistance === undefined || rawDistance === null) {
      return new Response(JSON.stringify({ error: 'Distance must be a positive number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (typeof rawDistance !== 'number' || isNaN(distanceMiles)) {
      return new Response(JSON.stringify({ error: 'Invalid distance value' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!isFinite(distanceMiles) || distanceMiles <= 0) {
      return new Response(JSON.stringify({ error: 'Distance must be a positive number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (imageId && !SLUG_REGEX.test(imageId)) {
      return new Response(JSON.stringify({ error: 'Image ID must be a valid slug format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Convert distance: miles → km
    const distanceKm = distanceMiles * 1.60934;

    // 3. Parameterized INSERT
    const insertResult = await db.write.prepare(
      'INSERT INTO goals (distance, title, description, special, image_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(distanceKm, title, description || null, special, imageId).run();

    // D1 returns last_row_id in meta
    const newGoalId = (insertResult.meta as Record<string, unknown>).last_row_id;
    if (typeof newGoalId !== 'number' || !Number.isFinite(newGoalId)) {
      console.error('Failed to retrieve new goal ID from INSERT result');
      return new Response(JSON.stringify({ error: 'Internal server error while creating goal' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Fetch created record
    const createdGoal = await db.read.prepare(
      'SELECT id, title, distance, description, special, image_id FROM goals WHERE id = ?'
    ).bind(newGoalId).first<AdminGoalDetail>();

    if (!createdGoal) {
      console.error('Failed to fetch newly created goal with ID:', newGoalId);
      return new Response(JSON.stringify({ error: 'Internal server error while creating goal' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Audit log
    await logAdminAction(db, {
      adminUserId,
      action: 'create_goal',
      targetType: 'goal',
      targetId: newGoalId,
      details: JSON.stringify({ title, distance_miles: distanceMiles, distance_km: distanceKm }),
      ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
      success: true,
    });

    // 6. Return 201 with created record
    return new Response(JSON.stringify(createdGoal), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error creating goal:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Row shape for goals queried for image cross-referencing.
 */
export interface GoalImageRow {
  id: number;
  title: string;
  image_id: string | null;
}

/**
 * Shape of the build-time image manifest (public/img/image-manifest.json).
 */
export interface ImageManifest {
  generated: string;
  images: string[];
  count: number;
}

/**
 * Response shape for GET /api/admin/images.
 */
export interface ImageInventoryResponse {
  images: Array<{ image_id: string; has_highres: boolean; has_thumb: boolean }>;
  total: number;
  orphaned: string[];
  missing: Array<{ goal_id: number; title: string; image_id: string }>;
}

/**
 * Handle GET /api/admin/images — returns image asset inventory.
 * Cross-references the build-time image manifest against goal image_id assignments.
 * Requires admin authentication (enforced by the route guard in index.ts).
 */
export async function handleAdminImageInventory(request: Request, db: DbClient, assets: Fetcher): Promise<Response> {
  try {
    // 1. Fetch the image manifest via Workers Assets binding
    const manifestUrl = new URL('/img/image-manifest.json', request.url);
    let manifestResponse: Response;
    try {
      manifestResponse = await assets.fetch(new Request(manifestUrl.toString()));
    } catch {
      return new Response(JSON.stringify({ error: 'Image manifest not available — run npm run build:manifest' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!manifestResponse.ok) {
      return new Response(JSON.stringify({ error: 'Image manifest not available — run npm run build:manifest' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let manifest: ImageManifest;
    try {
      manifest = await manifestResponse.json() as ImageManifest;
    } catch {
      return new Response(JSON.stringify({ error: 'Image manifest is malformed — run npm run build:manifest to regenerate' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const manifestSlugs = new Set(manifest.images);

    // 2. Query all goals with non-null image_id
    const goalsResult = await db.read.prepare(
      'SELECT id, title, image_id FROM goals WHERE image_id IS NOT NULL AND image_id != \'\''
    ).all();

    const goalRows = (goalsResult.results ?? []) as Array<{ id: number; title: string; image_id: string | null }>;

    // 3. Cross-reference: build sets for assigned slugs
    const assignedSlugs = new Set<string>();
    for (const row of goalRows) {
      if (row.image_id) {
        assignedSlugs.add(row.image_id);
      }
    }

    // images: goal image_ids that exist in the manifest
    const images: Array<{ image_id: string; has_highres: boolean; has_thumb: boolean }> = [];
    for (const slug of assignedSlugs) {
      if (manifestSlugs.has(slug)) {
        images.push({ image_id: slug, has_highres: true, has_thumb: true });
      }
    }
    images.sort((a, b) => a.image_id.localeCompare(b.image_id));

    // orphaned: manifest slugs not referenced by any goal
    const orphaned = manifest.images.filter(slug => !assignedSlugs.has(slug)).sort();

    // missing: goals whose image_id is not in the manifest
    const missing: Array<{ goal_id: number; title: string; image_id: string }> = [];
    for (const row of goalRows) {
      if (row.image_id && !manifestSlugs.has(row.image_id)) {
        missing.push({ goal_id: row.id, title: row.title, image_id: row.image_id });
      }
    }
    missing.sort((a, b) => a.goal_id - b.goal_id);

    const response: ImageInventoryResponse = {
      images,
      total: manifest.count,
      orphaned,
      missing,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching image inventory:', error);
    return new Response(JSON.stringify({ error: 'Internal server error while fetching image inventory' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Log an admin action to the admin_audit_log table.
 * This is append-only — entries are never deleted by the application.
 *
 * Designed for fire-and-forget usage: callers should NOT await this function
 * in the request path. In Cloudflare Workers, use `ctx.waitUntil(logAdminAction(...))`
 * to ensure the log write completes after the response is sent.
 * The function never throws — errors are logged to console.
 */
export async function logAdminAction(db: DbClient, params: AdminActionParams): Promise<void> {
  const { adminUserId, action, targetType, targetId, details, ipAddress, success } = params;

  try {
    await db.write.prepare(
      `INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id, details, ip_address, success)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      adminUserId,
      action,
      targetType ?? null,
      targetId ?? null,
      details ?? null,
      ipAddress ?? null,
      success ? 1 : 0
    ).run();
  } catch (error: unknown) {
    // Audit logging should not break the request — log the error but don't throw
    console.error('Failed to write admin audit log:', error);
  }
}
