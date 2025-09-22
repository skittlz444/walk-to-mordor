import { renderHtml } from '../src/renderHtml';
import { 
  isValidDateFormat, 
  isValidDistance, 
  safeJsonParse, 
  isValidMethod 
} from '../src/validators';

// Mock the modules at module level
jest.mock('../src/renderHtml');
jest.mock('../src/validators');

// Import after mocking
import worker from '../src/index';

const mockRenderHtml = jest.mocked(renderHtml);
const mockIsValidDateFormat = jest.mocked(isValidDateFormat);
const mockIsValidDistance = jest.mocked(isValidDistance);
const mockSafeJsonParse = jest.mocked(safeJsonParse);
const mockIsValidMethod = jest.mocked(isValidMethod);

describe('Cloudflare Worker Index', () => {
  let mockEnv: any;
  let mockRequest: any;
  let originalConsoleError: typeof console.error;
  let originalConsoleLog: typeof console.log;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Suppress console outputs during tests to reduce noise from expected scenarios
    originalConsoleError = console.error;
    originalConsoleLog = console.log;
    console.error = jest.fn();
    console.log = jest.fn();
    
    // Setup default mock returns
    mockRenderHtml.mockReturnValue('<html>Mock HTML</html>');
    mockIsValidDateFormat.mockReturnValue(true);
    mockIsValidDistance.mockReturnValue(true);
    mockIsValidMethod.mockReturnValue(true);
    mockSafeJsonParse.mockResolvedValue({ success: true, data: {} });

    // Create simple mock environment
    mockEnv = {
      DB: {
        prepare: jest.fn(() => ({
          bind: jest.fn(() => ({
            run: jest.fn(() => Promise.resolve({ meta: { changes: 1 } })),
            all: jest.fn(() => Promise.resolve({ results: [] }))
          })),
          all: jest.fn(() => Promise.resolve({ results: [] }))
        }))
      },
      ASSETS: {
        fetch: jest.fn(() => Promise.resolve({ status: 404 }))
      }
    };

    mockRequest = {
      url: 'https://example.com/',
      method: 'GET'
    };
  });

  afterEach(() => {
    // Restore console methods after each test
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  it('should call renderHtml for main page', async () => {
    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(mockRenderHtml).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it('should validate method for API endpoints', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'POST';
    mockIsValidMethod.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(mockIsValidMethod).toHaveBeenCalledWith('/wtm/api/calendar-progress', 'POST');
    expect(response.status).toBe(405);
  });

  it('should parse JSON for POST requests', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: '5.5' }
    });

    await worker.fetch(mockRequest, mockEnv);
    
    expect(mockSafeJsonParse).toHaveBeenCalledWith(mockRequest);
    expect(mockIsValidDateFormat).toHaveBeenCalledWith('2024-01-15');
    expect(mockIsValidDistance).toHaveBeenCalledWith('5.5');
  });

  it('should handle invalid JSON', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: false,
      error: 'Invalid JSON'
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(400);
  });

  it('should validate date format', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: 'invalid-date', title: '5.5' }
    });
    mockIsValidDateFormat.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(400);
  });

  it('should validate distance', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: 'invalid' }
    });
    mockIsValidDistance.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(400);
  });

  it('should serve static assets when available', async () => {
    const assetResponse = { status: 200, body: 'asset' };
    mockEnv.ASSETS.fetch.mockResolvedValue(assetResponse);

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response).toBe(assetResponse);
  });

  it('should handle missing required fields in POST', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { title: '5.5' } // missing start
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(400);
  });

  it('should return calendar data for GET requests', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'GET';

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(200);
  });

  it('should return goals data', async () => {
    mockRequest.url = 'https://example.com/wtm/api/goals';
    mockRequest.method = 'GET';

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(200);
  });

  it('should handle PUT requests successfully', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'PUT';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: '7.5' }
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(200);
  });

  it('should handle PUT with missing fields', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'PUT';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15' } // missing title
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(400);
  });

  it('should handle PUT when entry not found', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'PUT';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: '7.5' }
    });

    // Mock no changes in database
    mockEnv.DB.prepare.mockReturnValue({
      bind: jest.fn(() => ({
        run: jest.fn(() => Promise.resolve({ meta: { changes: 0 } }))
      }))
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(404);
  });

  it('should handle DELETE requests successfully', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'DELETE';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15' }
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(200);
  });

  it('should handle DELETE with missing start field', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'DELETE';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: {}
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(400);
  });

  it('should handle DELETE when entry not found', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'DELETE';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15' }
    });

    // Mock no changes in database
    mockEnv.DB.prepare.mockReturnValue({
      bind: jest.fn(() => ({
        run: jest.fn(() => Promise.resolve({ meta: { changes: 0 } }))
      }))
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(404);
  });

  it('should handle DELETE with invalid date', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'DELETE';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: 'invalid-date' }
    });
    mockIsValidDateFormat.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(400);
  });

  it('should handle database errors in POST', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: '5.5' }
    });

    // Mock database error
    mockEnv.DB.prepare.mockReturnValue({
      bind: jest.fn(() => ({
        run: jest.fn(() => Promise.reject(new Error('Database error')))
      }))
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(500);
  });

  it('should handle UNIQUE constraint error in POST', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: '5.5' }
    });

    // Mock UNIQUE constraint error
    mockEnv.DB.prepare.mockReturnValue({
      bind: jest.fn(() => ({
        run: jest.fn(() => Promise.reject(new Error('UNIQUE constraint failed')))
      }))
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(409);
  });

  it('should handle database errors in PUT', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'PUT';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: '5.5' }
    });

    // Mock database error
    mockEnv.DB.prepare.mockReturnValue({
      bind: jest.fn(() => ({
        run: jest.fn(() => Promise.reject(new Error('Database error')))
      }))
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(500);
  });

  it('should handle database errors in DELETE', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'DELETE';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15' }
    });

    // Mock database error
    mockEnv.DB.prepare.mockReturnValue({
      bind: jest.fn(() => ({
        run: jest.fn(() => Promise.reject(new Error('Database error')))
      }))
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(500);
  });

  it('should handle database errors in GET calendar-progress', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'GET';

    // Mock database error
    mockEnv.DB.prepare.mockReturnValue({
      all: jest.fn(() => Promise.reject(new Error('Database error')))
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(500);
  });

  it('should handle database errors in GET goals', async () => {
    mockRequest.url = 'https://example.com/wtm/api/goals';
    mockRequest.method = 'GET';

    // Mock database error
    mockEnv.DB.prepare.mockReturnValue({
      all: jest.fn(() => Promise.reject(new Error('Database error')))
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(500);
  });

  it('should calculate total distance correctly via API endpoint', async () => {
    mockRequest.url = 'https://example.com/wtm/api/total-distance';
    mockRequest.method = 'GET';

    // Mock multiple entries with distances
    mockEnv.DB.prepare.mockReturnValue({
      all: jest.fn(() => Promise.resolve({
        results: [
          { distance: 5.5 },
          { distance: 3.2 },
          { distance: 1.3 }
        ]
      }))
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.totalDistance).toBe(10); // 5.5 + 3.2 + 1.3 = 10
  });

  it('should handle database errors in total distance API', async () => {
    mockRequest.url = 'https://example.com/wtm/api/total-distance';
    mockRequest.method = 'GET';

    // Mock database error
    mockEnv.DB.prepare.mockReturnValue({
      all: jest.fn(() => Promise.reject(new Error('Database error')))
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(500);
  });

  it('should render main page even with database errors', async () => {
    mockRequest.url = 'https://example.com/';
    mockRequest.method = 'GET';

    // Mock database error (this won't affect main page rendering in new architecture)
    mockEnv.DB.prepare.mockReturnValue({
      all: jest.fn(() => Promise.reject(new Error('Database error')))
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(mockRenderHtml).toHaveBeenCalledWith(); // No parameters in new architecture
    expect(response.status).toBe(200);
  });

  it('should render main page without server-side distance calculation', async () => {
    mockRequest.url = 'https://example.com/';
    mockRequest.method = 'GET';

    // Database data doesn't affect main page rendering in new architecture
    mockEnv.DB.prepare.mockReturnValue({
      all: jest.fn(() => Promise.resolve({
        results: [
          { distance: 5.5 },
          { distance: 3.2 },
          { distance: 1.3 }
        ]
      }))
    });

    await worker.fetch(mockRequest, mockEnv);
    
    expect(mockRenderHtml).toHaveBeenCalledWith(); // No parameters in new architecture
  });

  it('should handle HEAD requests for assets', async () => {
    mockRequest.method = 'HEAD';
    
    const assetResponse = { status: 200, body: 'asset' };
    mockEnv.ASSETS.fetch.mockResolvedValue(assetResponse);

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response).toBe(assetResponse);
  });

  it('should validate distance for specific error types in POST', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: 'invalid' }
    });
    mockIsValidDistance.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(400);
  });

  it('should validate distance for NaN values in POST', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: 'not-a-number' }
    });
    mockIsValidDistance.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    const result = await response.json();
    
    expect(response.status).toBe(400);
    expect(result.error).toBe('Invalid distance value. Must be a valid number');
  });

  it('should validate distance for negative values in POST', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: '-5' }
    });
    mockIsValidDistance.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    const result = await response.json();
    
    expect(response.status).toBe(400);
    expect(result.error).toBe('Invalid distance value. Must be non-negative (0 or greater)');
  });

  it('should validate distance for too large values in POST', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: '1000000000' }
    });
    mockIsValidDistance.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    const result = await response.json();
    
    expect(response.status).toBe(400);
    expect(result.error).toBe('Invalid distance value. Must be less than 1 billion');
  });

  it('should validate missing title field in POST', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15' }
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    const result = await response.json();
    
    expect(response.status).toBe(400);
    expect(result.error).toBe('Missing required field: title (distance)');
  });

  it('should validate missing title field in PUT', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'PUT';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15' }
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    const result = await response.json();
    
    expect(response.status).toBe(400);
    expect(result.error).toBe('Missing required field: title (distance)');
  });

  it('should validate date format in PUT', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'PUT';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: 'invalid-date', title: '5.5' }
    });
    mockIsValidDateFormat.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    const result = await response.json();
    
    expect(response.status).toBe(400);
    expect(result.error).toBe('Invalid date format. Expected format: YYYY-MM-DD (e.g., 2024-01-15)');
  });

  it('should validate distance in PUT', async () => {
    mockRequest.url = 'https://example.com/wtm/api/calendar-progress';
    mockRequest.method = 'PUT';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: 'invalid' }
    });
    mockIsValidDistance.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    const result = await response.json();
    
    expect(response.status).toBe(400);
    expect(result.error).toBe('Invalid distance value. Must be a non-negative number');
  });
});