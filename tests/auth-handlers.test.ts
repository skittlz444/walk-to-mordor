
import { 
  handleRegister, 
  handleLogin, 
  handleLogout, 
  handleSessionValidation, 
  validateSession 
} from '../src/auth-handlers';
import { createErrorResponse, createSuccessResponse } from '../src/validators';
import * as authUtils from '../src/auth-utils';

// Mock auth-utils
jest.mock('../src/auth-utils', () => ({
  generateSalt: jest.fn(),
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
  generateSessionId: jest.fn(),
  isValidEmail: jest.fn(),
  isValidPassword: jest.fn(),
  isValidUsername: jest.fn(),
  getSessionExpiry: jest.fn(),
  isSessionExpired: jest.fn()
}));

describe('Auth Handlers', () => {
  let mockEnv: any;
  let mockRequest: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations for auth-utils
    (authUtils.generateSalt as jest.Mock).mockResolvedValue('mock-salt');
    (authUtils.hashPassword as jest.Mock).mockResolvedValue('mock-hash');
    (authUtils.verifyPassword as jest.Mock).mockResolvedValue(true);
    (authUtils.generateSessionId as jest.Mock).mockReturnValue('mock-session-id');
    (authUtils.isValidEmail as jest.Mock).mockReturnValue(true);
    (authUtils.isValidPassword as jest.Mock).mockReturnValue({ valid: true, errors: [] });
    (authUtils.isValidUsername as jest.Mock).mockReturnValue(true);
    (authUtils.getSessionExpiry as jest.Mock).mockReturnValue('2026-02-01T00:00:00Z');
    (authUtils.isSessionExpired as jest.Mock).mockReturnValue(false);

    // Mock DB
    mockEnv = {
      DB: {
        prepare: jest.fn(() => ({
          bind: jest.fn(() => ({
            run: jest.fn().mockResolvedValue({ meta: { last_row_id: 1, changes: 1 } }),
            all: jest.fn().mockResolvedValue({ results: [] }),
            first: jest.fn().mockResolvedValue(null)
          }))
        }))
      }
    };

    mockRequest = {
      headers: {
        get: jest.fn()
      }
    };
  });

  describe('handleRegister', () => {
    it('should register a new user successfully (first user auto-approved)', async () => {
      const body = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!'
      };

      // Mock DB responses
      // 1. Check for existing users (count = 0)
      // 2. Insert user
      // 3. Update progress (link existing)
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockRun = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll, run: mockRun });
      mockBind.mockReturnValue({ run: mockRun, all: mockAll });
      
      // First call: check count
      mockAll.mockResolvedValueOnce({ results: [{ count: 0 }] });
      // Second call: insert user
      mockRun.mockResolvedValueOnce({ meta: { last_row_id: 1 } });
      // Third call: update progress
      mockRun.mockResolvedValueOnce({ meta: { changes: 0 } });

      const response = await handleRegister(mockRequest, mockEnv, body);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toContain('first user');
      expect(data.requiresApproval).toBe(false);
      
      // Verify DB calls
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*)'));
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'));
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE progress'));
    });

    it('should register a new user successfully (subsequent user pending approval)', async () => {
      const body = {
        username: 'testuser2',
        email: 'test2@example.com',
        password: 'Password123!'
      };

      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockRun = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll, run: mockRun });
      mockBind.mockReturnValue({ run: mockRun, all: mockAll });
      
      // First call: check count (count > 0)
      mockAll.mockResolvedValueOnce({ results: [{ count: 1 }] });
      // Second call: insert user
      mockRun.mockResolvedValueOnce({ meta: { last_row_id: 2 } });

      const response = await handleRegister(mockRequest, mockEnv, body);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toContain('wait for approval');
      expect(data.requiresApproval).toBe(true);
    });

    it('should return 400 if email is missing', async () => {
      const body = { username: 'testuser', password: 'Password123!' };
      const response = await handleRegister(mockRequest, mockEnv, body);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('email');
    });

    it('should return 400 if password is missing', async () => {
      const body = { username: 'testuser', email: 'test@example.com' };
      const response = await handleRegister(mockRequest, mockEnv, body);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('password');
    });

    it('should return 400 if email is invalid', async () => {
      (authUtils.isValidEmail as jest.Mock).mockReturnValue(false);
      const body = { username: 'testuser', email: 'bad-email', password: 'Password123!' };
      const response = await handleRegister(mockRequest, mockEnv, body);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid email');
    });

    it('should return 400 if password is invalid', async () => {
      (authUtils.isValidPassword as jest.Mock).mockReturnValue({ valid: false, errors: ['Too short'] });
      const body = { username: 'testuser', email: 'test@example.com', password: 'bad' };
      const response = await handleRegister(mockRequest, mockEnv, body);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Too short');
    });

    it('should return 409 if email already exists', async () => {
      const body = { username: 'testuser', email: 'test@example.com', password: 'Password123!' };
      
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();
      
      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ 
        run: jest.fn().mockRejectedValue(new Error('UNIQUE constraint failed: users.email')),
        all: mockAll
      });
      
      mockAll.mockResolvedValueOnce({ results: [{ count: 0 }] }); // First user check

      const response = await handleRegister(mockRequest, mockEnv, body);
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe('Email already registered');
    });

    it('should return 500 on generic database error', async () => {
      const body = { username: 'testuser', email: 'test@example.com', password: 'Password123!' };
      
      const mockPrepare = mockEnv.DB.prepare;
      mockPrepare.mockImplementation(() => {
        throw new Error('DB Connection Failed');
      });

      const response = await handleRegister(mockRequest, mockEnv, body);
      expect(response.status).toBe(500);
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await handleRegister(mockRequest, mockEnv, {});
      expect(response.status).toBe(400);
    });

    it('should return 400 if username is invalid', async () => {
      (authUtils.isValidUsername as jest.Mock).mockReturnValue(false);
      const response = await handleRegister(mockRequest, mockEnv, { username: 'bad', email: 't@t.com', password: 'P' });
      expect(response.status).toBe(400);
    });

    it('should return 409 if username already exists', async () => {
      const body = {
        username: 'existing',
        email: 'test@example.com',
        password: 'Password123!'
      };

      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();
      
      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ 
        run: jest.fn().mockRejectedValue(new Error('UNIQUE constraint failed: users.username')),
        all: mockAll 
      });
      
      mockAll.mockResolvedValueOnce({ results: [{ count: 0 }] });

      const response = await handleRegister(mockRequest, mockEnv, body);
      expect(response.status).toBe(409);
    });
  });

  describe('handleLogin', () => {
    it('should return 400 if password is missing', async () => {
      const body = { username: 'testuser' };
      const response = await handleLogin(mockRequest, mockEnv, body);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('password');
    });

    it('should return 500 on database error', async () => {
      const body = { username: 'testuser', password: 'Password123!' };
      const mockPrepare = mockEnv.DB.prepare;
      mockPrepare.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const response = await handleLogin(mockRequest, mockEnv, body);
      expect(response.status).toBe(500);
    });

    it('should login successfully', async () => {
      const body = { username: 'testuser', password: 'Password123!' };
      
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();
      const mockRun = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll, run: mockRun });
      mockBind.mockReturnValue({ all: mockAll, run: mockRun });

      // Mock user lookup
      mockAll.mockResolvedValueOnce({ 
        results: [{ 
          id: 1, 
          username: 'testuser', 
          email: 'test@example.com', 
          password_hash: 'hash', 
          salt: 'salt', 
          approved: 1 
        }] 
      });

      const response = await handleLogin(mockRequest, mockEnv, body);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionId).toBe('mock-session-id');
    });

    it('should return 401 for invalid credentials (user not found)', async () => {
      const body = { username: 'testuser', password: 'Password123!' };
      
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ all: mockAll });

      mockAll.mockResolvedValueOnce({ results: [] });

      const response = await handleLogin(mockRequest, mockEnv, body);
      expect(response.status).toBe(401);
    });

    it('should return 401 for invalid credentials (wrong password)', async () => {
      const body = { username: 'testuser', password: 'WrongPassword' };
      
      (authUtils.verifyPassword as jest.Mock).mockResolvedValue(false);

      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ all: mockAll });

      mockAll.mockResolvedValueOnce({ 
        results: [{ 
          id: 1, 
          username: 'testuser', 
          password_hash: 'hash', 
          salt: 'salt', 
          approved: 1 
        }] 
      });

      const response = await handleLogin(mockRequest, mockEnv, body);
      expect(response.status).toBe(401);
    });

    it('should return 403 if user is not approved', async () => {
      const body = { username: 'testuser', password: 'Password123!' };
      
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ all: mockAll });

      mockAll.mockResolvedValueOnce({ 
        results: [{ 
          id: 1, 
          username: 'testuser', 
          password_hash: 'hash', 
          salt: 'salt', 
          approved: 0 
        }] 
      });

      const response = await handleLogin(mockRequest, mockEnv, body);
      expect(response.status).toBe(403);
    });
  });

  describe('handleLogout', () => {
    it('should return 500 on database error', async () => {
      const body = { sessionId: 'valid-session' };
      const mockPrepare = mockEnv.DB.prepare;
      mockPrepare.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const response = await handleLogout(mockRequest, mockEnv, body);
      expect(response.status).toBe(500);
    });

    it('should logout successfully', async () => {
      const body = { sessionId: 'session-id' };
      
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockRun = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, run: mockRun });
      mockBind.mockReturnValue({ run: mockRun });

      mockRun.mockResolvedValueOnce({ meta: { changes: 1 } });

      const response = await handleLogout(mockRequest, mockEnv, body);
      expect(response.status).toBe(200);
    });

    it('should return 404 if session not found', async () => {
      const body = { sessionId: 'session-id' };
      
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockRun = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, run: mockRun });
      mockBind.mockReturnValue({ run: mockRun });

      mockRun.mockResolvedValueOnce({ meta: { changes: 0 } });

      const response = await handleLogout(mockRequest, mockEnv, body);
      expect(response.status).toBe(404);
    });
  });

  describe('handleSessionValidation', () => {
    it('should return user info for valid session', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-token');
      
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ all: mockAll });

      mockAll.mockResolvedValueOnce({ 
        results: [{ 
          id: 'valid-token', 
          user_id: 1, 
          username: 'testuser',
          email: 'test@example.com',
          expires_at: 'future-date', 
          approved: 1 
        }] 
      });

      const response = await handleSessionValidation(mockRequest, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.username).toBe('testuser');
    });

    it('should return 401 if header missing', async () => {
      mockRequest.headers.get.mockReturnValue(null);
      const response = await handleSessionValidation(mockRequest, mockEnv);
      expect(response.status).toBe(401);
    });

    it('should return 401 if session invalid', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer invalid-token');
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ all: mockAll });
      mockAll.mockResolvedValueOnce({ results: [] });

      const response = await handleSessionValidation(mockRequest, mockEnv);
      expect(response.status).toBe(401);
    });

    it('should return 401 if session expired', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer expired-token');
      (authUtils.isSessionExpired as jest.Mock).mockReturnValue(true);

      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();
      const mockRun = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll, run: mockRun });
      mockBind.mockReturnValue({ all: mockAll, run: mockRun });

      mockAll.mockResolvedValueOnce({ 
        results: [{ 
          id: 'expired-token', 
          user_id: 1, 
          expires_at: 'past-date', 
          approved: 1 
        }] 
      });

      const response = await handleSessionValidation(mockRequest, mockEnv);
      expect(response.status).toBe(401);
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM sessions'));
    });

    it('should return 403 if user not approved', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-token');
      
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ all: mockAll });

      mockAll.mockResolvedValueOnce({ 
        results: [{ 
          id: 'valid-token', 
          user_id: 1, 
          expires_at: 'future-date', 
          approved: 0 
        }] 
      });

      const response = await handleSessionValidation(mockRequest, mockEnv);
      expect(response.status).toBe(403);
    });

    it('should return 500 on database error', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-token');
      const mockPrepare = mockEnv.DB.prepare;
      mockPrepare.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const response = await handleSessionValidation(mockRequest, mockEnv);
      expect(response.status).toBe(500);
    });
  });

  describe('validateSession', () => {
    it('should return valid session', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-token');
      
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ all: mockAll });

      mockAll.mockResolvedValueOnce({ 
        results: [{ 
          id: 'valid-token', 
          user_id: 1, 
          expires_at: 'future-date', 
          approved: 1 
        }] 
      });

      const result = await validateSession(mockRequest, mockEnv);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.userId).toBe(1);
      }
    });

    it('should return invalid if header missing', async () => {
      mockRequest.headers.get.mockReturnValue(null);
      const result = await validateSession(mockRequest, mockEnv);
      expect(result.valid).toBe(false);
    });

    it('should return invalid if session expired', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer expired-token');
      (authUtils.isSessionExpired as jest.Mock).mockReturnValue(true);

      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();
      const mockRun = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll, run: mockRun });
      mockBind.mockReturnValue({ all: mockAll, run: mockRun });

      mockAll.mockResolvedValueOnce({ 
        results: [{ 
          id: 'expired-token', 
          user_id: 1, 
          expires_at: 'past-date', 
          approved: 1 
        }] 
      });

      const result = await validateSession(mockRequest, mockEnv);
      expect(result.valid).toBe(false);
      // Should delete expired session
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM sessions'));
    });
    it('should return invalid if user not approved', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-token');
      
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ all: mockAll });

      mockAll.mockResolvedValueOnce({ 
        results: [{ 
          id: 'valid-token', 
          user_id: 1, 
          expires_at: 'future-date', 
          approved: 0 
        }] 
      });

      const result = await validateSession(mockRequest, mockEnv);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(403);
      }
    });

    it('should return invalid on database error', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-token');
      const mockPrepare = mockEnv.DB.prepare;
      mockPrepare.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const result = await validateSession(mockRequest, mockEnv);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(500);
      }
    });
  });
});
