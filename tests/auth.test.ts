// Tests for authentication functionality
import { 
  User, 
  createSession, 
  getUserBySession, 
  deleteSession, 
  extractSessionId 
} from '../src/auth/session';
import { 
  getOAuthProvider, 
  generateAuthUrl, 
  createOrUpdateUser 
} from '../src/auth/oauth';
import { 
  requiresAuth, 
  authenticateRequest, 
  createAuthError 
} from '../src/auth/middleware';

// Mock D1 Database
class MockD1Database {
  private data: { [table: string]: any[] } = {
    users: [],
    sessions: []
  };
  private nextId = 1;

  prepare(query: string) {
    return {
      bind: (...params: any[]) => ({
        run: async () => {
          if (query.includes('INSERT INTO users')) {
            const user = {
              id: this.nextId++,
              email: params[0],
              name: params[1],
              oauth_provider: params[2],
              oauth_provider_id: params[3],
              oauth_access_token: params[4],
              oauth_refresh_token: params[5],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            this.data.users.push(user);
            return { success: true, meta: { last_row_id: user.id } };
          }
          
          if (query.includes('INSERT INTO sessions')) {
            const session = {
              id: params[0],
              user_id: params[1],
              created_at: new Date().toISOString(),
              expires_at: params[2],
              last_used_at: new Date().toISOString()
            };
            this.data.sessions.push(session);
            return { success: true };
          }
          
          if (query.includes('DELETE FROM sessions')) {
            const sessionId = params[0];
            this.data.sessions = this.data.sessions.filter(s => s.id !== sessionId);
            return { success: true };
          }
          
          if (query.includes('UPDATE sessions SET last_used_at')) {
            const sessionId = params[0];
            const session = this.data.sessions.find(s => s.id === sessionId);
            if (session) {
              session.last_used_at = new Date().toISOString();
            }
            return { success: true };
          }
          
          return { success: true };
        },
        first: async () => {
          if (query.includes('SELECT u.* FROM users u INNER JOIN sessions s')) {
            const sessionId = params[0];
            const session = this.data.sessions.find(s => s.id === sessionId && s.expires_at > new Date().toISOString());
            if (!session) return null;
            
            const user = this.data.users.find(u => u.id === session.user_id);
            return user || null;
          }
          
          if (query.includes('SELECT * FROM users WHERE oauth_provider')) {
            const provider = params[0];
            const providerId = params[1];
            return this.data.users.find(u => 
              u.oauth_provider === provider && u.oauth_provider_id === providerId
            ) || null;
          }
          
          if (query.includes('SELECT * FROM users WHERE id')) {
            const userId = params[0];
            return this.data.users.find(u => u.id === userId) || null;
          }
          
          return null;
        }
      })
    };
  }
}

describe('Authentication System', () => {
  let mockDB: MockD1Database;

  beforeEach(() => {
    mockDB = new MockD1Database();
  });

  describe('Session Management', () => {
    test('should create a session', async () => {
      const userId = 1;
      const sessionId = await createSession(mockDB as any, userId);
      
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });

    test('should get user by session', async () => {
      // Create a user first
      const user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        oauth_provider: 'google',
        oauth_provider_id: '123456',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      (mockDB as any).data.users.push(user);
      
      // Create a session manually to ensure it has the right structure
      const sessionId = 'test-session-id';
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now
      (mockDB as any).data.sessions.push({
        id: sessionId,
        user_id: user.id,
        created_at: new Date().toISOString(),
        expires_at: futureDate,
        last_used_at: new Date().toISOString()
      });
      
      // Get user by session
      const retrievedUser = await getUserBySession(mockDB as any, sessionId);
      
      expect(retrievedUser).toBeDefined();
      expect(retrievedUser?.email).toBe(user.email);
    });

    test('should return null for invalid session', async () => {
      const user = await getUserBySession(mockDB as any, 'invalid-session-id');
      expect(user).toBeNull();
    });

    test('should delete a session', async () => {
      const sessionId = await createSession(mockDB as any, 1);
      await deleteSession(mockDB as any, sessionId);
      
      const user = await getUserBySession(mockDB as any, sessionId);
      expect(user).toBeNull();
    });

    test('should extract session ID from Authorization header', () => {
      const request = new Request('http://example.com', {
        headers: { 'Authorization': 'Bearer test-session-id' }
      });
      
      const sessionId = extractSessionId(request);
      expect(sessionId).toBe('test-session-id');
    });

    test('should extract session ID from cookie', () => {
      const request = new Request('http://example.com', {
        headers: { 'Cookie': 'session=test-session-id; other=value' }
      });
      
      const sessionId = extractSessionId(request);
      expect(sessionId).toBe('test-session-id');
    });

    test('should return null when no session found', () => {
      const request = new Request('http://example.com');
      const sessionId = extractSessionId(request);
      expect(sessionId).toBeNull();
    });
  });

  describe('OAuth Provider Configuration', () => {
    test('should get Google OAuth provider configuration', () => {
      const env = {
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
        OAUTH_REDIRECT_URI: 'http://localhost/callback'
      };
      
      const provider = getOAuthProvider('google', env);
      
      expect(provider).toBeDefined();
      expect(provider?.clientId).toBe('test-client-id');
      expect(provider?.clientSecret).toBe('test-client-secret');
      expect(provider?.authUrl).toContain('accounts.google.com');
    });

    test('should return null for unknown provider', () => {
      const provider = getOAuthProvider('unknown', {});
      expect(provider).toBeNull();
    });

    test('should generate auth URL with state', () => {
      const provider = {
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'http://localhost/callback',
        authUrl: 'https://example.com/oauth/authorize',
        tokenUrl: 'https://example.com/oauth/token',
        userInfoUrl: 'https://example.com/user'
      };
      
      const authUrl = generateAuthUrl(provider, 'test-state');
      
      expect(authUrl).toContain('https://example.com/oauth/authorize');
      expect(authUrl).toContain('client_id=test-client');
      expect(authUrl).toContain('state=test-state');
      expect(authUrl).toContain('response_type=code');
    });
  });

  describe('User Management', () => {
    test('should create new user', async () => {
      const userInfo = {
        id: '123456',
        email: 'test@example.com',
        name: 'Test User'
      };
      
      const user = await createOrUpdateUser(
        mockDB as any,
        'google',
        userInfo,
        'access-token',
        'refresh-token'
      );
      
      expect(user).toBeDefined();
      expect(user?.email).toBe(userInfo.email);
      expect(user?.oauth_provider).toBe('google');
    });

    test('should update existing user', async () => {
      // Create user first
      const existingUser = {
        id: 1,
        email: 'old@example.com',
        name: 'Old Name',
        oauth_provider: 'google',
        oauth_provider_id: '123456',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      (mockDB as any).data.users.push(existingUser);
      
      const userInfo = {
        id: '123456',
        email: 'new@example.com',
        name: 'New Name'
      };
      
      const user = await createOrUpdateUser(
        mockDB as any,
        'google',
        userInfo,
        'new-access-token',
        'new-refresh-token'
      );
      
      expect(user).toBeDefined();
      expect(user?.id).toBe(existingUser.id);
    });
  });

  describe('Authentication Middleware', () => {
    test('should identify endpoints that require auth', () => {
      expect(requiresAuth('/wtm/api/calendar-progress', 'POST')).toBe(true);
      expect(requiresAuth('/wtm/api/calendar-progress', 'PUT')).toBe(true);
      expect(requiresAuth('/wtm/api/calendar-progress', 'DELETE')).toBe(true);
      expect(requiresAuth('/wtm/api/calendar-progress', 'GET')).toBe(false);
      
      expect(requiresAuth('/wtm/api/samsung-health/link', 'GET')).toBe(true);
      expect(requiresAuth('/wtm/api/sync/samsung-health', 'POST')).toBe(true);
      
      expect(requiresAuth('/wtm/api/auth/google', 'GET')).toBe(false);
      expect(requiresAuth('/wtm/api/goals', 'GET')).toBe(false);
    });

    test('should authenticate valid session', async () => {
      // Create user and session
      const user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        oauth_provider: 'google',
        oauth_provider_id: '123456',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      (mockDB as any).data.users.push(user);
      
      // Create session manually
      const sessionId = 'test-session-id';
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      (mockDB as any).data.sessions.push({
        id: sessionId,
        user_id: user.id,
        created_at: new Date().toISOString(),
        expires_at: futureDate,
        last_used_at: new Date().toISOString()
      });
      
      const request = new Request('http://example.com', {
        headers: { 'Authorization': `Bearer ${sessionId}` }
      });
      
      const result = await authenticateRequest(request, mockDB as any);
      
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe(user.email);
      expect(result.error).toBeUndefined();
    });

    test('should fail authentication for invalid session', async () => {
      const request = new Request('http://example.com', {
        headers: { 'Authorization': 'Bearer invalid-session' }
      });
      
      const result = await authenticateRequest(request, mockDB as any);
      
      expect(result.user).toBeNull();
      expect(result.error).toBeDefined();
    });

    test('should fail authentication for missing session', async () => {
      const request = new Request('http://example.com');
      const result = await authenticateRequest(request, mockDB as any);
      
      expect(result.user).toBeNull();
      expect(result.error).toBe('No session found');
    });

    test('should create auth error response', () => {
      const response = createAuthError('Test error');
      
      expect(response.status).toBe(401);
      expect(response.headers.get('content-type')).toBe('application/json');
      expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
    });
  });
});