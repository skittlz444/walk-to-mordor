jest.mock('../../src/achievement-handlers', () => ({
  handleGetAchievements: jest.fn(),
}));

jest.mock('../../src/auth-handlers', () => ({
  ...jest.requireActual('../../src/auth-handlers'),
  validateSession: jest.fn(),
  validateAdminSession: jest.fn(),
}));

import { app } from '../../src/index';
import { handleGetAchievements } from '../../src/achievement-handlers';
import { validateSession } from '../../src/auth-handlers';

describe('Achievements route wiring', () => {
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
    jest.mocked(validateSession).mockResolvedValue({ valid: true, userId: 42 });
    jest.mocked(handleGetAchievements).mockResolvedValue(
      new Response(JSON.stringify({ achievements: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  it('dispatches GET /api/achievements to the handler with the guard-provided user id', async () => {
    const response = await app.request('/api/achievements', undefined, mockEnv);

    expect(response.status).toBe(200);
    expect(handleGetAchievements).toHaveBeenCalledTimes(1);
    const [request, db, userId] = jest.mocked(handleGetAchievements).mock.calls[0];
    expect(request).toBeInstanceOf(Request);
    expect(request.url).toBe('http://localhost/api/achievements');
    expect(db.read).toBe(mockEnv.DB);
    expect(db.write).toBe(mockEnv.DB);
    expect(userId).toBe(42);
  });

  it('passes the userId query parameter through to the handler', async () => {
    const response = await app.request('/api/achievements?userId=7', undefined, mockEnv);

    expect(response.status).toBe(200);
    const [request, , userId] = jest.mocked(handleGetAchievements).mock.calls[0];
    expect(new URL(request.url).searchParams.get('userId')).toBe('7');
    expect(userId).toBe(42);
  });

  it('returns 401 without a valid session and never calls the handler', async () => {
    jest.mocked(validateSession).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    });

    const response = await app.request('/api/achievements', undefined, mockEnv);

    expect(response.status).toBe(401);
    expect(handleGetAchievements).not.toHaveBeenCalled();
  });

  it('returns 405 with an Allow header for POST /api/achievements', async () => {
    const response = await app.request('/api/achievements', { method: 'POST' }, mockEnv);

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toContain('GET');
    expect(handleGetAchievements).not.toHaveBeenCalled();
  });
});
