import { DbClient } from '../../src/db';
import type { GoalContentRow } from '../../src/goal-content-helpers';

// Mock validateSession
jest.mock('../../src/auth-handlers', () => ({
  validateSession: jest.fn(),
}));

jest.mock('../../src/journal-helpers', () => ({
  hasUserReachedGoal: jest.fn(),
  hasFellowshipReachedGoal: jest.fn(),
  hasAnyFellowshipReachedGoal: jest.fn(),
  isActivePartyMember: jest.fn(),
}));

jest.mock('../../src/admin-handlers', () => ({
  logAdminAction: jest.fn(),
}));

import { validateSession } from '../../src/auth-handlers';
import {
  hasAnyFellowshipReachedGoal,
  hasFellowshipReachedGoal,
  hasUserReachedGoal,
  isActivePartyMember,
} from '../../src/journal-helpers';
import { logAdminAction } from '../../src/admin-handlers';
import {
  handleAdminGoalContentCreate,
  handleAdminGoalContentDelete,
  handleAdminGoalContentList,
  handleAdminGoalContentUpdate,
  handleContentDiscoveryEvent,
  handleGoalContentGet,
} from '../../src/goal-content-handlers';

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

function createRequest(path: string, headers?: Record<string, string>): Request {
  return new Request(`https://example.com${path}`, {
    headers: { 'Authorization': '******', ...headers },
  });
}

function contentRow(overrides: Partial<GoalContentRow> = {}): GoalContentRow {
  return {
    id: 10,
    goal_id: 5,
    type: 'story',
    title: 'Campfire tale',
    body: 'Lore body',
    author_attribution: 'Bilbo',
    sort_order: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

const validBody = {
  type: 'story',
  title: 'Campfire tale',
  body: 'Lore body',
  author_attribution: 'Bilbo',
  sort_order: 1,
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Goal Content Handlers', () => {
  let db: DbClient;
  let mockDB: { prepare: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    const client = mockDbClient();
    db = client.db;
    mockDB = client.mockDB;
    (validateSession as jest.Mock).mockResolvedValue({ valid: true, userId: 1 });
    (hasUserReachedGoal as jest.Mock).mockResolvedValue(false);
    (hasFellowshipReachedGoal as jest.Mock).mockResolvedValue(false);
    (hasAnyFellowshipReachedGoal as jest.Mock).mockResolvedValue(false);
    (isActivePartyMember as jest.Mock).mockResolvedValue(false);
    (logAdminAction as jest.Mock).mockResolvedValue(undefined);
  });

  describe('admin CRUD handlers', () => {
    it('lists content entries in stored order', async () => {
      const rows = [
        contentRow({ id: 1, title: 'First', sort_order: 0 }),
        contentRow({ id: 2, title: 'Second', sort_order: 1 }),
      ];
      mockAll(mockDB, rows);

      const resp = await handleAdminGoalContentList(createRequest('/api/admin/goals/5/content'), db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(200);
      expect(data.entries.map((entry: GoalContentRow) => entry.title)).toEqual(['First', 'Second']);
      expect(mockDB.prepare.mock.calls[0][0]).toContain('ORDER BY sort_order ASC, id ASC');
    });

    it('returns 500 when list fails', async () => {
      mockDB.prepare.mockImplementationOnce(() => {
        throw new Error('D1 unavailable');
      });

      const resp = await handleAdminGoalContentList(createRequest('/api/admin/goals/5/content'), db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(500);
      expect(data.error).toContain('listing goal content');
    });

    it('creates content and logs the admin action', async () => {
      mockFirst(mockDB, { id: 5 });
      mockFirst(mockDB, null);
      mockRun(mockDB, 1, 10);
      mockFirst(mockDB, contentRow());

      const resp = await handleAdminGoalContentCreate(
        createRequest('/api/admin/goals/5/content', { 'CF-Connecting-IP': '203.0.113.1' }),
        db,
        5,
        validBody,
        99,
      );
      const data = await resp.json();

      expect(resp.status).toBe(201);
      expect(data.id).toBe(10);
      expect(logAdminAction).toHaveBeenCalledWith(db, expect.objectContaining({
        adminUserId: 99,
        action: 'create_goal_content',
        targetId: 10,
        ipAddress: '203.0.113.1',
        success: true,
      }));
    });

    it('returns 404 when creating content for a missing goal', async () => {
      mockFirst(mockDB, null);

      const resp = await handleAdminGoalContentCreate(
        createRequest('/api/admin/goals/404/content'),
        db,
        404,
        validBody,
        99,
      );
      const data = await resp.json();

      expect(resp.status).toBe(404);
      expect(data.error).toBe('Goal not found');
      expect(logAdminAction).not.toHaveBeenCalled();
    });

    it('returns 400 when create validation fails', async () => {
      mockFirst(mockDB, { id: 5 });

      const resp = await handleAdminGoalContentCreate(
        createRequest('/api/admin/goals/5/content'),
        db,
        5,
        { ...validBody, type: 'song' },
        99,
      );
      const data = await resp.json();

      expect(resp.status).toBe(400);
      expect(data.error).toContain('Type must be one of');
      expect(logAdminAction).not.toHaveBeenCalled();
    });

    it('returns 409 when create hits duplicate sort order', async () => {
      mockFirst(mockDB, { id: 5 });
      mockFirst(mockDB, { id: 10 });

      const resp = await handleAdminGoalContentCreate(
        createRequest('/api/admin/goals/5/content'),
        db,
        5,
        validBody,
        99,
      );
      const data = await resp.json();

      expect(resp.status).toBe(409);
      expect(data.error).toContain('sort order already exists');
      expect(logAdminAction).not.toHaveBeenCalled();
    });

    it('returns 200 when update succeeds', async () => {
      mockFirst(mockDB, contentRow());
      mockFirst(mockDB, contentRow());
      mockFirst(mockDB, null);
      mockRun(mockDB, 1);
      mockFirst(mockDB, contentRow({ title: 'Updated', sort_order: 2 }));

      const resp = await handleAdminGoalContentUpdate(
        createRequest('/api/admin/goals/5/content/10'),
        db,
        5,
        10,
        { ...validBody, title: 'Updated', sort_order: 2 },
        99,
      );
      const data = await resp.json();

      expect(resp.status).toBe(200);
      expect(data.title).toBe('Updated');
      expect(logAdminAction).toHaveBeenCalledWith(db, expect.objectContaining({
        action: 'update_goal_content',
        targetId: 10,
      }));
    });

    it('returns 404 when update target is missing', async () => {
      mockFirst(mockDB, null);

      const resp = await handleAdminGoalContentUpdate(
        createRequest('/api/admin/goals/5/content/404'),
        db,
        5,
        404,
        validBody,
        99,
      );

      expect(resp.status).toBe(404);
      expect(logAdminAction).not.toHaveBeenCalled();
    });

    it('returns 404 when update target belongs to another goal', async () => {
      mockFirst(mockDB, contentRow({ goal_id: 6 }));

      const resp = await handleAdminGoalContentUpdate(
        createRequest('/api/admin/goals/5/content/10'),
        db,
        5,
        10,
        validBody,
        99,
      );

      expect(resp.status).toBe(404);
      expect(logAdminAction).not.toHaveBeenCalled();
    });

    it('returns 400 when update validation fails', async () => {
      mockFirst(mockDB, contentRow());

      const resp = await handleAdminGoalContentUpdate(
        createRequest('/api/admin/goals/5/content/10'),
        db,
        5,
        10,
        { ...validBody, title: '   ' },
        99,
      );

      expect(resp.status).toBe(400);
      expect(logAdminAction).not.toHaveBeenCalled();
    });

    it('returns 409 when update hits duplicate sort order', async () => {
      mockFirst(mockDB, contentRow());
      mockFirst(mockDB, contentRow());
      mockFirst(mockDB, { id: 11 });

      const resp = await handleAdminGoalContentUpdate(
        createRequest('/api/admin/goals/5/content/10'),
        db,
        5,
        10,
        validBody,
        99,
      );
      const data = await resp.json();

      expect(resp.status).toBe(409);
      expect(data.error).toContain('sort order already exists');
      expect(logAdminAction).not.toHaveBeenCalled();
    });

    it('returns 404 if update helper cannot refetch the entry', async () => {
      mockFirst(mockDB, contentRow());
      mockFirst(mockDB, null);

      const resp = await handleAdminGoalContentUpdate(
        createRequest('/api/admin/goals/5/content/10'),
        db,
        5,
        10,
        validBody,
        99,
      );

      expect(resp.status).toBe(404);
    });

    it('deletes content and logs the admin action', async () => {
      mockFirst(mockDB, contentRow());
      mockRun(mockDB, 1);

      const resp = await handleAdminGoalContentDelete(
        createRequest('/api/admin/goals/5/content/10'),
        db,
        5,
        10,
        99,
      );
      const data = await resp.json();

      expect(resp.status).toBe(200);
      expect(data.message).toBe('Goal content deleted');
      expect(logAdminAction).toHaveBeenCalledWith(db, expect.objectContaining({
        action: 'delete_goal_content',
        targetId: 10,
      }));
    });

    it('returns 404 when delete target is missing', async () => {
      mockFirst(mockDB, null);

      const resp = await handleAdminGoalContentDelete(
        createRequest('/api/admin/goals/5/content/404'),
        db,
        5,
        404,
        99,
      );

      expect(resp.status).toBe(404);
      expect(logAdminAction).not.toHaveBeenCalled();
    });

    it('returns 404 when delete target belongs to another goal', async () => {
      mockFirst(mockDB, contentRow({ goal_id: 6 }));

      const resp = await handleAdminGoalContentDelete(
        createRequest('/api/admin/goals/5/content/10'),
        db,
        5,
        10,
        99,
      );

      expect(resp.status).toBe(404);
      expect(logAdminAction).not.toHaveBeenCalled();
    });

    it('returns 500 when delete fails', async () => {
      mockFirst(mockDB, contentRow());
      mockDB.prepare.mockImplementationOnce(() => {
        throw new Error('D1 unavailable');
      });

      const resp = await handleAdminGoalContentDelete(
        createRequest('/api/admin/goals/5/content/10'),
        db,
        5,
        10,
        99,
      );

      expect(resp.status).toBe(500);
    });
  });

  describe('public goal-content reads', () => {
    it('returns entries when personal progress unlocks the goal', async () => {
      (hasUserReachedGoal as jest.Mock).mockResolvedValue(true);
      mockAll(mockDB, [contentRow()]);

      const resp = await handleGoalContentGet(createRequest('/api/goals/5/content'), db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(200);
      expect(data.entries).toHaveLength(1);
      expect(hasUserReachedGoal).toHaveBeenCalledWith(db, 1, 5);
      expect(hasAnyFellowshipReachedGoal).not.toHaveBeenCalled();
    });

    it('returns 403 when all unlock checks fail', async () => {
      const resp = await handleGoalContentGet(createRequest('/api/goals/5/content'), db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(403);
      expect(data.error).toBe('This goal content is locked');
      expect(hasAnyFellowshipReachedGoal).toHaveBeenCalledWith(db, 1, 5);
    });

    it('returns 403 when partyId viewer is not an active member', async () => {
      const resp = await handleGoalContentGet(createRequest('/api/goals/5/content?partyId=99'), db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(403);
      expect(data.error).toContain('not an active member');
      expect(isActivePartyMember).toHaveBeenCalledWith(db, 1, 99);
      expect(hasUserReachedGoal).not.toHaveBeenCalled();
    });

    it('rejects invalid partyId', async () => {
      const resp = await handleGoalContentGet(createRequest('/api/goals/5/content?partyId=abc'), db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(400);
      expect(data.error).toBe('Invalid partyId');
    });

    it('returns entries when fellowship progress unlocks the goal', async () => {
      (isActivePartyMember as jest.Mock).mockResolvedValue(true);
      (hasFellowshipReachedGoal as jest.Mock).mockResolvedValue(true);
      mockAll(mockDB, [contentRow()]);

      const resp = await handleGoalContentGet(createRequest('/api/goals/5/content?partyId=99'), db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(200);
      expect(data.entries).toHaveLength(1);
      expect(hasUserReachedGoal).toHaveBeenCalledWith(db, 1, 5);
      expect(hasFellowshipReachedGoal).toHaveBeenCalledWith(db, 99, 5);
    });

    it('returns entries when any fellowship unlocks without partyId', async () => {
      (hasAnyFellowshipReachedGoal as jest.Mock).mockResolvedValue(true);
      mockAll(mockDB, [contentRow({ id: 11 })]);

      const resp = await handleGoalContentGet(createRequest('/api/goals/5/content'), db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(200);
      expect(data.entries[0].id).toBe(11);
    });

    it('returns an empty list when unlocked goal has no entries', async () => {
      (hasUserReachedGoal as jest.Mock).mockResolvedValue(true);
      mockAll(mockDB, []);

      const resp = await handleGoalContentGet(createRequest('/api/goals/5/content'), db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(200);
      expect(data.entries).toEqual([]);
    });

    it('returns the validation error for unauthenticated reads', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      });

      const resp = await handleGoalContentGet(createRequest('/api/goals/5/content'), db, 5);

      expect(resp.status).toBe(401);
    });

    it('returns 500 when unlocked content read fails', async () => {
      (hasUserReachedGoal as jest.Mock).mockResolvedValue(true);
      mockDB.prepare.mockImplementationOnce(() => {
        throw new Error('D1 unavailable');
      });

      const resp = await handleGoalContentGet(createRequest('/api/goals/5/content'), db, 5);

      expect(resp.status).toBe(500);
    });
  });

  describe('discovery events', () => {
    it('rejects invalid event_type', async () => {
      const resp = await handleContentDiscoveryEvent(
        createRequest('/api/goals/5/content/events'),
        db,
        5,
        { event_type: 'bad', context_type: 'personal' },
        jest.fn(),
      );
      const data = await resp.json();

      expect(resp.status).toBe(400);
      expect(data.error).toBe('Invalid event_type');
    });

    it('rejects invalid context_type', async () => {
      const resp = await handleContentDiscoveryEvent(
        createRequest('/api/goals/5/content/events'),
        db,
        5,
        { event_type: 'content_open', context_type: 'bad' },
        jest.fn(),
      );
      const data = await resp.json();

      expect(resp.status).toBe(400);
      expect(data.error).toBe('Invalid context_type');
    });

    it('schedules valid discovery events and returns 202', async () => {
      const scheduleBackground = jest.fn();
      mockRun(mockDB, 1);

      const resp = await handleContentDiscoveryEvent(
        createRequest('/api/goals/5/content/events'),
        db,
        5,
        {
          event_type: 'content_open',
          context_type: 'fellowship',
          partyId: 99,
          content_id: 10,
        },
        scheduleBackground,
      );
      const data = await resp.json();

      expect(resp.status).toBe(202);
      expect(data.accepted).toBe(true);
      expect(scheduleBackground).toHaveBeenCalledWith(expect.any(Promise));
      await scheduleBackground.mock.calls[0][0];
    });

    it('returns the validation error for unauthenticated event writes', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      });

      const resp = await handleContentDiscoveryEvent(
        createRequest('/api/goals/5/content/events'),
        db,
        5,
        { event_type: 'content_open', context_type: 'personal' },
        jest.fn(),
      );

      expect(resp.status).toBe(401);
    });
  });
});
