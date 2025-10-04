import {
  handleRegister,
  handleLogin,
  handleLogout,
  handleMe,
  requireAuth
} from '../src/auth-handlers';

// Mock the auth-utils module
jest.mock('../src/auth-utils', () => ({
  generateSalt: jest.fn(() => 'mock-salt'),
  hashPassword: jest.fn(() => Promise.resolve('mock-hash')),
  verifyPassword: jest.fn(() => Promise.resolve(true)),
  isValidUsername: jest.fn(() => true),
  isValidPassword: jest.fn(() => true),
  createSession: jest.fn(() => Promise.resolve('mock-session-id')),
  destroySession: jest.fn(() => Promise.resolve()),
  getUserFromSession: jest.fn(() => Promise.resolve({ id: 1, username: 'testuser' })),
  cleanupExpiredSessions: jest.fn(() => Promise.resolve())
}));

// Mock the validators module
jest.mock('../src/validators', () => ({
  createErrorResponse: jest.fn((error, status) => 
    new Response(JSON.stringify({ error }), { 
      status: status || 400, 
      headers: { 'Content-Type': 'application/json' } 
    })
  ),
  createSuccessResponse: jest.fn((data, status) => 
    new Response(JSON.stringify(data), { 
      status: status || 200, 
      headers: { 'Content-Type': 'application/json' } 
    })
  )
}));

import * as authUtils from '../src/auth-utils';
import * as validators from '../src/validators';

describe('Auth Handlers', () => {
  let mockEnv: any;
  let mockRequest: Request;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset all mocks to their default implementations
    (validators.createErrorResponse as jest.Mock).mockImplementation((error, status) => 
      new Response(JSON.stringify({ error }), { 
        status: status || 400, 
        headers: { 'Content-Type': 'application/json' } 
      })
    );
    
    (validators.createSuccessResponse as jest.Mock).mockImplementation((data, status) => 
      new Response(JSON.stringify(data), { 
        status: status || 200, 
        headers: { 'Content-Type': 'application/json' } 
      })
    );
    
    // Reset auth utils mocks
    (authUtils.isValidUsername as jest.Mock).mockReturnValue(true);
    (authUtils.isValidPassword as jest.Mock).mockReturnValue(true);
    
    mockEnv = {
      DB: {
        prepare: jest.fn(() => ({
          bind: jest.fn(() => ({
            first: jest.fn(() => Promise.resolve(null)),
            run: jest.fn(() => Promise.resolve({ meta: { last_row_id: 1 } })),
            all: jest.fn(() => Promise.resolve({ results: [] }))
          }))
        }))
      }
    };

    mockRequest = new Request('http://localhost:8787/wtm/api/auth/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  });

  describe('handleRegister', () => {
    it('should register a new user successfully', async () => {
      const body = {
        username: 'testuser',
        password: 'password123'
      };

      const response = await handleRegister(mockRequest, mockEnv, body);
      const responseData = await response.json();

      expect(response.status).toBe(201);
      expect(responseData).toEqual({
        message: 'User registered successfully',
        user: { id: 1, username: 'testuser' },
        sessionId: 'mock-session-id'
      });
      expect(authUtils.generateSalt).toHaveBeenCalled();
      expect(authUtils.hashPassword).toHaveBeenCalledWith('password123', 'mock-salt');
      expect(authUtils.createSession).toHaveBeenCalledWith(1, mockEnv);
    });

    it('should reject registration with missing fields', async () => {
      const body = { username: 'testuser' }; // missing password
      
      const response = await handleRegister(mockRequest, mockEnv, body);
      
      expect(response.status).toBe(400);
      expect(validators.createErrorResponse).toHaveBeenCalledWith(
        'Missing required fields: username, password',
        400
      );
    });

    it('should reject registration with invalid username', async () => {
      (authUtils.isValidUsername as jest.Mock).mockReturnValue(false);
      
      const body = {
        username: 'invalid@user',
        password: 'password123'
      };

      const response = await handleRegister(mockRequest, mockEnv, body);
      
      expect(response.status).toBe(400);
      expect(validators.createErrorResponse).toHaveBeenCalledWith(
        'Invalid username. Must be 3-20 characters, alphanumeric, underscores, or hyphens only',
        400
      );
    });

    it('should reject registration when user already exists', async () => {
      mockEnv.DB.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue({ id: 1 }) // User exists
        })
      });

      const body = {
        username: 'testuser',
        password: 'password123'
      };

      const response = await handleRegister(mockRequest, mockEnv, body);
      
      expect(response.status).toBe(409);
      expect(validators.createErrorResponse).toHaveBeenCalledWith(
        'Username already exists',
        409
      );
    });
  });

  describe('handleLogin', () => {
    it('should login user successfully', async () => {
      mockEnv.DB.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue({
            id: 1,
            username: 'testuser',
            password_hash: 'mock-hash',
            salt: 'mock-salt'
          })
        })
      });

      const body = { username: 'testuser', password: 'password123' };
      
      const response = await handleLogin(mockRequest, mockEnv, body);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({
        message: 'Login successful',
        user: { id: 1, username: 'testuser' },
        sessionId: 'mock-session-id'
      });
      expect(authUtils.verifyPassword).toHaveBeenCalledWith('password123', 'mock-hash', 'mock-salt');
    });

    it('should reject login with missing fields', async () => {
      const body = { username: 'testuser' }; // missing password
      
      const response = await handleLogin(mockRequest, mockEnv, body);
      
      expect(response.status).toBe(400);
      expect(validators.createErrorResponse).toHaveBeenCalledWith(
        'Missing required fields: username, password',
        400
      );
    });

    it('should reject login for non-existent user', async () => {
      mockEnv.DB.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(null) // User not found
        })
      });

      const body = { username: 'nonexistent', password: 'password123' };
      
      const response = await handleLogin(mockRequest, mockEnv, body);
      
      expect(response.status).toBe(401);
      expect(validators.createErrorResponse).toHaveBeenCalledWith(
        'Invalid username or password',
        401
      );
    });

    it('should reject login with wrong password', async () => {
      (authUtils.verifyPassword as jest.Mock).mockResolvedValue(false);
      
      mockEnv.DB.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue({
            id: 1,
            username: 'testuser',
            password_hash: 'mock-hash',
            salt: 'mock-salt'
          })
        })
      });

      const body = { username: 'testuser', password: 'wrongpassword' };
      
      const response = await handleLogin(mockRequest, mockEnv, body);
      
      expect(response.status).toBe(401);
      expect(validators.createErrorResponse).toHaveBeenCalledWith(
        'Invalid username or password',
        401
      );
    });
  });

  describe('handleLogout', () => {
    it('should logout successfully with session', async () => {
      const requestWithSession = new Request('http://localhost:8787/wtm/api/auth/logout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': 'session=test-session'  
        }
      });

      const response = await handleLogout(requestWithSession, mockEnv);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ message: 'Logout successful' });
      expect(authUtils.destroySession).toHaveBeenCalledWith('test-session', mockEnv);
    });

    it('should logout successfully without session', async () => {
      const response = await handleLogout(mockRequest, mockEnv);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ message: 'Logout successful' });
      expect(authUtils.destroySession).not.toHaveBeenCalled();
    });
  });

  describe('handleMe', () => {
    it('should return user info for valid session', async () => {
      const requestWithSession = new Request('http://localhost:8787/wtm/api/auth/me', {
        headers: { 'Cookie': 'session=test-session' }
      });

      const response = await handleMe(requestWithSession, mockEnv);
      
      expect(response.status).toBe(200);
      expect(validators.createSuccessResponse).toHaveBeenCalledWith({
        user: { id: 1, username: 'testuser' }
      });
    });

    it('should reject request without session', async () => {
      const response = await handleMe(mockRequest, mockEnv);
      
      expect(response.status).toBe(401);
      expect(validators.createErrorResponse).toHaveBeenCalledWith('Not authenticated', 401);
    });
  });



  describe('requireAuth', () => {
    it('should return user for valid session', async () => {
      const requestWithSession = new Request('http://localhost:8787/wtm/api/test', {
        headers: { 'Cookie': 'session=test-session' }
      });

      const result = await requireAuth(requestWithSession, mockEnv);
      
      expect(result).toEqual({ id: 1, username: 'testuser' });
    });

    it('should return error response for missing session', async () => {
      const result = await requireAuth(mockRequest, mockEnv);
      
      expect(result).toBeInstanceOf(Response);
      expect(validators.createErrorResponse).toHaveBeenCalledWith('Authentication required', 401);
    });

    it('should return error response for invalid session', async () => {
      (authUtils.getUserFromSession as jest.Mock).mockResolvedValue(null);
      
      const requestWithSession = new Request('http://localhost:8787/wtm/api/test', {
        headers: { 'Cookie': 'session=invalid-session' }
      });

      const result = await requireAuth(requestWithSession, mockEnv);
      
      expect(result).toBeInstanceOf(Response);
    });
  });
});