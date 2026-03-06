import {
  validateAdminSession,
  handleSessionValidation
} from '../../src/auth-handlers';
import { logAdminAction, handleAdminDashboard } from '../../src/admin-handlers';
import * as authUtils from '../../src/auth-utils';

// Mock auth-utils
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

// Mock email-utils
jest.mock('../../src/email-utils', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendConfirmationEmail: jest.fn()
}));

describe('Admin Handlers', () => {
  let mockEnv: {
    DB: {
      prepare: jest.Mock;
    };
    ALLOW_TEST_AUTH?: string;
  };
  let mockRequest: {
    headers: {
      get: jest.Mock;
    };
    url: string;
  };
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    originalConsoleError = console.error;
    console.error = jest.fn();

    // Setup default mock implementations for auth-utils
    (authUtils.isValidUsername as jest.Mock).mockReturnValue(true);
    (authUtils.isSessionExpired as jest.Mock).mockReturnValue(false);

    // Mock DB
    mockEnv = {
      DB: {
        prepare: jest.fn()
      }
    };

    mockRequest = {
      headers: {
        get: jest.fn()
      },
      url: 'https://wtm.haydencarson.com/api/admin/dashboard'
    };
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  /**
   * Helper to set up a mock DB chain for a given query pattern.
   * Returns the mock functions for further chaining.
   */
  function setupDbQuery(options: {
    allResults?: Record<string, unknown>[];
    firstResult?: Record<string, unknown> | null;
    runResult?: { meta: { last_row_id: number; changes: number } };
  }) {
    const mockRun = jest.fn().mockResolvedValue(
      options.runResult ?? { meta: { last_row_id: 1, changes: 1 } }
    );
    const mockAll = jest.fn().mockResolvedValue({
      results: options.allResults ?? []
    });
    const mockFirst = jest.fn().mockResolvedValue(
      options.firstResult ?? null
    );
    const mockBind = jest.fn().mockReturnValue({
      run: mockRun,
      all: mockAll,
      first: mockFirst
    });
    mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });
    return { mockBind, mockRun, mockAll, mockFirst };
  }

  describe('validateAdminSession', () => {
    it('should return 401 for unauthenticated requests (no auth header)', async () => {
      mockRequest.headers.get.mockReturnValue(null);

      const result = await validateAdminSession(
        mockRequest as unknown as Request,
        mockEnv
      );

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(401);
      }
    });

    it('should return 401 for requests with invalid auth header format', async () => {
      mockRequest.headers.get.mockReturnValue('Basic some-token');

      const result = await validateAdminSession(
        mockRequest as unknown as Request,
        mockEnv
      );

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(401);
      }
    });

    it('should return 401 for invalid session token', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer invalid-token');

      // Session lookup returns empty
      setupDbQuery({ allResults: [] });

      const result = await validateAdminSession(
        mockRequest as unknown as Request,
        mockEnv
      );

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(401);
      }
    });

    it('should return 403 for authenticated non-admin users', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-session-id');

      // First call: validateSession session lookup (returns valid session)
      const sessionBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn().mockResolvedValue({
          results: [{
            id: 'valid-session-id',
            expires_at: '2099-01-01T00:00:00Z',
            user_id: 42,
            approved: 1
          }]
        }),
        first: jest.fn()
      });

      // Second call: admin check (is_admin = 0)
      const adminBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn(),
        first: jest.fn().mockResolvedValue({ is_admin: 0 })
      });

      mockEnv.DB.prepare
        .mockReturnValueOnce({ bind: sessionBind })
        .mockReturnValueOnce({ bind: adminBind });

      const result = await validateAdminSession(
        mockRequest as unknown as Request,
        mockEnv
      );

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(403);
        const body = await result.error.json();
        expect(body.error).toBe('Admin access required');
      }
    });

    it('should return success for admin users', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-session-id');

      // First call: validateSession session lookup
      const sessionBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn().mockResolvedValue({
          results: [{
            id: 'valid-session-id',
            expires_at: '2099-01-01T00:00:00Z',
            user_id: 42,
            approved: 1
          }]
        }),
        first: jest.fn()
      });

      // Second call: admin check (is_admin = 1)
      const adminBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn(),
        first: jest.fn().mockResolvedValue({ is_admin: 1 })
      });

      mockEnv.DB.prepare
        .mockReturnValueOnce({ bind: sessionBind })
        .mockReturnValueOnce({ bind: adminBind });

      const result = await validateAdminSession(
        mockRequest as unknown as Request,
        mockEnv
      );

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.userId).toBe(42);
        expect(result.isAdmin).toBe(true);
      }
    });

    it('should return 403 when user not found in admin check', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-session-id');

      // First call: validateSession session lookup
      const sessionBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn().mockResolvedValue({
          results: [{
            id: 'valid-session-id',
            expires_at: '2099-01-01T00:00:00Z',
            user_id: 42,
            approved: 1
          }]
        }),
        first: jest.fn()
      });

      // Second call: admin check (user not found)
      const adminBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn(),
        first: jest.fn().mockResolvedValue(null)
      });

      mockEnv.DB.prepare
        .mockReturnValueOnce({ bind: sessionBind })
        .mockReturnValueOnce({ bind: adminBind });

      const result = await validateAdminSession(
        mockRequest as unknown as Request,
        mockEnv
      );

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(403);
      }
    });

    it('should return 500 on database error during admin check', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-session-id');

      // First call: validateSession session lookup (success)
      const sessionBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn().mockResolvedValue({
          results: [{
            id: 'valid-session-id',
            expires_at: '2099-01-01T00:00:00Z',
            user_id: 42,
            approved: 1
          }]
        }),
        first: jest.fn()
      });

      // Second call: admin check throws
      const adminBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn(),
        first: jest.fn().mockRejectedValue(new Error('DB connection failed'))
      });

      mockEnv.DB.prepare
        .mockReturnValueOnce({ bind: sessionBind })
        .mockReturnValueOnce({ bind: adminBind });

      const result = await validateAdminSession(
        mockRequest as unknown as Request,
        mockEnv
      );

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(500);
        const body = await result.error.json();
        expect(body.error).toContain('Internal server error');
      }
    });

    it('should return 401 for expired session (before admin check)', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer expired-session-id');

      // Session lookup returns a result but session is expired
      const sessionBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn().mockResolvedValue({
          results: [{
            id: 'expired-session-id',
            expires_at: '2020-01-01T00:00:00Z',
            user_id: 42,
            approved: 1
          }]
        }),
        first: jest.fn()
      });

      // Session delete after expiry detection
      const deleteBind = jest.fn().mockReturnValue({
        run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
        all: jest.fn(),
        first: jest.fn()
      });

      mockEnv.DB.prepare
        .mockReturnValueOnce({ bind: sessionBind })
        .mockReturnValueOnce({ bind: deleteBind });

      // Make isSessionExpired return true for this test
      (authUtils.isSessionExpired as jest.Mock).mockReturnValue(true);

      const result = await validateAdminSession(
        mockRequest as unknown as Request,
        mockEnv
      );

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(401);
      }
    });

    it('should return 401 for empty bearer token', async () => {
      // "Bearer " with nothing after it — sessionId would be empty string
      mockRequest.headers.get.mockReturnValue('Bearer ');

      // DB lookup for empty string returns nothing
      setupDbQuery({ allResults: [] });

      const result = await validateAdminSession(
        mockRequest as unknown as Request,
        mockEnv
      );

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(401);
      }
    });

    it('should return JSON (not HTML) in 403 response body', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-session-id');

      // First call: session lookup (valid)
      const sessionBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn().mockResolvedValue({
          results: [{
            id: 'valid-session-id',
            expires_at: '2099-01-01T00:00:00Z',
            user_id: 42,
            approved: 1
          }]
        }),
        first: jest.fn()
      });

      // Second call: non-admin
      const adminBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn(),
        first: jest.fn().mockResolvedValue({ is_admin: 0 })
      });

      mockEnv.DB.prepare
        .mockReturnValueOnce({ bind: sessionBind })
        .mockReturnValueOnce({ bind: adminBind });

      const result = await validateAdminSession(
        mockRequest as unknown as Request,
        mockEnv
      );

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.headers.get('content-type')).toBe('application/json');
        const body = await result.error.text();
        // Must NOT contain any admin page HTML
        expect(body).not.toContain('Admin Dashboard');
        expect(body).not.toContain('<html');
        expect(body).not.toContain('Dashboard coming soon');
      }
    });

    it('should work with test mock tokens for admin user', async () => {
      mockEnv.ALLOW_TEST_AUTH = 'true';
      mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_AdminUser');

      // First call: validateSession mock auth - check if user exists
      const userSelectBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn().mockResolvedValue({
          results: [{ id: 1, username: 'AdminUser', email: 'AdminUser@example.com', approved: 1 }]
        }),
        first: jest.fn()
      });

      // Second call: admin check (is_admin = 1)
      const adminBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn(),
        first: jest.fn().mockResolvedValue({ is_admin: 1 })
      });

      mockEnv.DB.prepare
        .mockReturnValueOnce({ bind: userSelectBind })
        .mockReturnValueOnce({ bind: adminBind });

      const result = await validateAdminSession(
        mockRequest as unknown as Request,
        mockEnv
      );

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.userId).toBe(1);
        expect(result.isAdmin).toBe(true);
      }
    });

    it('should return 403 with test mock tokens for non-admin user', async () => {
      mockEnv.ALLOW_TEST_AUTH = 'true';
      mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_RegularUser');

      // First call: validateSession mock auth - user exists
      const userSelectBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn().mockResolvedValue({
          results: [{ id: 2, username: 'RegularUser', email: 'RegularUser@example.com', approved: 1 }]
        }),
        first: jest.fn()
      });

      // Second call: admin check (is_admin = 0)
      const adminBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn(),
        first: jest.fn().mockResolvedValue({ is_admin: 0 })
      });

      mockEnv.DB.prepare
        .mockReturnValueOnce({ bind: userSelectBind })
        .mockReturnValueOnce({ bind: adminBind });

      const result = await validateAdminSession(
        mockRequest as unknown as Request,
        mockEnv
      );

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(403);
      }
    });
  });

  describe('handleSessionValidation - isAdmin field', () => {
    it('should include isAdmin: false for regular users (production path)', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-session-id');

      const sessionBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn().mockResolvedValue({
          results: [{
            id: 'valid-session-id',
            expires_at: '2099-01-01T00:00:00Z',
            user_id: 1,
            username: 'testuser',
            email: 'test@example.com',
            approved: 1,
            show_future_goals_unlocked: 1,
            default_view_map: 0,
            is_admin: 0
          }]
        }),
        first: jest.fn()
      });

      mockEnv.DB.prepare.mockReturnValue({ bind: sessionBind });

      const response = await handleSessionValidation(
        mockRequest as unknown as Request,
        mockEnv
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.isAdmin).toBe(false);
      expect(body.userId).toBe(1);
    });

    it('should include isAdmin: true for admin users (production path)', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-session-id');

      const sessionBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn().mockResolvedValue({
          results: [{
            id: 'valid-session-id',
            expires_at: '2099-01-01T00:00:00Z',
            user_id: 1,
            username: 'adminuser',
            email: 'admin@example.com',
            approved: 1,
            show_future_goals_unlocked: 1,
            default_view_map: 0,
            is_admin: 1
          }]
        }),
        first: jest.fn()
      });

      mockEnv.DB.prepare.mockReturnValue({ bind: sessionBind });

      const response = await handleSessionValidation(
        mockRequest as unknown as Request,
        mockEnv
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.isAdmin).toBe(true);
    });

    it('should include isAdmin for test mock auth path', async () => {
      mockEnv.ALLOW_TEST_AUTH = 'true';
      mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_TestAdmin');

      // User exists with is_admin = 1
      const userBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn().mockResolvedValue({
          results: [{
            id: 5,
            username: 'TestAdmin',
            email: 'TestAdmin@example.com',
            approved: 1,
            show_future_goals_unlocked: 1,
            default_view_map: 0,
            is_admin: 1
          }]
        }),
        first: jest.fn()
      });

      mockEnv.DB.prepare.mockReturnValue({ bind: userBind });

      const response = await handleSessionValidation(
        mockRequest as unknown as Request,
        mockEnv
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.isAdmin).toBe(true);
    });

    it('should include isAdmin: false for test mock auth path (non-admin)', async () => {
      mockEnv.ALLOW_TEST_AUTH = 'true';
      mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_RegularMockUser');

      // User exists with is_admin = 0
      const userBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn().mockResolvedValue({
          results: [{
            id: 6,
            username: 'RegularMockUser',
            email: 'RegularMockUser@example.com',
            approved: 1,
            show_future_goals_unlocked: 1,
            default_view_map: 0,
            is_admin: 0
          }]
        }),
        first: jest.fn()
      });

      mockEnv.DB.prepare.mockReturnValue({ bind: userBind });

      const response = await handleSessionValidation(
        mockRequest as unknown as Request,
        mockEnv
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.isAdmin).toBe(false);
    });

    it('should default isAdmin to false when is_admin column is null (production path)', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-session-id');

      const sessionBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn().mockResolvedValue({
          results: [{
            id: 'valid-session-id',
            expires_at: '2099-01-01T00:00:00Z',
            user_id: 1,
            username: 'legacyuser',
            email: 'legacy@example.com',
            approved: 1,
            show_future_goals_unlocked: 0,
            default_view_map: 0,
            is_admin: null
          }]
        }),
        first: jest.fn()
      });

      mockEnv.DB.prepare.mockReturnValue({ bind: sessionBind });

      const response = await handleSessionValidation(
        mockRequest as unknown as Request,
        mockEnv
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.isAdmin).toBe(false);
    });

    it('should default isAdmin to false when is_admin column is undefined (production path)', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-session-id');

      // Simulate DB result missing the is_admin column entirely
      const sessionBind = jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn().mockResolvedValue({
          results: [{
            id: 'valid-session-id',
            expires_at: '2099-01-01T00:00:00Z',
            user_id: 1,
            username: 'olduser',
            email: 'old@example.com',
            approved: 1,
            show_future_goals_unlocked: 0,
            default_view_map: 0
            // is_admin not present at all
          }]
        }),
        first: jest.fn()
      });

      mockEnv.DB.prepare.mockReturnValue({ bind: sessionBind });

      const response = await handleSessionValidation(
        mockRequest as unknown as Request,
        mockEnv
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.isAdmin).toBe(false);
    });
  });

  describe('handleAdminDashboard', () => {
    it('should return dashboard stats with correct values', async () => {
      // Mock all four queries returned by Promise.all
      mockEnv.DB.prepare
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 42 }) })       // users
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ total: 12345.67 }) })  // distance
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 5 }) })         // parties
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 171 }) });      // goals

      const response = await handleAdminDashboard(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.totalUsers).toBe(42);
      expect(body.totalDistanceKm).toBe(12345.7);
      expect(body.activeParties).toBe(5);
      expect(body.totalGoals).toBe(171);
    });

    it('should return zeros when database has no data', async () => {
      mockEnv.DB.prepare
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 0 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ total: 0 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 0 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 0 }) });

      const response = await handleAdminDashboard(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.totalUsers).toBe(0);
      expect(body.totalDistanceKm).toBe(0);
      expect(body.activeParties).toBe(0);
      expect(body.totalGoals).toBe(0);
    });

    it('should handle null results gracefully', async () => {
      mockEnv.DB.prepare
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue(null) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue(null) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue(null) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue(null) });

      const response = await handleAdminDashboard(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.totalUsers).toBe(0);
      expect(body.totalDistanceKm).toBe(0);
      expect(body.activeParties).toBe(0);
      expect(body.totalGoals).toBe(0);
    });

    it('should return 500 on database error', async () => {
      mockEnv.DB.prepare.mockImplementation(() => {
        throw new Error('DB connection failed');
      });

      const response = await handleAdminDashboard(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database }
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toContain('Internal server error');
    });

    it('should return Content-Type application/json', async () => {
      mockEnv.DB.prepare
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 1 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ total: 10 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 1 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 5 }) });

      const response = await handleAdminDashboard(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database }
      );

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should round totalDistanceKm to one decimal place', async () => {
      mockEnv.DB.prepare
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 1 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ total: 1234.5678 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 1 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 1 }) });

      const response = await handleAdminDashboard(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      expect(body.totalDistanceKm).toBe(1234.6);
    });

    it('should query the correct SQL statements', async () => {
      mockEnv.DB.prepare
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 0 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ total: 0 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 0 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 0 }) });

      await handleAdminDashboard(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database }
      );

      expect(mockEnv.DB.prepare).toHaveBeenCalledTimes(4);
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('FROM users WHERE email_verified = 1')
      );
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SUM(distance)')
      );
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('parties')
      );
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('FROM goals')
      );
    });
  });

  describe('logAdminAction', () => {
    it('should insert an audit log entry with all fields', async () => {
      const mockRun = jest.fn().mockResolvedValue({ meta: { last_row_id: 1, changes: 1 } });
      const mockBind = jest.fn().mockReturnValue({ run: mockRun });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      await logAdminAction(mockEnv as unknown as { DB: D1Database }, {
        adminUserId: 1,
        action: 'update_goal',
        targetType: 'goal',
        targetId: 42,
        details: JSON.stringify({ field: 'title', old: 'Old Title', new: 'New Title' }),
        ipAddress: '1.2.3.4',
        success: true
      });

      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO admin_audit_log')
      );
      expect(mockBind).toHaveBeenCalledWith(1, 'update_goal', 'goal', 42, expect.any(String), '1.2.3.4', 1);
      expect(mockRun).toHaveBeenCalled();
    });

    it('should insert an audit log entry with optional null fields', async () => {
      const mockRun = jest.fn().mockResolvedValue({ meta: { last_row_id: 1, changes: 1 } });
      const mockBind = jest.fn().mockReturnValue({ run: mockRun });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      await logAdminAction(mockEnv as unknown as { DB: D1Database }, {
        adminUserId: 1,
        action: 'view_dashboard',
        success: true
      });

      expect(mockBind).toHaveBeenCalledWith(1, 'view_dashboard', null, null, null, null, 1);
      expect(mockRun).toHaveBeenCalled();
    });

    it('should record success = 0 for failed actions', async () => {
      const mockRun = jest.fn().mockResolvedValue({ meta: { last_row_id: 1, changes: 1 } });
      const mockBind = jest.fn().mockReturnValue({ run: mockRun });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      await logAdminAction(mockEnv as unknown as { DB: D1Database }, {
        adminUserId: 1,
        action: 'delete_goal',
        targetType: 'goal',
        targetId: 99,
        success: false
      });

      expect(mockBind).toHaveBeenCalledWith(1, 'delete_goal', 'goal', 99, null, null, 0);
    });

    it('should not throw on database error (logs error instead)', async () => {
      const mockBind = jest.fn().mockReturnValue({
        run: jest.fn().mockRejectedValue(new Error('DB write failed'))
      });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      // Should not throw
      await expect(
        logAdminAction(mockEnv as unknown as { DB: D1Database }, {
          adminUserId: 1,
          action: 'test_action',
          success: true
        })
      ).resolves.toBeUndefined();

      expect(console.error).toHaveBeenCalledWith(
        'Failed to write admin audit log:',
        expect.any(Error)
      );
    });

    it('should not throw when prepare() itself throws', async () => {
      mockEnv.DB.prepare.mockImplementation(() => {
        throw new Error('DB prepare failed');
      });

      await expect(
        logAdminAction(mockEnv as unknown as { DB: D1Database }, {
          adminUserId: 1,
          action: 'test_action',
          success: true
        })
      ).resolves.toBeUndefined();

      expect(console.error).toHaveBeenCalledWith(
        'Failed to write admin audit log:',
        expect.any(Error)
      );
    });

    it('should handle large details string without error', async () => {
      const mockRun = jest.fn().mockResolvedValue({ meta: { last_row_id: 1, changes: 1 } });
      const mockBind = jest.fn().mockReturnValue({ run: mockRun });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const largeDetails = JSON.stringify({ data: 'x'.repeat(5000) });

      await logAdminAction(mockEnv as unknown as { DB: D1Database }, {
        adminUserId: 1,
        action: 'bulk_update',
        details: largeDetails,
        success: true
      });

      expect(mockBind).toHaveBeenCalledWith(1, 'bulk_update', null, null, largeDetails, null, 1);
      expect(mockRun).toHaveBeenCalled();
    });
  });
});
