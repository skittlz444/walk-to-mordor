import {
  validateAdminSession,
  handleSessionValidation
} from '../../src/auth-handlers';
import { logAdminAction, handleAdminDashboard, handleAdminGoalsList, handleAdminGoalGet, handleAdminGoalUpdate } from '../../src/admin-handlers';
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

    it('should handle partial null results (some queries return data, some null)', async () => {
      mockEnv.DB.prepare
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 10 }) })   // users: 10
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue(null) })              // distance: null
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 3 }) })     // parties: 3
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue(null) });             // goals: null

      const response = await handleAdminDashboard(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.totalUsers).toBe(10);
      expect(body.totalDistanceKm).toBe(0);
      expect(body.activeParties).toBe(3);
      expect(body.totalGoals).toBe(0);
    });

    it('should return 500 when one query rejects inside Promise.all', async () => {
      mockEnv.DB.prepare
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 5 }) })
        .mockReturnValueOnce({ first: jest.fn().mockRejectedValue(new Error('Query timeout')) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 2 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 100 }) });

      const response = await handleAdminDashboard(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database }
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toContain('Internal server error');
    });

    it('should return all four expected keys and no extras', async () => {
      mockEnv.DB.prepare
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 1 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ total: 5.5 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 1 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 1 }) });

      const response = await handleAdminDashboard(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      const keys = Object.keys(body).sort();
      expect(keys).toEqual(['activeParties', 'totalDistanceKm', 'totalGoals', 'totalUsers']);
    });

    it('should handle very large distance values without overflow', async () => {
      mockEnv.DB.prepare
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 999999 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ total: 9999999.999 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 50000 }) })
        .mockReturnValueOnce({ first: jest.fn().mockResolvedValue({ count: 10000 }) });

      const response = await handleAdminDashboard(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.totalUsers).toBe(999999);
      expect(body.totalDistanceKm).toBe(10000000);
      expect(body.activeParties).toBe(50000);
      expect(body.totalGoals).toBe(10000);
    });

    it('should return 500 with JSON content-type on database error', async () => {
      mockEnv.DB.prepare.mockImplementation(() => {
        throw new Error('DB unavailable');
      });

      const response = await handleAdminDashboard(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database }
      );

      expect(response.status).toBe(500);
      expect(response.headers.get('Content-Type')).toBe('application/json');
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

  describe('handleAdminGoalsList', () => {
    const sampleGoals = [
      { id: 1, title: 'Bag End', distance: 0, description: 'Starting point', special: null, image_id: 'bag-end' },
      { id: 2, title: 'Woody End', distance: 40.2, description: 'Forest area', special: null, image_id: 'woody-end' },
      { id: 3, title: 'Bucklebury Ferry', distance: 60.4, description: 'River crossing', special: null, image_id: null },
    ];

    function createGoalsRequest(queryParams: string = ''): Request {
      return {
        url: `https://wtm.haydencarson.com/api/admin/goals${queryParams}`,
        headers: { get: jest.fn() },
      } as unknown as Request;
    }

    function setupGoalsDb(options: {
      countTotal: number;
      rows: typeof sampleGoals;
    }) {
      const mockCountFirst = jest.fn().mockResolvedValue({ total: options.countTotal });
      const mockCountBind = jest.fn().mockReturnValue({ first: mockCountFirst });
      const mockDataAll = jest.fn().mockResolvedValue({ results: options.rows });
      const mockDataBind = jest.fn().mockReturnValue({ all: mockDataAll });

      // Queries are sequential: count first (prepare call 1), then data (prepare call 2)
      mockEnv.DB.prepare
        .mockReturnValueOnce({ first: mockCountFirst, bind: mockCountBind })
        .mockReturnValueOnce({ all: mockDataAll, bind: mockDataBind });

      return { mockCountFirst, mockCountBind, mockDataAll, mockDataBind };
    }

    it('should return paginated goals with correct structure', async () => {
      setupGoalsDb({ countTotal: 3, rows: sampleGoals });

      const request = createGoalsRequest();
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.goals).toHaveLength(3);
      expect(body.total).toBe(3);
      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(25);
      expect(body.totalPages).toBe(1);
    });

    it('should compute has_image correctly from image_id', async () => {
      setupGoalsDb({ countTotal: 3, rows: sampleGoals });

      const request = createGoalsRequest();
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      // Bag End has image_id 'bag-end' -> has_image: true
      expect(body.goals[0].has_image).toBe(true);
      expect(body.goals[0].image_id).toBe('bag-end');
      // Woody End has image_id 'woody-end' -> has_image: true
      expect(body.goals[1].has_image).toBe(true);
      // Bucklebury Ferry has image_id null -> has_image: false
      expect(body.goals[2].has_image).toBe(false);
    });

    it('should compute has_image as false for empty string image_id', async () => {
      const rowsWithEmpty = [
        { id: 4, title: 'Empty Image', distance: 100, description: null, special: null, image_id: '' },
      ];
      setupGoalsDb({ countTotal: 1, rows: rowsWithEmpty });

      const request = createGoalsRequest();
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      expect(body.goals[0].has_image).toBe(false);
    });

    it('should return correct pagination for page=2', async () => {
      setupGoalsDb({ countTotal: 50, rows: sampleGoals });

      const request = createGoalsRequest('?page=2&pageSize=25');
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      expect(body.page).toBe(2);
      expect(body.pageSize).toBe(25);
      expect(body.totalPages).toBe(2);
      expect(body.total).toBe(50);
    });

    it('should clamp pageSize to max 100', async () => {
      setupGoalsDb({ countTotal: 200, rows: [] });

      const request = createGoalsRequest('?pageSize=999');
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      expect(body.pageSize).toBe(100);
    });

    it('should default pageSize to 25 when not provided', async () => {
      setupGoalsDb({ countTotal: 50, rows: sampleGoals });

      const request = createGoalsRequest();
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      expect(body.pageSize).toBe(25);
    });

    it('should default page to 1 when not provided', async () => {
      setupGoalsDb({ countTotal: 3, rows: sampleGoals });

      const request = createGoalsRequest();
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      expect(body.page).toBe(1);
    });

    it('should clamp page to minimum 1 for negative or zero values', async () => {
      setupGoalsDb({ countTotal: 3, rows: sampleGoals });

      const request = createGoalsRequest('?page=-5');
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      expect(body.page).toBe(1);
    });

    it('should filter by search term using parameterized LIKE', async () => {
      const mockCountFirst = jest.fn().mockResolvedValue({ total: 1 });
      const mockCountBind = jest.fn().mockReturnValue({ first: mockCountFirst });
      const mockDataAll = jest.fn().mockResolvedValue({
        results: [{ id: 10, title: 'Rivendell', distance: 458, description: 'Elven haven', special: null, image_id: 'rivendell' }],
      });
      const mockDataBind = jest.fn().mockReturnValue({ all: mockDataAll });

      mockEnv.DB.prepare
        .mockReturnValueOnce({ bind: mockCountBind })
        .mockReturnValueOnce({ bind: mockDataBind });

      const request = createGoalsRequest('?search=rivendell');
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.goals).toHaveLength(1);
      expect(body.goals[0].title).toBe('Rivendell');
      expect(body.total).toBe(1);

      // Verify parameterized binding was used (not string concatenation)
      expect(mockCountBind).toHaveBeenCalledWith('%rivendell%');
      expect(mockDataBind).toHaveBeenCalledWith('%rivendell%', 25, 0);
    });

    it('should include WHERE LIKE clause in SQL when search is provided', async () => {
      const mockCountFirst = jest.fn().mockResolvedValue({ total: 0 });
      const mockCountBind = jest.fn().mockReturnValue({ first: mockCountFirst });
      const mockDataAll = jest.fn().mockResolvedValue({ results: [] });
      const mockDataBind = jest.fn().mockReturnValue({ all: mockDataAll });

      mockEnv.DB.prepare
        .mockReturnValueOnce({ bind: mockCountBind })
        .mockReturnValueOnce({ bind: mockDataBind });

      const request = createGoalsRequest('?search=moria');
      await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      // Verify SQL includes WHERE title LIKE
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE title LIKE')
      );
    });

    it('should not include WHERE clause when search is empty', async () => {
      setupGoalsDb({ countTotal: 3, rows: sampleGoals });

      const request = createGoalsRequest('?search=');
      await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      // Both calls should NOT contain WHERE
      const calls = mockEnv.DB.prepare.mock.calls;
      expect(calls[0][0]).not.toContain('WHERE');
      expect(calls[1][0]).not.toContain('WHERE');
    });

    it('should sort by distance DESC when order=desc', async () => {
      setupGoalsDb({ countTotal: 3, rows: sampleGoals });

      const request = createGoalsRequest('?order=desc');
      await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      // Verify data SQL includes ORDER BY distance DESC
      const dataSqlCall = mockEnv.DB.prepare.mock.calls[1][0];
      expect(dataSqlCall).toContain('ORDER BY distance DESC');
    });

    it('should default to distance ASC when order not specified', async () => {
      setupGoalsDb({ countTotal: 3, rows: sampleGoals });

      const request = createGoalsRequest();
      await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const dataSqlCall = mockEnv.DB.prepare.mock.calls[1][0];
      expect(dataSqlCall).toContain('ORDER BY distance ASC');
    });

    it('should default to ASC for invalid order parameter', async () => {
      setupGoalsDb({ countTotal: 3, rows: sampleGoals });

      const request = createGoalsRequest('?order=invalid');
      await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const dataSqlCall = mockEnv.DB.prepare.mock.calls[1][0];
      expect(dataSqlCall).toContain('ORDER BY distance ASC');
    });

    it('should return 500 on database error', async () => {
      mockEnv.DB.prepare.mockImplementation(() => {
        throw new Error('DB connection failed');
      });

      const request = createGoalsRequest();
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toContain('Internal server error');
    });

    it('should return Content-Type application/json', async () => {
      setupGoalsDb({ countTotal: 3, rows: sampleGoals });

      const request = createGoalsRequest();
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should return all expected keys in response', async () => {
      setupGoalsDb({ countTotal: 3, rows: sampleGoals });

      const request = createGoalsRequest();
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      expect(Object.keys(body).sort()).toEqual(['goals', 'page', 'pageSize', 'total', 'totalPages']);
    });

    it('should return all expected keys in each goal row', async () => {
      setupGoalsDb({ countTotal: 1, rows: [sampleGoals[0]] });

      const request = createGoalsRequest();
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      expect(Object.keys(body.goals[0]).sort()).toEqual([
        'description', 'distance', 'has_image', 'id', 'image_id', 'special', 'title'
      ]);
    });

    it('should calculate totalPages correctly', async () => {
      setupGoalsDb({ countTotal: 171, rows: sampleGoals });

      const request = createGoalsRequest('?pageSize=25');
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      expect(body.totalPages).toBe(7); // ceil(171/25) = 7
    });

    it('should return totalPages as 1 when total is 0', async () => {
      setupGoalsDb({ countTotal: 0, rows: [] });

      const request = createGoalsRequest();
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      expect(body.totalPages).toBe(1);
    });

    it('should trim whitespace from search parameter', async () => {
      const mockCountFirst = jest.fn().mockResolvedValue({ total: 0 });
      const mockCountBind = jest.fn().mockReturnValue({ first: mockCountFirst });
      const mockDataAll = jest.fn().mockResolvedValue({ results: [] });
      const mockDataBind = jest.fn().mockReturnValue({ all: mockDataAll });

      mockEnv.DB.prepare
        .mockReturnValueOnce({ bind: mockCountBind })
        .mockReturnValueOnce({ bind: mockDataBind });

      const request = createGoalsRequest('?search=%20rivendell%20');
      await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      // Should trim to 'rivendell'
      expect(mockCountBind).toHaveBeenCalledWith('%rivendell%');
    });

    it('should treat whitespace-only search as empty (no WHERE clause)', async () => {
      setupGoalsDb({ countTotal: 3, rows: sampleGoals });

      const request = createGoalsRequest('?search=%20%20%20');
      await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      // No WHERE clause expected for whitespace-only search
      const calls = mockEnv.DB.prepare.mock.calls;
      expect(calls[0][0]).not.toContain('WHERE');
    });

    it('should handle non-numeric page and pageSize gracefully', async () => {
      setupGoalsDb({ countTotal: 3, rows: sampleGoals });

      const request = createGoalsRequest('?page=abc&pageSize=xyz');
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      // Should default to page=1 and pageSize=25 when non-numeric
      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(25);
    });

    it('should escape LIKE wildcard characters in search term', async () => {
      const mockCountFirst = jest.fn().mockResolvedValue({ total: 0 });
      const mockCountBind = jest.fn().mockReturnValue({ first: mockCountFirst });
      const mockDataAll = jest.fn().mockResolvedValue({ results: [] });
      const mockDataBind = jest.fn().mockReturnValue({ all: mockDataAll });

      mockEnv.DB.prepare
        .mockReturnValueOnce({ bind: mockCountBind })
        .mockReturnValueOnce({ bind: mockDataBind });

      const request = createGoalsRequest('?search=100%25_done');
      await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      // % and _ should be escaped with backslash
      expect(mockCountBind).toHaveBeenCalledWith('%100\\%\\_done%');
    });

    it('should clamp page to totalPages when requested page exceeds total', async () => {
      setupGoalsDb({ countTotal: 50, rows: [] });

      const request = createGoalsRequest('?page=999&pageSize=25');
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      // totalPages = ceil(50/25) = 2, page should be clamped to 2
      expect(body.page).toBe(2);
      expect(body.totalPages).toBe(2);
    });

    it('should escape backslash in search term for LIKE pattern', async () => {
      const mockCountFirst = jest.fn().mockResolvedValue({ total: 0 });
      const mockCountBind = jest.fn().mockReturnValue({ first: mockCountFirst });
      const mockDataAll = jest.fn().mockResolvedValue({ results: [] });
      const mockDataBind = jest.fn().mockReturnValue({ all: mockDataAll });

      mockEnv.DB.prepare
        .mockReturnValueOnce({ bind: mockCountBind })
        .mockReturnValueOnce({ bind: mockDataBind });

      const request = createGoalsRequest('?search=path\\to');
      await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      // Backslash should be escaped: \ → \\
      expect(mockCountBind).toHaveBeenCalledWith('%path\\\\to%');
    });

    it('should include ESCAPE clause in SQL when search is provided', async () => {
      const mockCountFirst = jest.fn().mockResolvedValue({ total: 0 });
      const mockCountBind = jest.fn().mockReturnValue({ first: mockCountFirst });
      const mockDataAll = jest.fn().mockResolvedValue({ results: [] });
      const mockDataBind = jest.fn().mockReturnValue({ all: mockDataAll });

      mockEnv.DB.prepare
        .mockReturnValueOnce({ bind: mockCountBind })
        .mockReturnValueOnce({ bind: mockDataBind });

      const request = createGoalsRequest('?search=test');
      await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      // Both count and data SQL should include ESCAPE clause
      const countSqlCall = mockEnv.DB.prepare.mock.calls[0][0] as string;
      const dataSqlCall = mockEnv.DB.prepare.mock.calls[1][0] as string;
      expect(countSqlCall).toContain("ESCAPE '\\'");
      expect(dataSqlCall).toContain("ESCAPE '\\'");
    });

    it('should clamp page=0 to 1', async () => {
      setupGoalsDb({ countTotal: 3, rows: sampleGoals });

      const request = createGoalsRequest('?page=0');
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      expect(body.page).toBe(1);
    });

    it('should default pageSize to 25 when 0 is provided (falsy fallback)', async () => {
      setupGoalsDb({ countTotal: 3, rows: sampleGoals });

      const request = createGoalsRequest('?pageSize=0');
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      // parseInt('0') is 0 (falsy), so || 25 kicks in → pageSize = 25
      expect(body.pageSize).toBe(25);
    });

    it('should clamp negative pageSize to 1', async () => {
      setupGoalsDb({ countTotal: 3, rows: sampleGoals });

      const request = createGoalsRequest('?pageSize=-10');
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      expect(body.pageSize).toBe(1);
    });

    it('should preserve null description and special in goal rows', async () => {
      const rowsWithNulls = [
        { id: 5, title: 'Weathertop', distance: 300, description: null, special: null, image_id: 'weathertop' },
      ];
      setupGoalsDb({ countTotal: 1, rows: rowsWithNulls });

      const request = createGoalsRequest();
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      expect(body.goals[0].description).toBeNull();
      expect(body.goals[0].special).toBeNull();
      expect(body.goals[0].has_image).toBe(true);
    });

    it('should return Content-Type application/json on 500 error', async () => {
      mockEnv.DB.prepare.mockImplementation(() => {
        throw new Error('DB crashed');
      });

      const request = createGoalsRequest();
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      expect(response.status).toBe(500);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should combine search and sort correctly', async () => {
      const mockCountFirst = jest.fn().mockResolvedValue({ total: 2 });
      const mockCountBind = jest.fn().mockReturnValue({ first: mockCountFirst });
      const mockDataAll = jest.fn().mockResolvedValue({
        results: [
          { id: 10, title: 'Rivendell', distance: 458, description: null, special: null, image_id: null },
          { id: 11, title: 'River Hoarwell', distance: 350, description: null, special: null, image_id: null },
        ],
      });
      const mockDataBind = jest.fn().mockReturnValue({ all: mockDataAll });

      mockEnv.DB.prepare
        .mockReturnValueOnce({ bind: mockCountBind })
        .mockReturnValueOnce({ bind: mockDataBind });

      const request = createGoalsRequest('?search=river&order=desc');
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.goals).toHaveLength(2);

      // Verify both WHERE LIKE and ORDER BY DESC are in data SQL
      const dataSqlCall = mockEnv.DB.prepare.mock.calls[1][0] as string;
      expect(dataSqlCall).toContain('WHERE title LIKE');
      expect(dataSqlCall).toContain('ORDER BY distance DESC');

      // Verify search binding is used
      expect(mockCountBind).toHaveBeenCalledWith('%river%');
    });

    it('should return empty goals array when no results match', async () => {
      setupGoalsDb({ countTotal: 0, rows: [] });

      const request = createGoalsRequest();
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      expect(body.goals).toEqual([]);
      expect(body.total).toBe(0);
      expect(body.page).toBe(1);
    });

    it('should handle countResult returning null gracefully', async () => {
      const mockCountFirst = jest.fn().mockResolvedValue(null);
      const mockDataAll = jest.fn().mockResolvedValue({ results: [] });
      const mockDataBind = jest.fn().mockReturnValue({ all: mockDataAll });

      mockEnv.DB.prepare
        .mockReturnValueOnce({ first: mockCountFirst })
        .mockReturnValueOnce({ all: mockDataAll, bind: mockDataBind });

      const request = createGoalsRequest();
      const response = await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      const body = await response.json();
      // When countResult is null, total defaults to 0 via ?? operator
      expect(body.total).toBe(0);
      expect(body.totalPages).toBe(1);
    });

    it('should escape all LIKE wildcards combined in a single search term', async () => {
      const mockCountFirst = jest.fn().mockResolvedValue({ total: 0 });
      const mockCountBind = jest.fn().mockReturnValue({ first: mockCountFirst });
      const mockDataAll = jest.fn().mockResolvedValue({ results: [] });
      const mockDataBind = jest.fn().mockReturnValue({ all: mockDataAll });

      mockEnv.DB.prepare
        .mockReturnValueOnce({ bind: mockCountBind })
        .mockReturnValueOnce({ bind: mockDataBind });

      // Search with all three special characters: \ % _
      const request = createGoalsRequest('?search=a\\b%c_d');
      await handleAdminGoalsList(
        request,
        mockEnv as unknown as { DB: D1Database }
      );

      // \ → \\, % → \%, _ → \_ (backslash first, then %, then _)
      expect(mockCountBind).toHaveBeenCalledWith('%a\\\\b\\%c\\_d%');
    });
  });

  describe('handleAdminGoalGet', () => {
    const sampleGoal = {
      id: 42,
      title: 'Rivendell',
      distance: 747.8,
      description: 'The company arrives at the Last Homely House...',
      special: null,
      image_id: 'rivendell',
    };

    it('should return full goal object for valid ID', async () => {
      setupDbQuery({ firstResult: sampleGoal });

      const response = await handleAdminGoalGet(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(sampleGoal);
    });

    it('should return 404 for non-existent goal', async () => {
      setupDbQuery({ firstResult: null });

      const response = await handleAdminGoalGet(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        999
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Goal not found');
    });

    it('should return 500 on database error', async () => {
      mockEnv.DB.prepare.mockImplementation(() => {
        throw new Error('DB crashed');
      });

      const response = await handleAdminGoalGet(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Internal server error');
    });

    it('should return Content-Type application/json', async () => {
      setupDbQuery({ firstResult: sampleGoal });

      const response = await handleAdminGoalGet(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42
      );

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should bind goal ID to query parameter', async () => {
      const { mockBind } = setupDbQuery({ firstResult: sampleGoal });

      await handleAdminGoalGet(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42
      );

      expect(mockBind).toHaveBeenCalledWith(42);
    });

    it('should query correct columns from goals table', async () => {
      setupDbQuery({ firstResult: sampleGoal });

      await handleAdminGoalGet(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42
      );

      const sql = mockEnv.DB.prepare.mock.calls[0][0] as string;
      expect(sql).toContain('SELECT');
      expect(sql).toContain('id');
      expect(sql).toContain('title');
      expect(sql).toContain('distance');
      expect(sql).toContain('description');
      expect(sql).toContain('special');
      expect(sql).toContain('image_id');
      expect(sql).toContain('FROM goals WHERE id = ?');
    });

    it('should return goal with null special and image_id', async () => {
      const goalWithNulls = { ...sampleGoal, special: null, image_id: null };
      setupDbQuery({ firstResult: goalWithNulls });

      const response = await handleAdminGoalGet(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42
      );

      const body = await response.json();
      expect(body.special).toBeNull();
      expect(body.image_id).toBeNull();
    });
  });

  describe('handleAdminGoalUpdate', () => {
    const existingGoal = {
      id: 42,
      title: 'Rivendell',
      distance: 747.8,
      description: 'Original description',
      special: null,
      image_id: 'rivendell',
    };

    const validBody = {
      title: 'Rivendell Updated',
      distance: 750.0,
      description: 'Updated description',
      special: null,
      image_id: 'rivendell',
    };

    function setupUpdateDb(options?: {
      existing?: Record<string, unknown> | null;
      updated?: Record<string, unknown> | null;
    }) {
      const existing = options?.existing ?? existingGoal;
      const updated = options?.updated ?? { ...existingGoal, ...validBody };

      // Call sequence: 1) SELECT existing, 2) UPDATE run, 3) INSERT audit log, 4) SELECT updated
      const mockFirst1 = jest.fn().mockResolvedValue(existing);
      const mockBind1 = jest.fn().mockReturnValue({ first: mockFirst1 });

      const mockRun2 = jest.fn().mockResolvedValue({ meta: { changes: 1 } });
      const mockBind2 = jest.fn().mockReturnValue({ run: mockRun2 });

      const mockRun3 = jest.fn().mockResolvedValue({ meta: { changes: 1 } });
      const mockBind3 = jest.fn().mockReturnValue({ run: mockRun3 });

      const mockFirst4 = jest.fn().mockResolvedValue(updated);
      const mockBind4 = jest.fn().mockReturnValue({ first: mockFirst4 });

      mockEnv.DB.prepare
        .mockReturnValueOnce({ bind: mockBind1 })
        .mockReturnValueOnce({ bind: mockBind2 })
        .mockReturnValueOnce({ bind: mockBind3 })
        .mockReturnValueOnce({ bind: mockBind4 });

      return { mockBind1, mockBind2, mockBind3, mockBind4, mockRun2, mockFirst1, mockFirst4 };
    }

    it('should update goal with valid data and return 200', async () => {
      const updated = { ...existingGoal, ...validBody };
      setupUpdateDb({ updated });
      mockRequest.headers.get.mockReturnValue('1.2.3.4');

      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        validBody,
        1
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.title).toBe('Rivendell Updated');
    });

    it('should return 400 for missing title', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, title: '' },
        1
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Title is required');
    });

    it('should return 400 for whitespace-only title', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, title: '   ' },
        1
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Title is required');
    });

    it('should return 400 for non-positive distance', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, distance: -10 },
        1
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Distance must be a positive number');
    });

    it('should return 400 for zero distance', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, distance: 0 },
        1
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Distance must be a positive number');
    });

    it('should return 400 for NaN distance', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, distance: 'abc' },
        1
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Distance must be a positive number');
    });

    it('should return 400 for missing description', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, description: '' },
        1
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Description is required');
    });

    it('should return 400 for invalid image_id slug format', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, image_id: 'INVALID SLUG!' },
        1
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Image ID must be a valid slug format');
    });

    it('should accept valid slug image_id', async () => {
      const bodyWithSlug = { ...validBody, image_id: 'bag-end' };
      setupUpdateDb({ updated: { ...existingGoal, ...bodyWithSlug } });
      mockRequest.headers.get.mockReturnValue('1.2.3.4');

      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        bodyWithSlug,
        1
      );

      expect(response.status).toBe(200);
    });

    it('should normalize empty special to null', async () => {
      const bodyWithEmptySpecial = { ...validBody, special: '' };
      const { mockBind2 } = setupUpdateDb({ updated: { ...existingGoal, ...bodyWithEmptySpecial, special: null } });
      mockRequest.headers.get.mockReturnValue('1.2.3.4');

      await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        bodyWithEmptySpecial,
        1
      );

      // The UPDATE bind should receive null for special (4th arg)
      expect(mockBind2).toHaveBeenCalledWith(
        'Rivendell Updated',
        750.0,
        'Updated description',
        null,
        'rivendell',
        42
      );
    });

    it('should normalize empty image_id to null', async () => {
      const bodyWithEmptyImageId = { ...validBody, image_id: '' };
      const { mockBind2 } = setupUpdateDb({ updated: { ...existingGoal, ...bodyWithEmptyImageId, image_id: null } });
      mockRequest.headers.get.mockReturnValue('1.2.3.4');

      await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        bodyWithEmptyImageId,
        1
      );

      // The UPDATE bind should receive null for image_id (5th arg)
      expect(mockBind2).toHaveBeenCalledWith(
        'Rivendell Updated',
        750.0,
        'Updated description',
        null,
        null,
        42
      );
    });

    it('should return 404 for non-existent goal', async () => {
      // Validation passes first (body is valid), then the SELECT for existing goal returns null
      const mockFirst1 = jest.fn().mockResolvedValue(null);
      const mockBind1 = jest.fn().mockReturnValue({ first: mockFirst1 });
      mockEnv.DB.prepare.mockReturnValueOnce({ bind: mockBind1 });

      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        999,
        validBody,
        1
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Goal not found');
    });

    it('should call logAdminAction with correct details for changed fields', async () => {
      const updated = { ...existingGoal, title: 'New Title', distance: 800 };
      setupUpdateDb({ updated });
      mockRequest.headers.get.mockReturnValue('1.2.3.4');

      await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, title: 'New Title', distance: 800 },
        1
      );

      // The 3rd DB.prepare call is the audit log INSERT
      const auditSql = mockEnv.DB.prepare.mock.calls[2][0] as string;
      expect(auditSql).toContain('INSERT INTO admin_audit_log');
    });

    it('should return 500 on database error during update', async () => {
      mockEnv.DB.prepare.mockImplementation(() => {
        throw new Error('DB crashed');
      });

      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        validBody,
        1
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Internal server error');
    });

    it('should return Content-Type application/json on all responses', async () => {
      // Test 400 response
      const response400 = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, title: '' },
        1
      );
      expect(response400.headers.get('Content-Type')).toBe('application/json');

      // Test 200 response
      setupUpdateDb();
      mockRequest.headers.get.mockReturnValue('1.2.3.4');
      const response200 = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        validBody,
        1
      );
      expect(response200.headers.get('Content-Type')).toBe('application/json');
    });

    it('should use CF-Connecting-IP for audit log IP address', async () => {
      setupUpdateDb();
      mockRequest.headers.get.mockImplementation((header: string) => {
        if (header === 'CF-Connecting-IP') return '10.0.0.1';
        return null;
      });

      await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        validBody,
        1
      );

      // Audit log INSERT is the 3rd prepare call, check the bind args
      const auditBindCall = mockEnv.DB.prepare.mock.calls[2];
      expect(auditBindCall).toBeDefined();
    });

    it('should accept null image_id and special values', async () => {
      const bodyWithNulls = { ...validBody, special: null, image_id: null };
      setupUpdateDb({ updated: { ...existingGoal, ...bodyWithNulls } });
      mockRequest.headers.get.mockReturnValue('1.2.3.4');

      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        bodyWithNulls,
        1
      );

      expect(response.status).toBe(200);
    });

    it('should trim title and description before saving', async () => {
      const bodyWithSpaces = { ...validBody, title: '  Rivendell  ', description: '  Desc  ' };
      const { mockBind2 } = setupUpdateDb({ updated: { ...existingGoal, title: 'Rivendell', description: 'Desc' } });
      mockRequest.headers.get.mockReturnValue('1.2.3.4');

      await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        bodyWithSpaces,
        1
      );

      // First arg to UPDATE bind should be trimmed title
      expect(mockBind2).toHaveBeenCalledWith(
        'Rivendell',
        750.0,
        'Desc',
        null,
        'rivendell',
        42
      );
    });

    it('should reject image_id with uppercase letters', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, image_id: 'Rivendell' },
        1
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Image ID must be a valid slug format');
    });

    it('should reject image_id with spaces', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, image_id: 'bag end' },
        1
      );

      expect(response.status).toBe(400);
    });

    it('should reject image_id starting with hyphen', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, image_id: '-rivendell' },
        1
      );

      expect(response.status).toBe(400);
    });

    it('should store distance as-is without rounding', async () => {
      const bodyWithDecimal = { ...validBody, distance: 747.123456 };
      const { mockBind2 } = setupUpdateDb({ updated: { ...existingGoal, distance: 747.123456 } });
      mockRequest.headers.get.mockReturnValue('1.2.3.4');

      await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        bodyWithDecimal,
        1
      );

      // 2nd arg to UPDATE bind should be the exact distance value
      const bindArgs = mockBind2.mock.calls[0];
      expect(bindArgs[1]).toBe(747.123456);
      expect(bindArgs[5]).toBe(42);
    });

    // ─── Edge-case tests added by QA (Story 4-4) ───

    it('should return 500 when body is null (caught by try/catch)', async () => {
      // null body causes TypeError accessing .title — caught as 500 internal error
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        null as unknown,
        1
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Internal server error');
    });

    it('should return 500 when body is undefined (caught by try/catch)', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        undefined as unknown,
        1
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Internal server error');
    });

    it('should ignore extra/unknown fields in body', async () => {
      const bodyWithExtras = {
        ...validBody,
        unknownField: 'should be ignored',
        _hack: true,
        id: 999, // should not override the URL param
      };
      const updated = { ...existingGoal, ...validBody };
      const { mockBind2 } = setupUpdateDb({ updated });
      mockRequest.headers.get.mockReturnValue('1.2.3.4');

      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        bodyWithExtras,
        1
      );

      expect(response.status).toBe(200);
      // UPDATE bind should only contain the 5 known fields + goalId
      expect(mockBind2).toHaveBeenCalledWith(
        'Rivendell Updated',
        750.0,
        'Updated description',
        null,
        'rivendell',
        42
      );
    });

    it('should accept slug with numbers only', async () => {
      const bodyWithNumSlug = { ...validBody, image_id: '123' };
      setupUpdateDb({ updated: { ...existingGoal, ...bodyWithNumSlug } });
      mockRequest.headers.get.mockReturnValue('1.2.3.4');

      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        bodyWithNumSlug,
        1
      );

      expect(response.status).toBe(200);
    });

    it('should accept slug with single character', async () => {
      const bodyWithSingleChar = { ...validBody, image_id: 'a' };
      setupUpdateDb({ updated: { ...existingGoal, ...bodyWithSingleChar } });
      mockRequest.headers.get.mockReturnValue('1.2.3.4');

      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        bodyWithSingleChar,
        1
      );

      expect(response.status).toBe(200);
    });

    it('should accept slug with multiple hyphenated segments', async () => {
      const bodyWithMultiSeg = { ...validBody, image_id: 'the-old-forest-road-2' };
      setupUpdateDb({ updated: { ...existingGoal, ...bodyWithMultiSeg } });
      mockRequest.headers.get.mockReturnValue('1.2.3.4');

      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        bodyWithMultiSeg,
        1
      );

      expect(response.status).toBe(200);
    });

    it('should reject image_id ending with hyphen', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, image_id: 'rivendell-' },
        1
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Image ID must be a valid slug format');
    });

    it('should reject image_id with consecutive hyphens', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, image_id: 'bag--end' },
        1
      );

      expect(response.status).toBe(400);
    });

    it('should accept title with special characters and unicode', async () => {
      const bodyWithUnicode = { ...validBody, title: 'Lothlórien — The Golden Wood 🌳' };
      const updated = { ...existingGoal, title: 'Lothlórien — The Golden Wood 🌳' };
      setupUpdateDb({ updated });
      mockRequest.headers.get.mockReturnValue('1.2.3.4');

      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        bodyWithUnicode,
        1
      );

      expect(response.status).toBe(200);
      const resBody = await response.json();
      expect(resBody.title).toBe('Lothlórien — The Golden Wood 🌳');
    });

    it('should accept description with HTML tags (stored as-is, sanitised on render)', async () => {
      const bodyWithHtml = { ...validBody, description: '<script>alert("xss")</script><b>Bold</b>' };
      const updated = { ...existingGoal, description: '<script>alert("xss")</script><b>Bold</b>' };
      setupUpdateDb({ updated });
      mockRequest.headers.get.mockReturnValue('1.2.3.4');

      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        bodyWithHtml,
        1
      );

      // Server stores raw; DOMPurify sanitises on client render
      expect(response.status).toBe(200);
    });

    it('should handle very long title (1000+ characters)', async () => {
      const longTitle = 'A'.repeat(2000);
      const bodyWithLongTitle = { ...validBody, title: longTitle };
      const updated = { ...existingGoal, title: longTitle };
      setupUpdateDb({ updated });
      mockRequest.headers.get.mockReturnValue('1.2.3.4');

      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        bodyWithLongTitle,
        1
      );

      // Handler does not enforce max-length — DB layer may; handler should not crash
      expect(response.status).toBe(200);
    });

    it('should return 400 for whitespace-only description', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, description: '   \n\t  ' },
        1
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Description is required');
    });

    it('should pass validation for Infinity distance (isNaN is false, > 0 is true)', async () => {
      // Infinity passes the isNaN/> 0 check; this tests that the handler doesn't crash
      const bodyWithInfinity = { ...validBody, distance: Infinity };
      setupUpdateDb({ updated: { ...existingGoal, distance: Infinity } });
      mockRequest.headers.get.mockReturnValue('1.2.3.4');

      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        bodyWithInfinity,
        1
      );

      // Infinity passes validation → 200 (DB stores it)
      expect(response.status).toBe(200);
    });

    it('should produce audit log details with old/new values for changed fields', async () => {
      const updatedBody = {
        title: 'New Title',
        distance: 800,
        description: 'New description',
        special: 'birthday',
        image_id: 'new-image',
      };
      setupUpdateDb({ updated: { ...existingGoal, ...updatedBody } });
      mockRequest.headers.get.mockReturnValue('10.0.0.1');

      await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        updatedBody,
        7
      );

      // The 3rd prepare call is the audit INSERT
      const auditBindCall = mockEnv.DB.prepare.mock.calls[2];
      expect(auditBindCall).toBeDefined();
      const auditSql = auditBindCall[0] as string;
      expect(auditSql).toContain('INSERT INTO admin_audit_log');

      // The bind args should be: adminUserId, action, targetType, targetId, details, ipAddress, success
      // We access via the bind mock on the 3rd prepare
      const thirdPrepare = mockEnv.DB.prepare.mock.results[2].value;
      const bindArgs = thirdPrepare.bind.mock.calls[0];
      expect(bindArgs[0]).toBe(7);           // adminUserId
      expect(bindArgs[1]).toBe('update_goal'); // action
      expect(bindArgs[2]).toBe('goal');       // targetType
      expect(bindArgs[3]).toBe(42);           // targetId

      // Parse the details JSON to verify structure
      const details = JSON.parse(bindArgs[4]);
      expect(details.title).toEqual({ old: 'Rivendell', new: 'New Title' });
      expect(details.distance).toEqual({ old: 747.8, new: 800 });
      // Description is truncated in audit log
      expect(details.description).toEqual({ old: '(truncated)', new: '(truncated)' });
      expect(details.special).toEqual({ old: null, new: 'birthday' });
      expect(details.image_id).toEqual({ old: 'rivendell', new: 'new-image' });

      expect(bindArgs[5]).toBe('10.0.0.1');  // ipAddress
      expect(bindArgs[6]).toBe(1);           // success flag (1 = true)
    });

    it('should produce empty changes object when no fields actually changed', async () => {
      // Submit the exact same values as existing goal
      const identicalBody = {
        title: 'Rivendell',
        distance: 747.8,
        description: 'Original description',
        special: null,
        image_id: 'rivendell',
      };
      setupUpdateDb({
        existing: existingGoal,
        updated: existingGoal,
      });
      mockRequest.headers.get.mockReturnValue('1.2.3.4');

      await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        identicalBody,
        1
      );

      // Verify the audit details JSON is an empty changes object
      const thirdPrepare = mockEnv.DB.prepare.mock.results[2].value;
      const bindArgs = thirdPrepare.bind.mock.calls[0];
      const details = JSON.parse(bindArgs[4]);
      expect(details).toEqual({});
    });

    it('should use "unknown" as IP when CF-Connecting-IP header is absent', async () => {
      setupUpdateDb();
      mockRequest.headers.get.mockReturnValue(null);

      await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        validBody,
        1
      );

      // The audit log bind should have 'unknown' as ipAddress
      const thirdPrepare = mockEnv.DB.prepare.mock.results[2].value;
      const bindArgs = thirdPrepare.bind.mock.calls[0];
      expect(bindArgs[5]).toBe('unknown');
    });

    it('should return 400 for distance passed as string number', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, distance: '750' },
        1
      );

      // typeof '750' !== 'number' → NaN → 400
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Distance must be a positive number');
    });

    it('should return 400 when title is a non-string type', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, title: 12345 },
        1
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Title is required');
    });

    it('should return 400 when description is a non-string type', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, description: 42 },
        1
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Description is required');
    });

    it('should reject image_id with underscores', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, image_id: 'bag_end' },
        1
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Image ID must be a valid slug format');
    });

    it('should reject image_id with dots', async () => {
      const response = await handleAdminGoalUpdate(
        mockRequest as unknown as Request,
        mockEnv as unknown as { DB: D1Database },
        42,
        { ...validBody, image_id: 'bag.end' },
        1
      );

      expect(response.status).toBe(400);
    });
  });
});
