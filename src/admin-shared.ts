import type { DbClient } from './db';

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

export interface AdminStorylineSummary {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  path_key: string;
  sort_order: number;
  is_active: boolean;
  admin_only: boolean;
  goal_count: number;
  min_distance: number | null;
  max_distance: number | null;
}

export interface AdminStorylineGoalRow {
  storyline_goal_id: number;
  goal_id: number;
  title: string;
  distance: number;
  sort_order: number;
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

export function escapeLikeSearch(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function getIsoDateOffset(daysAgo: number): string {
  const now = new Date();
  const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  utcDate.setUTCDate(utcDate.getUTCDate() - daysAgo);
  return utcDate.toISOString().slice(0, 10);
}

/**
 * Handle GET /api/admin/dashboard — returns live system statistics.
 * Requires admin authentication (enforced by the route guard in index.ts).
 */

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
