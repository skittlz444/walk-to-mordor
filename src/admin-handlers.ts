// Admin API handlers

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
