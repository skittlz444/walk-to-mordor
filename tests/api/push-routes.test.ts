jest.mock('../../src/push-handlers', () => ({
  handlePushSubscribe: jest.fn(),
  handlePushUnsubscribe: jest.fn(),
  handlePushStatus: jest.fn(),
  handlePushSettings: jest.fn(),
  handleVapidKey: jest.fn(),
}));

jest.mock('../../src/auth-handlers', () => ({
  ...jest.requireActual('../../src/auth-handlers'),
  validateSession: jest.fn(),
  validateAdminSession: jest.fn(),
}));

import { app } from '../../src/index';
import {
  handlePushSettings,
  handlePushStatus,
  handlePushSubscribe,
  handlePushUnsubscribe,
  handleVapidKey,
} from '../../src/push-handlers';
import { validateSession } from '../../src/auth-handlers';

describe('Push route wiring', () => {
  const mockEnv = {
    DB: {
      prepare: jest.fn(() => ({
        bind: jest.fn(() => ({
          run: jest.fn(() => Promise.resolve({ meta: { changes: 1 } })),
          all: jest.fn(() => Promise.resolve({ results: [] })),
          first: jest.fn(() => Promise.resolve(null)),
        })),
        all: jest.fn(() => Promise.resolve({ results: [] })),
        first: jest.fn(() => Promise.resolve(null)),
        run: jest.fn(() => Promise.resolve({ meta: { changes: 1 } })),
      })),
    },
    ASSETS: {
      fetch: jest.fn(async () => new Response('Not Found', { status: 404 })),
    },
    ALLOW_TEST_AUTH: 'true',
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(validateSession).mockResolvedValue({ valid: true, userId: 1 });
    jest.mocked(handlePushSubscribe).mockResolvedValue(new Response(JSON.stringify({ status: 'success' }), { status: 200 }));
    jest.mocked(handlePushUnsubscribe).mockResolvedValue(new Response(JSON.stringify({ status: 'success' }), { status: 200 }));
    jest.mocked(handlePushStatus).mockResolvedValue(new Response(JSON.stringify({ status: 'success' }), { status: 200 }));
    jest.mocked(handlePushSettings).mockResolvedValue(new Response(JSON.stringify({ status: 'success' }), { status: 200 }));
    jest.mocked(handleVapidKey).mockReturnValue(new Response(JSON.stringify({ status: 'success' }), { status: 200 }));
  });

  it('routes GET /api/push/vapid-key to the public handler', async () => {
    const response = await app.request('/api/push/vapid-key', undefined, mockEnv);
    expect(handleVapidKey).toHaveBeenCalledWith(mockEnv);
    expect(response.status).toBe(200);
  });

  it('routes POST /api/push/subscribe to the push subscribe handler', async () => {
    const response = await app.request('/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://push.example/sub-1',
        keys: { auth: 'auth-key', p256dh: 'p256dh-key' },
      }),
    }, mockEnv);

    expect(handlePushSubscribe).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it('returns 405 for unsupported method on /api/push/settings', async () => {
    const response = await app.request('/api/push/settings', { method: 'PATCH' }, mockEnv);

    expect(response.status).toBe(405);
  });
});