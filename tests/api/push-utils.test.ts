import {
  cleanupExpiredSubscription,
  sendPushNotification,
  sendPushToUser,
  type PushDeliveryEnv,
} from '../../src/push-utils';
import type { DbClient } from '../../src/db';

function createChainableMock(overrides?: {
  first?: unknown;
  all?: { results: unknown[] };
  run?: unknown;
}) {
  const first = jest.fn().mockResolvedValue(overrides?.first ?? null);
  const all = jest.fn().mockResolvedValue(overrides?.all ?? { results: [] });
  const run = jest.fn().mockResolvedValue(overrides?.run ?? { meta: { changes: 1 } });
  const bind = jest.fn(() => ({ first, all, run }));
  return { bind, first, all, run };
}

describe('push-utils', () => {
  let mockReadDb: { prepare: jest.Mock };
  let mockWriteDb: { prepare: jest.Mock };
  let mockDb: DbClient;

  const env: PushDeliveryEnv = {
    VAPID_PUBLIC_KEY: 'public-key',
    VAPID_PRIVATE_KEY: 'private-key',
    VAPID_SUBJECT: 'mailto:info@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockReadDb = { prepare: jest.fn() };
    mockWriteDb = { prepare: jest.fn() };
    mockDb = {
      read: mockReadDb as unknown as DbClient['read'],
      write: mockWriteDb as unknown as DbClient['write'],
    };
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  it('deletes expired subscriptions by endpoint', async () => {
    const deletion = createChainableMock();
    mockWriteDb.prepare.mockReturnValueOnce(deletion);

    await cleanupExpiredSubscription(mockDb, 'https://push.example/sub-1');

    expect(deletion.bind).toHaveBeenCalledWith('https://push.example/sub-1');
  });

  it('cleans up a subscription when the push service returns 410', async () => {
    const deletion = createChainableMock();
    mockWriteDb.prepare.mockReturnValueOnce(deletion);
    (global.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 410 }));

    const result = await sendPushNotification(
      mockDb,
      'https://push.example/sub-2',
      { auth: 'auth-key', p256dh: 'p256dh-key' },
      { title: 'Walk', body: 'Take a walk' },
      env,
      jest.fn().mockResolvedValue({ method: 'POST', headers: {}, body: new Uint8Array() }),
    );

    expect(result).toEqual({ ok: false, status: 410, deleted: true });
    expect(deletion.bind).toHaveBeenCalledWith('https://push.example/sub-2');
  });

  it('skips sending when notifications are globally disabled', async () => {
    const settings = createChainableMock({ first: { notifications_enabled: 0 } });
    const sender = jest.fn();
    mockReadDb.prepare.mockReturnValueOnce(settings);

    const summary = await sendPushToUser(
      mockDb,
      7,
      { title: 'Walk', body: 'Take a walk' },
      env,
      sender,
    );

    expect(summary).toEqual({
      attempted: 0,
      delivered: 0,
      cleanedUp: 0,
      skipped: true,
    });
    expect(sender).not.toHaveBeenCalled();
  });

  it('counts delivered and cleaned-up subscriptions across a user subscription set', async () => {
    const settings = createChainableMock({ first: { notifications_enabled: 1 } });
    const subscriptions = createChainableMock({
      all: {
        results: [
          { endpoint: 'https://push.example/sub-a', keys_p256dh: 'key-a', keys_auth: 'auth-a' },
          { endpoint: 'https://push.example/sub-b', keys_p256dh: 'key-b', keys_auth: 'auth-b' },
        ],
      },
    });
    const sender = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 201, deleted: false })
      .mockResolvedValueOnce({ ok: false, status: 410, deleted: true });

    mockReadDb.prepare
      .mockReturnValueOnce(settings)
      .mockReturnValueOnce(subscriptions);

    const summary = await sendPushToUser(
      mockDb,
      7,
      { title: 'Walk', body: 'Keep moving' },
      env,
      sender,
    );

    expect(summary).toEqual({
      attempted: 2,
      delivered: 1,
      cleanedUp: 1,
      skipped: false,
    });
  });
});