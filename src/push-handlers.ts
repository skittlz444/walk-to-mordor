import { validateSession } from './auth-handlers';
import type { DbClient } from './db';
import { createErrorResponse, createSuccessResponse } from './validators';

interface PushStatusRow {
  notifications_enabled: number;
  one_more_mile_enabled: number;
  inactivity_nudge_enabled: number;
  subscription_count: number;
}

interface VapidKeyEnv {
  VAPID_PUBLIC_KEY?: string;
}

interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidHttpsEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function parsePushSubscription(body: Record<string, unknown> | undefined): PushSubscriptionInput | null {
  if (!body || !isNonEmptyString(body.endpoint) || !isRecord(body.keys)) {
    return null;
  }

  const { p256dh, auth } = body.keys;
  if (!isNonEmptyString(p256dh) || !isNonEmptyString(auth)) {
    return null;
  }

  return {
    endpoint: body.endpoint,
    keys: {
      p256dh,
      auth,
    },
  };
}

export async function handlePushSubscribe(
  request: Request,
  db: DbClient,
  body?: Record<string, unknown>,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }

  const subscription = parsePushSubscription(body);
  if (!subscription) {
    return createErrorResponse('Invalid push subscription payload', 400);
  }

  if (!isValidHttpsEndpoint(subscription.endpoint)) {
    return createErrorResponse('Push subscription endpoint must be a valid HTTPS URL', 400);
  }

  try {
    const result = await db.write.prepare(
      `INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth, last_used_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(endpoint) DO UPDATE SET
         keys_p256dh = excluded.keys_p256dh,
         keys_auth = excluded.keys_auth,
         last_used_at = CURRENT_TIMESTAMP
       WHERE push_subscriptions.user_id = excluded.user_id`
    ).bind(
      sessionValidation.userId,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
    ).run();

    if ((result.meta?.changes ?? 0) === 0) {
      return createErrorResponse('Push subscription endpoint is already registered to another user', 409);
    }

    return createSuccessResponse({ status: 'success' });
  } catch (error: unknown) {
    console.error('Database error during push subscription upsert:', error);
    return createErrorResponse('Internal server error during push subscription update', 500);
  }
}

export async function handlePushUnsubscribe(
  request: Request,
  db: DbClient,
  body?: Record<string, unknown>,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }

  const endpoint = body?.endpoint;
  if (!isNonEmptyString(endpoint) || !isValidHttpsEndpoint(endpoint)) {
    return createErrorResponse('Push subscription endpoint must be a valid HTTPS URL', 400);
  }

  try {
    await db.write.prepare(
      'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?'
    ).bind(sessionValidation.userId, endpoint).run();

    return createSuccessResponse({ status: 'success' });
  } catch (error: unknown) {
    console.error('Database error during push subscription delete:', error);
    return createErrorResponse('Internal server error during push subscription delete', 500);
  }
}

export async function handlePushStatus(
  request: Request,
  db: DbClient,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }

  try {
    const row = await db.read.prepare(
      `SELECT
         COALESCE(u.notifications_enabled, 1) AS notifications_enabled,
         COALESCE(u.one_more_mile_enabled, 1) AS one_more_mile_enabled,
         COALESCE(u.inactivity_nudge_enabled, 1) AS inactivity_nudge_enabled,
         COUNT(ps.id) AS subscription_count
       FROM users u
       LEFT JOIN push_subscriptions ps ON ps.user_id = u.id
       WHERE u.id = ?
       GROUP BY u.id, u.notifications_enabled, u.one_more_mile_enabled, u.inactivity_nudge_enabled`
    ).bind(sessionValidation.userId).first<PushStatusRow>();

    const subscriptionCount = row?.subscription_count ?? 0;
    const notificationsEnabled = (row?.notifications_enabled ?? 1) === 1;
    const oneMoreMileEnabled = (row?.one_more_mile_enabled ?? 1) === 1;
    const inactivityNudgeEnabled = (row?.inactivity_nudge_enabled ?? 1) === 1;

    return createSuccessResponse({
      status: 'success',
      data: {
        hasSubscriptions: subscriptionCount > 0,
        subscriptionCount,
        notificationsEnabled,
        oneMoreMileEnabled,
        inactivityNudgeEnabled,
      },
    });
  } catch (error: unknown) {
    console.error('Database error during push status lookup:', error);
    return createErrorResponse('Internal server error during push status lookup', 500);
  }
}

export async function handlePushSettings(
  request: Request,
  db: DbClient,
  body?: Record<string, unknown>,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }

  if (body?.notificationsEnabled !== undefined && typeof body.notificationsEnabled !== 'boolean') {
    return createErrorResponse('notificationsEnabled must be a boolean', 400);
  }

  if (body?.oneMoreMileEnabled !== undefined && typeof body.oneMoreMileEnabled !== 'boolean') {
    return createErrorResponse('oneMoreMileEnabled must be a boolean', 400);
  }

  if (body?.inactivityNudgeEnabled !== undefined && typeof body.inactivityNudgeEnabled !== 'boolean') {
    return createErrorResponse('inactivityNudgeEnabled must be a boolean', 400);
  }

  const hasNotificationsEnabled = typeof body?.notificationsEnabled === 'boolean';
  const hasOneMoreMileEnabled = typeof body?.oneMoreMileEnabled === 'boolean';
  const hasInactivityNudgeEnabled = typeof body?.inactivityNudgeEnabled === 'boolean';

  if (!hasNotificationsEnabled && !hasOneMoreMileEnabled && !hasInactivityNudgeEnabled) {
    return createErrorResponse('At least one setting must be provided: notificationsEnabled, oneMoreMileEnabled, or inactivityNudgeEnabled', 400);
  }

  try {
    const updates: string[] = [];
    const values: (number | string)[] = [];

    if (hasNotificationsEnabled) {
      updates.push('notifications_enabled = ?');
      values.push(body!.notificationsEnabled ? 1 : 0);
    }

    if (hasOneMoreMileEnabled) {
      updates.push('one_more_mile_enabled = ?');
      values.push(body!.oneMoreMileEnabled ? 1 : 0);
    }

    if (hasInactivityNudgeEnabled) {
      updates.push('inactivity_nudge_enabled = ?');
      values.push(body!.inactivityNudgeEnabled ? 1 : 0);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(sessionValidation.userId);

    await db.write.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    return createSuccessResponse({ status: 'success' });
  } catch (error: unknown) {
    console.error('Database error during push settings update:', error);
    return createErrorResponse('Internal server error during push settings update', 500);
  }
}

export function handleVapidKey(env: VapidKeyEnv): Response {
  if (!env.VAPID_PUBLIC_KEY) {
    return createErrorResponse('Push notifications are not configured', 503);
  }

  return createSuccessResponse({
    status: 'success',
    data: {
      vapidPublicKey: env.VAPID_PUBLIC_KEY,
    },
  });
}