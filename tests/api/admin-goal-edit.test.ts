import { handleAdminGoalGet, handleAdminGoalUpdate, logAdminAction } from '../../src/admin-handlers';

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

describe('Admin Goal Edit Handlers (Story 4.4)', () => {
  let mockEnv: { DB: { prepare: jest.Mock } };
  let mockRequest: { headers: { get: jest.Mock }; url: string };
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    originalConsoleError = console.error;
    console.error = jest.fn();

    mockEnv = {
      DB: { prepare: jest.fn() },
    };

    mockRequest = {
      headers: { get: jest.fn().mockReturnValue(null) },
      url: 'https://wtm.haydencarson.com/api/admin/goals/42',
    };
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  const sampleGoal = {
    id: 42,
    title: 'Rivendell',
    distance: 747.8,
    description: 'The company arrives at the Last Homely House.',
    special: null,
    image_id: 'rivendell',
  };

  /**
   * Helper to set up sequential DB prepare calls.
   * Each call in the array configures what .prepare(...) returns for that invocation.
   */
  function setupDbCalls(calls: Array<{
    first?: unknown;
    run?: unknown;
    all?: unknown;
  }>) {
    calls.forEach((call, idx) => {
      const mockBind = jest.fn().mockReturnValue({
        first: jest.fn().mockResolvedValue(call.first ?? null),
        run: jest.fn().mockResolvedValue(call.run ?? { meta: { changes: 1 } }),
        all: jest.fn().mockResolvedValue({ results: call.all ?? [] }),
      });
      if (idx === 0) {
        mockEnv.DB.prepare.mockReturnValueOnce({ bind: mockBind });
      } else {
        mockEnv.DB.prepare.mockReturnValueOnce({ bind: mockBind });
      }
    });
  }

  // ===================== handleAdminGoalGet =====================

  describe('handleAdminGoalGet', () => {
    it('should return goal data for a valid ID', async () => {
      setupDbCalls([{ first: sampleGoal }]);

      const res = await handleAdminGoalGet(
        mockRequest as unknown as Request,
        mockEnv,
        42
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual(sampleGoal);
    });

    it('should return 404 for non-existent goal', async () => {
      setupDbCalls([{ first: null }]);

      const res = await handleAdminGoalGet(
        mockRequest as unknown as Request,
        mockEnv,
        9999
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Goal not found');
    });

    it('should return 500 on database error', async () => {
      mockEnv.DB.prepare.mockImplementation(() => {
        throw new Error('DB down');
      });

      const res = await handleAdminGoalGet(
        mockRequest as unknown as Request,
        mockEnv,
        42
      );

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Internal server error');
    });
  });

  // ===================== handleAdminGoalUpdate =====================

  describe('handleAdminGoalUpdate', () => {
    const validBody = {
      title: 'Rivendell Updated',
      distance: 750.0,
      description: 'Updated description of Rivendell.',
      special: null,
      image_id: 'rivendell',
    };

    it('should update goal and return updated data', async () => {
      const updatedGoal = { ...sampleGoal, title: 'Rivendell Updated', distance: 750.0, description: 'Updated description of Rivendell.' };

      // 1) Fetch existing goal  2) Update  3) Audit log  4) Fetch updated
      setupDbCalls([
        { first: sampleGoal },                // SELECT existing
        { run: { meta: { changes: 1 } } },    // UPDATE
        { run: { meta: { changes: 1 } } },    // INSERT audit log
        { first: updatedGoal },                // SELECT updated
      ]);

      const res = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv,
        42,
        validBody,
        1
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.title).toBe('Rivendell Updated');
      expect(body.distance).toBe(750.0);
    });

    it('should return 400 for missing title', async () => {
      const res = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv,
        42,
        { ...validBody, title: '' },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Title is required');
    });

    it('should return 400 for empty-after-trim title', async () => {
      const res = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv,
        42,
        { ...validBody, title: '   ' },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Title is required');
    });

    it('should return 400 for non-positive distance', async () => {
      const res = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv,
        42,
        { ...validBody, distance: -5 },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Distance must be a positive number');
    });

    it('should return 400 for zero distance', async () => {
      const res = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv,
        42,
        { ...validBody, distance: 0 },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Distance must be a positive number');
    });

    it('should return 400 for non-number distance', async () => {
      const res = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv,
        42,
        { ...validBody, distance: 'abc' },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Distance must be a positive number');
    });

    it('should return 400 for missing description', async () => {
      const res = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv,
        42,
        { ...validBody, description: '' },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Description is required');
    });

    it('should return 400 for invalid image_id slug format', async () => {
      const res = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv,
        42,
        { ...validBody, image_id: 'Invalid Slug!' },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Image ID must be a valid slug format');
    });

    it('should return 400 for image_id with uppercase', async () => {
      const res = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv,
        42,
        { ...validBody, image_id: 'Rivendell' },
        1
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Image ID must be a valid slug format');
    });

    it('should normalize empty special to null', async () => {
      const updatedGoal = { ...sampleGoal, special: null };
      setupDbCalls([
        { first: sampleGoal },
        { run: { meta: { changes: 1 } } },
        { run: { meta: { changes: 1 } } },
        { first: updatedGoal },
      ]);

      const res = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv,
        42,
        { ...validBody, special: '' },
        1
      );

      expect(res.status).toBe(200);
      // Verify the UPDATE statement was called with null for special
      const updateCall = mockEnv.DB.prepare.mock.calls[1];
      expect(updateCall[0]).toContain('UPDATE goals SET');
      const bindArgs = mockEnv.DB.prepare.mock.results[1].value.bind.mock.calls[0];
      expect(bindArgs[3]).toBeNull(); // special param
    });

    it('should normalize empty image_id to null', async () => {
      const updatedGoal = { ...sampleGoal, image_id: null };
      setupDbCalls([
        { first: sampleGoal },
        { run: { meta: { changes: 1 } } },
        { run: { meta: { changes: 1 } } },
        { first: updatedGoal },
      ]);

      const res = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv,
        42,
        { ...validBody, image_id: '' },
        1
      );

      expect(res.status).toBe(200);
      const bindArgs = mockEnv.DB.prepare.mock.results[1].value.bind.mock.calls[0];
      expect(bindArgs[4]).toBeNull(); // image_id param
    });

    it('should return 404 for non-existent goal', async () => {
      setupDbCalls([{ first: null }]);

      const res = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv,
        9999,
        validBody,
        1
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Goal not found');
    });

    it('should call logAdminAction with changed fields', async () => {
      const updatedGoal = { ...sampleGoal, title: 'Updated Title' };
      setupDbCalls([
        { first: sampleGoal },                // SELECT existing
        { run: { meta: { changes: 1 } } },    // UPDATE
        { run: { meta: { changes: 1 } } },    // INSERT audit log
        { first: updatedGoal },                // SELECT updated
      ]);

      await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv,
        42,
        { ...validBody, title: 'Updated Title' },
        7
      );

      // Verify the audit log INSERT was called
      const auditCall = mockEnv.DB.prepare.mock.calls[2];
      expect(auditCall[0]).toContain('INSERT INTO admin_audit_log');
      const auditBindArgs = mockEnv.DB.prepare.mock.results[2].value.bind.mock.calls[0];
      expect(auditBindArgs[0]).toBe(7);           // adminUserId
      expect(auditBindArgs[1]).toBe('update_goal'); // action
      expect(auditBindArgs[2]).toBe('goal');        // targetType
      expect(auditBindArgs[3]).toBe(42);            // targetId
      const details = JSON.parse(auditBindArgs[4]); // details JSON
      expect(details.title).toEqual({ old: 'Rivendell', new: 'Updated Title' });
    });

    it('should accept valid slug image_id formats', async () => {
      const updatedGoal = { ...sampleGoal, image_id: 'bag-end' };
      setupDbCalls([
        { first: sampleGoal },
        { run: { meta: { changes: 1 } } },
        { run: { meta: { changes: 1 } } },
        { first: updatedGoal },
      ]);

      const res = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv,
        42,
        { ...validBody, image_id: 'bag-end' },
        1
      );

      expect(res.status).toBe(200);
    });

    it('should return 500 on database error during update', async () => {
      mockEnv.DB.prepare.mockImplementation(() => {
        throw new Error('DB down');
      });

      const res = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv,
        42,
        validBody,
        1
      );

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Internal server error');
    });
  });
});
