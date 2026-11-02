jest.mock('../../src/auth-handlers', () => ({
  ...jest.requireActual('../../src/auth-handlers'),
  validateSession: jest.fn(),
}));

import { handleGetProfileOverview } from '../../src/profile-handlers';
import { validateSession } from '../../src/auth-handlers';
import type { DbClient } from '../../src/db';

const mockedValidateSession = jest.mocked(validateSession);

interface OverviewBody {
  username: string;
  avatarId: string | null;
  totalDistance: number;
  memberSince: string;
  currentGoalTitle: string | null;
  activeStoryline: {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    pathKey: string;
    adminOnly: boolean;
    distanceOffset: number;
  };
  fellowships: Array<{ id: number; name: string }>;
}

interface UserFixture {
  username: string;
  avatar_id: string | null;
  created_at: string;
}

interface StorylineFixture {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  path_key: string;
  sort_order: number;
  is_active: number;
  admin_only: number;
  storyline_distance_offset: number | null;
}

interface GoalFixture {
  storyline_goal_id: number;
  id: number;
  title: string;
  distance: number;
  description: string | null;
  image_id: string | null;
  special: string | null;
  sort_order: number;
  has_content: number;
}

interface MembershipFixture {
  id: number;
  name: string;
  status: 'active' | 'left';
  dissolved_at: string | null;
}

type SqlRoute = 'progress' | 'storyline' | 'user' | 'goals' | 'fellowships';

const defaultUser: UserFixture = {
  username: 'FrodoBaggins',
  avatar_id: 'frodo',
  created_at: '2024-08-15 18:30:00',
};

const defaultStoryline: StorylineFixture = {
  id: 3,
  slug: 'frodo-sam',
  title: 'Frodo & Sam',
  description: 'Follow the hobbits to Mount Doom.',
  path_key: 'fellowship',
  sort_order: 1,
  is_active: 1,
  admin_only: 0,
  storyline_distance_offset: 0,
};

function goal(title: string, distance: number, id = distance): GoalFixture {
  return {
    storyline_goal_id: id,
    id,
    title,
    distance,
    description: null,
    image_id: null,
    special: null,
    sort_order: id,
    has_content: 0,
  };
}

function fellowship(id: number, name: string, status: MembershipFixture['status'] = 'active', dissolvedAt: string | null = null): MembershipFixture {
  return { id, name, status, dissolved_at: dissolvedAt };
}

function routeSql(sql: string): SqlRoute {
  if (sql.includes('FROM progress')) return 'progress';
  if (sql.includes('FROM users u')) return 'storyline';
  if (sql.includes('SELECT username, avatar_id, created_at FROM users')) return 'user';
  if (sql.includes('FROM storyline_goals sg')) return 'goals';
  if (sql.includes('FROM party_members pm')) return 'fellowships';
  throw new Error(`Unexpected SQL in profile overview test: ${sql}`);
}

interface Fixtures {
  progress?: Array<{ distance: number }>;
  storyline?: StorylineFixture | null;
  user?: UserFixture | null;
  goals?: GoalFixture[];
  memberships?: MembershipFixture[];
  /** Route whose statement throws, to exercise the DB-error branch. */
  failRoute?: SqlRoute;
}

/**
 * Minimal D1 stand-in. Each statement is routed by shape and answered from the
 * fixtures. For fellowships the fake evaluates the predicates the statement
 * declares, so a query that stops filtering active/non-dissolved rows (or stops
 * ordering by name) surfaces as a response difference instead of being hidden
 * by the fixture.
 */
function createDb(fixtures: Fixtures = {}) {
  const {
    progress = [{ distance: 100 }],
    storyline = defaultStoryline,
    user = defaultUser,
    goals = [goal('Buckleberry Ferry', 50), goal('Rivendell', 200)],
    memberships = [],
    failRoute,
  } = fixtures;

  const fellowshipResults = (sql: string) => {
    const activeOnly = sql.includes("pm.status = 'active'");
    const nonDissolved = sql.includes('p.dissolved_at IS NULL');
    const nameOrdered = sql.includes('ORDER BY p.name');
    const rows = memberships
      .filter((membership) => (!activeOnly || membership.status === 'active')
        && (!nonDissolved || membership.dissolved_at === null))
      .map(({ id, name }) => ({ id, name }));
    return nameOrdered
      ? rows.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
      : rows;
  };

  const execute = (route: SqlRoute, sql: string) => {
    if (failRoute === route) {
      throw new Error('D1 read failed');
    }
    switch (route) {
      case 'progress':
        return { results: progress };
      case 'storyline':
        return storyline;
      case 'user':
        return user;
      case 'goals':
        return { results: [...goals].sort((a, b) => a.distance - b.distance) };
      case 'fellowships':
        return { results: fellowshipResults(sql) };
    }
  };

  const prepare = jest.fn((sql: string) => {
    const route = routeSql(sql);
    return {
      bind: jest.fn(() => ({
        first: jest.fn(() => Promise.resolve(execute(route, sql))),
        all: jest.fn(() => Promise.resolve(execute(route, sql))),
      })),
      first: jest.fn(() => Promise.resolve(execute(route, sql))),
      all: jest.fn(() => Promise.resolve(execute(route, sql))),
    };
  });

  const db: DbClient = {
    read: { prepare } as unknown as D1Database,
    write: { prepare } as unknown as D1Database,
  };

  return { db };
}

function request(): Request {
  return new Request('http://localhost/api/profile/overview');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedValidateSession.mockResolvedValue({ valid: true, userId: 7 });
});

describe('handleGetProfileOverview', () => {
  it('returns the self-overview shape for the authenticated user', async () => {
    const { db } = createDb({
      progress: [{ distance: 400 }, { distance: 600 }],
      goals: [goal('Buckleberry Ferry', 50), goal('Rivendell', 900)],
      memberships: [fellowship(3, 'Fellowship of the Ring')],
    });

    const response = await handleGetProfileOverview(request(), db, 7);

    expect(response.status).toBe(200);
    const body = await response.json() as OverviewBody;
    expect(body).toEqual({
      username: 'FrodoBaggins',
      avatarId: 'frodo',
      totalDistance: 1000,
      memberSince: '2024-08-15T18:30:00.000Z',
      currentGoalTitle: 'Rivendell',
      activeStoryline: {
        id: 3,
        slug: 'frodo-sam',
        title: 'Frodo & Sam',
        description: 'Follow the hobbits to Mount Doom.',
        pathKey: 'fellowship',
        adminOnly: false,
        distanceOffset: 0,
      },
      fellowships: [{ id: 3, name: 'Fellowship of the Ring' }],
    });
    expect(mockedValidateSession).toHaveBeenCalledWith(request(), db, undefined);
  });

  it('applies the storyline distance offset to totalDistance', async () => {
    const { db } = createDb({
      progress: [{ distance: 1000 }],
      storyline: { ...defaultStoryline, storyline_distance_offset: 120 },
    });

    const response = await handleGetProfileOverview(request(), db, 7);

    const body = await response.json() as OverviewBody;
    expect(body.totalDistance).toBe(1120);
    expect(body.activeStoryline.distanceOffset).toBe(120);
    expect(body).not.toHaveProperty('rawTotalDistance');
  });

  it('reports the next unreached storyline goal as currentGoalTitle', async () => {
    const { db } = createDb({
      progress: [{ distance: 150 }],
      goals: [goal('Buckleberry Ferry', 50), goal('Rivendell', 200), goal('Moria', 500)],
    });

    const body = await (await handleGetProfileOverview(request(), db, 7)).json() as OverviewBody;

    expect(body.currentGoalTitle).toBe('Rivendell');
  });

  it('falls back to the last goal title once every goal is reached', async () => {
    const { db } = createDb({
      progress: [{ distance: 900 }],
      goals: [goal('Buckleberry Ferry', 50), goal('Rivendell', 200), goal('Moria', 500)],
    });

    const body = await (await handleGetProfileOverview(request(), db, 7)).json() as OverviewBody;

    expect(body.currentGoalTitle).toBe('Moria');
  });

  it('returns a null currentGoalTitle for a goal-less storyline', async () => {
    const { db } = createDb({ goals: [] });

    const response = await handleGetProfileOverview(request(), db, 7);

    expect(response.status).toBe(200);
    const body = await response.json() as OverviewBody;
    expect(body.currentGoalTitle).toBeNull();
    expect(body.totalDistance).toBe(100);
    expect(body.activeStoryline.title).toBe('Frodo & Sam');
  });

  it('converts the SQLite created_at value to an ISO 8601 UTC string', async () => {
    const { db } = createDb({
      user: { username: 'Samwise', avatar_id: null, created_at: '2023-01-02 03:04:05' },
    });

    const body = await (await handleGetProfileOverview(request(), db, 7)).json() as OverviewBody;

    expect(body.memberSince).toBe('2023-01-02T03:04:05.000Z');
    expect(body.memberSince).not.toBe('2023-01-02 03:04:05');
    expect(body.avatarId).toBeNull();
  });

  it.each([
    ['a naive T-separated value', '2023-01-02T03:04:05'],
    ['a value with an explicit Z', '2023-01-02T03:04:05.000Z'],
    ['a value with a numeric offset', '2023-01-02T05:04:05+02:00'],
  ])('normalizes %s to the same ISO 8601 UTC string', async (_label, createdAt) => {
    const { db } = createDb({
      user: { username: 'Samwise', avatar_id: null, created_at: createdAt },
    });

    const body = await (await handleGetProfileOverview(request(), db, 7)).json() as OverviewBody;

    expect(body.memberSince).toBe('2023-01-02T03:04:05.000Z');
  });

  it('lists only active, non-dissolved fellowships as { id, name }, ordered by name', async () => {
    const { db } = createDb({
      memberships: [
        fellowship(9, 'Rangers of the North'),
        fellowship(4, 'Fellowship of the Ring'),
        fellowship(5, 'Dissolved Company', 'active', '2025-01-01 00:00:00'),
        fellowship(6, 'Left Company', 'left'),
      ],
    });

    const body = await (await handleGetProfileOverview(request(), db, 7)).json() as OverviewBody;

    expect(body.fellowships).toEqual([
      { id: 4, name: 'Fellowship of the Ring' },
      { id: 9, name: 'Rangers of the North' },
    ]);
    expect(body.fellowships[0]).not.toHaveProperty('is_shared');
  });

  it('returns an empty fellowships array when the user has none', async () => {
    const { db } = createDb({ memberships: [] });

    const body = await (await handleGetProfileOverview(request(), db, 7)).json() as OverviewBody;

    expect(body.fellowships).toEqual([]);
  });

  it('returns 401 when the session is invalid and never reads the database', async () => {
    mockedValidateSession.mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    });
    const { db } = createDb();

    const response = await handleGetProfileOverview(request(), db, 7);

    expect(response.status).toBe(401);
    expect(db.read.prepare).not.toHaveBeenCalled();
  });

  it('returns 404 when the authenticated user row is missing', async () => {
    const { db } = createDb({ user: null });

    const response = await handleGetProfileOverview(request(), db, 7);

    expect(response.status).toBe(404);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('User not found');
  });

  it('returns 500 and logs the error when a database read fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db } = createDb({ failRoute: 'progress' });

    const response = await handleGetProfileOverview(request(), db, 7);

    expect(response.status).toBe(500);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('Internal server error');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
