// Tests for authentication utilities
import {
  generateSalt,
  hashPassword,
  verifyPassword,
  generateSessionId,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  getSessionExpiry,
  isSessionExpired,
  generatePasswordResetToken,
  getPasswordResetExpiry,
  isPasswordResetTokenExpired
} from '../../src/auth-utils';

describe('Authentication Utilities', () => {
  describe('generateSalt', () => {
    it('should generate a 32-character hex string', async () => {
      const salt = await generateSalt();
      expect(salt).toHaveLength(32);
      expect(salt).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate unique salts', async () => {
      const salt1 = await generateSalt();
      const salt2 = await generateSalt();
      expect(salt1).not.toBe(salt2);
    });
  });

  describe('hashPassword', () => {
    it('should hash a password with salt', async () => {
      const password = 'Test1234!';
      const salt = await generateSalt();
      const hash = await hashPassword(password, salt);
      
      expect(hash).toHaveLength(64); // 256 bits = 64 hex chars
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should produce different hashes with different salts', async () => {
      const password = 'Test1234!';
      const salt1 = await generateSalt();
      const salt2 = await generateSalt();
      
      const hash1 = await hashPassword(password, salt1);
      const hash2 = await hashPassword(password, salt2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should produce same hash with same salt', async () => {
      const password = 'Test1234!';
      const salt = await generateSalt();
      
      const hash1 = await hashPassword(password, salt);
      const hash2 = await hashPassword(password, salt);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'Test1234!';
      const salt = await generateSalt();
      const hash = await hashPassword(password, salt);
      
      const isValid = await verifyPassword(password, salt, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'Test1234!';
      const wrongPassword = 'Wrong1234!';
      const salt = await generateSalt();
      const hash = await hashPassword(password, salt);
      
      const isValid = await verifyPassword(wrongPassword, salt, hash);
      expect(isValid).toBe(false);
    });
  });

  describe('generateSessionId', () => {
    it('should generate a 64-character hex string', () => {
      const sessionId = generateSessionId();
      expect(sessionId).toHaveLength(64);
      expect(sessionId).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate unique session IDs', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('isValidEmail', () => {
    it('should accept valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('test+tag@example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('test @example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null as any)).toBe(false);
    });
  });

  describe('isValidPassword', () => {
    it('should accept valid passwords', () => {
      const result1 = isValidPassword('Test1234!');
      expect(result1.valid).toBe(true);
      expect(result1.errors).toHaveLength(0);

      const result2 = isValidPassword('Password123');
      expect(result2.valid).toBe(true);
    });

    it('should reject password too short', () => {
      const result = isValidPassword('Test1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase', () => {
      const result = isValidPassword('test1234!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase', () => {
      const result = isValidPassword('TEST1234!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without number or symbol', () => {
      const result = isValidPassword('TestPassword');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number or symbol');
    });

    it('should return multiple errors for multiple issues', () => {
      const result = isValidPassword('test');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('isValidUsername', () => {
    it('should accept valid usernames', () => {
      expect(isValidUsername('testuser')).toBe(true);
      expect(isValidUsername('test_user')).toBe(true);
      expect(isValidUsername('TestUser123')).toBe(true);
      expect(isValidUsername('abc')).toBe(true); // minimum 3 chars
    });

    it('should reject invalid usernames', () => {
      expect(isValidUsername('ab')).toBe(false); // too short
      expect(isValidUsername('a'.repeat(31))).toBe(false); // too long
      expect(isValidUsername('test-user')).toBe(false); // contains hyphen
      expect(isValidUsername('test user')).toBe(false); // contains space
      expect(isValidUsername('test@user')).toBe(false); // contains @
      expect(isValidUsername('')).toBe(false);
      expect(isValidUsername(null as any)).toBe(false);
    });
  });

  describe('getSessionExpiry', () => {
    it('should return a date 30 days in the future', () => {
      const expiryStr = getSessionExpiry();
      const expiry = new Date(expiryStr);
      const now = new Date();
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      // Check that expiry is approximately 30 days from now (within 1 minute tolerance)
      const diff = Math.abs(expiry.getTime() - thirtyDaysLater.getTime());
      expect(diff).toBeLessThan(60 * 1000);
    });
  });

  describe('isSessionExpired', () => {
    it('should return true for expired sessions', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isSessionExpired(yesterday.toISOString())).toBe(true);
    });

    it('should return false for valid sessions', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(isSessionExpired(tomorrow.toISOString())).toBe(false);
    });
  });

  describe('generatePasswordResetToken', () => {
    it('should generate a 64-character hex string', () => {
      const token = generatePasswordResetToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate unique tokens', () => {
      const token1 = generatePasswordResetToken();
      const token2 = generatePasswordResetToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('getPasswordResetExpiry', () => {
    it('should return expiry 1 hour in the future', () => {
      const expiry = getPasswordResetExpiry();
      const expiryDate = new Date(expiry);
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      
      // Allow 5 seconds tolerance for test execution time
      expect(expiryDate.getTime()).toBeGreaterThan(now.getTime() + 59 * 60 * 1000);
      expect(expiryDate.getTime()).toBeLessThan(oneHourFromNow.getTime() + 5000);
    });
  });

  describe('isPasswordResetTokenExpired', () => {
    it('should return false for future expiry', () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      expect(isPasswordResetTokenExpired(futureDate.toISOString())).toBe(false);
    });

    it('should return true for past expiry', () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      expect(isPasswordResetTokenExpired(pastDate.toISOString())).toBe(true);
    });

    it('should return true for current time (edge case)', () => {
      // Token that expires right now should be considered expired
      const now = new Date(Date.now() - 1000); // 1 second ago to ensure it's past
      expect(isPasswordResetTokenExpired(now.toISOString())).toBe(true);
    });
  });
});
