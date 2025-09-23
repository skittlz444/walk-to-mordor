// Samsung Health Service Unit Tests
import { SamsungHealthService, TokenEncryption } from '../src/samsung-health-service';

describe('SamsungHealthService', () => {
  let service: SamsungHealthService;

  beforeEach(() => {
    service = new SamsungHealthService('test_client_id', 'test_client_secret');
  });

  describe('generateAuthUrl', () => {
    it('should generate valid authorization URL with default base URL', () => {
      const state = 'test_state_123';
      const authUrl = service.generateAuthUrl(state);

      expect(authUrl).toContain('https://account.samsung.com/accounts/oauth/authorize');
      expect(authUrl).toContain('client_id=test_client_id');
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('scope=sami%3Aread_health_data'); // URL encoded
      expect(authUrl).toContain(`state=${state}`);
      expect(authUrl).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A8787%2Fwtm%2Fapi%2Fsamsung-health%2Fcallback'); // URL encoded
    });

    it('should generate valid authorization URL with custom base URL', () => {
      const state = 'test_state_456';
      const baseUrl = 'https://example.com';
      const authUrl = service.generateAuthUrl(state, baseUrl);

      expect(authUrl).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fwtm%2Fapi%2Fsamsung-health%2Fcallback'); // URL encoded
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange mock auth code for tokens', async () => {
      const result = await service.exchangeCodeForTokens('mock_auth_code');

      expect(result).toBeTruthy();
      expect(result?.access_token).toContain('mock_access_token_');
      expect(result?.refresh_token).toContain('mock_refresh_token_');
      expect(result?.expires_in).toBe(3600);
    });

    it('should exchange test auth code for tokens', async () => {
      const result = await service.exchangeCodeForTokens('test_12345');

      expect(result).toBeTruthy();
      expect(result?.access_token).toContain('mock_access_token_');
      expect(result?.refresh_token).toContain('mock_refresh_token_');
      expect(result?.expires_in).toBe(3600);
    });

    it('should return null for invalid auth code', async () => {
      const result = await service.exchangeCodeForTokens('invalid_code');

      expect(result).toBeNull();
    });

    it('should return null for empty auth code', async () => {
      const result = await service.exchangeCodeForTokens('');

      expect(result).toBeNull();
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh mock token successfully', async () => {
      const result = await service.refreshAccessToken('mock_refresh_token_123');

      expect(result).toBeTruthy();
      expect(result?.access_token).toContain('mock_access_token_');
      expect(result?.refresh_token).toBe('mock_refresh_token_123');
      expect(result?.expires_in).toBe(3600);
    });

    it('should return null for invalid refresh token', async () => {
      const result = await service.refreshAccessToken('invalid_token');

      expect(result).toBeNull();
    });
  });

  describe('getWalkingDistance', () => {
    it('should return walking distance for mock token', async () => {
      const result = await service.getWalkingDistance('mock_access_token_123', '2024-01-15');

      expect(result).toBeTruthy();
      expect(result?.date).toBe('2024-01-15');
      expect(result?.distance).toBeGreaterThanOrEqual(0);
      expect(result?.distance).toBeLessThanOrEqual(10);
    });

    it('should return consistent distance for same date', async () => {
      const date = '2024-01-15';
      const result1 = await service.getWalkingDistance('mock_access_token_123', date);
      const result2 = await service.getWalkingDistance('mock_access_token_456', date);

      expect(result1?.distance).toBe(result2?.distance);
    });

    it('should return null for invalid token', async () => {
      const result = await service.getWalkingDistance('invalid_token', '2024-01-15');

      expect(result).toBeNull();
    });

    it('should return null for invalid date', async () => {
      const result = await service.getWalkingDistance('mock_access_token_123', 'invalid-date');

      expect(result).toBeNull();
    });
  });

  describe('revokeToken', () => {
    it('should revoke mock token successfully', async () => {
      const result = await service.revokeToken('mock_access_token_123');

      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      const result = await service.revokeToken('invalid_token');

      expect(result).toBe(false);
    });
  });
});

describe('TokenEncryption', () => {
  const testKey = 'test_encryption_key_32_characters';

  beforeEach(async () => {
    await TokenEncryption.initializeKey(testKey);
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt text correctly', async () => {
      const originalText = 'test_access_token_12345';
      
      const encrypted = await TokenEncryption.encrypt(originalText);
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(originalText);

      const decrypted = await TokenEncryption.decrypt(encrypted);
      expect(decrypted).toBe(originalText);
    });

    it('should produce different encrypted values for same input', async () => {
      const originalText = 'test_token';
      
      const encrypted1 = await TokenEncryption.encrypt(originalText);
      const encrypted2 = await TokenEncryption.encrypt(originalText);
      
      expect(encrypted1).not.toBe(encrypted2);
      
      const decrypted1 = await TokenEncryption.decrypt(encrypted1);
      const decrypted2 = await TokenEncryption.decrypt(encrypted2);
      
      expect(decrypted1).toBe(originalText);
      expect(decrypted2).toBe(originalText);
    });

    it('should handle empty string', async () => {
      const originalText = '';
      
      const encrypted = await TokenEncryption.encrypt(originalText);
      const decrypted = await TokenEncryption.decrypt(encrypted);
      
      expect(decrypted).toBe(originalText);
    });

    it('should handle long text', async () => {
      const originalText = 'a'.repeat(1000);
      
      const encrypted = await TokenEncryption.encrypt(originalText);
      const decrypted = await TokenEncryption.decrypt(encrypted);
      
      expect(decrypted).toBe(originalText);
    });

    it('should handle special characters', async () => {
      const originalText = 'token_with_special_chars!@#$%^&*(){}[]|\\:";\'<>?,./`~';
      
      const encrypted = await TokenEncryption.encrypt(originalText);
      const decrypted = await TokenEncryption.decrypt(encrypted);
      
      expect(decrypted).toBe(originalText);
    });
  });

  describe('error handling', () => {
    it('should throw error when encrypting without key initialization', async () => {
      // Create new instance without initialization
      const testClass = class extends TokenEncryption {
        static key = null;
      };

      await expect(testClass.encrypt('test')).rejects.toThrow('Encryption key not initialized');
    });

    it('should throw error when decrypting without key initialization', async () => {
      // Create new instance without initialization
      const testClass = class extends TokenEncryption {
        static key = null;
      };

      await expect(testClass.decrypt('test')).rejects.toThrow('Encryption key not initialized');
    });

    it('should throw error when decrypting invalid data', async () => {
      await expect(TokenEncryption.decrypt('invalid_encrypted_data')).rejects.toThrow();
    });
  });
});