import {
  AchievementDefinitionNotFoundError,
  awardAchievement,
  getAchievementDefinitionBySlug,
  getUserAchievementSummary,
  getUserAchievements,
  type AchievementDefinition,
} from '../../src/achievement-utils';
import { DbClient } from '../../src/db';
import * as fs from 'fs';
import * as path from 'path';

// ── Helpers ────────────────────────────────────────────────────────────────

function mockDbClient(): { db: DbClient; mockDB: { prepare: jest.Mock } } {
  const mockDB = { prepare: jest.fn() };
  const db: DbClient = {
    read: mockDB as unknown as D1Database,
    write: mockDB as unknown as D1Database,
  };
  return { db, mockDB };
}

function mockFirst(mockDB: { prepare: jest.Mock }, value: unknown) {
  mockDB.prepare.mockReturnValueOnce({
    bind: jest.fn().mockReturnValue({
      first: jest.fn(() => Promise.resolve(value)),
    }),
  });
}

function mockAll(mockDB: { prepare: jest.Mock }, results: unknown[]) {
  mockDB.prepare.mockReturnValueOnce({
    bind: jest.fn().mockReturnValue({
      all: jest.fn(() => Promise.resolve({ results })),
    }),
  });
}

function mockRun(mockDB: { prepare: jest.Mock }, changes = 1, lastRowId?: number) {
  mockDB.prepare.mockReturnValueOnce({
    bind: jest.fn().mockReturnValue({
      run: jest.fn(() => Promise.resolve({
        meta: { changes, last_row_id: lastRowId ?? 0 },
      })),
    }),
  });
}

function mockRunRejects(mockDB: { prepare: jest.Mock }, error: Error) {
  mockDB.prepare.mockReturnValueOnce({
    bind: jest.fn().mockReturnValue({
      run: jest.fn(() => Promise.reject(error)),
    }),
  });
}

interface DefinitionRowFixture {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  image_slug: string | null;
  badge_type: string;
  is_repeatable: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

function definitionRow(overrides: Partial<DefinitionRowFixture> = {}): DefinitionRowFixture {
  return {
    id: 1,
    slug: 'nazgul-outrun',
    name: 'Outran a Nazgûl',
    description: 'Escaped a Black Rider encounter.',
    image_slug: 'nazgul-outrun-badge',
    badge_type: 'encounter',
    is_repeatable: 0,
    metadata: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Achievement Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAchievementDefinitionBySlug', () => {
    it('returns the mapped definition when found', async () => {
      const { db, mockDB } = mockDbClient();
      mockFirst(mockDB, definitionRow({ is_repeatable: 1 }));

      const result = await getAchievementDefinitionBySlug(db, 'nazgul-outrun');

      expect(result).toEqual<AchievementDefinition>({
        id: 1,
        slug: 'nazgul-outrun',
        name: 'Outran a Nazgûl',
        description: 'Escaped a Black Rider encounter.',
        image_slug: 'nazgul-outrun-badge',
        badge_type: 'encounter',
        is_repeatable: true,
        metadata: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      });
    });

    it('returns null when no definition matches the slug', async () => {
      const { db, mockDB } = mockDbClient();
      mockFirst(mockDB, null);

      const result = await getAchievementDefinitionBySlug(db, 'unknown-slug');

      expect(result).toBeNull();
    });
  });

  describe('awardAchievement', () => {
    it('throws AchievementDefinitionNotFoundError for an unknown slug', async () => {
      const { db, mockDB } = mockDbClient();
      mockFirst(mockDB, null);

      await expect(
        awardAchievement(db, 1, 'does-not-exist', 'key-1'),
      ).rejects.toThrow(AchievementDefinitionNotFoundError);
    });

    it('inserts a new instance on first award and returns isNew: true', async () => {
      const { db, mockDB } = mockDbClient();
      mockFirst(mockDB, definitionRow({ id: 10, is_repeatable: 0 }));
      mockFirst(mockDB, null); // no existing instance for this (non-repeatable) achievement
      mockRun(mockDB, 1, 501);

      const result = await awardAchievement(db, 1, 'nazgul-outrun', 'key-1');

      expect(result).toEqual({ instanceId: 501, isNew: true });
    });

    it('is idempotent: the same idempotency key twice yields one row and isNew: false the second time', async () => {
      const { db, mockDB } = mockDbClient();

      // First award: repeatable badge, no existing instance for key-1, insert succeeds.
      mockFirst(mockDB, definitionRow({ id: 20, is_repeatable: 1 }));
      mockFirst(mockDB, null);
      mockRun(mockDB, 1, 601);

      const first = await awardAchievement(db, 5, 'nazgul-outrun', 'key-1');
      expect(first).toEqual({ instanceId: 601, isNew: true });

      // Second award: same key already recorded -> no insert, same instance returned.
      mockFirst(mockDB, definitionRow({ id: 20, is_repeatable: 1 }));
      mockFirst(mockDB, { id: 601 });

      const second = await awardAchievement(db, 5, 'nazgul-outrun', 'key-1');
      expect(second).toEqual({ instanceId: 601, isNew: false });

      // Only two prepare() calls happened on the duplicate path (definition lookup + existence
      // check) — no INSERT/write query was ever prepared, so the row could not have been touched.
      expect(mockDB.prepare).toHaveBeenCalledTimes(5);
    });

    it('creates a distinct instance for each idempotency key on a repeatable badge', async () => {
      const { db, mockDB } = mockDbClient();

      mockFirst(mockDB, definitionRow({ id: 30, is_repeatable: 1 }));
      mockFirst(mockDB, null);
      mockRun(mockDB, 1, 701);
      const awardA = await awardAchievement(db, 7, 'nazgul-outrun', 'occurrence-a');
      expect(awardA).toEqual({ instanceId: 701, isNew: true });

      mockFirst(mockDB, definitionRow({ id: 30, is_repeatable: 1 }));
      mockFirst(mockDB, null);
      mockRun(mockDB, 1, 702);
      const awardB = await awardAchievement(db, 7, 'nazgul-outrun', 'occurrence-b');
      expect(awardB).toEqual({ instanceId: 702, isNew: true });

      expect(awardA.instanceId).not.toBe(awardB.instanceId);
    });

    it('blocks a second award of a non-repeatable badge even with a different idempotency key', async () => {
      const { db, mockDB } = mockDbClient();

      mockFirst(mockDB, definitionRow({ id: 40, is_repeatable: 0 }));
      mockFirst(mockDB, null);
      mockRun(mockDB, 1, 801);
      const first = await awardAchievement(db, 9, 'nazgul-outrun', 'occurrence-a');
      expect(first).toEqual({ instanceId: 801, isNew: true });

      // Different idempotency key, but an instance already exists for this user+achievement.
      mockFirst(mockDB, definitionRow({ id: 40, is_repeatable: 0 }));
      mockFirst(mockDB, { id: 801 });
      const second = await awardAchievement(db, 9, 'nazgul-outrun', 'occurrence-b');
      expect(second).toEqual({ instanceId: 801, isNew: false });
    });

    it('stores the same idempotency key for a non-repeatable badge regardless of the caller-supplied key', async () => {
      const { db, mockDB } = mockDbClient();

      const preCheckBindSpy = jest.fn().mockReturnValue({ first: jest.fn(() => Promise.resolve(null)) });
      const insertBindSpy = jest.fn().mockReturnValue({
        run: jest.fn(() => Promise.resolve({ meta: { changes: 1, last_row_id: 1101 } })),
      });
      mockFirst(mockDB, definitionRow({ id: 90, is_repeatable: 0 })); // definition lookup
      mockDB.prepare.mockReturnValueOnce({ bind: preCheckBindSpy }); // pre-check lookup
      mockDB.prepare.mockReturnValueOnce({ bind: insertBindSpy }); // insert

      await awardAchievement(db, 1, 'nazgul-outrun', 'caller-key-A');

      const preCheckKey = preCheckBindSpy.mock.calls[0][2];
      const insertKey = insertBindSpy.mock.calls[0][3];
      expect(preCheckKey).toBe(insertKey);
      expect(preCheckKey).not.toBe('caller-key-A');
    });

    it('closes the non-repeatable race window: a second concurrent award with a different key still hits the UNIQUE constraint', async () => {
      const { db, mockDB } = mockDbClient();

      // Simulates two concurrent requests for the same non-repeatable badge, each with a
      // different caller-supplied idempotency key. Both pre-checks run before either insert
      // lands, so both see "no existing row" -- but because non-repeatable awards are stored
      // under the same sentinel key, the second INSERT still collides with the DB constraint.
      mockFirst(mockDB, definitionRow({ id: 95, is_repeatable: 0 }));
      mockFirst(mockDB, null); // pre-check for request A: nothing yet
      mockRun(mockDB, 1, 1201); // request A's insert wins
      const first = await awardAchievement(db, 20, 'nazgul-outrun', 'race-key-a');
      expect(first).toEqual({ instanceId: 1201, isNew: true });

      mockFirst(mockDB, definitionRow({ id: 95, is_repeatable: 0 }));
      mockFirst(mockDB, null); // pre-check for request B: also saw nothing (race window)
      mockRunRejects(mockDB, new Error('D1_ERROR: UNIQUE constraint failed: user_achievement_instances.user_id, user_achievement_instances.achievement_id, user_achievement_instances.idempotency_key'));
      mockFirst(mockDB, { id: 1201 }); // read-back finds request A's row
      const second = await awardAchievement(db, 20, 'nazgul-outrun', 'race-key-b');

      expect(second).toEqual({ instanceId: 1201, isNew: false });
    });

    it('reads back the winning row when a concurrent duplicate insert races and hits the UNIQUE constraint', async () => {
      const { db, mockDB } = mockDbClient();

      mockFirst(mockDB, definitionRow({ id: 50, is_repeatable: 1 }));
      mockFirst(mockDB, null); // pre-check found nothing (race window)
      mockRunRejects(mockDB, new Error('D1_ERROR: UNIQUE constraint failed: user_achievement_instances.user_id, user_achievement_instances.achievement_id, user_achievement_instances.idempotency_key'));
      mockFirst(mockDB, { id: 901 }); // read-back after the race finds the winner's row

      const result = await awardAchievement(db, 11, 'nazgul-outrun', 'key-race');

      expect(result).toEqual({ instanceId: 901, isNew: false });
    });

    it('reads back the winning row when the UNIQUE violation is wrapped in error.cause instead of the top-level message', async () => {
      const { db, mockDB } = mockDbClient();

      const wrapped = new Error('D1_ERROR: internal error', {
        cause: new Error('UNIQUE constraint failed: user_achievement_instances.user_id, user_achievement_instances.achievement_id, user_achievement_instances.idempotency_key'),
      });

      mockFirst(mockDB, definitionRow({ id: 55, is_repeatable: 1 }));
      mockFirst(mockDB, null);
      mockRunRejects(mockDB, wrapped);
      mockFirst(mockDB, { id: 902 });

      const result = await awardAchievement(db, 11, 'nazgul-outrun', 'key-race-wrapped');

      expect(result).toEqual({ instanceId: 902, isNew: false });
    });

    it('rethrows unexpected write errors', async () => {
      const { db, mockDB } = mockDbClient();

      mockFirst(mockDB, definitionRow({ id: 60, is_repeatable: 1 }));
      mockFirst(mockDB, null);
      mockRunRejects(mockDB, new Error('D1_ERROR: disk I/O error'));

      await expect(
        awardAchievement(db, 12, 'nazgul-outrun', 'key-1'),
      ).rejects.toThrow('disk I/O error');
    });

    it('passes context metadata through to the insert', async () => {
      const { db, mockDB } = mockDbClient();
      mockFirst(mockDB, definitionRow({ id: 70, is_repeatable: 1 }));
      mockFirst(mockDB, null);

      const bindSpy = jest.fn().mockReturnValue({
        run: jest.fn(() => Promise.resolve({ meta: { changes: 1, last_row_id: 999 } })),
      });
      mockDB.prepare.mockReturnValueOnce({ bind: bindSpy });

      await awardAchievement(db, 13, 'nazgul-outrun', 'key-1', '{"storyline":"frodo-sam"}');

      expect(bindSpy).toHaveBeenCalledWith(13, 70, '{"storyline":"frodo-sam"}', 'key-1');
    });
  });

  describe('getUserAchievements', () => {
    it('returns earned instances joined with definition metadata', async () => {
      const { db, mockDB } = mockDbClient();
      mockAll(mockDB, [
        {
          id: 1,
          user_id: 5,
          achievement_id: 10,
          earned_at: '2026-01-02T00:00:00Z',
          context_metadata: null,
          idempotency_key: 'key-1',
          created_at: '2026-01-02T00:00:00Z',
          slug: 'nazgul-outrun',
          name: 'Outran a Nazgûl',
          description: 'Escaped a Black Rider encounter.',
          image_slug: 'nazgul-outrun-badge',
          badge_type: 'encounter',
          is_repeatable: 1,
        },
      ]);

      const result = await getUserAchievements(db, 5);

      expect(result).toEqual([
        {
          id: 1,
          user_id: 5,
          achievement_id: 10,
          earned_at: '2026-01-02T00:00:00Z',
          context_metadata: null,
          idempotency_key: 'key-1',
          created_at: '2026-01-02T00:00:00Z',
          slug: 'nazgul-outrun',
          name: 'Outran a Nazgûl',
          description: 'Escaped a Black Rider encounter.',
          image_slug: 'nazgul-outrun-badge',
          badge_type: 'encounter',
          is_repeatable: true,
        },
      ]);
    });

    it('returns an empty array when the user has no earned instances', async () => {
      const { db, mockDB } = mockDbClient();
      mockAll(mockDB, []);

      const result = await getUserAchievements(db, 5);

      expect(result).toEqual([]);
    });
  });

  describe('getUserAchievementSummary', () => {
    it('returns an empty list for a user with no achievements', async () => {
      const { db, mockDB } = mockDbClient();
      mockAll(mockDB, []);

      const result = await getUserAchievementSummary(db, 5);

      expect(result).toEqual([]);
    });

    it('groups multiple earns of a repeatable badge with the correct earned_count', async () => {
      const { db, mockDB } = mockDbClient();
      mockAll(mockDB, [
        {
          achievement_id: 10,
          slug: 'nazgul-outrun',
          name: 'Outran a Nazgûl',
          description: 'Escaped a Black Rider encounter.',
          image_slug: 'nazgul-outrun-badge',
          badge_type: 'encounter',
          is_repeatable: 1,
          earned_count: 3,
          first_earned_at: '2026-01-01T00:00:00Z',
          last_earned_at: '2026-01-03T00:00:00Z',
        },
      ]);

      const result = await getUserAchievementSummary(db, 5);

      expect(result).toEqual([
        {
          achievement_id: 10,
          slug: 'nazgul-outrun',
          name: 'Outran a Nazgûl',
          description: 'Escaped a Black Rider encounter.',
          image_slug: 'nazgul-outrun-badge',
          badge_type: 'encounter',
          is_repeatable: true,
          earned_count: 3,
          first_earned_at: '2026-01-01T00:00:00Z',
          last_earned_at: '2026-01-03T00:00:00Z',
        },
      ]);
    });

    it('includes one-time badges with earned_count: 1', async () => {
      const { db, mockDB } = mockDbClient();
      mockAll(mockDB, [
        {
          achievement_id: 11,
          slug: 'book-fellowship-1-complete',
          name: 'Completed Book I',
          description: null,
          image_slug: null,
          badge_type: 'book',
          is_repeatable: 0,
          earned_count: 1,
          first_earned_at: '2026-01-01T00:00:00Z',
          last_earned_at: '2026-01-01T00:00:00Z',
        },
      ]);

      const result = await getUserAchievementSummary(db, 5);

      expect(result).toEqual([
        expect.objectContaining({ achievement_id: 11, earned_count: 1, is_repeatable: false }),
      ]);
    });

    it('returns multiple distinct badges as separate summary entries', async () => {
      const { db, mockDB } = mockDbClient();
      mockAll(mockDB, [
        {
          achievement_id: 10,
          slug: 'nazgul-outrun',
          name: 'Outran a Nazgûl',
          description: null,
          image_slug: null,
          badge_type: 'encounter',
          is_repeatable: 1,
          earned_count: 1,
          first_earned_at: '2026-01-01T00:00:00Z',
          last_earned_at: '2026-01-01T00:00:00Z',
        },
        {
          achievement_id: 11,
          slug: 'book-fellowship-1-complete',
          name: 'Completed Book I',
          description: null,
          image_slug: null,
          badge_type: 'book',
          is_repeatable: 0,
          earned_count: 1,
          first_earned_at: '2026-01-02T00:00:00Z',
          last_earned_at: '2026-01-02T00:00:00Z',
        },
      ]);

      const result = await getUserAchievementSummary(db, 5);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.achievement_id)).toEqual([10, 11]);
    });
  });

  describe('immutability guarantee', () => {
    it('the module never issues UPDATE or DELETE statements against user_achievement_instances', () => {
      const source = fs.readFileSync(
        path.join(__dirname, '../../src/achievement-utils.ts'),
        'utf-8',
      );

      expect(source).not.toMatch(/UPDATE\s+user_achievement_instances/i);
      expect(source).not.toMatch(/DELETE\s+FROM\s+user_achievement_instances/i);
    });

    it('a duplicate award never prepares a write query, so the existing row cannot be mutated', async () => {
      const { db, mockDB } = mockDbClient();
      mockFirst(mockDB, definitionRow({ id: 80, is_repeatable: 0 }));
      mockFirst(mockDB, { id: 1001 });

      const prepareCallsBefore = mockDB.prepare.mock.calls.length;
      const result = await awardAchievement(db, 1, 'nazgul-outrun', 'any-key');
      const prepareCallsAfter = mockDB.prepare.mock.calls.length;

      expect(result).toEqual({ instanceId: 1001, isNew: false });
      // Exactly the two read-only lookups happened — no INSERT was prepared.
      expect(prepareCallsAfter - prepareCallsBefore).toBe(2);
    });
  });
});
