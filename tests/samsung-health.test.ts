// Tests for Samsung Health integration
import { 
  getSamsungHealthConfig, 
  generateSamsungHealthAuthUrl, 
  linkSamsungHealthAccount, 
  syncSamsungHealthData 
} from '../src/auth/samsung-health';
import { User } from '../src/auth/session';

// Mock D1 Database for Samsung Health tests
class MockSamsungHealthDB {
  private users: any[] = [];
  private progress: any[] = [];

  prepare(query: string) {
    return {
      bind: (...params: any[]) => ({
        run: async () => {
          if (query.includes('UPDATE users') && query.includes('samsung_health_access_token')) {
            const userId = params[2]; // user_id is the 3rd parameter
            const user = this.users.find(u => u.id === userId);
            if (user) {
              user.samsung_health_access_token = params[0];
              user.samsung_health_refresh_token = params[1];
              user.samsung_health_linked_at = new Date().toISOString();
              user.updated_at = new Date().toISOString();
            }
            return { success: true };
          }
          
          if (query.includes('INSERT INTO progress')) {
            const entry = {
              id: this.progress.length + 1,
              date: params[0],
              distance: params[1],
              user_id: params[2],
              synced_from_samsung: params[3],
              samsung_sync_date: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            this.progress.push(entry);
            return { success: true };
          }
          
          if (query.includes('UPDATE progress') && query.includes('synced_from_samsung')) {
            const userId = params[1];
            const date = params[2];
            const entry = this.progress.find(p => p.user_id === userId && p.date === date);
            if (entry) {
              entry.distance = params[0];
              entry.synced_from_samsung = true;
              entry.samsung_sync_date = new Date().toISOString();
              entry.updated_at = new Date().toISOString();
            }
            return { success: true };
          }
          
          return { success: true };
        },
        first: async () => {
          if (query.includes('SELECT * FROM progress WHERE user_id')) {
            const userId = params[0];
            const date = params[1];
            return this.progress.find(p => p.user_id === userId && p.date === date) || null;
          }
          return null;
        }
      })
    };
  }

  // Helper methods for testing
  addUser(user: any) {
    this.users.push(user);
  }

  addProgress(entry: any) {
    this.progress.push(entry);
  }

  getUsers() {
    return this.users;
  }

  getProgress() {
    return this.progress;
  }
}

// Mock fetch for Samsung Health API calls
const originalFetch = global.fetch;
const mockFetch = jest.fn();

beforeAll(() => {
  global.fetch = mockFetch;
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('Samsung Health Integration', () => {
  let mockDB: MockSamsungHealthDB;

  beforeEach(() => {
    mockDB = new MockSamsungHealthDB();
    mockFetch.mockClear();
  });

  describe('Configuration', () => {
    test('should get Samsung Health configuration', () => {
      const env = {
        SAMSUNG_HEALTH_CLIENT_ID: 'test-samsung-client-id',
        SAMSUNG_HEALTH_CLIENT_SECRET: 'test-samsung-secret',
        SAMSUNG_HEALTH_REDIRECT_URI: 'http://localhost/samsung-callback'
      };
      
      const config = getSamsungHealthConfig(env);
      
      expect(config.clientId).toBe('test-samsung-client-id');
      expect(config.clientSecret).toBe('test-samsung-secret');
      expect(config.redirectUri).toBe('http://localhost/samsung-callback');
    });

    test('should generate Samsung Health auth URL', () => {
      const config = getSamsungHealthConfig({
        SAMSUNG_HEALTH_CLIENT_ID: 'test-client-id',
        SAMSUNG_HEALTH_CLIENT_SECRET: 'test-secret',
        SAMSUNG_HEALTH_REDIRECT_URI: 'http://localhost/callback'
      });
      
      const authUrl = generateSamsungHealthAuthUrl(config, 'test-state');
      
      expect(authUrl).toContain('account.samsung.com');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('state=test-state');
      expect(authUrl).toContain('scope=com.samsung.health.step_daily_trend.read');
    });
  });

  describe('Account Linking', () => {
    test('should link Samsung Health account', async () => {
      const userId = 1;
      const accessToken = 'test-access-token';
      const refreshToken = 'test-refresh-token';
      
      // Add a user to the mock DB
      mockDB.addUser({
        id: userId,
        email: 'test@example.com',
        samsung_health_access_token: null,
        samsung_health_refresh_token: null
      });
      
      const result = await linkSamsungHealthAccount(
        mockDB as any,
        userId,
        accessToken,
        refreshToken
      );
      
      expect(result).toBe(true);
      
      // Verify user was updated
      const users = mockDB.getUsers();
      const user = users.find(u => u.id === userId);
      expect(user.samsung_health_access_token).toBe(accessToken);
      expect(user.samsung_health_refresh_token).toBe(refreshToken);
    });
  });

  describe('Data Synchronization', () => {
    test('should sync Samsung Health data successfully', async () => {
      const user: User = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        oauth_provider: 'google',
        oauth_provider_id: '123456',
        samsung_health_access_token: 'valid-access-token',
        samsung_health_refresh_token: 'valid-refresh-token',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
      
      const config = getSamsungHealthConfig({
        SAMSUNG_HEALTH_CLIENT_ID: 'test-client-id',
        SAMSUNG_HEALTH_CLIENT_SECRET: 'test-secret',
        SAMSUNG_HEALTH_REDIRECT_URI: 'http://localhost/callback'
      });
      
      // Mock successful Samsung Health API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{
            count: 10000,
            distance: 8000, // 8000 meters = 8 km
            start_time: '2024-01-15T00:00:00Z',
            end_time: '2024-01-15T23:59:59Z'
          }]
        })
      });
      
      const result = await syncSamsungHealthData(
        mockDB as any,
        user,
        '2024-01-15',
        config
      );
      
      expect(result.success).toBe(true);
      expect(result.distance).toBe(8); // Should be converted to km
      
      // Verify progress entry was created
      const progress = mockDB.getProgress();
      expect(progress).toHaveLength(1);
      expect(progress[0].distance).toBe(8);
      expect(progress[0].synced_from_samsung).toBe(true);
    });

    test('should fail sync when Samsung Health not linked', async () => {
      const user: User = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        oauth_provider: 'google',
        oauth_provider_id: '123456',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
        // No Samsung Health tokens
      };
      
      const config = getSamsungHealthConfig({});
      
      const result = await syncSamsungHealthData(
        mockDB as any,
        user,
        '2024-01-15',
        config
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Samsung Health not linked');
    });

    test('should update existing progress entry when syncing', async () => {
      const user: User = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        oauth_provider: 'google',
        oauth_provider_id: '123456',
        samsung_health_access_token: 'valid-access-token',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
      
      // Add existing progress entry
      mockDB.addProgress({
        id: 1,
        date: '2024-01-15',
        distance: 5.0,
        user_id: 1,
        synced_from_samsung: false
      });
      
      const config = getSamsungHealthConfig({
        SAMSUNG_HEALTH_CLIENT_ID: 'test-client-id'
      });
      
      // Mock Samsung Health API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{
            count: 12000,
            distance: 10000, // 10 km
            start_time: '2024-01-15T00:00:00Z',
            end_time: '2024-01-15T23:59:59Z'
          }]
        })
      });
      
      const result = await syncSamsungHealthData(
        mockDB as any,
        user,
        '2024-01-15',
        config
      );
      
      expect(result.success).toBe(true);
      expect(result.distance).toBe(10);
      
      // Should still have only one progress entry, but updated
      const progress = mockDB.getProgress();
      expect(progress).toHaveLength(1);
      expect(progress[0].distance).toBe(10); // Updated distance
      expect(progress[0].synced_from_samsung).toBe(true);
    });

    test('should handle Samsung Health API errors', async () => {
      const user: User = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        oauth_provider: 'google',
        oauth_provider_id: '123456',
        samsung_health_access_token: 'invalid-access-token',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
      
      const config = getSamsungHealthConfig({
        SAMSUNG_HEALTH_CLIENT_ID: 'test-client-id'
      });
      
      // Mock failed Samsung Health API response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      });
      
      const result = await syncSamsungHealthData(
        mockDB as any,
        user,
        '2024-01-15',
        config
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No Samsung Health data available for this date');
    });

    test('should handle no data available', async () => {
      const user: User = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        oauth_provider: 'google',
        oauth_provider_id: '123456',
        samsung_health_access_token: 'valid-access-token',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
      
      const config = getSamsungHealthConfig({
        SAMSUNG_HEALTH_CLIENT_ID: 'test-client-id'
      });
      
      // Mock Samsung Health API response with no data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [] // No data for this date
        })
      });
      
      const result = await syncSamsungHealthData(
        mockDB as any,
        user,
        '2024-01-15',
        config
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No Samsung Health data available for this date');
    });
  });
});