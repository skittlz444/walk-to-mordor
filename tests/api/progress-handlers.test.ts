
import { 
  handleProgressPost, 
  handleProgressPut, 
  handleProgressDelete, 
  handleProgressGet 
} from '../../src/progress-handlers';
import { validateSession } from '../../src/auth-handlers';
import * as validators from '../../src/validators';

// Mock dependencies
jest.mock('../../src/auth-handlers');
jest.mock('../../src/validators', () => ({
  ...jest.requireActual('../../src/validators'),
  isValidDateFormat: jest.fn(),
  isValidDistance: jest.fn(),
  safeJsonParse: jest.fn()
}));

describe('Progress Handlers', () => {
  let mockEnv: any;
  let mockRequest: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    (validateSession as jest.Mock).mockResolvedValue({ valid: true, userId: 1 });
    (validators.isValidDateFormat as jest.Mock).mockReturnValue(true);
    (validators.isValidDistance as jest.Mock).mockReturnValue(true);

    // Mock DB
    mockEnv = {
      DB: {
        prepare: jest.fn(() => ({
          bind: jest.fn(() => ({
            run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
            all: jest.fn().mockResolvedValue({ results: [] }),
            first: jest.fn().mockResolvedValue(null)
          }))
        }))
      }
    };

    mockRequest = {
      headers: {
        get: jest.fn()
      }
    };
  });

  describe('handleProgressGet', () => {
    it('should return progress entries', async () => {
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ all: mockAll });

      const mockResults = [
        { date: '2024-01-01', distance: 5.5 },
        { date: '2024-01-02', distance: 3.2 }
      ];
      mockAll.mockResolvedValueOnce({ results: mockResults });

      const response = await handleProgressGet(mockRequest, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(200);
      // The handler transforms the data to match FullCalendar format
      expect(data).toEqual([
        { start: '2024-01-01', title: '5.5' },
        { start: '2024-01-02', title: '3.2' }
      ]);
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM progress WHERE user_id = ?'));
      expect(mockBind).toHaveBeenCalledWith(1); // userId
    });

    it('should return 401 if session invalid', async () => {
      (validateSession as jest.Mock).mockResolvedValue({ 
        valid: false, 
        error: new Response('Unauthorized', { status: 401 }) 
      });

      const response = await handleProgressGet(mockRequest, mockEnv);
      expect(response.status).toBe(401);
    });
  });

  describe('handleProgressPost', () => {
    it('should create new progress entry', async () => {
      const body = { start: '2024-01-01', title: '5.5' };
      
      const response = await handleProgressPost(mockRequest, mockEnv, body);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe('Created successfully');
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO progress'));
    });

    it('should return 400 if missing required fields', async () => {
      const response = await handleProgressPost(mockRequest, mockEnv, {});
      expect(response.status).toBe(400);
    });

    it('should return 400 if invalid date format', async () => {
      (validators.isValidDateFormat as jest.Mock).mockReturnValue(false);
      const response = await handleProgressPost(mockRequest, mockEnv, { start: 'bad-date', title: '5.5' });
      expect(response.status).toBe(400);
    });

    it('should return 400 if invalid distance', async () => {
      (validators.isValidDistance as jest.Mock).mockReturnValue(false);
      const response = await handleProgressPost(mockRequest, mockEnv, { start: '2024-01-01', title: 'bad' });
      expect(response.status).toBe(400);
    });

    it('should return 409 if duplicate entry', async () => {
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      
      mockPrepare.mockReturnValue({ bind: mockBind });
      mockBind.mockReturnValue({ 
        run: jest.fn().mockRejectedValue(new Error('UNIQUE constraint failed')) 
      });

      const response = await handleProgressPost(mockRequest, mockEnv, { start: '2024-01-01', title: '5.5' });
      expect(response.status).toBe(409);
    });
  });

  describe('handleProgressPut', () => {
    it('should update existing progress entry', async () => {
      const body = { start: '2024-01-01', title: '6.0' };
      
      const response = await handleProgressPut(mockRequest, mockEnv, body);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Updated successfully');
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE progress'));
    });

    it('should return 404 if entry not found', async () => {
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockRun = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, run: mockRun });
      mockBind.mockReturnValue({ run: mockRun });
      mockRun.mockResolvedValueOnce({ meta: { changes: 0 } });

      const response = await handleProgressPut(mockRequest, mockEnv, { start: '2024-01-01', title: '6.0' });
      expect(response.status).toBe(404);
    });
  });

  describe('handleProgressDelete', () => {
    it('should delete progress entry', async () => {
      const body = { start: '2024-01-01' };
      
      const response = await handleProgressDelete(mockRequest, mockEnv, body);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Deleted successfully');
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM progress'));
    });

    it('should return 404 if entry not found', async () => {
      const mockPrepare = mockEnv.DB.prepare;
      const mockBind = jest.fn();
      const mockRun = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, run: mockRun });
      mockBind.mockReturnValue({ run: mockRun });
      mockRun.mockResolvedValueOnce({ meta: { changes: 0 } });

      const response = await handleProgressDelete(mockRequest, mockEnv, { start: '2024-01-01' });
      expect(response.status).toBe(404);
    });
  });
});
