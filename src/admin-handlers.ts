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

/**
 * Handle GET /api/admin/dashboard — returns live system statistics.
 * Requires admin authentication (enforced by the route guard in index.ts).
 */
export async function handleAdminDashboard(_request: Request, env: { DB: D1Database }): Promise<Response> {
  try {
    // Run all four stat queries in parallel for best performance
    const [usersResult, distanceResult, partiesResult, goalsResult] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE email_verified = 1').first<{ count: number }>(),
      env.DB.prepare('SELECT COALESCE(SUM(distance), 0) as total FROM progress').first<{ total: number }>(),
      env.DB.prepare(
        `SELECT COUNT(DISTINCT p.id) as count
         FROM parties p
         INNER JOIN party_members pm ON pm.party_id = p.id
         WHERE pm.is_active = 1`
      ).first<{ count: number }>(),
      env.DB.prepare('SELECT COUNT(*) as count FROM goals').first<{ count: number }>(),
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
 * Handle GET /api/admin/goals — returns a paginated, searchable, sortable list of goals.
 * Requires admin authentication (enforced by the route guard in index.ts).
 *
 * Query parameters:
 *   - page (default 1)
 *   - pageSize (default 25, max 100)
 *   - search (optional, filters title LIKE %term%)
 *   - order ('asc' | 'desc', default 'asc' — by distance)
 */
export async function handleAdminGoalsList(request: Request, env: { DB: D1Database }): Promise<Response> {
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
      const whereClause = ' WHERE title LIKE ? ESCAPE \'\\\'';
      countSql += whereClause;
      dataSql += whereClause;
      // Escape LIKE wildcards in user input to prevent unintended pattern matching
      const escapedSearch = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      countBindings.push(`%${escapedSearch}%`);
      dataBindings.push(`%${escapedSearch}%`);
    }

    dataSql += ` ORDER BY distance ${order} LIMIT ? OFFSET ?`;
    dataBindings.push(pageSize);

    // Get total count first to clamp page
    const countResult = countBindings.length > 0
      ? await env.DB.prepare(countSql).bind(...countBindings).first<{ total: number }>()
      : await env.DB.prepare(countSql).first<{ total: number }>();

    const total = countResult?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // Clamp page to valid range so clients never see "Page 999 of 8"
    const page = Math.min(rawPage, totalPages);
    const offset = (page - 1) * pageSize;
    dataBindings.push(offset);

    const dataResult = await env.DB.prepare(dataSql).bind(...dataBindings).all();

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
 * Log an admin action to the admin_audit_log table.
 * This is append-only — entries are never deleted by the application.
 *
 * Designed for fire-and-forget usage: callers should NOT await this function
 * in the request path. In Cloudflare Workers, use `ctx.waitUntil(logAdminAction(...))`
 * to ensure the log write completes after the response is sent.
 * The function never throws — errors are logged to console.
 */
export async function logAdminAction(env: { DB: D1Database }, params: AdminActionParams): Promise<void> {
  const { adminUserId, action, targetType, targetId, details, ipAddress, success } = params;

  try {
    await env.DB.prepare(
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
