jest.mock('../../src/push-handlers', () => ({
  handlePushSubscribe: jest.fn(),
  handlePushUnsubscribe: jest.fn(),
  handlePushStatus: jest.fn(),
  handlePushSettings: jest.fn(),
  handleVapidKey: jest.fn(),
}));

import worker from '../../src/index';
import {
  handlePushSettings,
  handlePushStatus,
  handlePushSubscribe,
  handlePushUnsubscribe,
  handleVapidKey,
} from '../../src/push-handlers';

describe('Push route wiring', () => {
  const mockEnv = {
    DB: {
      prepare: jest.fn(),
    },
    ASSETS: {
      fetch: jest.fn(async () => new Response('Not Found', { status: 404 })),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(handlePushSubscribe).mockResolvedValue(new Response(JSON.stringify({ status: 'success' }), { status: 200 }));
    jest.mocked(handlePushUnsubscribe).mockResolvedValue(new Response(JSON.stringify({ status: 'success' }), { status: 200 }));
    jest.mocked(handlePushStatus).mockResolvedValue(new Response(JSON.stringify({ status: 'success' }), { status: 200 }));
    jest.mocked(handlePushSettings).mockResolvedValue(new Response(JSON.stringify({ status: 'success' }), { status: 200 }));
    jest.mocked(handleVapidKey).mockReturnValue(new Response(JSON.stringify({ status: 'success' }), { status: 200 }));
  });

  it('routes GET /api/push/vapid-key to the public handler', async () => {
    const response = await worker.fetch(new Request('https://example.com/api/push/vapid-key'), mockEnv as never);
    expect(handleVapidKey).toHaveBeenCalledWith(mockEnv);
    expect(response.status).toBe(200);
  });

  it('routes POST /api/push/subscribe to the push subscribe handler', async () => {
    const request = new Request('https://example.com/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://push.example/sub-1',
        keys: { auth: 'auth-key', p256dh: 'p256dh-key' },
      }),
    });

    const response = await worker.fetch(request, mockEnv as never);

    expect(handlePushSubscribe).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it('returns 405 with PUT as the only allowed method for /api/push/settings', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/push/settings', { method: 'PATCH' }),
      mockEnv as never,
    );

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({
      allowedMethods: ['PUT'],
    });
  });
});