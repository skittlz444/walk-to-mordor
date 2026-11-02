jest.mock('../../src/profile-handlers', () => ({
  handleGetProfileOverview: jest.fn(),
}));

jest.mock('../../src/auth-handlers', () => ({
  ...jest.requireActual('../../src/auth-handlers'),
  validateSession: jest.fn(),
  validateAdminSession: jest.fn(),
}));

import { app } from '../../src/index';
import { handleGetProfileOverview } from '../../src/profile-handlers';
import { validateSession } from '../../src/auth-handlers';

describe('Profile overview route wiring', () => {
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
    jest.mocked(handleGetProfileOverview).mockResolvedValue(
      new Response(JSON.stringify({ username: 'FrodoBaggins' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  it('dispatches GET /api/profile/overview with the guard-provided user id', async () => {
    const response = await app.request('/api/profile/overview', undefined, mockEnv);

    expect(response.status).toBe(200);
    const body = await response.json() as { username: string };
    expect(body.username).toBe('FrodoBaggins');
    expect(handleGetProfileOverview).toHaveBeenCalledTimes(1);
    const [request, db, userId, allowTestAuth] = jest.mocked(handleGetProfileOverview).mock.calls[0];
    expect(request).toBeInstanceOf(Request);
    expect(request.url).toBe('http://localhost/api/profile/overview');
    expect(db.read).toBe(mockEnv.DB);
    expect(db.write).toBe(mockEnv.DB);
    expect(userId).toBe(42);
    // Forwarded so the handler's own session check accepts TEST_MOCK_TOKEN_* auth.
    expect(allowTestAuth).toBe('true');
  });

  it('returns 401 without a valid session and never calls the handler', async () => {
    jest.mocked(validateSession).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    });

    const response = await app.request('/api/profile/overview', undefined, mockEnv);

    expect(response.status).toBe(401);
    expect(handleGetProfileOverview).not.toHaveBeenCalled();
  });

  it('returns 405 with an Allow header for POST /api/profile/overview', async () => {
    const response = await app.request('/api/profile/overview', { method: 'POST' }, mockEnv);

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toContain('GET');
    expect(handleGetProfileOverview).not.toHaveBeenCalled();
  });
});
