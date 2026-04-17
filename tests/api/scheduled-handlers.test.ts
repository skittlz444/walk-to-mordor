import { handleOneMoreMileCron } from '../../src/scheduled-handlers';

jest.mock('../../src/push-messages', () => ({
  getOneMoreMileMessage: jest.fn().mockReturnValue({
    title: 'Almost There!',
    body: 'You are just 1.5 km from Weathertop.',
  }),
}));

jest.mock('../../src/push-utils', () => ({
  sendPushNotification: jest.fn().mockResolvedValue({ ok: true, status: 201, deleted: false }),
  cleanupExpiredSubscription: jest.fn().mockResolvedValue(undefined),
}));

import { getOneMoreMileMessage } from '../../src/push-messages';
import { sendPushNotification, cleanupExpiredSubscription } from '../../src/push-utils';

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

function makeEligibleUser(overrides: Partial<{
  user_id: number;
  total_distance: number;
  next_goal_id: number;
  next_goal_distance: number;
  next_goal_title: string;
  remaining_km: number;
}> = {}) {
  return {
    user_id: overrides.user_id ?? 1,
    total_distance: overrides.total_distance ?? 98.5,
    next_goal_id: overrides.next_goal_id ?? 10,
    next_goal_distance: overrides.next_goal_distance ?? 100,
    next_goal_title: overrides.next_goal_title ?? 'Weathertop',
    remaining_km: overrides.remaining_km ?? 1.5,
  };
}

describe('Scheduled Handlers - One More Mile', () => {
  let mockReadDb: { prepare: jest.Mock };
  let mockWriteDb: { prepare: jest.Mock };
  let mockEnv: Env;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReadDb = { prepare: jest.fn() };
    mockWriteDb = { prepare: jest.fn() };

    mockEnv = {
      DB: {
        prepare: jest.fn(),
      } as unknown as D1Database,
      ASSETS: {} as Fetcher,
      VAPID_PUBLIC_KEY: 'test-public-key',
      VAPID_PRIVATE_KEY: 'test-private-key',
      VAPID_SUBJECT: 'mailto:test@example.com',
    };

    // Patch createDbClient to return our mocks
    jest.spyOn(require('../../src/db'), 'createDbClient').mockReturnValue({
      read: mockReadDb,
      write: mockWriteDb,
    });
  });

  it('sends notification to eligible user with all criteria met', async () => {
    const user = makeEligibleUser();
    const eligibleQuery = createChainableMock({ all: { results: [user] } });
    const claimMock = createChainableMock();
    const subQuery = createChainableMock({
      all: { results: [{ endpoint: 'https://push.example/sub-1', keys_p256dh: 'p256dh', keys_auth: 'auth' }] },
    });

    mockReadDb.prepare.mockReturnValueOnce(eligibleQuery);
    mockWriteDb.prepare.mockReturnValueOnce(claimMock);
    mockReadDb.prepare.mockReturnValueOnce(subQuery);

    await handleOneMoreMileCron(mockEnv);

    expect(claimMock.bind).toHaveBeenCalledWith(1, 10);
    expect(getOneMoreMileMessage).toHaveBeenCalledWith('Weathertop', 1.5);
    expect(sendPushNotification).toHaveBeenCalledWith(
      expect.anything(),
      'https://push.example/sub-1',
      { p256dh: 'p256dh', auth: 'auth' },
      expect.objectContaining({ title: 'Almost There!', body: 'You are just 1.5 km from Weathertop.', url: '/' }),
      mockEnv,
    );
  });

  it('skips processing when no eligible users found', async () => {
    const emptyQuery = createChainableMock({ all: { results: [] } });
    mockReadDb.prepare.mockReturnValueOnce(emptyQuery);

    await handleOneMoreMileCron(mockEnv);

    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  it('cleans up expired subscriptions on 410 responses', async () => {
    (sendPushNotification as jest.Mock).mockResolvedValueOnce({ ok: false, status: 410, deleted: true });

    const user = makeEligibleUser();
    const eligibleQuery = createChainableMock({ all: { results: [user] } });
    const claimMock = createChainableMock();
    const subQuery = createChainableMock({
      all: { results: [{ endpoint: 'https://push.example/gone', keys_p256dh: 'p256dh', keys_auth: 'auth' }] },
    });

    mockReadDb.prepare.mockReturnValueOnce(eligibleQuery);
    mockWriteDb.prepare.mockReturnValueOnce(claimMock);
    mockReadDb.prepare.mockReturnValueOnce(subQuery);

    await handleOneMoreMileCron(mockEnv);

    expect(cleanupExpiredSubscription).toHaveBeenCalledWith(
      expect.anything(),
      'https://push.example/gone',
    );
    // Claim is kept when subscription was cleaned up (410) per AC #8
    expect(claimMock.bind).toHaveBeenCalledWith(1, 10);
  });

  it('rolls back sent record when delivery fails without subscription cleanup', async () => {
    (sendPushNotification as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500, deleted: false });

    const user = makeEligibleUser();
    const eligibleQuery = createChainableMock({ all: { results: [user] } });
    const claimMock = createChainableMock();
    const subQuery = createChainableMock({
      all: { results: [{ endpoint: 'https://push.example/sub-1', keys_p256dh: 'p256dh', keys_auth: 'auth' }] },
    });
    const rollbackMock = createChainableMock();

    mockReadDb.prepare.mockReturnValueOnce(eligibleQuery);
    mockWriteDb.prepare.mockReturnValueOnce(claimMock);
    mockReadDb.prepare.mockReturnValueOnce(subQuery);
    mockWriteDb.prepare.mockReturnValueOnce(rollbackMock);

    await handleOneMoreMileCron(mockEnv);

    // Claim was inserted then rolled back because delivery failed (500)
    expect(claimMock.bind).toHaveBeenCalledWith(1, 10);
    expect(rollbackMock.bind).toHaveBeenCalledWith(1, 10);
  });

  it('continues processing other users when one fails', async () => {
    const user1 = makeEligibleUser({ user_id: 1 });
    const user2 = makeEligibleUser({ user_id: 2, next_goal_id: 11 });

    const eligibleQuery = createChainableMock({ all: { results: [user1, user2] } });

    // User 1: claim succeeds
    const claimMock1 = createChainableMock();
    // User 1: subscription query throws
    const failingSubQuery = createChainableMock();
    failingSubQuery.all.mockRejectedValueOnce(new Error('DB error'));
    // User 1: rollback claim after error
    const rollbackMock = createChainableMock();
    // User 2: claim succeeds
    const claimMock2 = createChainableMock();
    // User 2: subscriptions
    const subQuery2 = createChainableMock({
      all: { results: [{ endpoint: 'https://push.example/sub-2', keys_p256dh: 'p256dh2', keys_auth: 'auth2' }] },
    });

    mockReadDb.prepare.mockReturnValueOnce(eligibleQuery);
    mockWriteDb.prepare.mockReturnValueOnce(claimMock1);
    mockReadDb.prepare.mockReturnValueOnce(failingSubQuery);
    mockWriteDb.prepare.mockReturnValueOnce(rollbackMock);
    mockWriteDb.prepare.mockReturnValueOnce(claimMock2);
    mockReadDb.prepare.mockReturnValueOnce(subQuery2);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await handleOneMoreMileCron(mockEnv);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('One More Mile: failed for user 1'),
      expect.any(Error),
    );
    // Second user should still be processed
    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    expect(claimMock2.bind).toHaveBeenCalledWith(2, 11);

    consoleSpy.mockRestore();
  });

  it('processes multiple batches when first batch is full', async () => {
    // Create 100 users for first batch (full batch triggers another query)
    const batch1Users = Array.from({ length: 100 }, (_, i) =>
      makeEligibleUser({ user_id: i + 1, next_goal_id: 10 + i }),
    );
    const batch1Query = createChainableMock({ all: { results: batch1Users } });
    const emptyBatch = createChainableMock({ all: { results: [] } });

    mockReadDb.prepare.mockReturnValueOnce(batch1Query);

    // For each user: claim INSERT + subscription query
    for (let i = 0; i < 100; i++) {
      mockWriteDb.prepare.mockReturnValueOnce(createChainableMock());
      const subQuery = createChainableMock({
        all: { results: [{ endpoint: `https://push.example/sub-${i}`, keys_p256dh: 'p', keys_auth: 'a' }] },
      });
      mockReadDb.prepare.mockReturnValueOnce(subQuery);
    }

    // Second batch: empty
    mockReadDb.prepare.mockReturnValueOnce(emptyBatch);

    await handleOneMoreMileCron(mockEnv);

    expect(sendPushNotification).toHaveBeenCalledTimes(100);
  });

  it('sends to multiple subscriptions for one user', async () => {
    const user = makeEligibleUser();
    const eligibleQuery = createChainableMock({ all: { results: [user] } });
    const claimMock = createChainableMock();
    const subQuery = createChainableMock({
      all: {
        results: [
          { endpoint: 'https://push.example/sub-a', keys_p256dh: 'pa', keys_auth: 'aa' },
          { endpoint: 'https://push.example/sub-b', keys_p256dh: 'pb', keys_auth: 'ab' },
        ],
      },
    });

    mockReadDb.prepare.mockReturnValueOnce(eligibleQuery);
    mockWriteDb.prepare.mockReturnValueOnce(claimMock);
    mockReadDb.prepare.mockReturnValueOnce(subQuery);

    await handleOneMoreMileCron(mockEnv);

    expect(sendPushNotification).toHaveBeenCalledTimes(2);
  });
});
