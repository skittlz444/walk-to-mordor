import {
  GOAL_CONTENT_LIMITS,
  DuplicateSortOrderError,
  createGoalContent,
  deleteGoalContent,
  goalHasContent,
  listGoalContent,
  recordDiscoveryEvent,
  updateGoalContent,
  validateGoalContentInput,
  type GoalContentInput,
  type GoalContentRow,
} from '../../src/goal-content-helpers';
import { DbClient } from '../../src/db';

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

const validInput: GoalContentInput = {
  type: 'story',
  title: 'At the Campfire',
  body: 'A tale from the road.',
  author_attribution: 'Bilbo',
  sort_order: 2,
};

function goalContentRow(overrides: Partial<GoalContentRow> = {}): GoalContentRow {
  return {
    id: 10,
    goal_id: 5,
    type: 'story',
    title: 'At the Campfire',
    body: 'A tale from the road.',
    author_attribution: 'Bilbo',
    sort_order: 2,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Goal Content Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  describe('validateGoalContentInput', () => {
    it('accepts valid content, trims text fields, and normalizes blank attribution', () => {
      const result = validateGoalContentInput({
        type: 'appendix',
        title: '  Lore Notes  ',
        body: '  Body stays authored.  ',
        author_attribution: '   ',
        sort_order: 0,
      });

      expect(result).toEqual({
        ok: true,
        value: {
          type: 'appendix',
          title: 'Lore Notes',
          body: '  Body stays authored.  ',
          author_attribution: null,
          sort_order: 0,
        },
      });
    });

    it('trims non-empty attribution', () => {
      const result = validateGoalContentInput({
        ...validInput,
        author_attribution: '  Bilbo Baggins  ',
      });

      expect(result).toEqual({
        ok: true,
        value: {
          ...validInput,
          author_attribution: 'Bilbo Baggins',
        },
      });
    });

    it.each([
      ['invalid request body', null, 'Invalid request body'],
      ['invalid type', { ...validInput, type: 'song' }, 'Type must be one of'],
      ['missing title', { ...validInput, title: '   ' }, 'Title is required'],
      [
        'title too long',
        { ...validInput, title: 'x'.repeat(GOAL_CONTENT_LIMITS.TITLE_MAX + 1) },
        'Title must be 120 characters or less',
      ],
      ['missing body', { ...validInput, body: '   ' }, 'Body is required'],
      [
        'body too long',
        { ...validInput, body: 'x'.repeat(GOAL_CONTENT_LIMITS.BODY_MAX + 1) },
        'Body must be 20000 characters or less',
      ],
      [
        'attribution too long',
        { ...validInput, author_attribution: 'x'.repeat(GOAL_CONTENT_LIMITS.ATTRIBUTION_MAX + 1) },
        'Attribution must be 255 characters or less',
      ],
      ['non-string attribution', { ...validInput, author_attribution: 123 }, 'Attribution must be a string'],
      ['non-integer sort order', { ...validInput, sort_order: 1.5 }, 'Sort order must be an integer'],
      ['sort order below range', { ...validInput, sort_order: -1 }, 'Sort order must be between 0 and 999'],
      ['sort order above range', { ...validInput, sort_order: 1000 }, 'Sort order must be between 0 and 999'],
    ])('rejects %s', (_name, body, expectedError) => {
      const result = validateGoalContentInput(body);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain(expectedError);
      }
    });
  });

  describe('data access', () => {
    let db: DbClient;
    let mockDB: { prepare: jest.Mock };

    beforeEach(() => {
      const client = mockDbClient();
      db = client.db;
      mockDB = client.mockDB;
    });

    it('lists goal content using ordered persistence', async () => {
      const rows = [
        goalContentRow({ id: 1, sort_order: 0, title: 'First' }),
        goalContentRow({ id: 2, sort_order: 1, title: 'Second' }),
      ];
      mockAll(mockDB, rows);

      const entries = await listGoalContent(db, 5);

      expect(entries.map((entry) => entry.title)).toEqual(['First', 'Second']);
      expect(mockDB.prepare.mock.calls[0][0]).toContain('ORDER BY sort_order ASC, id ASC');
    });

    it('creates content after checking duplicate sort order', async () => {
      const createdRow = goalContentRow({ id: 44 });
      mockFirst(mockDB, null);
      mockRun(mockDB, 1, 44);
      mockFirst(mockDB, createdRow);

      const created = await createGoalContent(db, 5, validInput);

      expect(created).toEqual(createdRow);
      expect(mockDB.prepare).toHaveBeenCalledTimes(3);
    });

    it('rejects duplicate sort order on create', async () => {
      mockFirst(mockDB, { id: 99 });

      await expect(createGoalContent(db, 5, validInput)).rejects.toBeInstanceOf(DuplicateSortOrderError);
      expect(mockDB.prepare).toHaveBeenCalledTimes(1);
    });

    it('throws if created row cannot be fetched', async () => {
      mockFirst(mockDB, null);
      mockRun(mockDB, 1, 44);
      mockFirst(mockDB, null);

      await expect(createGoalContent(db, 5, validInput)).rejects.toThrow('Failed to fetch created goal content');
    });

    it('updates content after checking duplicate sort order', async () => {
      const existing = goalContentRow();
      const updated = goalContentRow({ title: 'Updated title', sort_order: 3 });
      mockFirst(mockDB, existing);
      mockFirst(mockDB, null);
      mockRun(mockDB, 1);
      mockFirst(mockDB, updated);

      const result = await updateGoalContent(db, 10, { ...validInput, title: 'Updated title', sort_order: 3 });

      expect(result).toEqual(updated);
      expect(mockDB.prepare).toHaveBeenCalledTimes(4);
    });

    it('returns null when updating a missing entry', async () => {
      mockFirst(mockDB, null);

      await expect(updateGoalContent(db, 404, validInput)).resolves.toBeNull();
      expect(mockDB.prepare).toHaveBeenCalledTimes(1);
    });

    it('rejects duplicate sort order on update', async () => {
      mockFirst(mockDB, goalContentRow());
      mockFirst(mockDB, { id: 11 });

      await expect(updateGoalContent(db, 10, validInput)).rejects.toBeInstanceOf(DuplicateSortOrderError);
    });

    it('deletes content and reports whether a row changed', async () => {
      mockRun(mockDB, 1);
      await expect(deleteGoalContent(db, 10)).resolves.toBe(true);

      mockRun(mockDB, 0);
      await expect(deleteGoalContent(db, 11)).resolves.toBe(false);
    });

    it('checks whether a goal has content', async () => {
      mockFirst(mockDB, { present: 1 });
      await expect(goalHasContent(db, 5)).resolves.toBe(true);

      mockFirst(mockDB, null);
      await expect(goalHasContent(db, 6)).resolves.toBe(false);
    });

    it('records discovery events', async () => {
      mockRun(mockDB, 1);

      await recordDiscoveryEvent(db, {
        userId: 1,
        partyId: 2,
        goalId: 5,
        contentId: 10,
        eventType: 'content_open',
        contextType: 'fellowship',
      });

      expect(mockDB.prepare).toHaveBeenCalledTimes(1);
    });

    it('swallows discovery event database failures', async () => {
      mockDB.prepare.mockImplementationOnce(() => {
        throw new Error('D1 unavailable');
      });

      await expect(recordDiscoveryEvent(db, {
        userId: 1,
        partyId: null,
        goalId: 5,
        contentId: null,
        eventType: 'teaser_impression',
        contextType: 'personal',
      })).resolves.toBeUndefined();
      expect(console.error).toHaveBeenCalledWith('Failed to record content discovery event:', expect.any(Error));
    });
  });
});
