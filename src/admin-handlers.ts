// Admin API handlers

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
