import type { PushMessage as WebPushMessage, PushSubscription as WebPushSubscription, VapidKeys } from '@block65/webcrypto-web-push';
import type { DbClient } from './db';

export interface PushPayload {
  [key: string]: string | undefined;
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushDeliveryEnv {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

export interface PushDeliveryResult {
  ok: boolean;
  status: number;
  deleted: boolean;
  error?: string;
}

export interface PushSendSummary {
  attempted: number;
  delivered: number;
  cleanedUp: number;
  skipped: boolean;
}

interface UserNotificationPreferenceRow {
  notifications_enabled: number;
}

interface StoredPushSubscriptionRow {
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
}

type PushRequestBuilder = (
  endpoint: string,
  keys: PushSubscriptionKeys,
  payload: PushPayload,
  env: PushDeliveryEnv,
) => Promise<RequestInit>;

type PushNotificationSender = (
  db: DbClient,
  endpoint: string,
  keys: PushSubscriptionKeys,
  payload: PushPayload,
  env: PushDeliveryEnv,
) => Promise<PushDeliveryResult>;

function getVapidKeys(env: PushDeliveryEnv): VapidKeys {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    throw new Error('Web push is not configured');
  }

  return {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
}

async function buildPushRequest(
  endpoint: string,
  keys: PushSubscriptionKeys,
  payload: PushPayload,
  env: PushDeliveryEnv,
): Promise<RequestInit> {
  const vapid = getVapidKeys(env);
  const { buildPushPayload } = await import('@block65/webcrypto-web-push');

  const message: WebPushMessage<PushPayload> = {
    data: payload,
    options: {
      ttl: 86400,
      urgency: 'normal',
    },
  };

  const subscription: WebPushSubscription = {
    endpoint,
    expirationTime: null,
    keys: {
      auth: keys.auth,
      p256dh: keys.p256dh,
    },
  };

  return buildPushPayload(message, subscription, vapid);
}

async function markSubscriptionUsed(db: DbClient, endpoint: string): Promise<void> {
  await db.write.prepare(
    'UPDATE push_subscriptions SET last_used_at = CURRENT_TIMESTAMP WHERE endpoint = ?'
  ).bind(endpoint).run();
}

export async function cleanupExpiredSubscription(db: DbClient, endpoint: string): Promise<void> {
  await db.write.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
}

export async function sendPushNotification(
  db: DbClient,
  endpoint: string,
  keys: PushSubscriptionKeys,
  payload: PushPayload,
  env: PushDeliveryEnv,
  requestBuilder: PushRequestBuilder = buildPushRequest,
): Promise<PushDeliveryResult> {
  let requestInit: RequestInit;

  try {
    requestInit = await requestBuilder(endpoint, keys, payload, env);
  } catch (error: unknown) {
    return {
      ok: false,
      status: 0,
      deleted: false,
      error: error instanceof Error ? error.message : 'Failed to build push request',
    };
  }

  try {
    const response = await fetch(endpoint, requestInit);

    if (response.status === 404 || response.status === 410) {
      await cleanupExpiredSubscription(db, endpoint);
      return { ok: false, status: response.status, deleted: true };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        deleted: false,
        error: `Push service returned ${response.status}`,
      };
    }

    await markSubscriptionUsed(db, endpoint);
    return { ok: true, status: response.status, deleted: false };
  } catch (error: unknown) {
    return {
      ok: false,
      status: 0,
      deleted: false,
      error: error instanceof Error ? error.message : 'Push send failed',
    };
  }
}

export async function sendPushToUser(
  db: DbClient,
  userId: number,
  payload: PushPayload,
  env: PushDeliveryEnv,
  sendNotification: PushNotificationSender = sendPushNotification,
): Promise<PushSendSummary> {
  const settings = await db.read.prepare(
    'SELECT notifications_enabled FROM users WHERE id = ?'
  ).bind(userId).first<UserNotificationPreferenceRow>();

  if (!settings || settings.notifications_enabled !== 1) {
    return {
      attempted: 0,
      delivered: 0,
      cleanedUp: 0,
      skipped: true,
    };
  }

  const { results } = await db.read.prepare(
    'SELECT endpoint, keys_p256dh, keys_auth FROM push_subscriptions WHERE user_id = ?'
  ).bind(userId).all<StoredPushSubscriptionRow>();

  let delivered = 0;
  let cleanedUp = 0;

  for (const subscription of results) {
    const result = await sendNotification(
      db,
      subscription.endpoint,
      {
        p256dh: subscription.keys_p256dh,
        auth: subscription.keys_auth,
      },
      payload,
      env,
    );

    if (result.ok) {
      delivered += 1;
    }

    if (result.deleted) {
      cleanedUp += 1;
    }
  }

  return {
    attempted: results.length,
    delivered,
    cleanedUp,
    skipped: false,
  };
}