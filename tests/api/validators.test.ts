import { 
  isValidDateFormat, 
  isValidDistance, 
  safeJsonParse, 
  isValidMethod,
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

  describe('safeJsonParse', () => {
    it('should parse valid JSON', async () => {
      const mockRequest = {
        text: async () => '{"start": "2024-01-15", "title": "100"}'
      } as Request;
      
      const result = await safeJsonParse(mockRequest);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ start: "2024-01-15", title: "100" });
    });

    it('should reject invalid JSON', async () => {
      const mockRequest = {
        text: async () => '{ invalid json }'
      } as Request;
      
      const result = await safeJsonParse(mockRequest);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid JSON format');
    });

    it('should treat empty request body as empty object', async () => {
      const mockRequest = {
        text: async () => ''
      } as Request;
      
      const result = await safeJsonParse(mockRequest);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });

    it('should treat whitespace-only request body as empty object', async () => {
      const mockRequest = {
        text: async () => '   '
      } as Request;
      
      const result = await safeJsonParse(mockRequest);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });

    it('should reject non-object JSON', async () => {
      const mockRequest = {
        text: async () => '"just a string"'
      } as Request;
      
      const result = await safeJsonParse(mockRequest);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Request body must be a JSON object');
    });

    it('should reject null JSON', async () => {
      const mockRequest = {
        text: async () => 'null'
      } as Request;
      
      const result = await safeJsonParse(mockRequest);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Request body must be a JSON object');
    });
  });

  describe('isValidMethod', () => {
    it('should validate calendar-progress endpoint methods', () => {
      expect(isValidMethod('/api/calendar-progress', 'GET')).toBe(true);
      expect(isValidMethod('/api/calendar-progress', 'POST')).toBe(true);
      expect(isValidMethod('/api/calendar-progress', 'PUT')).toBe(true);
      expect(isValidMethod('/api/calendar-progress', 'DELETE')).toBe(true);
      expect(isValidMethod('/api/calendar-progress', 'PATCH')).toBe(false);
      expect(isValidMethod('/api/calendar-progress', 'HEAD')).toBe(false);
    });

    it('should validate goals endpoint methods', () => {
      expect(isValidMethod('/api/goals', 'GET')).toBe(true);
      expect(isValidMethod('/api/goals', 'POST')).toBe(false);
      expect(isValidMethod('/api/goals', 'PUT')).toBe(false);
      expect(isValidMethod('/api/goals', 'DELETE')).toBe(false);
    });

    it('should reject unknown endpoints', () => {
      expect(isValidMethod('/api/unknown', 'GET')).toBe(false);
      expect(isValidMethod('/other/endpoint', 'GET')).toBe(false);
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
