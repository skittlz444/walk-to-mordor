import type { DbClient } from './db';
import { generatePasswordResetToken, getPasswordResetExpiry } from './auth-utils';
import { sendPasswordResetEmail } from './email-utils';
import {
  escapeLikeSearch,
  logAdminAction,
} from './admin-shared';

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
    const emailResult = await sendPasswordResetEmail({ RESEND_API_KEY: resendApiKey }, user.email, user.username, token, origin);

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
