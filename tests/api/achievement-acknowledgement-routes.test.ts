jest.mock('../../src/achievement-handlers', () => ({
  handleGetAchievements: jest.fn(),
  handleGetPendingAchievements: jest.fn(),
  handleAcknowledgeAchievements: jest.fn(),
}));

jest.mock('../../src/auth-handlers', () => ({
  ...jest.requireActual('../../src/auth-handlers'),
  validateSession: jest.fn(),
  validateAdminSession: jest.fn(),
}));

import { app } from '../../src/index';
import {
  handleAcknowledgeAchievements,
  handleGetAchievements,
  handleGetPendingAchievements,
} from '../../src/achievement-handlers';
import { validateSession } from '../../src/auth-handlers';

function successResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Achievement pending and acknowledge route wiring', () => {
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
      successResponse({ achievements: [] }),
    );
    jest.mocked(handleGetPendingAchievements).mockResolvedValue(
      successResponse({ pending: [] }),
    );
    jest.mocked(handleAcknowledgeAchievements).mockResolvedValue(
      successResponse({ acknowledged: 1 }),
    );
  });

  it('dispatches GET /api/achievements/pending with the guard-provided user id', async () => {
    const response = await app.request('/api/achievements/pending', undefined, mockEnv);

    expect(response.status).toBe(200);
    expect(handleGetPendingAchievements).toHaveBeenCalledTimes(1);
    const [request, db, userId] = jest.mocked(handleGetPendingAchievements).mock.calls[0];
    expect(request).toBeInstanceOf(Request);
    expect(request.url).toBe('http://localhost/api/achievements/pending');
    expect(db.read).toBe(mockEnv.DB);
    expect(db.write).toBe(mockEnv.DB);
    expect(userId).toBe(42);
  });

  it('dispatches POST /api/achievements/acknowledge with the raw request and user id', async () => {
    const response = await app.request(
      '/api/achievements/acknowledge',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ instance_ids: [1, 2] }),
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    expect(handleAcknowledgeAchievements).toHaveBeenCalledTimes(1);
    const [request, db, userId] = jest.mocked(handleAcknowledgeAchievements).mock.calls[0];
    expect(request).toBeInstanceOf(Request);
    expect(request.method).toBe('POST');
    expect(request.url).toBe('http://localhost/api/achievements/acknowledge');
    expect(await request.json()).toEqual({ instance_ids: [1, 2] });
    expect(db.read).toBe(mockEnv.DB);
    expect(userId).toBe(42);
  });

  it('keeps GET /api/achievements on the summary handler', async () => {
    const response = await app.request('/api/achievements', undefined, mockEnv);

    expect(response.status).toBe(200);
    expect(handleGetAchievements).toHaveBeenCalledTimes(1);
    expect(handleGetPendingAchievements).not.toHaveBeenCalled();
  });

  it.each([
    ['GET', '/api/achievements/pending'],
    ['POST', '/api/achievements/acknowledge'],
  ])('returns 401 for %s %s without a valid session', async (method, path) => {
    jest.mocked(validateSession).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    });

    const response = await app.request(path, { method }, mockEnv);

    expect(response.status).toBe(401);
    expect(handleGetPendingAchievements).not.toHaveBeenCalled();
    expect(handleAcknowledgeAchievements).not.toHaveBeenCalled();
  });

  it('returns 405 with an Allow header for POST /api/achievements/pending', async () => {
    const response = await app.request(
      '/api/achievements/pending',
      { method: 'POST' },
      mockEnv,
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toContain('GET');
    expect(handleGetPendingAchievements).not.toHaveBeenCalled();
  });

  it('returns 405 with an Allow header for GET /api/achievements/acknowledge', async () => {
    const response = await app.request(
      '/api/achievements/acknowledge',
      { method: 'GET' },
      mockEnv,
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toContain('POST');
    expect(handleAcknowledgeAchievements).not.toHaveBeenCalled();
  });
});
