import { handleAdminGoalCreate } from '../../src/admin-handlers';
import { DbClient } from '../../src/db';

// Mock auth-utils (required since admin-handlers transitively relies on auth exports)
jest.mock('../../src/auth-utils', () => ({
  generateSalt: jest.fn(),
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
  generateSessionId: jest.fn(),
  isValidEmail: jest.fn(),
  isValidPassword: jest.fn(),
  isValidUsername: jest.fn(),
  getSessionExpiry: jest.fn(),
  isSessionExpired: jest.fn(),
  generatePasswordResetToken: jest.fn(),
  getPasswordResetExpiry: jest.fn(),
  isPasswordResetTokenExpired: jest.fn(),
  generateEmailConfirmationToken: jest.fn(),
  getEmailConfirmationExpiry: jest.fn(),
  isEmailConfirmationTokenExpired: jest.fn()
}));

jest.mock('../../src/email-utils', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendConfirmationEmail: jest.fn()
}));

describe('Admin Goal Create Handler (Story 4.6)', () => {
  let mockDB: { prepare: jest.Mock };
  let mockDb: DbClient;
  let mockRequest: { headers: { get: jest.Mock }; url: string };
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    originalConsoleError = console.error;
    console.error = jest.fn();

    mockDB = { prepare: jest.fn() };
    mockDb = { read: mockDB as unknown as D1Database, write: mockDB as unknown as D1Database };

    mockRequest = {
      headers: { get: jest.fn().mockReturnValue(null) },
      url: 'https://wtm.haydencarson.com/api/admin/goals',
    };
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  /**
   * Helper to set up sequential DB prepare calls.
   */
  function setupDbCalls(calls: Array<{
    first?: unknown;
    run?: unknown;
    all?: unknown;
  }>) {
    calls.forEach((call) => {
      const mockBind = jest.fn().mockReturnValue({
        first: jest.fn().mockResolvedValue(call.first ?? null),
        run: jest.fn().mockResolvedValue(call.run ?? { meta: { changes: 1, last_row_id: 99 } }),
        all: jest.fn().mockResolvedValue({ results: call.all ?? [] }),
      });
      mockDB.prepare.mockReturnValueOnce({ bind: mockBind });
    });
  }

  const validBody = {
    title: 'Camp at Weathertop',
    distance_miles: 120.5,
    description: 'A camp near the ancient watchtower.',
    special: null,
    image_id: null,
  };

  const createdGoal = {
    id: 99,
    title: 'Camp at Weathertop',
    distance: 193.93, // 120.5 * 1.60934
    description: 'A camp near the ancient watchtower.',
    special: null,
    image_id: null,
  };

  describe('handleAdminGoalCreate', () => {
    it('should create goal and return 201 with goal record', async () => {
      // 1) INSERT run  2) SELECT first  3) audit log run
      setupDbCalls([
        { run: { meta: { changes: 1, last_row_id: 99 } } },  // INSERT
        { first: createdGoal },                                 // SELECT created
        { run: { meta: { changes: 1 } } },                     // audit log INSERT
      ]);

      const res = await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        validBody,
        1
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBe(99);
      expect(body.title).toBe('Camp at Weathertop');
    });

    it('should convert distance correctly: miles * 1.60934', async () => {
      setupDbCalls([
        { run: { meta: { changes: 1, last_row_id: 99 } } },
        { first: createdGoal },
        { run: { meta: { changes: 1 } } },
      ]);

      await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        { ...validBody, distance_miles: 100 },
        1
      );

      // Verify the INSERT bind args
      const insertCall = mockDB.prepare.mock.calls[0];
      expect(insertCall[0]).toContain('INSERT INTO goals');
      const bindArgs = mockDB.prepare.mock.results[0].value.bind.mock.calls[0];
      expect(bindArgs[0]).toBeCloseTo(160.934, 2); // 100 * 1.60934
    });

    it('should return 400 for missing title', async () => {
      const res = await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        { ...validBody, title: '' },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Title is required');
    });

    it('should return 400 for empty-after-trim title', async () => {
      const res = await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        { ...validBody, title: '   ' },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Title is required');
    });

    it('should return 400 for missing distance', async () => {
      const res = await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        { ...validBody, distance_miles: undefined },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Distance must be a positive number');
    });

    it('should return 400 for negative distance', async () => {
      const res = await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        { ...validBody, distance_miles: -5 },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Distance must be a positive number');
    });

    it('should return 400 for zero distance', async () => {
      const res = await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        { ...validBody, distance_miles: 0 },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Distance must be a positive number');
    });

    it('should return 400 for non-number distance', async () => {
      const res = await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        { ...validBody, distance_miles: 'abc' },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Invalid distance value');
    });

    it('should return 400 for invalid image_id format', async () => {
      const res = await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        { ...validBody, image_id: 'Invalid Slug!' },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Image ID must be a valid slug format');
    });

    it('should return 400 for image_id with uppercase', async () => {
      const res = await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        { ...validBody, image_id: 'Rivendell' },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Image ID must be a valid slug format');
    });

    it('should accept valid kebab-case image_id', async () => {
      setupDbCalls([
        { run: { meta: { changes: 1, last_row_id: 99 } } },
        { first: { ...createdGoal, image_id: 'camp-under-oak' } },
        { run: { meta: { changes: 1 } } },
      ]);

      const res = await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        { ...validBody, image_id: 'camp-under-oak' },
        1
      );

      expect(res.status).toBe(201);
    });

    it('should accept valid optional fields', async () => {
      setupDbCalls([
        { run: { meta: { changes: 1, last_row_id: 99 } } },
        { first: { ...createdGoal, special: 'A special event', image_id: 'weathertop' } },
        { run: { meta: { changes: 1 } } },
      ]);

      const res = await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        { ...validBody, special: 'A special event', image_id: 'weathertop' },
        1
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.special).toBe('A special event');
      expect(body.image_id).toBe('weathertop');
    });

    it('should normalize empty special and image_id to null', async () => {
      setupDbCalls([
        { run: { meta: { changes: 1, last_row_id: 99 } } },
        { first: createdGoal },
        { run: { meta: { changes: 1 } } },
      ]);

      await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        { ...validBody, special: '', image_id: '  ' },
        1
      );

      // Verify the INSERT was called with null for special and image_id
      const bindArgs = mockDB.prepare.mock.results[0].value.bind.mock.calls[0];
      expect(bindArgs[3]).toBeNull(); // special
      expect(bindArgs[4]).toBeNull(); // image_id
    });

    it('should normalize empty description to null', async () => {
      setupDbCalls([
        { run: { meta: { changes: 1, last_row_id: 99 } } },
        { first: { ...createdGoal, description: null } },
        { run: { meta: { changes: 1 } } },
      ]);

      await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        { ...validBody, description: '' },
        1
      );

      const bindArgs = mockDB.prepare.mock.results[0].value.bind.mock.calls[0];
      expect(bindArgs[2]).toBeNull(); // description (empty -> null)
    });

    it('should create audit log on success', async () => {
      setupDbCalls([
        { run: { meta: { changes: 1, last_row_id: 99 } } },
        { first: createdGoal },
        { run: { meta: { changes: 1 } } },
      ]);

      await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        validBody,
        7
      );

      // Verify the audit log INSERT was called
      const auditCall = mockDB.prepare.mock.calls[2];
      expect(auditCall[0]).toContain('INSERT INTO admin_audit_log');
      const auditBindArgs = mockDB.prepare.mock.results[2].value.bind.mock.calls[0];
      expect(auditBindArgs[0]).toBe(7);              // adminUserId
      expect(auditBindArgs[1]).toBe('create_goal');   // action
      expect(auditBindArgs[2]).toBe('goal');           // targetType
      expect(auditBindArgs[3]).toBe(99);               // targetId
      const details = JSON.parse(auditBindArgs[4]);
      expect(details.title).toBe('Camp at Weathertop');
      expect(details.distance_miles).toBe(120.5);
      expect(details.distance_km).toBeCloseTo(193.93, 1);
    });

    it('should return 500 on database error', async () => {
      mockDB.prepare.mockImplementation(() => {
        throw new Error('DB down');
      });

      const res = await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        validBody,
        1
      );

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Internal server error');
    });

    it('should return 400 for Infinity distance', async () => {
      const res = await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        { ...validBody, distance_miles: Infinity },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Distance must be a positive number');
    });

    it('should return 400 for negative Infinity distance', async () => {
      const res = await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        { ...validBody, distance_miles: -Infinity },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Distance must be a positive number');
    });

    it('should return 400 for null body', async () => {
      const res = await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        null,
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Invalid request body');
    });

    it('should return 400 for undefined body', async () => {
      const res = await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        undefined,
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Invalid request body');
    });

    it('should return 400 for boolean distance_miles', async () => {
      const res = await handleAdminGoalCreate(
        mockRequest as unknown as Request,
        mockDb,
        { ...validBody, distance_miles: true },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Invalid distance value');
    });
  });
});
