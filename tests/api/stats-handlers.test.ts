import { handleWeeklyStats, handleHeatmap, handleWrappedStats } from '../../src/stats-handlers';
import { validateSession, validateAdminSession } from '../../src/auth-handlers';
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

  const mockStorylineRow = {
    id: 1,
    slug: 'frodo-sam',
    title: 'Frodo & Sam',
    description: null,
    path_key: 'fellowship',
    sort_order: 0,
    is_active: 1,
    storyline_distance_offset: 0,
  };

  function mockResolveUserStoryline(offset = 0) {
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ ...mockStorylineRow, storyline_distance_offset: offset }) }),
    );
  }

  function mockStorylineGoals(goals: Array<{ id: number; title: string; distance: number; special: string | null; sort_order?: number }>) {
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: goals.map((goal, index) => ({
            storyline_goal_id: index + 1,
            description: null,
            image_id: null,
            sort_order: goal.sort_order ?? index + 1,
            ...goal,
          })),
        }),
      }),
    );
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
      read: mockDB as unknown as DbClient['read'],
      write: mockDB as unknown as DbClient['write'],
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
    mockResolveUserStoryline();
    mockStorylineGoals([
      { id: 1, title: 'Rivendell', distance: 458, special: null },
      { id: 2, title: 'Lothlórien', distance: 917, special: 'major' },
    ]);
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
    mockResolveUserStoryline();
    mockStorylineGoals([
      { id: 1, title: 'Rivendell', distance: 458, special: null },
      { id: 2, title: 'Lothlórien', distance: 917, special: 'major' },
      { id: 3, title: 'Far Away', distance: 2000, special: 'major' },
    ]);
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
    const storyline = createChainableMock({ first: jest.fn().mockResolvedValue(mockStorylineRow) });
    const goals = createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) });
    const fellowships = createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) });

    mockDB.prepare
      .mockReturnValueOnce(activityCheck)
      .mockReturnValueOnce(thisWeek)
      .mockReturnValueOnce(prevWeek)
      .mockReturnValueOnce(totalDistance)
      .mockReturnValueOnce(storyline)
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
    mockResolveUserStoryline();
    mockStorylineGoals([]);
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
    mockResolveUserStoryline();
    mockStorylineGoals([
      { id: 1, title: 'Small Step', distance: 910, special: null },
      { id: 2, title: 'Lothlórien', distance: 917, special: 'major' },
    ]);
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
  
  it('projects against the active storyline distance and goals', async () => {
    // 30-day count
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ count: 10 }) }),
    );
    // This week: 100 km
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 100 }) }),
    );
    // Previous week
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 0 }) }),
    );
    // Raw total distance remains 0 after resetting onto the shortcut route
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 0 }) }),
    );
    mockResolveUserStoryline(160.934);
    mockStorylineGoals([
      { id: 1, title: 'Bag End', distance: 0, special: 'start' },
      { id: 2, title: 'Isengard', distance: 160.934, special: null },
      { id: 3, title: 'Mount Doom', distance: 321.868, special: 'major' },
    ]);
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );

    const res = await handleWeeklyStats(mockRequest, mockDb);
    expect(res.status).toBe(200);
    const data = await res.json() as {
      projection: { title: string; km_to_next: number } | null;
    };
    expect(data.projection?.title).toBe('Mount Doom');
    expect(data.projection?.km_to_next).toBe(160.9);
    expect(mockDB.prepare).toHaveBeenCalledWith(expect.stringContaining('FROM storyline_goals sg'));
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
    mockResolveUserStoryline();
    mockStorylineGoals([
      { id: 1, title: 'Next Goal', distance: 300, special: null },
    ]);
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
  const fixedNow = new Date('2026-04-08T12:00:00Z');
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
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
    jest.clearAllMocks();
    (validateSession as jest.Mock).mockResolvedValue({ valid: true, userId: 1 });

    mockDB = {
      prepare: jest.fn(() => createChainableMock()),
      batch: jest.fn().mockResolvedValue([]),
    };
    mockDb = {
      read: mockDB as unknown as DbClient['read'],
      write: mockDB as unknown as DbClient['write'],
    };

    mockRequest = new Request('https://example.com/api/stats/heatmap', {
      headers: { Authorization: 'Bearer test-token' },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
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

  it('ignores future-dated walks when calculating streak metrics', async () => {
    const today = new Date();
    const formatD = (d: Date) => d.toISOString().slice(0, 10);
    const day = (offset: number) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - offset);
      return formatD(d);
    };

    const windowQuery = createChainableMock({
      all: jest.fn().mockResolvedValue({
        results: [
          { date: day(1), distance: 4.0 },
          { date: day(0), distance: 3.0 },
        ],
      }),
    });
    const allTimeQuery = createChainableMock({
      all: jest.fn().mockResolvedValue({
        results: [
          { date: day(1) },
          { date: day(0) },
          { date: day(-1) },
          { date: day(-2) },
        ],
      }),
    });

    mockDB.prepare
      .mockReturnValueOnce(windowQuery)
      .mockReturnValueOnce(allTimeQuery)
      .mockReturnValueOnce(createChainableMock({ first: jest.fn().mockResolvedValue({ created_at: day(30) }) }));

    const res = await handleHeatmap(mockRequest, mockDb);
    const data = await res.json() as { currentStreak: number; longestStreak: number };

    expect(allTimeQuery.bind).toHaveBeenCalledWith(1, day(0));
    expect(data.currentStreak).toBe(2);
    expect(data.longestStreak).toBe(2);
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

describe('Stats Handlers – handleWrappedStats', () => {
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
    (validateAdminSession as jest.Mock).mockResolvedValue({ valid: true, userId: 1, isAdmin: true });

    mockDB = {
      prepare: jest.fn(() => createChainableMock()),
      batch: jest.fn().mockResolvedValue([]),
    };
    mockDb = {
      read: mockDB as unknown as DbClient['read'],
      write: mockDB as unknown as DbClient['write'],
    };

    mockRequest = new Request('https://example.com/api/stats/wrapped?year=2025', {
      headers: { Authorization: 'Bearer test-token' },
    });
  });

  it('returns 401 when session is invalid', async () => {
    (validateAdminSession as jest.Mock).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    });

    const res = await handleWrappedStats(mockRequest, mockDb);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not admin', async () => {
    (validateAdminSession as jest.Mock).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    });

    const res = await handleWrappedStats(mockRequest, mockDb);
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid year parameter', async () => {
    mockRequest = new Request('https://example.com/api/stats/wrapped?year=abc', {
      headers: { Authorization: 'Bearer test-token' },
    });

    const res = await handleWrappedStats(mockRequest, mockDb);
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toBe('Invalid year parameter');
  });

  it('returns 400 for malformed year values with numeric prefixes', async () => {
    mockRequest = new Request('https://example.com/api/stats/wrapped?year=2025abc', {
      headers: { Authorization: 'Bearer test-token' },
    });

    const res = await handleWrappedStats(mockRequest, mockDb);
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toBe('Invalid year parameter');
  });

  it('returns 400 for year out of range', async () => {
    mockRequest = new Request('https://example.com/api/stats/wrapped?year=1999', {
      headers: { Authorization: 'Bearer test-token' },
    });

    const res = await handleWrappedStats(mockRequest, mockDb);
    expect(res.status).toBe(400);
  });

  it('returns wrapped stats for a year with activity', async () => {
    // 1. Total distance for year
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 350.5 }) }),
    );
    // 2. Walk count
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ count: 120 }) }),
    );
    // 3. Active days
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ count: 95 }) }),
    );
    // 4. Year walks for streak calculation
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({
        results: [
          { date: '2025-03-01' }, { date: '2025-03-02' }, { date: '2025-03-03' },
          { date: '2025-03-04' }, { date: '2025-03-05' },
          { date: '2025-06-10' }, { date: '2025-06-11' },
        ],
      }) }),
    );
    // 5. Monthly aggregation
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({
        results: [
          { month: '03', total: 120 },
          { month: '06', total: 80 },
          { month: '01', total: 50 },
        ],
      }) }),
    );
    // 6. Distance before year
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 100 }) }),
    );
    // 7. Distance end of year
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 450.5 }) }),
    );
    // 8. Milestones (between 100 and 450.5 km distance)
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({
        results: [
          { id: 5, title: 'Bucklebury Ferry', distance: 150, special: null, image_id: '5' },
          { id: 10, title: 'The Prancing Pony', distance: 300, special: 'The Prancing Pony', image_id: '10' },
          { id: 15, title: 'Weathertop', distance: 400, special: 'Weathertop', image_id: '15' },
        ],
      }) }),
    );
    // 9. Fellowships
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({
        results: [
          { party_id: 1, party_name: 'The Fellowship', party_year_km: 500 },
        ],
      }) }),
    );
    // 10. First walk date
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ first_date: '2025-01-15' }) }),
    );

    const res = await handleWrappedStats(mockRequest, mockDb);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.year).toBe(2025);
    expect(data.total_distance_km).toBe(350.5);
    expect(data.journey_pct).toBe(19.5);
    expect(data.walk_count).toBe(120);
    expect(data.active_days).toBe(95);
    expect(data.best_streak).toBe(5);
    expect(data.favorite_month).toEqual({ month: 3, name: 'March', total_km: 120 });
    expect((data.milestones as unknown[]).length).toBe(3);
    expect((data.fellowship_highlights as unknown[]).length).toBe(1);
    expect(data.first_walk_date).toBe('2025-01-15');
    expect(typeof data.narrative).toBe('string');
    expect((data.narrative as string).length).toBeGreaterThan(0);
  });

  it('returns zero data when user has no walks in the year', async () => {
    // 1. Total distance
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 0 }) }),
    );
    // 2. Walk count
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ count: 0 }) }),
    );
    // 3. Active days
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ count: 0 }) }),
    );
    // 4. Year walks
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );
    // 5. Monthly
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );
    // 6. Distance before year
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 0 }) }),
    );
    // 7. Distance end of year
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 0 }) }),
    );
    // 8. Milestones
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );
    // 9. Fellowships
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );
    // 10. First walk date
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ first_date: null }) }),
    );

    const res = await handleWrappedStats(mockRequest, mockDb);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.total_distance_km).toBe(0);
    expect(data.walk_count).toBe(0);
    expect(data.best_streak).toBe(0);
    expect(data.favorite_month).toBeNull();
    expect(data.milestones).toEqual([]);
    expect(data.fellowship_highlights).toEqual([]);
  });

  it('uses positive-distance rows consistently for wrapped activity queries', async () => {
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 0 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ count: 0 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ count: 0 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 0 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 0 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ first_date: null }) }),
    );

    const res = await handleWrappedStats(mockRequest, mockDb);
    expect(res.status).toBe(200);

    const queries = mockDB.prepare.mock.calls.map(([sql]) => sql as string);
    expect(queries[1]).toContain('distance > 0');
    expect(queries[2]).toContain('distance > 0');
    expect(queries[3]).toContain('distance > 0');
    expect(queries[4]).toContain('distance > 0');
    expect(queries[9]).toContain('distance > 0');
  });

  it('filters to special milestones when count exceeds threshold', async () => {
    // Create > 10 milestones to trigger filtering
    const manyMilestones = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      title: `Milestone ${i + 1}`,
      distance: 100 + (i * 30),
      special: i % 4 === 0 ? `Special ${i + 1}` : null,
      image_id: String(i + 1),
    }));

    // 1-3: year totals
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 500 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ count: 50 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ count: 40 }) }),
    );
    // 4: walks for streak
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );
    // 5: monthly
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [{ month: '05', total: 100 }] }) }),
    );
    // 6: distance before year
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 50 }) }),
    );
    // 7: distance end of year
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 550 }) }),
    );
    // 8: milestones (12 items = > threshold of 10)
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: manyMilestones }) }),
    );
    // 9: fellowships
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );
    // 10: first walk date
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ first_date: '2025-02-01' }) }),
    );

    const res = await handleWrappedStats(mockRequest, mockDb);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    const milestones = data.milestones as { special: string | null }[];
    // Only special milestones should remain (indices 0, 4, 8 have special)
    expect(milestones.length).toBe(3);
    expect(milestones.every((m) => m.special !== null)).toBe(true);
  });

  it('defaults to current year when year param is missing', async () => {
    mockRequest = new Request('https://example.com/api/stats/wrapped', {
      headers: { Authorization: 'Bearer test-token' },
    });

    // Set up all 10 mock DB calls for the handler
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 0 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ count: 0 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ count: 0 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 0 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 0 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ first_date: null }) }),
    );

    const res = await handleWrappedStats(mockRequest, mockDb);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.year).toBe(new Date().getUTCFullYear());
  });

  it('returns 500 on database error', async () => {
    mockDB.prepare.mockReturnValueOnce({
      bind: jest.fn().mockReturnValue({
        first: jest.fn().mockRejectedValue(new Error('DB failure')),
      }),
    });

    const res = await handleWrappedStats(mockRequest, mockDb);
    expect(res.status).toBe(500);
    const data = await res.json() as { error: string };
    expect(data.error).toBe('Internal server error while retrieving wrapped stats');
  });

  it('includes narrative with Tolkien-flavored text', async () => {
    // Mock all required DB calls with data that produces a rich narrative
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 200 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ count: 60 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ count: 50 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({
        results: [{ date: '2025-04-01' }, { date: '2025-04-02' }, { date: '2025-04-03' }],
      }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({
        results: [{ month: '04', total: 80 }],
      }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 0 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ total: 200 }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({
        results: [
          { id: 3, title: 'The Prancing Pony', distance: 150, special: 'The Prancing Pony', image_id: '3' },
        ],
      }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ all: jest.fn().mockResolvedValue({ results: [] }) }),
    );
    mockDB.prepare.mockReturnValueOnce(
      createChainableMock({ first: jest.fn().mockResolvedValue({ first_date: '2025-01-05' }) }),
    );

    const res = await handleWrappedStats(mockRequest, mockDb);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    const narrative = data.narrative as string;
    expect(narrative).toContain('Like Bilbo in the Shire');
    expect(narrative).toContain('2025-01-05');
    expect(narrative).toContain('200 km');
    expect(narrative).toContain('hobbit');
    expect(narrative).toContain('April');
    expect(narrative).toContain('The Prancing Pony');
  });
});
