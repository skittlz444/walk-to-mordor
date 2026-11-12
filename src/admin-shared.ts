import type { DbClient } from './db';

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

export function escapeLikeSearch(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** JSON response shared by the admin handler modules. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Client IP recorded on audit rows; Cloudflare sets `CF-Connecting-IP`. */
export function auditIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

/** Best-effort UNIQUE detection; native driver errors may cross vm realms. */
export function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('UNIQUE');
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

/** Slug validation regex: lowercase alphanumeric segments separated by single hyphens */
export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
