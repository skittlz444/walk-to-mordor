import { 
  isValidDateFormat, 
  isValidDistance,
  isValidEmail,
  isValidUsername,
  createErrorResponse,
  createSuccessResponse
} from '../../src/validators';

describe('Validators', () => {
  describe('isValidDateFormat', () => {
    it('should accept valid date formats', () => {
      expect(isValidDateFormat('2024-01-15')).toBe(true);
      expect(isValidDateFormat('2024-12-31')).toBe(true);
      expect(isValidDateFormat('2000-02-29')).toBe(true); // Leap year
      expect(isValidDateFormat('1999-01-01')).toBe(true);
    });

    it('should reject invalid date formats', () => {
      expect(isValidDateFormat('01/15/2024')).toBe(false);
      expect(isValidDateFormat('2024-1-15')).toBe(false);
      expect(isValidDateFormat('2024-01')).toBe(false);
      expect(isValidDateFormat('24-01-15')).toBe(false);
      expect(isValidDateFormat('not-a-date')).toBe(false);
      expect(isValidDateFormat('')).toBe(false);
    });

    it('should reject invalid dates', () => {
      expect(isValidDateFormat('2024-02-30')).toBe(false); // Feb 30th doesn't exist
      expect(isValidDateFormat('2024-13-01')).toBe(false); // Month 13 doesn't exist
      expect(isValidDateFormat('2024-00-01')).toBe(false); // Month 0 doesn't exist
      expect(isValidDateFormat('2024-01-00')).toBe(false); // Day 0 doesn't exist
      expect(isValidDateFormat('2024-01-32')).toBe(false); // Jan 32nd doesn't exist
      expect(isValidDateFormat('2023-02-29')).toBe(false); // Not a leap year
    });

    it('should handle edge cases', () => {
      expect(isValidDateFormat(null as any)).toBe(false);
      expect(isValidDateFormat(undefined as any)).toBe(false);
      expect(isValidDateFormat(123 as any)).toBe(false);
      expect(isValidDateFormat({} as any)).toBe(false);
    });

    it('should validate year ranges', () => {
      expect(isValidDateFormat('0999-01-01')).toBe(false); // Year too low
      expect(isValidDateFormat('10000-01-01')).toBe(false); // Year too high
      expect(isValidDateFormat('1000-01-01')).toBe(true); // Min valid year
      expect(isValidDateFormat('9999-12-31')).toBe(true); // Max valid year
    });
  });

  describe('isValidDistance', () => {
    it('should accept valid distance values', () => {
      expect(isValidDistance(0)).toBe(true);
      expect(isValidDistance(1)).toBe(true);
      expect(isValidDistance(15.5)).toBe(true);
      expect(isValidDistance('0')).toBe(true);
      expect(isValidDistance('15.5')).toBe(true);
      expect(isValidDistance('1000')).toBe(true);
    });

    it('should reject invalid distance values', () => {
      expect(isValidDistance(-1)).toBe(false);
      expect(isValidDistance('-5')).toBe(false);
      expect(isValidDistance('not-a-number')).toBe(false);
      expect(isValidDistance('')).toBe(false);
      expect(isValidDistance('  ')).toBe(false);
      expect(isValidDistance(null)).toBe(false);
      expect(isValidDistance(undefined)).toBe(false);
      expect(isValidDistance(NaN)).toBe(false);
      expect(isValidDistance(Infinity)).toBe(false);
      expect(isValidDistance(-Infinity)).toBe(false);
    });

    it('should reject values that are too large', () => {
      expect(isValidDistance(999999999)).toBe(true); // At limit
      expect(isValidDistance(1000000000)).toBe(false); // Over limit
      expect(isValidDistance('9999999999')).toBe(false); // Way over limit
    });
  });

  describe('isValidUsername', () => {
    it('accepts the boundary lengths and allowed characters', () => {
      expect(isValidUsername('abc')).toBe(true);
      expect(isValidUsername('a'.repeat(30))).toBe(true);
      expect(isValidUsername('TestUser_123')).toBe(true);
    });

    it('rejects values outside the server predicate', () => {
      expect(isValidUsername('ab')).toBe(false);
      expect(isValidUsername('a'.repeat(31))).toBe(false);
      expect(isValidUsername('test-user')).toBe(false);
      expect(isValidUsername('test user')).toBe(false);
      expect(isValidUsername('')).toBe(false);
      expect(isValidUsername(null as any)).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('accepts common email shapes', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('rejects malformed email shapes', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('test @example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null as any)).toBe(false);
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response with default status', () => {
      const response = createErrorResponse('Test error');
      expect(response.status).toBe(400);
    });

    it('should create error response with custom status', () => {
      const response = createErrorResponse('Test error', 404);
      expect(response.status).toBe(404);
    });

    it('should have correct content type', () => {
      const response = createErrorResponse('Test error');
      expect(response.headers.get('content-type')).toBe('application/json');
    });
  });

  describe('createSuccessResponse', () => {
    it('should create success response with default status', () => {
      const response = createSuccessResponse({ message: 'Success' });
      expect(response.status).toBe(200);
    });

    it('should create success response with custom status', () => {
      const response = createSuccessResponse({ message: 'Created' }, 201);
      expect(response.status).toBe(201);
    });

    it('should have correct content type', () => {
      const response = createSuccessResponse({ message: 'Success' });
      expect(response.headers.get('content-type')).toBe('application/json');
    });
  });
});
