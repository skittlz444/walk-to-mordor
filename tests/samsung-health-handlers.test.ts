// Samsung Health Handlers Unit Tests
import {
  handleSamsungHealthAuthUrl,
  handleSamsungHealthCallback,
  handleSamsungHealthUnlink,
  handleSamsungHealthStatus,
  handleSamsungHealthSync,
  initializeSamsungHealthService
} from '../src/samsung-health-handlers';

// Mock the encryption module
jest.mock('../src/samsung-health-service', () => {
  const originalModule = jest.requireActual('../src/samsung-health-service');
  
  return {
    ...originalModule,
    TokenEncryption: {
      initializeKey: jest.fn().mockResolvedValue(void 0),
      encrypt: jest.fn().mockImplementation(async (text: string) => `encrypted_${text}`),
      decrypt: jest.fn().mockImplementation(async (text: string) => text.replace('encrypted_', ''))
    }
  };
});

describe('Samsung Health Handlers', () => {
  let mockEnv: any;
  let mockUser: { id: number; username: string };

  beforeEach(() => {
    mockUser = { id: 1, username: 'testuser' };
    mockEnv = {
      DB: {
        prepare: jest.fn().mockReturnThis(),
        bind: jest.fn().mockReturnThis(),
        run: jest.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
        first: jest.fn().mockResolvedValue(null),
        all: jest.fn().mockResolvedValue({ results: [] })
      }
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('handleSamsungHealthAuthUrl', () => {
    it('should generate authorization URL successfully', async () => {
      const mockRequest = new Request('https://example.com/test');
      
      const response = await handleSamsungHealthAuthUrl(mockRequest, mockEnv, mockUser);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.authUrl).toBeTruthy();
      expect(data.authUrl).toContain('https://account.samsung.com/accounts/oauth/authorize');
      expect(data.state).toContain(`user_${mockUser.id}_`);
    });

    it('should handle errors gracefully', async () => {
      const mockRequest = new Request('invalid-url');
      
      const response = await handleSamsungHealthAuthUrl(mockRequest, mockEnv, mockUser);
      
      // Should still work with mock service
      expect(response.status).toBe(200);
    });
  });

  describe('handleSamsungHealthCallback', () => {
    it('should link account with valid auth code', async () => {
      const mockRequest = new Request('https://example.com/test');
      const state = `user_${mockUser.id}_${Date.now()}`;
      const body = {
        authCode: 'mock_auth_code',
        state: state
      };

      const response = await handleSamsungHealthCallback(mockRequest, mockEnv, body, mockUser);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Samsung Health account linked successfully');
      expect(data.linkedAt).toBeTruthy();
      
      // Verify database update was called
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users')
      );
    });

    it('should reject missing auth code', async () => {
      const mockRequest = new Request('https://example.com/test');
      const body = { state: `user_${mockUser.id}_123` };

      const response = await handleSamsungHealthCallback(mockRequest, mockEnv, body, mockUser);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing authorization code');
    });

    it('should reject invalid state', async () => {
      const mockRequest = new Request('https://example.com/test');
      const body = {
        authCode: 'mock_auth_code',
        state: 'invalid_state'
      };

      const response = await handleSamsungHealthCallback(mockRequest, mockEnv, body, mockUser);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid or missing state parameter');
    });

    it('should handle invalid auth code', async () => {
      const mockRequest = new Request('https://example.com/test');
      const state = `user_${mockUser.id}_${Date.now()}`;
      const body = {
        authCode: 'invalid_code',
        state: state
      };

      const response = await handleSamsungHealthCallback(mockRequest, mockEnv, body, mockUser);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Failed to exchange authorization code for tokens');
    });
  });

  describe('handleSamsungHealthUnlink', () => {
    it('should unlink account successfully', async () => {
      const mockRequest = new Request('https://example.com/test');
      
      // Mock user with Samsung Health tokens
      mockEnv.DB.first.mockResolvedValue({
        samsung_health_token: 'encrypted_mock_access_token',
        samsung_health_refresh_token: 'encrypted_mock_refresh_token'
      });

      const response = await handleSamsungHealthUnlink(mockRequest, mockEnv, mockUser);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Samsung Health account unlinked successfully');
      
      // Verify database update was called
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users')
      );
    });

    it('should handle account not linked', async () => {
      const mockRequest = new Request('https://example.com/test');
      
      // Mock user without Samsung Health tokens
      mockEnv.DB.first.mockResolvedValue(null);

      const response = await handleSamsungHealthUnlink(mockRequest, mockEnv, mockUser);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Samsung Health account not linked');
    });

    it('should handle database errors gracefully', async () => {
      const mockRequest = new Request('https://example.com/test');
      
      mockEnv.DB.first.mockRejectedValue(new Error('Database error'));

      const response = await handleSamsungHealthUnlink(mockRequest, mockEnv, mockUser);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to unlink Samsung Health account');
    });
  });

  describe('handleSamsungHealthStatus', () => {
    it('should return linked status when account is linked', async () => {
      const mockRequest = new Request('https://example.com/test');
      const linkedAt = new Date().toISOString();
      
      mockEnv.DB.first.mockResolvedValue({
        samsung_health_linked_at: linkedAt
      });

      const response = await handleSamsungHealthStatus(mockRequest, mockEnv, mockUser);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isLinked).toBe(true);
      expect(data.linkedAt).toBe(linkedAt);
    });

    it('should return not linked status when account is not linked', async () => {
      const mockRequest = new Request('https://example.com/test');
      
      mockEnv.DB.first.mockResolvedValue(null);

      const response = await handleSamsungHealthStatus(mockRequest, mockEnv, mockUser);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isLinked).toBe(false);
      expect(data.linkedAt).toBeNull();
    });

    it('should handle database errors', async () => {
      const mockRequest = new Request('https://example.com/test');
      
      mockEnv.DB.first.mockRejectedValue(new Error('Database error'));

      const response = await handleSamsungHealthStatus(mockRequest, mockEnv, mockUser);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to check Samsung Health status');
    });
  });

  describe('handleSamsungHealthSync', () => {
    it('should sync walking distance successfully', async () => {
      const mockRequest = new Request('https://example.com/test');
      const body = { date: '2024-01-15' };
      
      // Mock user with Samsung Health tokens
      mockEnv.DB.first.mockResolvedValue({
        samsung_health_token: 'encrypted_mock_access_token',
        samsung_health_refresh_token: 'encrypted_mock_refresh_token'
      });

      const response = await handleSamsungHealthSync(mockRequest, mockEnv, body, mockUser);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.date).toBe('2024-01-15');
      expect(data.distance).toBeGreaterThanOrEqual(0);
      expect(data.syncedAt).toBeTruthy();
    });

    it('should reject missing date', async () => {
      const mockRequest = new Request('https://example.com/test');
      const body = {};

      const response = await handleSamsungHealthSync(mockRequest, mockEnv, body, mockUser);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Valid date (YYYY-MM-DD) is required');
    });

    it('should reject invalid date format', async () => {
      const mockRequest = new Request('https://example.com/test');
      const body = { date: 'invalid-date' };

      const response = await handleSamsungHealthSync(mockRequest, mockEnv, body, mockUser);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Valid date (YYYY-MM-DD) is required');
    });

    it('should handle account not linked', async () => {
      const mockRequest = new Request('https://example.com/test');
      const body = { date: '2024-01-15' };
      
      mockEnv.DB.first.mockResolvedValue(null);

      const response = await handleSamsungHealthSync(mockRequest, mockEnv, body, mockUser);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Samsung Health account not linked');
    });

    it('should handle token decryption failure', async () => {
      const mockRequest = new Request('https://example.com/test');
      const body = { date: '2024-01-15' };
      
      // Mock user with invalid tokens
      mockEnv.DB.first.mockResolvedValue({
        samsung_health_token: 'invalid_encrypted_token',
        samsung_health_refresh_token: 'encrypted_mock_refresh_token'
      });

      // Mock decryption failure
      const { TokenEncryption } = require('../src/samsung-health-service');
      TokenEncryption.decrypt.mockRejectedValue(new Error('Decryption failed'));

      const response = await handleSamsungHealthSync(mockRequest, mockEnv, body, mockUser);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Invalid Samsung Health token, please relink your account');
    });

    it('should handle API service failure', async () => {
      const mockRequest = new Request('https://example.com/test');
      const body = { date: '2024-01-15' };
      
      // Mock user with tokens but API failure (invalid token format)
      mockEnv.DB.first.mockResolvedValue({
        samsung_health_token: 'encrypted_invalid_token_format',
        samsung_health_refresh_token: 'encrypted_mock_refresh_token'
      });

      const response = await handleSamsungHealthSync(mockRequest, mockEnv, body, mockUser);
      
      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch walking data from Samsung Health');
    });
  });

  describe('initializeSamsungHealthService', () => {
    it('should initialize service and encryption', async () => {
      const { TokenEncryption } = require('../src/samsung-health-service');
      
      await initializeSamsungHealthService('client_id', 'client_secret', 'encryption_key');
      
      expect(TokenEncryption.initializeKey).toHaveBeenCalledWith('encryption_key');
    });
  });
});