import worker from '../src/index';

// Mock dependencies
jest.mock('../src/renderHtml');
jest.mock('../src/validators');
jest.mock('../src/auth-handlers');
jest.mock('../src/progress-handlers');
jest.mock('../src/goals-handlers');

import { renderHtml, renderAuthHtml } from '../src/renderHtml';
import { requireAuth, getUserFromSession, handleLogin, handleRegister, handleLogout, handleMe } from '../src/auth-handlers';
import { handleProgressGet, handleProgressPost, handleProgressPut, handleProgressDelete } from '../src/progress-handlers';
import { handleGoalsGet, calculateTotalDistance } from '../src/goals-handlers';
import { safeJsonParse } from '../src/validators';

const mockRenderHtml = jest.mocked(renderHtml);
const mockRenderAuthHtml = jest.mocked(renderAuthHtml);
const mockRequireAuth = jest.mocked(requireAuth);
const mockGetUserFromSession = jest.mocked(getUserFromSession);
const mockHandleLogin = jest.mocked(handleLogin);
const mockHandleRegister = jest.mocked(handleRegister);
const mockHandleLogout = jest.mocked(handleLogout);
const mockHandleMe = jest.mocked(handleMe);
const mockHandleProgressGet = jest.mocked(handleProgressGet);
const mockHandleProgressPost = jest.mocked(handleProgressPost);
const mockHandleProgressPut = jest.mocked(handleProgressPut);
const mockHandleProgressDelete = jest.mocked(handleProgressDelete);
const mockHandleGoalsGet = jest.mocked(handleGoalsGet);
const mockCalculateTotalDistance = jest.mocked(calculateTotalDistance);
const mockSafeJsonParse = jest.mocked(safeJsonParse);

describe('Index Authentication Integration', () => {
  let mockEnv: any;

  // Helper to create request with specific cookies
  const createRequest = (url: string, method: string = 'GET', cookies: string = '', body?: string) => ({
    url,
    method,
    headers: {
      get: (name: string) => {
        if (name === 'Cookie') return cookies;
        if (name === 'Content-Type') return 'application/json';
        return null;
      }
    },
    json: body ? () => Promise.resolve(JSON.parse(body)) : undefined
  });

  // Helper to create authenticated requests with proper session cookie
  const createAuthRequest = (url: string, method: string = 'GET', sessionId: string = 'test-session') => 
    createRequest(url, method, `session=${sessionId}`);

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockEnv = {
      DB: {
        prepare: jest.fn(() => ({
          bind: jest.fn(() => ({
            run: jest.fn(() => Promise.resolve({ meta: { changes: 1 } })),
            all: jest.fn(() => Promise.resolve({ results: [] }))
          }))
        }))
      },
      ASSETS: {
        fetch: jest.fn(() => Promise.resolve({ status: 404 }))
      }
    };

    // Default mocks
    mockRenderHtml.mockReturnValue('<html>Authenticated</html>');
    mockRenderAuthHtml.mockReturnValue('<html>Login Page</html>');
    mockSafeJsonParse.mockResolvedValue({ success: true, data: { test: 'data' } });
    
    const mockUser = { id: 1, username: 'testuser' };
    mockRequireAuth.mockResolvedValue(mockUser as any);
    mockGetUserFromSession.mockResolvedValue(mockUser);
    
    // Mock handler returns
    mockHandleLogin.mockResolvedValue(new Response('OK', { status: 200 }));
    mockHandleRegister.mockResolvedValue(new Response('OK', { status: 201 }));
    mockHandleLogout.mockResolvedValue(new Response('OK', { status: 200 }));
    mockHandleMe.mockResolvedValue(new Response(JSON.stringify({ user: mockUser }), { status: 200 }));
    mockHandleProgressGet.mockResolvedValue(new Response('[]', { status: 200 }));
    mockHandleProgressPost.mockResolvedValue(new Response('OK', { status: 201 }));
    mockHandleProgressPut.mockResolvedValue(new Response('OK', { status: 200 }));
    mockHandleProgressDelete.mockResolvedValue(new Response('OK', { status: 200 }));
    mockHandleGoalsGet.mockResolvedValue(new Response('[]', { status: 200 }));
    mockCalculateTotalDistance.mockResolvedValue(42.5);
  });

  describe('Authentication Routes', () => {
    it('should handle user registration', async () => {
      const request = createRequest('https://example.com/wtm/api/auth/register', 'POST');
      const response = await worker.fetch(request, mockEnv);
      
      expect(mockHandleRegister).toHaveBeenCalledWith(request, mockEnv, { test: 'data' });
      expect(response.status).toBe(201);
    });

    it('should handle user login', async () => {
      const request = createRequest('https://example.com/wtm/api/auth/login', 'POST');
      const response = await worker.fetch(request, mockEnv);
      
      expect(mockHandleLogin).toHaveBeenCalledWith(request, mockEnv, { test: 'data' });
      expect(response.status).toBe(200);
    });

    it('should handle user logout', async () => {
      const request = createRequest('https://example.com/wtm/api/auth/logout', 'POST');
      const response = await worker.fetch(request, mockEnv);
      
      expect(mockHandleLogout).toHaveBeenCalledWith(request, mockEnv);
      expect(response.status).toBe(200);
    });

    it('should handle get current user info', async () => {
      const request = createRequest('https://example.com/wtm/api/auth/me', 'GET');
      const response = await worker.fetch(request, mockEnv);
      
      expect(mockHandleMe).toHaveBeenCalledWith(request, mockEnv);
      expect(response.status).toBe(200);
    });
  });

  describe('Main Page Authentication', () => {
    it('should show main page for authenticated users', async () => {
      const request = createRequest('https://example.com/', 'GET', 'session=valid-session');
      const response = await worker.fetch(request, mockEnv);
      
      expect(mockGetUserFromSession).toHaveBeenCalledWith('valid-session', mockEnv);
      expect(mockRenderHtml).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('should show login page for unauthenticated users', async () => {
      mockGetUserFromSession.mockResolvedValue(null);
      const request = createRequest('https://example.com/', 'GET');
      const response = await worker.fetch(request, mockEnv);
      
      expect(mockRenderAuthHtml).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('should show login page when session lookup fails', async () => {
      mockGetUserFromSession.mockRejectedValue(new Error('Database error'));
      const request = createRequest('https://example.com/', 'GET', 'sessionId=invalid');
      const response = await worker.fetch(request, mockEnv);
      
      expect(mockRenderAuthHtml).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe('Protected API Endpoints', () => {
    it('should allow authenticated access to calendar progress GET', async () => {
      const request = createAuthRequest('https://example.com/wtm/api/calendar-progress', 'GET', 'valid');
      const response = await worker.fetch(request, mockEnv);
      
      expect(mockRequireAuth).toHaveBeenCalledWith(request, mockEnv);
      expect(mockHandleProgressGet).toHaveBeenCalledWith(request, mockEnv, 1);
      expect(response.status).toBe(200);
    });

    it('should allow authenticated access to calendar progress POST', async () => {
      const request = createAuthRequest('https://example.com/wtm/api/calendar-progress', 'POST', 'valid');
      const response = await worker.fetch(request, mockEnv);
      
      expect(mockRequireAuth).toHaveBeenCalledWith(request, mockEnv);
      expect(mockHandleProgressPost).toHaveBeenCalledWith(request, mockEnv, { test: 'data' }, 1);
      expect(response.status).toBe(201);
    });

    it('should allow authenticated access to goals', async () => {
      const request = createAuthRequest('https://example.com/wtm/api/goals', 'GET', 'valid');
      const response = await worker.fetch(request, mockEnv);
      
      expect(mockRequireAuth).toHaveBeenCalledWith(request, mockEnv);
      expect(mockHandleGoalsGet).toHaveBeenCalledWith(request, mockEnv);
      expect(response.status).toBe(200);
    });

    it('should allow authenticated access to total distance', async () => {
      const request = createRequest('https://example.com/wtm/api/total-distance', 'GET', 'sessionId=valid');
      const response = await worker.fetch(request, mockEnv);
      
      expect(mockRequireAuth).toHaveBeenCalledWith(request, mockEnv);
      expect(mockCalculateTotalDistance).toHaveBeenCalledWith(mockEnv, 1);
      expect(response.status).toBe(200);
    });

    it('should reject unauthenticated access to protected endpoints', async () => {
      mockRequireAuth.mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) as any);
      const request = createRequest('https://example.com/wtm/api/calendar-progress', 'GET');
      const response = await worker.fetch(request, mockEnv);
      
      expect(mockRequireAuth).toHaveBeenCalledWith(request, mockEnv);
      expect(response.status).toBe(401);
    });
  });

  describe('Static Assets', () => {
    it('should serve static assets when available', async () => {
      mockEnv.ASSETS.fetch.mockResolvedValue({ status: 200, body: 'asset content' });
      const request = createRequest('https://example.com/wtm/css/main.css', 'GET');
      const response = await worker.fetch(request, mockEnv);
      
      expect(mockEnv.ASSETS.fetch).toHaveBeenCalledWith(request);
    });

    it('should fallback to main logic when asset not found', async () => {
      mockEnv.ASSETS.fetch.mockResolvedValue({ status: 404 });
      const request = createRequest('https://example.com/wtm/unknown.css', 'GET');
      const response = await worker.fetch(request, mockEnv);
      
      expect(mockEnv.ASSETS.fetch).toHaveBeenCalledWith(request);
      // Should fall through to main page logic
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully in total distance endpoint', async () => {
      mockCalculateTotalDistance.mockRejectedValue(new Error('Database connection failed'));
      const request = createRequest('https://example.com/wtm/api/total-distance', 'GET', 'sessionId=valid');
      const response = await worker.fetch(request, mockEnv);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'Internal server error while calculating total distance');
    });

    it('should handle authentication errors during main page access', async () => {
      mockGetUserFromSession.mockRejectedValue(new Error('Session lookup failed'));
      const request = createRequest('https://example.com/', 'GET', 'sessionId=corrupted');
      const response = await worker.fetch(request, mockEnv);
      
      // Should fall back to login page
      expect(mockRenderAuthHtml).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe('Method Validation', () => {
    it('should validate HTTP methods for API endpoints', async () => {
      const request = createRequest('https://example.com/wtm/api/calendar-progress', 'PATCH', 'sessionId=valid');
      const response = await worker.fetch(request, mockEnv);
      
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Method PATCH not allowed');
    });
  });
});