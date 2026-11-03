jest.mock('../../src/achievement-utils', () => ({
  getUserAchievementSummary: jest.fn(),
}));

import { handleGetAchievements } from '../../src/achievement-handlers';
import {
  getUserAchievementSummary,
  type AchievementSummary,
} from '../../src/achievement-utils';
import type { DbClient } from '../../src/db';

const mockedSummary = jest.mocked(getUserAchievementSummary);

interface AchievementsResponse {
  achievements: Array<Record<string, unknown>>;
}

function summaryEntry(overrides: Partial<AchievementSummary> = {}): AchievementSummary {
  return {
    achievement_id: 10,
    slug: 'journey-frodo-sam-buckleberry-ferry',
    name: 'Across the Buckleberry Ferry',
    description: 'The first step out of the Shire.',
    image_slug: 'journey-frodo-sam-buckleberry-ferry',
    badge_type: 'journey',
    is_repeatable: false,
    metadata: '{"rank":1,"storyline":"frodo-sam"}',
    earned_count: 1,
    first_earned_at: '2026-01-01T00:00:00Z',
    last_earned_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function mockDb(friendship: { id: number } | null = null) {
  const first = jest.fn().mockResolvedValue(friendship);
  const bind = jest.fn(() => ({ first }));
  const prepare = jest.fn(() => ({ bind }));
  const db: DbClient = {
    read: { prepare } as unknown as D1Database,
    write: { prepare } as unknown as D1Database,
  };
  return { db, prepare, bind, first };
}

function request(query = ''): Request {
  return new Request(`http://localhost/api/achievements${query}`);
}

describe('handleGetAchievements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSummary.mockResolvedValue([]);
  });

  it('returns the caller’s own summary with display fields and no raw metadata', async () => {
    const { db, prepare } = mockDb();
    mockedSummary.mockResolvedValue([summaryEntry()]);

    const response = await handleGetAchievements(request(), db, 7);

    expect(response.status).toBe(200);
    const body = await response.json() as AchievementsResponse;
    expect(body.achievements).toHaveLength(1);
    expect(body.achievements[0]).toMatchObject({
      achievement_id: 10,
      slug: 'journey-frodo-sam-buckleberry-ferry',
      name: 'Across the Buckleberry Ferry',
      description: 'The first step out of the Shire.',
      image_slug: 'journey-frodo-sam-buckleberry-ferry',
      badge_type: 'journey',
      is_repeatable: false,
      earned_count: 1,
      first_earned_at: '2026-01-01T00:00:00Z',
      last_earned_at: '2026-01-01T00:00:00Z',
    });
    expect(body.achievements[0]).not.toHaveProperty('metadata');
    expect(mockedSummary).toHaveBeenCalledWith(db, 7);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('returns an empty achievements array when the user has none', async () => {
    const { db } = mockDb();

    const response = await handleGetAchievements(request(), db, 7);

    expect(response.status).toBe(200);
    const body = await response.json() as AchievementsResponse;
    expect(body.achievements).toEqual([]);
  });

  it('allows an accepted friend to fetch another user’s summary', async () => {
    const { db } = mockDb({ id: 55 });
    mockedSummary.mockResolvedValue([summaryEntry()]);

    const response = await handleGetAchievements(request('?userId=2'), db, 7);

    expect(response.status).toBe(200);
    expect(mockedSummary).toHaveBeenCalledWith(db, 2);
    const body = await response.json() as AchievementsResponse;
    expect(body.achievements).toHaveLength(1);
  });

  it('returns 404 for a non-friend', async () => {
    const { db } = mockDb(null);

    const response = await handleGetAchievements(request('?userId=2'), db, 7);

    expect(response.status).toBe(404);
    expect(mockedSummary).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown user, indistinguishable from a non-friend', async () => {
    const { db } = mockDb(null);

    const response = await handleGetAchievements(request('?userId=99999'), db, 7);

    expect(response.status).toBe(404);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('User not found or not a friend');
    expect(mockedSummary).not.toHaveBeenCalled();
  });

  it('resolves a self query to the caller without a friendship check', async () => {
    const { db, prepare } = mockDb(null);
    mockedSummary.mockResolvedValue([summaryEntry()]);

    const response = await handleGetAchievements(request('?userId=7'), db, 7);

    expect(response.status).toBe(200);
    expect(prepare).not.toHaveBeenCalled();
    expect(mockedSummary).toHaveBeenCalledWith(db, 7);
  });

  it.each(['abc', '0', '-1', '1.5', '', '   ', '12abc', '99999999999999999999'])(
    'returns 400 for invalid userId %p',
    async (value) => {
      const { db, prepare } = mockDb();

      const response = await handleGetAchievements(
        request(`?userId=${encodeURIComponent(value)}`),
        db,
        7,
      );

      expect(response.status).toBe(400);
      expect(prepare).not.toHaveBeenCalled();
      expect(mockedSummary).not.toHaveBeenCalled();
    },
  );

  it('preserves newest-first ordering from the summary query', async () => {
    const { db } = mockDb();
    mockedSummary.mockResolvedValue([
      summaryEntry({
        achievement_id: 2,
        slug: 'newer',
        last_earned_at: '2026-03-01T00:00:00Z',
      }),
      summaryEntry({
        achievement_id: 1,
        slug: 'older',
        last_earned_at: '2026-01-01T00:00:00Z',
      }),
    ]);

    const response = await handleGetAchievements(request(), db, 7);

    const body = await response.json() as AchievementsResponse;
    expect(body.achievements.map((entry) => entry.slug)).toEqual(['newer', 'older']);
  });

  it('maps each entry through the presentation resolver', async () => {
    const { db } = mockDb();
    mockedSummary.mockResolvedValue([
      summaryEntry({
        achievement_id: 20,
        slug: 'habit-faithful-walker',
        name: 'Faithful Walker',
        badge_type: 'habit',
        is_repeatable: true,
        metadata: '{"rank_thresholds":[1,4,12,26]}',
        earned_count: 5,
      }),
      summaryEntry({
        achievement_id: 21,
        slug: 'journey-frodo-sam-glittering-caves',
        name: 'The Glittering Caves',
        metadata: '{"rank":4,"storyline":"frodo-sam","collection":{"slug":"frodo-sam-journey","label":"The Road to Mordor","index":7,"size":8}}',
      }),
      summaryEntry({
        achievement_id: 22,
        slug: 'malformed-metadata',
        metadata: 'not json',
      }),
    ]);

    const response = await handleGetAchievements(request(), db, 7);

    const body = await response.json() as AchievementsResponse;
    expect(body.achievements.map((entry) => entry.presentation)).toEqual([
      { rank: 2, rank_label: 'silver', storyline: null, collection: null },
      {
        rank: 4,
        rank_label: 'mithril',
        storyline: 'frodo-sam',
        collection: {
          slug: 'frodo-sam-journey',
          label: 'The Road to Mordor',
          index: 7,
          size: 8,
        },
      },
      { rank: 1, rank_label: 'bronze', storyline: null, collection: null },
    ]);
    expect(body.achievements.every((entry) => !('metadata' in entry))).toBe(true);
  });

  it('returns 500 and logs when the summary query fails', async () => {
    const { db } = mockDb();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedSummary.mockRejectedValue(new Error('D1_ERROR: disk I/O error'));

    const response = await handleGetAchievements(request(), db, 7);

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
