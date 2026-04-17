import { createDbClient } from './db';
import type { DbClient } from './db';
import { getOneMoreMileMessage } from './push-messages';
import { sendPushNotification, cleanupExpiredSubscription } from './push-utils';
import type { PushDeliveryEnv, PushPayload } from './push-utils';

interface EligibleUserRow {
  user_id: number;
  total_distance: number;
  next_goal_id: number;
  next_goal_distance: number;
  next_goal_title: string;
  remaining_km: number;
}

interface UserSubscriptionRow {
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
}

const ELIGIBLE_USER_QUERY = `
WITH user_distances AS (
  SELECT
    u.id AS user_id,
    COALESCE(SUM(p.distance), 0) AS total_distance
  FROM users u
  LEFT JOIN progress p ON p.user_id = u.id
  WHERE u.notifications_enabled = 1
    AND u.one_more_mile_enabled = 1
  GROUP BY u.id
),
user_next_goals AS (
  SELECT
    ud.user_id,
    ud.total_distance,
    g.id AS next_goal_id,
    g.distance AS next_goal_distance,
    g.title AS next_goal_title,
    ROW_NUMBER() OVER (PARTITION BY ud.user_id ORDER BY g.distance ASC) AS rn
  FROM user_distances ud
  INNER JOIN goals g ON g.distance > ud.total_distance
),
close_users AS (
  SELECT
    user_id,
    total_distance,
    next_goal_id,
    next_goal_distance,
    next_goal_title,
    (next_goal_distance - total_distance) AS remaining_km
  FROM user_next_goals
  WHERE rn = 1
    AND (next_goal_distance - total_distance) <= 2.0
)
SELECT
  cu.user_id,
  cu.total_distance,
  cu.next_goal_id,
  cu.next_goal_distance,
  cu.next_goal_title,
  cu.remaining_km
FROM close_users cu
WHERE cu.user_id > ?
AND EXISTS (
  SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = cu.user_id
)
AND NOT EXISTS (
  SELECT 1 FROM progress p
  WHERE p.user_id = cu.user_id
    AND p.date >= date('now', '-3 days')
)
AND NOT EXISTS (
  SELECT 1 FROM one_more_mile_sent oms
  WHERE oms.user_id = cu.user_id
    AND oms.goal_id = cu.next_goal_id
)
ORDER BY cu.user_id
LIMIT ?
`;

const BATCH_SIZE = 100;

interface SendResult {
  delivered: number;
  deleted: number;
}

async function sendToUserSubscriptions(
  db: DbClient,
  userId: number,
  payload: PushPayload,
  env: PushDeliveryEnv,
): Promise<SendResult> {
  const { results: subscriptions } = await db.read.prepare(
    'SELECT endpoint, keys_p256dh, keys_auth FROM push_subscriptions WHERE user_id = ?',
  ).bind(userId).all<UserSubscriptionRow>();

  let delivered = 0;
  let deleted = 0;

  for (const sub of subscriptions) {
    const result = await sendPushNotification(
      db,
      sub.endpoint,
      { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
      payload,
      env,
    );

    if (result.ok) {
      delivered += 1;
    }
    if (result.deleted) {
      await cleanupExpiredSubscription(db, sub.endpoint);
      deleted += 1;
    }
  }

  return { delivered, deleted };
}

export async function handleOneMoreMileCron(env: Env): Promise<void> {
  const db = createDbClient(env.DB);
  let cursor = 0;

  for (;;) {
    const { results: eligibleUsers } = await db.read.prepare(ELIGIBLE_USER_QUERY)
      .bind(cursor, BATCH_SIZE)
      .all<EligibleUserRow>();

    if (eligibleUsers.length === 0) {
      break;
    }

    for (const user of eligibleUsers) {
      try {
        // Claim atomically to prevent duplicate sends across concurrent runs
        const claim = await db.write.prepare(
          'INSERT OR IGNORE INTO one_more_mile_sent (user_id, goal_id) VALUES (?, ?)',
        ).bind(user.user_id, user.next_goal_id).run();

        if ((claim.meta?.changes ?? 0) === 0) {
          continue;
        }

        const message = getOneMoreMileMessage(user.next_goal_title, user.remaining_km);
        const payload: PushPayload = {
          title: message.title,
          body: message.body,
          url: '/',
          icon: '/img/icons/icon-192x192.png',
        };

        const { delivered, deleted } = await sendToUserSubscriptions(db, user.user_id, payload, env);

        // Roll back claim when nothing was delivered so user can be retried next cron run.
        // Keep claim when a subscription was cleaned up (410/404) per AC #8.
        if (delivered === 0 && deleted === 0) {
          await db.write.prepare(
            'DELETE FROM one_more_mile_sent WHERE user_id = ? AND goal_id = ?',
          ).bind(user.user_id, user.next_goal_id).run();
        }
      } catch (error: unknown) {
        try {
          await db.write.prepare(
            'DELETE FROM one_more_mile_sent WHERE user_id = ? AND goal_id = ?',
          ).bind(user.user_id, user.next_goal_id).run();
        } catch { /* best-effort rollback */ }
        console.error(`One More Mile: failed for user ${user.user_id}:`, error);
      }
    }

    // Advance cursor to the last user_id in this batch
    cursor = eligibleUsers[eligibleUsers.length - 1].user_id;

    if (eligibleUsers.length < BATCH_SIZE) {
      break;
    }
  }
}
