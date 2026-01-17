
import { 
  handleRegister, 
  handleLogin, 
  handleLogout, 
  handleSessionValidation, 
  validateSession,
  handleUpdateProfile,
  handlePasswordResetRequest,
  handlePasswordReset,
  handleConfirmEmail,
  handleResendConfirmation
} from '../../src/auth-handlers';
import * as authUtils from '../../src/auth-utils';
import * as emailUtils from '../../src/email-utils';

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
    (authUtils.generatePasswordResetToken as jest.Mock).mockReturnValue('mock-reset-token');
    (authUtils.getPasswordResetExpiry as jest.Mock).mockReturnValue('2026-01-06T17:00:00Z');
    (authUtils.isPasswordResetTokenExpired as jest.Mock).mockReturnValue(false);
    (authUtils.generateEmailConfirmationToken as jest.Mock).mockReturnValue('mock-confirm-token');
    (authUtils.getEmailConfirmationExpiry as jest.Mock).mockReturnValue('2026-01-18T17:00:00Z');
    (authUtils.isEmailConfirmationTokenExpired as jest.Mock).mockReturnValue(false);
    (emailUtils.sendPasswordResetEmail as jest.Mock).mockResolvedValue({ success: true });
    (emailUtils.sendConfirmationEmail as jest.Mock).mockResolvedValue({ success: true });

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
      },
      url: 'https://wtm.haydencarson.com/api/auth/some-action'
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

    it('should register a new user successfully (subsequent user needs email confirmation)', async () => {
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
      // Third call: insert email confirmation token
      mockRun.mockResolvedValueOnce({ meta: { last_row_id: 1 } });

      const response = await handleRegister(mockRequest, mockEnv, body);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toContain('check your email');
      expect(data.requiresEmailConfirmation).toBe(true);
      
      // Verify email confirmation was sent
      expect(emailUtils.sendConfirmationEmail).toHaveBeenCalledWith(
        mockEnv,
        'test2@example.com',
        expect.stringContaining('mock-confirm-token')
      );
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

      // Mock user lookup - include email_verified
      mockAll.mockResolvedValueOnce({ 
        results: [{ 
          id: 1, 
          username: 'testuser', 
          email: 'test@example.com', 
          password_hash: 'hash', 
          salt: 'salt', 
          approved: 1,
          email_verified: 1
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

  describe('handleSessionValidation (Mock Auth)', () => {
    beforeEach(() => {
      mockEnv.ALLOW_TEST_AUTH = 'true';
    });

    it('should validate mock token correctly', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_testuser');
      
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ all: mockAll });
      
      mockAll.mockResolvedValueOnce({ results: [{ id: 1, username: 'testuser', email: 'test@example.com', approved: 1 }] });

      const response = await handleSessionValidation(mockRequest, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.username).toBe('testuser');
      expect(data.userId).toBe(1);
    });

    it('should create user if missing during mock auth', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_newuser');
      
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();
      const mockRun = jest.fn();
      const mockFirst = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll, run: mockRun, first: mockFirst });
      mockBind.mockReturnValue({ all: mockAll, run: mockRun, first: mockFirst });
      
      mockAll.mockResolvedValueOnce({ results: [] });
      mockRun.mockResolvedValueOnce({ meta: { last_row_id: 2 } });
      mockFirst.mockResolvedValueOnce({ id: 2, username: 'newuser', email: 'newuser@example.com', approved: 1 });

      const response = await handleSessionValidation(mockRequest, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.userId).toBe(2);
      expect(data.username).toBe('newuser');
    });

    it('should reject invalid username in mock token', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_bad!user');
      (authUtils.isValidUsername as jest.Mock).mockReturnValue(false);

      const response = await handleSessionValidation(mockRequest, mockEnv);
      expect(response.status).toBe(400);
      
      (authUtils.isValidUsername as jest.Mock).mockReturnValue(true); 
    });

    it('should handle database errors during mock auth', async () => {
        mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_testuser');
        
        mockEnv.DB.prepare.mockImplementation(() => {
            throw new Error('DB Error');
        });

        const response = await handleSessionValidation(mockRequest, mockEnv);
        expect(response.status).toBe(500);
    });
  });

  describe('validateSession (Mock Auth)', () => {
    beforeEach(() => {
      mockEnv.ALLOW_TEST_AUTH = 'true';
    });

    it('should return valid session for mock token', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_testuser');
      
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ all: mockAll });
      
      mockAll.mockResolvedValueOnce({ results: [{ id: 1, username: 'testuser' }] });

      const result = await validateSession(mockRequest, mockEnv);
      expect(result.valid).toBe(true);
      expect(result.userId).toBe(1);
    });

    it('should reject invalid username in mock token for validateSession', async () => {
       mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_bad!user');
       (authUtils.isValidUsername as jest.Mock).mockReturnValue(false);

       const result = await validateSession(mockRequest, mockEnv);
       expect(result.valid).toBe(false);
       expect(result.error).toBeDefined();

       (authUtils.isValidUsername as jest.Mock).mockReturnValue(true);
    });

     it('should handle database errors during mock auth in validateSession', async () => {
        mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_testuser');
        
        mockEnv.DB.prepare.mockImplementation(() => {
            throw new Error('DB Error');
        });

        const result = await validateSession(mockRequest, mockEnv);
        expect(result.valid).toBe(false);
        expect(result.error!.status).toBe(500);
    });
  });

  describe('handleUpdateProfile', () => {
    it('should fail if session is invalid', async () => {
      mockRequest.headers.get.mockReturnValue(null); // No header = invalid session
      const response = await handleUpdateProfile(mockRequest, mockEnv, {});
      expect(response.status).toBe(401);
    });

    it('should fail if no fields provided', async () => {
       mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_testuser');
       mockEnv.ALLOW_TEST_AUTH = 'true';
       
       const mockAll = jest.fn().mockResolvedValue({ results: [{ id: 1 }] });
       const mockBind = jest.fn().mockReturnValue({ all: mockAll });
       mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

       const response = await handleUpdateProfile(mockRequest, mockEnv, {});
       expect(response.status).toBe(400);
    });

    it('should update username successfully', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_testuser');
      mockEnv.ALLOW_TEST_AUTH = 'true';
      
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockRun = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, run: mockRun, all: mockAll });
      mockBind.mockReturnValue({ run: mockRun, all: mockAll });

      mockAll.mockResolvedValueOnce({ results: [{ id: 1, username: 'oldname' }] });
      mockRun.mockResolvedValueOnce({ meta: { changes: 1 } });
      mockAll.mockResolvedValueOnce({ results: [{ id: 1, username: 'newname', email: 'old@example.com' }] });

      const body = { username: 'newname' };
      const response = await handleUpdateProfile(mockRequest, mockEnv, body);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.username).toBe('newname');
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE users SET username = ?'));
    });

    it('should update email successfully', async () => {
        mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_testuser');
        mockEnv.ALLOW_TEST_AUTH = 'true';
        
        const mockPrepare = mockEnv.DB.prepare;
        const mockBind = jest.fn();
        const mockRun = jest.fn();
        const mockAll = jest.fn();
  
        mockPrepare.mockReturnValue({ bind: mockBind, run: mockRun, all: mockAll });
        mockBind.mockReturnValue({ run: mockRun, all: mockAll });
  
        mockAll.mockResolvedValueOnce({ results: [{ id: 1 }] });
        mockRun.mockResolvedValueOnce({ meta: { changes: 1 } });
        mockAll.mockResolvedValueOnce({ results: [{ id: 1, username: 'testuser', email: 'new@example.com' }] });
  
        const body = { email: 'new@example.com' };
        const response = await handleUpdateProfile(mockRequest, mockEnv, body);
        const data = await response.json();
  
        expect(response.status).toBe(200);
        expect(data.email).toBe('new@example.com');
    });

    it('should return 404 if user not found during update', async () => {
         mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_testuser');
         mockEnv.ALLOW_TEST_AUTH = 'true';
         
         const mockPrepare = mockEnv.DB.prepare;
         const mockBind = jest.fn();
         const mockRun = jest.fn();
         const mockAll = jest.fn();
   
         mockPrepare.mockReturnValue({ bind: mockBind, run: mockRun, all: mockAll });
         mockBind.mockReturnValue({ run: mockRun, all: mockAll });
   
         mockAll.mockResolvedValueOnce({ results: [{ id: 1 }] });
         mockRun.mockResolvedValueOnce({ meta: { changes: 0 } });
   
         const body = { username: 'newname' };
         const response = await handleUpdateProfile(mockRequest, mockEnv, body);
         expect(response.status).toBe(404);
    });

    it('should return 400 for invalid username', async () => {
        mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_testuser');
        mockEnv.ALLOW_TEST_AUTH = 'true';
        
        const mockAll = jest.fn().mockResolvedValue({ results: [{ id: 1 }] });
        const mockBind = jest.fn().mockReturnValue({ all: mockAll });
        mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });
        
        (authUtils.isValidUsername as jest.Mock).mockReturnValue(false);

        const body = { username: 'bad' };
        const response = await handleUpdateProfile(mockRequest, mockEnv, body);
        expect(response.status).toBe(400);

        (authUtils.isValidUsername as jest.Mock).mockReturnValue(true);
    });

    it('should return 400 for invalid email', async () => {
        mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_testuser');
        mockEnv.ALLOW_TEST_AUTH = 'true';
        
        const mockAll = jest.fn().mockResolvedValue({ results: [{ id: 1 }] });
        const mockBind = jest.fn().mockReturnValue({ all: mockAll });
        mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });
        
        (authUtils.isValidEmail as jest.Mock).mockReturnValue(false);

        const body = { email: 'bad' };
        const response = await handleUpdateProfile(mockRequest, mockEnv, body);
        expect(response.status).toBe(400);

        (authUtils.isValidEmail as jest.Mock).mockReturnValue(true);
    });

    it('should handle unique constraint violations (username)', async () => {
        mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_testuser');
        mockEnv.ALLOW_TEST_AUTH = 'true';
        
        const mockPrepare = mockEnv.DB.prepare;
        const mockBind = jest.fn();
        const mockRun = jest.fn();
        const mockAll = jest.fn();
  
        mockPrepare.mockReturnValue({ bind: mockBind, run: mockRun, all: mockAll });
        mockBind.mockReturnValue({ run: mockRun, all: mockAll });
  
        mockAll.mockResolvedValueOnce({ results: [{ id: 1 }] });
        mockRun.mockRejectedValue(new Error('UNIQUE constraint failed: users.username'));
  
        const body = { username: 'taken' };
        const response = await handleUpdateProfile(mockRequest, mockEnv, body);
        expect(response.status).toBe(409);
        const data = await response.json();
        expect(data.error).toBe('Username already exists');
    });

    it('should handle unique constraint violations (email)', async () => {
        mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_testuser');
        mockEnv.ALLOW_TEST_AUTH = 'true';
        
        const mockPrepare = mockEnv.DB.prepare;
        const mockBind = jest.fn();
        const mockRun = jest.fn();
        const mockAll = jest.fn();
  
        mockPrepare.mockReturnValue({ bind: mockBind, run: mockRun, all: mockAll });
        mockBind.mockReturnValue({ run: mockRun, all: mockAll });
  
        mockAll.mockResolvedValueOnce({ results: [{ id: 1 }] });
        mockRun.mockRejectedValue(new Error('UNIQUE constraint failed: users.email'));
  
        const body = { email: 'taken@example.com' };
        const response = await handleUpdateProfile(mockRequest, mockEnv, body);
        expect(response.status).toBe(409);
        const data = await response.json();
        expect(data.error).toBe('Email already registered');
    });

    it('should handle generic database errors during update', async () => {
        mockRequest.headers.get.mockReturnValue('Bearer TEST_MOCK_TOKEN_testuser');
        mockEnv.ALLOW_TEST_AUTH = 'true';
        
        const mockPrepare = mockEnv.DB.prepare;
        mockPrepare.mockImplementationOnce(() => { throw new Error('DB Error'); });

        const body = { username: 'newname' };
        const response = await handleUpdateProfile(mockRequest, mockEnv, body);
        expect(response.status).toBe(500);
    });
  });

  describe('handlePasswordResetRequest', () => {
    it('should generate reset token for valid email', async () => {
      const body = { email: 'test@example.com' };
      
      // Mock user exists
      mockEnv.DB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue({
            results: [{ id: 1, username: 'testuser', email: 'test@example.com' }]
          })
        })
      });

      // Mock rate limit check
      mockEnv.DB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue({
            results: [{ count: 0 }]
          })
        })
      });

      // Mock cleanup
      mockEnv.DB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          run: jest.fn().mockResolvedValue({ meta: { changes: 0 } })
        })
      });
      
      // Mock token insert
      mockEnv.DB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          run: jest.fn().mockResolvedValue({ meta: { last_row_id: 1 } })
        })
      });

      const response = await handlePasswordResetRequest(mockRequest, mockEnv, body);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toContain('password reset link');
      expect(emailUtils.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockEnv,
        'test@example.com',
        'testuser',
        'mock-reset-token',
        'https://wtm.haydencarson.com'
      );
    });

    it('should return success even for non-existent email (security)', async () => {
      const body = { email: 'nonexistent@example.com' };
      
      // Mock user doesn't exist
      mockEnv.DB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue({ results: [] })
        })
      });

      const response = await handlePasswordResetRequest(mockRequest, mockEnv, body);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toContain('If an account with that email exists');
    });

    it('should return 400 for missing email', async () => {
      const response = await handlePasswordResetRequest(mockRequest, mockEnv, {});
      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid email format', async () => {
      (authUtils.isValidEmail as jest.Mock).mockReturnValue(false);
      const body = { email: 'invalid-email' };
      const response = await handlePasswordResetRequest(mockRequest, mockEnv, body);
      expect(response.status).toBe(400);
    });

    it('should handle database errors gracefully', async () => {
      const body = { email: 'test@example.com' };
      mockEnv.DB.prepare.mockImplementationOnce(() => { throw new Error('DB Error'); });
      
      const response = await handlePasswordResetRequest(mockRequest, mockEnv, body);
      expect(response.status).toBe(500);
    });
  });

  describe('handlePasswordReset', () => {
    it('should reset password with valid token', async () => {
      const body = { token: 'valid-token', password: 'NewPassword123!' };
      
      // Mock token validation
      mockEnv.DB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue({
            results: [{ id: 1, user_id: 1, expires_at: '2026-02-01T00:00:00Z', used: 0 }]
          })
        })
      });
      
      // Mock password update
      mockEnv.DB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          run: jest.fn().mockResolvedValue({ meta: { changes: 1 } })
        })
      });
      
      // Mock token mark as used
      mockEnv.DB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          run: jest.fn().mockResolvedValue({ meta: { changes: 1 } })
        })
      });
      
      // Mock session deletion
      mockEnv.DB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          run: jest.fn().mockResolvedValue({ meta: { changes: 0 } })
        })
      });

      const response = await handlePasswordReset(mockRequest, mockEnv, body);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toContain('Password has been reset successfully');
    });

    it('should return 400 for missing token', async () => {
      const body = { password: 'NewPassword123!' };
      const response = await handlePasswordReset(mockRequest, mockEnv, body);
      expect(response.status).toBe(400);
    });

    it('should return 400 for missing password', async () => {
      const body = { token: 'valid-token' };
      const response = await handlePasswordReset(mockRequest, mockEnv, body);
      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid password', async () => {
      (authUtils.isValidPassword as jest.Mock).mockReturnValue({ 
        valid: false, 
        errors: ['Password must be at least 8 characters long'] 
      });
      const body = { token: 'valid-token', password: 'weak' };
      const response = await handlePasswordReset(mockRequest, mockEnv, body);
      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid token', async () => {
      const body = { token: 'invalid-token', password: 'NewPassword123!' };
      
      mockEnv.DB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue({ results: [] })
        })
      });

      const response = await handlePasswordReset(mockRequest, mockEnv, body);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid password reset token');
    });

    it('should return 400 for already used token', async () => {
      const body = { token: 'used-token', password: 'NewPassword123!' };
      
      mockEnv.DB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue({
            results: [{ id: 1, user_id: 1, expires_at: '2026-02-01T00:00:00Z', used: 1 }]
          })
        })
      });

      const response = await handlePasswordReset(mockRequest, mockEnv, body);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('already been used');
    });

    it('should return 400 for expired token', async () => {
      (authUtils.isPasswordResetTokenExpired as jest.Mock).mockReturnValue(true);
      const body = { token: 'expired-token', password: 'NewPassword123!' };
      
      mockEnv.DB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue({
            results: [{ id: 1, user_id: 1, expires_at: '2020-01-01T00:00:00Z', used: 0 }]
          })
        })
      });

      const response = await handlePasswordReset(mockRequest, mockEnv, body);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('expired');
    });

    it('should handle database errors gracefully', async () => {
      const body = { token: 'valid-token', password: 'NewPassword123!' };
      mockEnv.DB.prepare.mockImplementationOnce(() => { throw new Error('DB Error'); });
      
      const response = await handlePasswordReset(mockRequest, mockEnv, body);
      expect(response.status).toBe(500);
    });
  });

  describe('handleConfirmEmail', () => {
    it('should confirm email with valid token', async () => {
      const mockRequest = {
        url: 'https://wtm.haydencarson.com/api/auth/confirm-email?token=valid-token'
      };

      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockRun = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll, run: mockRun });
      mockBind.mockReturnValue({ run: mockRun, all: mockAll });

      // First call: get token
      mockAll.mockResolvedValueOnce({
        results: [{
          id: 1,
          user_id: 5,
          expires_at: '2026-01-18T17:00:00Z'
        }]
      });

      const response = await handleConfirmEmail(mockRequest, mockEnv);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('?verified=true');
      
      // Verify DB operations
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE users'));
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM email_confirmation_tokens'));
    });

    it('should return error if token is missing', async () => {
      const mockRequest = {
        url: 'https://wtm.haydencarson.com/api/auth/confirm-email'
      };

      const response = await handleConfirmEmail(mockRequest, mockEnv);

      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toContain('Missing confirmation token');
    });

    it('should return error if token is invalid', async () => {
      const mockRequest = {
        url: 'https://wtm.haydencarson.com/api/auth/confirm-email?token=invalid-token'
      };

      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ all: mockAll });

      // Token not found
      mockAll.mockResolvedValueOnce({ results: [] });

      const response = await handleConfirmEmail(mockRequest, mockEnv);

      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toContain('Invalid or expired');
    });

    it('should return error if token is expired', async () => {
      const mockRequest = {
        url: 'https://wtm.haydencarson.com/api/auth/confirm-email?token=expired-token'
      };

      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockRun = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll, run: mockRun });
      mockBind.mockReturnValue({ run: mockRun, all: mockAll });

      // Token found but expired
      mockAll.mockResolvedValueOnce({
        results: [{
          id: 1,
          user_id: 5,
          expires_at: '2026-01-16T17:00:00Z'
        }]
      });
      
      (authUtils.isEmailConfirmationTokenExpired as jest.Mock).mockReturnValueOnce(true);

      const response = await handleConfirmEmail(mockRequest, mockEnv);

      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toContain('expired');
    });
  });

  describe('handleResendConfirmation', () => {
    it('should resend confirmation email for unverified user', async () => {
      const body = { email: 'test@example.com' };

      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockRun = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll, run: mockRun });
      mockBind.mockReturnValue({ run: mockRun, all: mockAll });

      // First call: get user
      mockAll.mockResolvedValueOnce({
        results: [{
          id: 5,
          username: 'testuser',
          email: 'test@example.com',
          email_verified: 0
        }]
      });
      
      // Second call: check rate limit
      mockAll.mockResolvedValueOnce({ results: [{ count: 0 }] });

      const response = await handleResendConfirmation(mockRequest, mockEnv, body);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('confirmation link has been sent');
      
      // Verify email was sent
      expect(emailUtils.sendConfirmationEmail).toHaveBeenCalled();
    });

    it('should return success even if user not found (security)', async () => {
      const body = { email: 'nonexistent@example.com' };

      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ all: mockAll });

      // User not found
      mockAll.mockResolvedValueOnce({ results: [] });

      const response = await handleResendConfirmation(mockRequest, mockEnv, body);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('confirmation link has been sent');
      
      // Email should NOT be sent
      expect(emailUtils.sendConfirmationEmail).not.toHaveBeenCalled();
    });

    it('should return success even if user already verified (security)', async () => {
      const body = { email: 'verified@example.com' };

      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ all: mockAll });

      // User already verified
      mockAll.mockResolvedValueOnce({
        results: [{
          id: 5,
          username: 'testuser',
          email: 'verified@example.com',
          email_verified: 1
        }]
      });

      const response = await handleResendConfirmation(mockRequest, mockEnv, body);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('confirmation link has been sent');
      
      // Email should NOT be sent
      expect(emailUtils.sendConfirmationEmail).not.toHaveBeenCalled();
    });

    it('should respect rate limiting', async () => {
      const body = { email: 'test@example.com' };

      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ all: mockAll });

      // First call: get user
      mockAll.mockResolvedValueOnce({
        results: [{
          id: 5,
          username: 'testuser',
          email: 'test@example.com',
          email_verified: 0
        }]
      });
      
      // Second call: check rate limit (3 requests already made)
      mockAll.mockResolvedValueOnce({ results: [{ count: 3 }] });

      const response = await handleResendConfirmation(mockRequest, mockEnv, body);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should still return success for security
      expect(data.message).toContain('confirmation link has been sent');
      
      // Email should NOT be sent due to rate limit
      expect(emailUtils.sendConfirmationEmail).not.toHaveBeenCalled();
    });

    it('should return error if email is missing', async () => {
      const body = {};

      const response = await handleResendConfirmation(mockRequest, mockEnv, body);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required field');
    });

    it('should return error if email is invalid', async () => {
      const body = { email: 'invalid-email' };
      (authUtils.isValidEmail as jest.Mock).mockReturnValueOnce(false);

      const response = await handleResendConfirmation(mockRequest, mockEnv, body);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid email');
    });
  });

  describe('handleLogin - email verification check', () => {
    it('should reject login if email not verified', async () => {
      const body = { username: 'testuser', password: 'Password123!' };

      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ all: mockAll });

      // User found but email not verified
      mockAll.mockResolvedValueOnce({
        results: [{
          id: 5,
          username: 'testuser',
          email: 'test@example.com',
          password_hash: 'mock-hash',
          salt: 'mock-salt',
          approved: 1,
          email_verified: 0
        }]
      });

      const response = await handleLogin(mockRequest, mockEnv, body);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Email not verified');
    });

    it('should allow login if email is verified', async () => {
      const body = { username: 'testuser', password: 'Password123!' };

      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockRun = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll, run: mockRun });
      mockBind.mockReturnValue({ run: mockRun, all: mockAll });

      // User found and email verified
      mockAll.mockResolvedValueOnce({
        results: [{
          id: 5,
          username: 'testuser',
          email: 'test@example.com',
          password_hash: 'mock-hash',
          salt: 'mock-salt',
          approved: 1,
          email_verified: 1
        }]
      });

      const response = await handleLogin(mockRequest, mockEnv, body);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionId).toBeDefined();
    });
  });
});
