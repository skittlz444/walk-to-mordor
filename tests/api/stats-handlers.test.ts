import { handleWeeklyStats } from '../../src/stats-handlers';
import { validateSession } from '../../src/auth-handlers';
import { DbClient } from '../../src/db';

jest.mock('../../src/auth-handlers');

describe('Stats Handlers – handleWeeklyStats', () => {
  let mockDB: Record<string, jest.Mock>;
  let mockDb: DbClient;
  let mockRequest: Request;

  function createChainableMock(overrides?: {
    first?: jest.Mock;
    all?: jest.Mock;
    run?: jest.Mock;
  }) {
    const first = overrides?.first ?? jest.fn().mockResolvedValue(null);
    const all = overrides?.all ?? jest.fn().mockResolvedValue({ results: [] });
    const run = overrides?.run ?? jest.fn().mockResolvedValue({ meta: { changes: 1 } });
    const bind = jest.fn(() => ({ run, all, first }));
    return { bind, run, all, first };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (validateSession as jest.Mock).mockResolvedValue({ valid: true, userId: 1 });

    mockDB = {
      prepare: jest.fn(() => createChainableMock()),
      batch: jest.fn().mockResolvedValue([]),
    };
    mockDb = {
      read: mockDB as unknown as D1Database,
      write: mockDB as unknown as D1Database,
    };

    mockRequest = new Request('https://example.com/api/stats/weekly', {
      headers: { Authorization: 'Bearer test-token' },
    });
  });

  it('returns 401 when session is invalid', async () => {
    (validateSession as jest.Mock).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    });

    const res = await handleWeeklyStats(mockRequest, mockDb);
    expect(res.status).toBe(401);
  });

  it('returns has_activity: false when no walks in past 30 days', async () => {
    // 30-day activity check: returns 0
    mockDB.prepare
      .mockReturnValueOnce(
        createChainableMock({ first: jest.fn().mockResolvedValue({ count: 0 }) }),
      );

    const res = await handleWeeklyStats(mockRequest, mockDb);
    expect(res.status).toBe(200);
    const data = await res.json() as { has_activity: boolean };
    expect(data.has_activity).toBe(false);
  });

  it('returns no_walks_this_week: true when user walked 30 days but 0 this week', async () => {
    // 30-day count → has activity
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ count: 5 }) }),
    );
    // This week distance
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 0 }) }),
    );
    // Previous week distance
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 20 }) }),
    );
    // Total distance
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 120 }) }),
    );
    // Goals for projection
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [
        { id: 1, title: 'Rivendell', distance: 458, special: null },
        { id: 2, title: 'Lothlórien', distance: 917, special: 'major' },
      ] }) }),
    );
    // Fellowships
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );

    const res = await handleWeeklyStats(mockRequest, mockDb);
    expect(res.status).toBe(200);
    const data = await res.json() as {
      has_activity: boolean;
      no_walks_this_week: boolean;
    };
    expect(data.has_activity).toBe(true);
    expect(data.no_walks_this_week).toBe(true);
  });

  it('returns weekly stats with pace trend and projection', async () => {
    // 30-day count
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ count: 10 }) }),
    );
    // This week: 30 km
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 30 }) }),
    );
    // Previous week: 20 km
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 20 }) }),
    );
    // Total distance: 450 km
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 450 }) }),
    );
    // Goals: next major milestone at 917 km; regular next at 458
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [
        { id: 1, title: 'Rivendell', distance: 458, special: null },
        { id: 2, title: 'Lothlórien', distance: 917, special: 'major' },
        { id: 3, title: 'Far Away', distance: 2000, special: 'major' },
      ] }) }),
    );
    // No fellowships
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );

    const res = await handleWeeklyStats(mockRequest, mockDb);
    expect(res.status).toBe(200);
    const data = await res.json() as {
      has_activity: boolean;
      no_walks_this_week: boolean;
      this_week_km: number;
      prev_week_km: number;
      pace_trend: 'up' | 'down' | 'same';
      pace_change_pct: number;
      projection: { title: string; distance: number; km_to_next: number; days_away: number } | null;
      fellowships: unknown[];
    };
    expect(data.has_activity).toBe(true);
    expect(data.no_walks_this_week).toBe(false);
    expect(data.this_week_km).toBe(30);
    expect(data.prev_week_km).toBe(20);
    expect(data.pace_trend).toBe('up');
    expect(data.pace_change_pct).toBe(50);
    // At pace=30 km/week (last 7 days), 450 km total, next goal at 458 is 8 km away → round(8/30*7)=2 days
    // next major is at 917 → 467 km away → round(467/30*7)=109 days > 14 → falls back to next regular goal
    expect(data.projection).not.toBeNull();
    expect(data.projection?.title).toBe('Rivendell');
    expect(data.fellowships).toEqual([]);
  });

  it('projects to major milestone when it is within 2 weeks', async () => {
    // 30-day count
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ count: 10 }) }),
    );
    // This week: 100 km (very fast)
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 100 }) }),
    );
    // Previous week: 90 km
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 90 }) }),
    );
    // Total distance: 900 km (major milestone at 917 is only 17 km away)
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 900 }) }),
    );
    // Goals: next regular at 910, next major at 917
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [
        { id: 1, title: 'Small Step', distance: 910, special: null },
        { id: 2, title: 'Lothlórien', distance: 917, special: 'major' },
      ] }) }),
    );
    // No fellowships
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );

    const res = await handleWeeklyStats(mockRequest, mockDb);
    expect(res.status).toBe(200);
    const data = await res.json() as {
      projection: { title: string; distance: number; km_to_next: number; days_away: number };
    };
    // 17 km at 100 km/week → ~1.19 days < 14 → should show major milestone
    expect(data.projection?.title).toBe('Lothlórien');
  });

  it('returns top 2 fellowship contributions sorted by percentage descending', async () => {
    // 30-day count
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ count: 10 }) }),
    );
    // This week: 20 km
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 20 }) }),
    );
    // Previous week
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 15 }) }),
    );
    // Total distance
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 200 }) }),
    );
    // Goals
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [
        { id: 1, title: 'Next Goal', distance: 300, special: null },
      ] }) }),
    );
    // Fellowships: 3 parties, user contributed 20 km to each, party totals differ
    // party A: user 20, total 40 → 50%
    // party B: user 20, total 100 → 20%
    // party C: user 20, total 200 → 10%
    // Expected top 2: A (50%), B (20%)
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [
        { party_id: 1, party_name: 'Fellowship A', user_week_km: 20, party_week_km: 40 },
        { party_id: 2, party_name: 'Fellowship B', user_week_km: 20, party_week_km: 100 },
        { party_id: 3, party_name: 'Fellowship C', user_week_km: 20, party_week_km: 200 },
      ] }) }),
    );

    const res = await handleWeeklyStats(mockRequest, mockDb);
    expect(res.status).toBe(200);
    const data = await res.json() as {
      fellowships: Array<{ party_id: number; party_name: string; contribution_pct: number }>;
    };
    expect(data.fellowships).toHaveLength(2);
    expect(data.fellowships[0].party_id).toBe(1);
    expect(data.fellowships[0].contribution_pct).toBe(50);
    expect(data.fellowships[1].party_id).toBe(2);
    expect(data.fellowships[1].contribution_pct).toBe(20);
  });

  it('handles database error gracefully', async () => {
    mockDB.prepare.mockReturnValueOnce({
      bind: jest.fn().mockReturnValue({
        first: jest.fn().mockRejectedValue(new Error('DB failure')),
      }),
    });

    const res = await handleWeeklyStats(mockRequest, mockDb);
    expect(res.status).toBe(500);
    const data = await res.json() as { error: string };
    expect(data.error).toBe('Internal server error while retrieving weekly stats');
  });
});
