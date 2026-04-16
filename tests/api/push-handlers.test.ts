import {
  handlePushSettings,
  handlePushStatus,
  handlePushSubscribe,
  handlePushUnsubscribe,
  handleVapidKey,
} from '../../src/push-handlers';
import { validateSession } from '../../src/auth-handlers';
import type { DbClient } from '../../src/db';

jest.mock('../../src/auth-handlers', () => ({
  validateSession: jest.fn(),
}));

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

describe('Push Handlers', () => {
  let mockReadDb: { prepare: jest.Mock };
  let mockWriteDb: { prepare: jest.Mock };
  let mockDb: DbClient;
  let request: Request;

  beforeEach(() => {
    jest.clearAllMocks();
    (validateSession as jest.Mock).mockResolvedValue({ valid: true, userId: 7 });

    mockReadDb = { prepare: jest.fn() };
    mockWriteDb = { prepare: jest.fn() };
    mockDb = {
      read: mockReadDb as unknown as DbClient['read'],
      write: mockWriteDb as unknown as DbClient['write'],
    };

    request = new Request('https://example.com/api/push/subscribe', {
      headers: { Authorization: 'Bearer test-token' },
    });
  });

  it('returns the auth error for subscribe when the session is invalid', async () => {
    (validateSession as jest.Mock).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const response = await handlePushSubscribe(request, mockDb, {}, 'true');
    expect(response.status).toBe(401);
  });

  it('rejects invalid subscribe payloads', async () => {
    const response = await handlePushSubscribe(request, mockDb, {
      endpoint: 'http://invalid.example/subscription',
      keys: { auth: 'auth' },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid push subscription payload',
    });
  });

  it('inserts a new push subscription when the endpoint is unused', async () => {
    const upsert = createChainableMock({ run: { meta: { changes: 1 } } });
    mockWriteDb.prepare.mockReturnValueOnce(upsert);

    const response = await handlePushSubscribe(request, mockDb, {
      endpoint: 'https://push.example/sub-1',
      keys: { auth: 'auth-key', p256dh: 'p256dh-key' },
    });

    expect(response.status).toBe(200);
    expect(upsert.bind).toHaveBeenCalledWith(
      7,
      'https://push.example/sub-1',
      'p256dh-key',
      'auth-key',
    );
  });

  it('updates an existing push subscription when the same user re-subscribes', async () => {
    const upsert = createChainableMock({ run: { meta: { changes: 1 } } });
    mockWriteDb.prepare.mockReturnValueOnce(upsert);

    const response = await handlePushSubscribe(request, mockDb, {
      endpoint: 'https://push.example/sub-2',
      keys: { auth: 'new-auth', p256dh: 'new-p256dh' },
    });

    expect(response.status).toBe(200);
    expect(upsert.bind).toHaveBeenCalledWith(
      7,
      'https://push.example/sub-2',
      'new-p256dh',
      'new-auth',
    );
  });

  it('rejects an existing endpoint that belongs to another user', async () => {
    const upsert = createChainableMock({ run: { meta: { changes: 0 } } });
    mockWriteDb.prepare.mockReturnValueOnce(upsert);

    const response = await handlePushSubscribe(request, mockDb, {
      endpoint: 'https://push.example/sub-3',
      keys: { auth: 'auth-key', p256dh: 'p256dh-key' },
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Push subscription endpoint is already registered to another user',
    });
  });

  it('handles concurrent same-user subscribe races without returning 500', async () => {
    const upsert = createChainableMock({ run: { meta: { changes: 1 } } });
    mockWriteDb.prepare.mockReturnValueOnce(upsert);

    const response = await handlePushSubscribe(request, mockDb, {
      endpoint: 'https://push.example/sub-race',
      keys: { auth: 'auth-key', p256dh: 'p256dh-key' },
    });

    expect(response.status).toBe(200);
    expect(upsert.run).toHaveBeenCalled();
  });

  it('deletes the current user subscription on unsubscribe', async () => {
    const deletion = createChainableMock();
    mockWriteDb.prepare.mockReturnValueOnce(deletion);

    const response = await handlePushUnsubscribe(request, mockDb, {
      endpoint: 'https://push.example/sub-4',
    });

    expect(response.status).toBe(200);
    expect(deletion.bind).toHaveBeenCalledWith(7, 'https://push.example/sub-4');
  });

  it('returns subscription count and notificationsEnabled status', async () => {
    const statusQuery = createChainableMock({
      first: { notifications_enabled: 0, one_more_mile_enabled: 1, subscription_count: 2 },
    });
    mockReadDb.prepare.mockReturnValueOnce(statusQuery);

    const response = await handlePushStatus(request, mockDb);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'success',
      data: {
        hasSubscriptions: true,
        subscriptionCount: 2,
        notificationsEnabled: false,
        oneMoreMileEnabled: true,
      },
    });
  });

  it('updates notificationsEnabled for the user', async () => {
    const update = createChainableMock();
    mockWriteDb.prepare.mockReturnValueOnce(update);

    const response = await handlePushSettings(request, mockDb, {
      notificationsEnabled: false,
    });

    expect(response.status).toBe(200);
    expect(update.bind).toHaveBeenCalledWith(0, 7);
  });

  it('updates oneMoreMileEnabled for the user', async () => {
    const update = createChainableMock();
    mockWriteDb.prepare.mockReturnValueOnce(update);

    const response = await handlePushSettings(request, mockDb, {
      oneMoreMileEnabled: false,
    });

    expect(response.status).toBe(200);
    expect(update.bind).toHaveBeenCalledWith(0, 7);
  });

  it('updates both settings when both provided', async () => {
    const update = createChainableMock();
    mockWriteDb.prepare.mockReturnValueOnce(update);

    const response = await handlePushSettings(request, mockDb, {
      notificationsEnabled: true,
      oneMoreMileEnabled: false,
    });

    expect(response.status).toBe(200);
    expect(update.bind).toHaveBeenCalledWith(1, 0, 7);
  });

  it('rejects when no valid setting is provided', async () => {
    const response = await handlePushSettings(request, mockDb, {
      notificationsEnabled: 'yes',
    } as unknown as Record<string, unknown>);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'notificationsEnabled must be a boolean',
    });
  });

  it('rejects partially invalid payloads where one field is malformed', async () => {
    const response = await handlePushSettings(request, mockDb, {
      notificationsEnabled: 'yes',
      oneMoreMileEnabled: true,
    } as unknown as Record<string, unknown>);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'notificationsEnabled must be a boolean',
    });
  });

  it('returns the configured public VAPID key', async () => {
    const response = handleVapidKey({ VAPID_PUBLIC_KEY: 'test-public-key' });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'success',
      data: { vapidPublicKey: 'test-public-key' },
    });
  });

  it('returns 503 when the public VAPID key is missing', async () => {
    const response = handleVapidKey({});
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'Push notifications are not configured',
    });
  });
});