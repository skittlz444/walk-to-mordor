import {
  handleAdminStorylinesList,
  handleAdminStorylineGet,
  handleAdminStorylineCreate,
  handleAdminStorylineUpdate,
  handleAdminStorylineGoalsUpdate,
} from '../../src/admin-handlers';
import { DbClient } from '../../src/db';
import * as authUtils from '../../src/auth-utils';

jest.mock('../../src/auth-utils', () => ({
  isValidUsername: jest.fn(),
  isSessionExpired: jest.fn(),
  generateSalt: jest.fn(),
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
  generateSessionId: jest.fn(),
  isValidEmail: jest.fn(),
  isValidPassword: jest.fn(),
  getSessionExpiry: jest.fn(),
  generatePasswordResetToken: jest.fn(),
  getPasswordResetExpiry: jest.fn(),
  isPasswordResetTokenExpired: jest.fn(),
  generateEmailConfirmationToken: jest.fn(),
  getEmailConfirmationExpiry: jest.fn(),
  isEmailConfirmationTokenExpired: jest.fn(),
}));

describe('Admin Storyline Handlers', () => {
  let mockDB: { prepare: jest.Mock; batch: jest.Mock };
  let mockDb: DbClient;
  let mockRequest: Request;
  let adminUserId: number;

  const mockStorylineDbRow = {
    id: 1,
    slug: 'frodo-sam',
    title: 'Frodo & Sam',
    description: null,
    path_key: 'fellowship',
    sort_order: 0,
    is_active: 1,
    admin_only: 0,
    goal_count: 3,
    min_distance: 100,
    max_distance: 1779,
  };

  const mockAdminStorylineSummary = {
    id: 1,
    slug: 'frodo-sam',
    title: 'Frodo & Sam',
    description: null,
    pathKey: 'fellowship',
    sortOrder: 0,
    isActive: true,
    goalCount: 3,
    minDistance: 100,
    maxDistance: 1779,
  };

  const mockGoalRow = {
    storyline_goal_id: 10,
    goal_id: 1,
    title: 'Rivendell',
    distance: 458,
    sort_order: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    adminUserId = 42;

    (authUtils.isSessionExpired as jest.Mock).mockReturnValue(false);

    mockDB = { prepare: jest.fn(), batch: jest.fn() };
    mockDb = { read: mockDB as unknown as D1Database, write: mockDB as unknown as D1Database };
    mockRequest = new Request('https://example.com', {
      headers: {
        'Authorization': 'Bearer mock-admin-token',
        'CF-Connecting-IP': '127.0.0.1',
      },
    });
  });

  // Helper: mock the logAdminAction DB write
  function mockLogAdminAction() {
    mockDB.prepare.mockReturnValueOnce({
      bind: jest.fn().mockReturnValue({ run: jest.fn(() => Promise.resolve({})) }),
    });
  }

  // Helper: mock getAdminStorylineSummary
  function mockGetAdminStorylineSummary(row: typeof mockStorylineDbRow | null) {
    mockDB.prepare.mockReturnValueOnce({
      bind: jest.fn().mockReturnValue({ first: jest.fn(() => Promise.resolve(row)) }),
    });
  }

  // Helper: mock the storyline detail goals query (used in buildStorylineDetailResponse)
  function mockGoalsQuery(goals: typeof mockGoalRow[]) {
    mockDB.prepare.mockReturnValueOnce({
      bind: jest.fn().mockReturnValue({ all: jest.fn(() => Promise.resolve({ results: goals })) }),
    });
  }

  // -------------------------------------------------------------------------
  describe('handleAdminStorylinesList', () => {
    it('returns list of storylines', async () => {
      mockDB.prepare.mockReturnValueOnce({
        all: jest.fn(() => Promise.resolve({ results: [mockStorylineDbRow] })),
      });

      const response = await handleAdminStorylinesList(mockRequest, mockDb);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.storylines).toHaveLength(1);
      expect(data.storylines[0].slug).toBe('frodo-sam');
      expect(data.storylines[0].is_active).toBe(true);
      expect(data.storylines[0].admin_only).toBe(false);
    });

    it('returns 500 on database error', async () => {
      mockDB.prepare.mockReturnValueOnce({
        all: jest.fn(() => Promise.reject(new Error('DB error'))),
      });

      const response = await handleAdminStorylinesList(mockRequest, mockDb);
      expect(response.status).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  describe('handleAdminStorylineGet', () => {
    it('returns storyline with goals', async () => {
      mockGetAdminStorylineSummary(mockStorylineDbRow);
      mockGoalsQuery([mockGoalRow]);

      const response = await handleAdminStorylineGet(mockRequest, mockDb, 1);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.storyline.slug).toBe('frodo-sam');
      expect(data.goals).toHaveLength(1);
      expect(data.goals[0].storyline_goal_id).toBe(10);
    });

    it('returns 404 when storyline not found', async () => {
      mockGetAdminStorylineSummary(null);

      const response = await handleAdminStorylineGet(mockRequest, mockDb, 99);
      expect(response.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  describe('handleAdminStorylineCreate', () => {
    const validBody = {
      slug: 'new-path',
      title: 'New Path',
      pathKey: 'fellowship',
      sortOrder: 1,
      isActive: true,
    };

    it('creates a new storyline and copies goals from existing', async () => {
      // Copy-from storyline lookup
      mockDB.prepare.mockReturnValueOnce({
        first: jest.fn(() => Promise.resolve({ id: 1 })),
      });
      // INSERT storyline
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ run: jest.fn(() => Promise.resolve({ meta: { last_row_id: 2 } })) }),
      });
      // INSERT INTO storyline_goals SELECT
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ run: jest.fn(() => Promise.resolve({})) }),
      });
      mockLogAdminAction();
      // getAdminStorylineSummary for response
      mockGetAdminStorylineSummary({ ...mockStorylineDbRow, id: 2, slug: 'new-path', title: 'New Path' });

      const response = await handleAdminStorylineCreate(mockRequest, mockDb, validBody, adminUserId);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.storyline.slug).toBe('new-path');
    });

    it('creates first storyline with no copy source (empty goals)', async () => {
      // Copy-from: no existing storylines
      mockDB.prepare.mockReturnValueOnce({
        first: jest.fn(() => Promise.resolve(null)),
      });
      // INSERT storyline
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ run: jest.fn(() => Promise.resolve({ meta: { last_row_id: 1 } })) }),
      });
      // No INSERT INTO storyline_goals (skipped when no copy source)
      mockLogAdminAction();
      mockGetAdminStorylineSummary({ ...mockStorylineDbRow, id: 1 });

      const response = await handleAdminStorylineCreate(mockRequest, mockDb, validBody, adminUserId);
      expect(response.status).toBe(201);
    });

    it('creates an explicitly empty storyline when copy source is null', async () => {
      // INSERT storyline (no copy-from lookup when caller explicitly requests no goals)
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ run: jest.fn(() => Promise.resolve({ meta: { last_row_id: 3 } })) }),
      });
      mockLogAdminAction();
      mockGetAdminStorylineSummary({ ...mockStorylineDbRow, id: 3, slug: 'empty-path', title: 'Empty Path' });

      const response = await handleAdminStorylineCreate(
        mockRequest,
        mockDb,
        { ...validBody, slug: 'empty-path', title: 'Empty Path', copyFromStorylineId: null },
        adminUserId,
      );

      expect(response.status).toBe(201);
      expect(mockDB.prepare).not.toHaveBeenCalledWith(expect.stringContaining('SELECT id FROM storylines'));
    });

    it('creates an admin-only storyline', async () => {
      mockDB.prepare.mockReturnValueOnce({
        first: jest.fn(() => Promise.resolve({ id: 1 })),
      });
      const insertRun = jest.fn(() => Promise.resolve({ meta: { last_row_id: 4 } }));
      const insertBind = jest.fn().mockReturnValue({ run: insertRun });
      mockDB.prepare.mockReturnValueOnce({ bind: insertBind });
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ run: jest.fn(() => Promise.resolve({})) }),
      });
      mockLogAdminAction();
      mockGetAdminStorylineSummary({ ...mockStorylineDbRow, id: 4, slug: 'draft-path', title: 'Draft Path', admin_only: 1 });

      const response = await handleAdminStorylineCreate(
        mockRequest,
        mockDb,
        { ...validBody, slug: 'draft-path', title: 'Draft Path', adminOnly: true },
        adminUserId,
      );
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(insertBind).toHaveBeenCalledWith('draft-path', 'Draft Path', null, 'fellowship', 1, 1, 1);
      expect(data.storyline.admin_only).toBe(true);
    });

    it('returns 400 for invalid slug', async () => {
      const response = await handleAdminStorylineCreate(
        mockRequest, mockDb, { ...validBody, slug: 'INVALID_SLUG' }, adminUserId,
      );
      expect(response.status).toBe(400);
    });

    it('returns 409 on duplicate slug', async () => {
      mockDB.prepare.mockReturnValueOnce({
        first: jest.fn(() => Promise.resolve({ id: 1 })),
      });
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          run: jest.fn(() => Promise.reject(new Error('UNIQUE constraint failed'))),
        }),
      });

      const response = await handleAdminStorylineCreate(mockRequest, mockDb, validBody, adminUserId);
      expect(response.status).toBe(409);
    });
  });

  // -------------------------------------------------------------------------
  describe('handleAdminStorylineUpdate', () => {
    const validBody = {
      slug: 'frodo-sam',
      title: 'Frodo & Sam Updated',
      pathKey: 'fellowship',
      sortOrder: 0,
      isActive: true,
    };

    it('updates a storyline metadata', async () => {
      mockGetAdminStorylineSummary(mockStorylineDbRow);
      // UPDATE storylines
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ run: jest.fn(() => Promise.resolve({})) }),
      });
      mockLogAdminAction();
      mockGetAdminStorylineSummary({ ...mockStorylineDbRow, title: 'Frodo & Sam Updated' });

      const response = await handleAdminStorylineUpdate(mockRequest, mockDb, 1, validBody, adminUserId);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.storyline.title).toBe('Frodo & Sam Updated');
    });

    it('updates admin-only visibility', async () => {
      mockGetAdminStorylineSummary(mockStorylineDbRow);
      const updateBind = jest.fn().mockReturnValue({ run: jest.fn(() => Promise.resolve({})) });
      mockDB.prepare.mockReturnValueOnce({ bind: updateBind });
      mockLogAdminAction();
      mockGetAdminStorylineSummary({ ...mockStorylineDbRow, admin_only: 1 });

      const response = await handleAdminStorylineUpdate(
        mockRequest,
        mockDb,
        1,
        { ...validBody, adminOnly: true },
        adminUserId,
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(updateBind).toHaveBeenCalledWith('frodo-sam', 'Frodo & Sam Updated', null, 'fellowship', 0, 1, 1, 1);
      expect(data.storyline.admin_only).toBe(true);
    });

    it('returns 404 when storyline not found', async () => {
      mockGetAdminStorylineSummary(null);

      const response = await handleAdminStorylineUpdate(mockRequest, mockDb, 99, validBody, adminUserId);
      expect(response.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  describe('handleAdminStorylineGoalsUpdate', () => {
    const validBody = {
      goals: [
        { goalId: 1, distance: 100, sortOrder: 0 },
        { goalId: 2, distance: 200, sortOrder: 1 },
      ],
    };

    it('replaces all goals for a storyline', async () => {
      // 1. getAdminStorylineSummary
      mockGetAdminStorylineSummary(mockStorylineDbRow);
      // 2. DELETE stmt (stored, then passed to batch)
      mockDB.prepare.mockReturnValueOnce({ bind: jest.fn().mockReturnValue({}) });
      // 3+4. INSERT stmts for 2 goals (stored, passed to batch)
      mockDB.prepare.mockReturnValueOnce({ bind: jest.fn().mockReturnValue({}) });
      mockDB.prepare.mockReturnValueOnce({ bind: jest.fn().mockReturnValue({}) });
      // batch
      mockDB.batch.mockResolvedValueOnce([{}]);
      // 5. logAdminAction
      mockLogAdminAction();
      // 6+7. buildStorylineDetailResponse
      mockGetAdminStorylineSummary(mockStorylineDbRow);
      mockGoalsQuery([mockGoalRow]);

      const response = await handleAdminStorylineGoalsUpdate(mockRequest, mockDb, 1, validBody, adminUserId);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDB.batch).toHaveBeenCalledTimes(1);
      // batch called with [delete, insert, insert] (1 delete + 2 inserts)
      const batchArgs = (mockDB.batch as jest.Mock).mock.calls[0][0];
      expect(batchArgs).toHaveLength(3);
    });

    it('clears all goals when empty array is submitted', async () => {
      // 1. getAdminStorylineSummary
      mockGetAdminStorylineSummary(mockStorylineDbRow);
      // 2. DELETE stmt only (no inserts for empty array)
      mockDB.prepare.mockReturnValueOnce({ bind: jest.fn().mockReturnValue({}) });
      // batch with just the delete stmt
      mockDB.batch.mockResolvedValueOnce([{}]);
      // 3. logAdminAction
      mockLogAdminAction();
      // 4+5. buildStorylineDetailResponse
      mockGetAdminStorylineSummary(mockStorylineDbRow);
      mockGoalsQuery([]);

      const response = await handleAdminStorylineGoalsUpdate(mockRequest, mockDb, 1, { goals: [] }, adminUserId);
      const data = await response.json();

      expect(response.status).toBe(200);
      // batch called with [delete] only (no inserts)
      const batchArgs = (mockDB.batch as jest.Mock).mock.calls[0][0];
      expect(batchArgs).toHaveLength(1);
      expect(data.goals).toHaveLength(0);
    });

    it('returns 400 when goals is missing', async () => {
      const response = await handleAdminStorylineGoalsUpdate(mockRequest, mockDb, 1, {}, adminUserId);
      expect(response.status).toBe(400);
    });

    it('returns 404 when storyline not found', async () => {
      mockGetAdminStorylineSummary(null);

      const response = await handleAdminStorylineGoalsUpdate(mockRequest, mockDb, 99, validBody, adminUserId);
      expect(response.status).toBe(404);
    });

    it('returns 400 for invalid goal entry', async () => {
      const badBody = {
        goals: [{ goalId: 'not-a-number', distance: 100 }],
      };
      const response = await handleAdminStorylineGoalsUpdate(mockRequest, mockDb, 1, badBody, adminUserId);
      expect(response.status).toBe(400);
    });
  });
});
