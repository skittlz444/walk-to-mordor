import { handleWeeklyStats, handleHeatmap } from '../../src/stats-handlers';
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
    jest.useRealTimers();
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

  it('uses matching 7-day windows for current and previous week queries', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-07T12:00:00Z'));

    const activityCheck = createChainableMock({ first: jest.fn().mockResolvedValue({ count: 10 }) });
    const thisWeek = createChainableMock({ first: jest.fn().mockResolvedValue({ total: 12 }) });
    const prevWeek = createChainableMock({ first: jest.fn().mockResolvedValue({ total: 8 }) });
    const totalDistance = createChainableMock({ first: jest.fn().mockResolvedValue({ total: 120 }) });
    const goals = createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) });
    const fellowships = createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) });

    mockDB.prepare
      .mockReturnValueOnce(activityCheck)
      .mockReturnValueOnce(thisWeek)
      .mockReturnValueOnce(prevWeek)
      .mockReturnValueOnce(totalDistance)
      .mockReturnValueOnce(goals)
      .mockReturnValueOnce(fellowships);

    await handleWeeklyStats(mockRequest, mockDb);

    expect(activityCheck.bind).toHaveBeenCalledWith(1, '2026-03-09', '2026-04-07');
    expect(thisWeek.bind).toHaveBeenCalledWith(1, '2026-04-01', '2026-04-07');
    expect(prevWeek.bind).toHaveBeenCalledWith(1, '2026-03-25', '2026-04-01');
  });

  it('returns a null pace change for a first active week', async () => {
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ count: 10 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 18 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 0 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 120 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );

    const res = await handleWeeklyStats(mockRequest, mockDb);
    const data = await res.json() as {
      pace_trend: 'up' | 'down' | 'same';
      pace_change_pct: number | null;
    };

    expect(data.pace_trend).toBe('up');
    expect(data.pace_change_pct).toBeNull();
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

describe('Stats Handlers – handleHeatmap', () => {
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
    jest.useRealTimers();
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

    mockRequest = new Request('https://example.com/api/stats/heatmap', {
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

    const res = await handleHeatmap(mockRequest, mockDb);
    expect(res.status).toBe(401);
  });

  it('returns empty days and zero streaks when no data exists', async () => {
    // 365-day progress query
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );
    // All-time dates for longest streak
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );

    const res = await handleHeatmap(mockRequest, mockDb);
    expect(res.status).toBe(200);
    const data = await res.json() as { days: unknown[]; currentStreak: number; longestStreak: number };
    expect(data.days).toEqual([]);
    expect(data.currentStreak).toBe(0);
    expect(data.longestStreak).toBe(0);
  });

  it('calculates current streak correctly for consecutive days ending today', async () => {
    const today = new Date();
    const formatD = (d: Date) => d.toISOString().slice(0, 10);
    const day = (offset: number) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - offset);
      return formatD(d);
    };

    // Progress for last 365 days — 3 consecutive days ending today
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { date: day(2), distance: 5.0 },
            { date: day(1), distance: 3.2 },
            { date: day(0), distance: 7.1 },
          ],
        }),
      }),
    );
    // All-time dates for longest streak — same 3 days
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { date: day(2) },
            { date: day(1) },
            { date: day(0) },
          ],
        }),
      }),
    );

    const res = await handleHeatmap(mockRequest, mockDb);
    expect(res.status).toBe(200);
    const data = await res.json() as { days: unknown[]; currentStreak: number; longestStreak: number };
    expect(data.currentStreak).toBe(3);
    expect(data.longestStreak).toBe(3);
    expect(data.days).toHaveLength(3);
  });

  it('breaks current streak when yesterday is missing', async () => {
    const today = new Date();
    const formatD = (d: Date) => d.toISOString().slice(0, 10);
    const day = (offset: number) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - offset);
      return formatD(d);
    };

    // Today walked, yesterday NOT, day before walked
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { date: day(2), distance: 5.0 },
            { date: day(0), distance: 7.1 },
          ],
        }),
      }),
    );
    // All-time data with a gap
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { date: day(2) },
            { date: day(0) },
          ],
        }),
      }),
    );

    const res = await handleHeatmap(mockRequest, mockDb);
    const data = await res.json() as { currentStreak: number; longestStreak: number };
    expect(data.currentStreak).toBe(1); // only today
    expect(data.longestStreak).toBe(1); // no consecutive days
  });

  it('calculates longest streak across all time, not just 365-day window', async () => {
    const today = new Date();
    const formatD = (d: Date) => d.toISOString().slice(0, 10);
    const day = (offset: number) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - offset);
      return formatD(d);
    };

    // 365-day window only shows today
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [{ date: day(0), distance: 2.0 }],
        }),
      }),
    );
    // All-time includes a historical 5-day streak (days 400-396 ago)
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { date: day(400) },
            { date: day(399) },
            { date: day(398) },
            { date: day(397) },
            { date: day(396) },
            { date: day(0) },
          ],
        }),
      }),
    );

    const res = await handleHeatmap(mockRequest, mockDb);
    const data = await res.json() as { currentStreak: number; longestStreak: number };
    expect(data.currentStreak).toBe(1);
    expect(data.longestStreak).toBe(5);
  });

  it('does not cap current streak at the 365-day heatmap window', async () => {
    const today = new Date();
    const formatD = (d: Date) => d.toISOString().slice(0, 10);
    const day = (offset: number) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - offset);
      return formatD(d);
    };

    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: Array.from({ length: 365 }, (_, index) => ({
            date: day(364 - index),
            distance: 1.0,
          })),
        }),
      }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: Array.from({ length: 366 }, (_, index) => ({
            date: day(365 - index),
          })),
        }),
      }),
    );

    const res = await handleHeatmap(mockRequest, mockDb);
    const data = await res.json() as { currentStreak: number; longestStreak: number };
    expect(data.currentStreak).toBe(366);
    expect(data.longestStreak).toBe(366);
  });

  it('returns a startDate clamped to account creation when the account is newer than one year', async () => {
    const today = new Date();
    const formatD = (d: Date) => d.toISOString().slice(0, 10);
    const day = (offset: number) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - offset);
      return formatD(d);
    };

    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { date: day(2), distance: 2.5 },
            { date: day(0), distance: 1.0 },
          ],
        }),
      }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { date: day(2) },
            { date: day(0) },
          ],
        }),
      }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({
        first: jest.fn().mockResolvedValue({ created_at: day(30) }),
      }),
    );

    const res = await handleHeatmap(mockRequest, mockDb);
    const data = await res.json() as { startDate: string };
    expect(data.startDate).toBe(day(30));
  });

  it('returns current streak of 0 when user did not walk today', async () => {
    const today = new Date();
    const formatD = (d: Date) => d.toISOString().slice(0, 10);
    const day = (offset: number) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - offset);
      return formatD(d);
    };

    // Walked yesterday and the day before but not today
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { date: day(2), distance: 3.0 },
            { date: day(1), distance: 4.0 },
          ],
        }),
      }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { date: day(2) },
            { date: day(1) },
          ],
        }),
      }),
    );

    const res = await handleHeatmap(mockRequest, mockDb);
    const data = await res.json() as { currentStreak: number; longestStreak: number };
    expect(data.currentStreak).toBe(0);
    expect(data.longestStreak).toBe(2);
  });

  it('returns a single-day streak when only today has data', async () => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [{ date: todayStr, distance: 1.5 }],
        }),
      }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [{ date: todayStr }],
        }),
      }),
    );

    const res = await handleHeatmap(mockRequest, mockDb);
    const data = await res.json() as { currentStreak: number; longestStreak: number };
    expect(data.currentStreak).toBe(1);
    expect(data.longestStreak).toBe(1);
  });

  it('returns 500 on database error', async () => {
    mockDB.prepare.mockReturnValueOnce({
      bind: jest.fn().mockReturnValue({
        all: jest.fn().mockRejectedValue(new Error('DB failure')),
      }),
    });

    const res = await handleHeatmap(mockRequest, mockDb);
    expect(res.status).toBe(500);
    const data = await res.json() as { error: string };
    expect(data.error).toBe('Internal server error while retrieving heatmap stats');
  });
});
