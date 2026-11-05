jest.mock('../../src/event-handlers', () => ({
  handleDailyRoll: jest.fn(),
  handleAcceptEncounter: jest.fn(),
  handleDeclineEncounter: jest.fn(),
}));

jest.mock('../../src/auth-handlers', () => ({
  ...jest.requireActual('../../src/auth-handlers'),
  validateSession: jest.fn(),
  validateAdminSession: jest.fn(),
}));

import { app } from '../../src/index';
import {
  handleAcceptEncounter,
  handleDailyRoll,
  handleDeclineEncounter,
} from '../../src/event-handlers';
import { validateSession } from '../../src/auth-handlers';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Personal challenge route wiring', () => {
  const baseEnv = {
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
    ALLOW_TEST_AUTH: 'true' as string | undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(validateSession).mockResolvedValue({ valid: true, userId: 42 });
    jest.mocked(handleDailyRoll).mockResolvedValue(jsonResponse({ offer: null }));
    jest.mocked(handleAcceptEncounter).mockResolvedValue(jsonResponse({ ok: true }));
    jest.mocked(handleDeclineEncounter).mockResolvedValue(jsonResponse({ declined: true }));
  });

  it('dispatches POST /api/events/daily-roll with the guard-provided user and db', async () => {
    const response = await app.request(
      '/api/events/daily-roll',
      { method: 'POST', body: JSON.stringify({}) },
      baseEnv,
    );

    expect(response.status).toBe(200);
    expect(handleDailyRoll).toHaveBeenCalledTimes(1);
    const [request, db, userId, options] = jest.mocked(handleDailyRoll).mock.calls[0];
    expect(request).toBeInstanceOf(Request);
    expect(request.url).toBe('http://localhost/api/events/daily-roll');
    expect(db.read).toBe(baseEnv.DB);
    expect(db.write).toBe(baseEnv.DB);
    expect(userId).toBe(42);
    expect(options).toEqual({ forceOffer: false });
  });

  it('passes forceOffer true when ALLOW_TEST_AUTH is true and the body flag is true', async () => {
    await app.request(
      '/api/events/daily-roll',
      { method: 'POST', body: JSON.stringify({ force_offer: true }) },
      { ...baseEnv, ALLOW_TEST_AUTH: 'true' },
    );

    expect(jest.mocked(handleDailyRoll).mock.calls[0][3]).toEqual({ forceOffer: true });
  });

  it('never honors force_offer unless ALLOW_TEST_AUTH is exactly true', async () => {
    await app.request(
      '/api/events/daily-roll',
      { method: 'POST', body: JSON.stringify({ force_offer: true }) },
      { ...baseEnv, ALLOW_TEST_AUTH: 'false' },
    );
    await app.request(
      '/api/events/daily-roll',
      { method: 'POST', body: JSON.stringify({ force_offer: true }) },
      { ...baseEnv, ALLOW_TEST_AUTH: undefined },
    );

    expect(jest.mocked(handleDailyRoll).mock.calls[0][3]).toEqual({ forceOffer: false });
    expect(jest.mocked(handleDailyRoll).mock.calls[1][3]).toEqual({ forceOffer: false });
  });

  it('passes forceOffer false for a false or absent body flag', async () => {
    await app.request(
      '/api/events/daily-roll',
      { method: 'POST', body: JSON.stringify({ force_offer: false }) },
      { ...baseEnv, ALLOW_TEST_AUTH: 'true' },
    );
    await app.request(
      '/api/events/daily-roll',
      { method: 'POST', body: JSON.stringify({}) },
      { ...baseEnv, ALLOW_TEST_AUTH: 'true' },
    );

    expect(jest.mocked(handleDailyRoll).mock.calls[0][3]).toEqual({ forceOffer: false });
    expect(jest.mocked(handleDailyRoll).mock.calls[1][3]).toEqual({ forceOffer: false });
  });

  it('dispatches POST /api/events/daily-roll/accept to the accept handler', async () => {
    const response = await app.request(
      '/api/events/daily-roll/accept',
      { method: 'POST', body: JSON.stringify({ encounter_definition_id: 7 }) },
      baseEnv,
    );

    expect(response.status).toBe(200);
    expect(handleAcceptEncounter).toHaveBeenCalledTimes(1);
    expect(handleDailyRoll).not.toHaveBeenCalled();
    const [request, db, userId] = jest.mocked(handleAcceptEncounter).mock.calls[0];
    expect(request.url).toBe('http://localhost/api/events/daily-roll/accept');
    expect(db.read).toBe(baseEnv.DB);
    expect(userId).toBe(42);
  });

  it('dispatches POST /api/events/daily-roll/decline to the decline handler', async () => {
    const response = await app.request(
      '/api/events/daily-roll/decline',
      { method: 'POST', body: JSON.stringify({}) },
      baseEnv,
    );

    expect(response.status).toBe(200);
    expect(handleDeclineEncounter).toHaveBeenCalledTimes(1);
    expect(handleDailyRoll).not.toHaveBeenCalled();
    const [request, db, userId] = jest.mocked(handleDeclineEncounter).mock.calls[0];
    expect(request.url).toBe('http://localhost/api/events/daily-roll/decline');
    expect(db.read).toBe(baseEnv.DB);
    expect(userId).toBe(42);
  });

  it('returns 401 without a valid session and never calls a handler', async () => {
    jest.mocked(validateSession).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    });

    const response = await app.request(
      '/api/events/daily-roll/accept',
      { method: 'POST', body: JSON.stringify({ encounter_definition_id: 7 }) },
      baseEnv,
    );

    expect(response.status).toBe(401);
    expect(handleDailyRoll).not.toHaveBeenCalled();
    expect(handleAcceptEncounter).not.toHaveBeenCalled();
    expect(handleDeclineEncounter).not.toHaveBeenCalled();
  });
});
