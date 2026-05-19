
import { 
  handleProgressPost, 
  handleProgressPut, 
  handleProgressDelete, 
  handleProgressGet 
} from '../../src/progress-handlers';
import { validateSession } from '../../src/auth-handlers';
import * as validators from '../../src/validators';
import { DbClient } from '../../src/db';

// Mock dependencies
jest.mock('../../src/auth-handlers');
jest.mock('../../src/validators', () => ({
  ...jest.requireActual('../../src/validators'),
  isValidDateFormat: jest.fn(),
  isValidDistance: jest.fn(),
  safeJsonParse: jest.fn()
}));

describe('Progress Handlers', () => {
  let mockDB: any;
  let mockDb: DbClient;
  let mockRequest: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    (validateSession as jest.Mock).mockResolvedValue({ valid: true, userId: 1 });
    (validators.isValidDateFormat as jest.Mock).mockReturnValue(true);
    (validators.isValidDistance as jest.Mock).mockReturnValue(true);

    // Mock DB
    mockDB = {
      prepare: jest.fn(() => ({
        bind: jest.fn(() => ({
          run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
          all: jest.fn().mockResolvedValue({ results: [] }),
          first: jest.fn().mockResolvedValue(null)
        }))
      }))
    };
    mockDb = { read: mockDB as unknown as D1Database, write: mockDB as unknown as D1Database };

    mockRequest = {
      headers: {
        get: jest.fn()
      }
    };
  });

  describe('handleProgressGet', () => {
    it('should return progress entries', async () => {
      const mockPrepare = mockDB.prepare;
      const mockBind = jest.fn();
      const mockAll = jest.fn();

      mockPrepare.mockReturnValue({ bind: mockBind, all: mockAll });
      mockBind.mockReturnValue({ all: mockAll });

      const mockResults = [
        { date: '2024-01-01', distance: 5.5 },
        { date: '2024-01-02', distance: 3.2 }
      ];
      mockAll.mockResolvedValueOnce({ results: mockResults });

      const response = await handleProgressGet(mockRequest, mockDb);
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

      const response = await handleProgressGet(mockRequest, mockDb);
      expect(response.status).toBe(401);
    });
  });

  describe('handleProgressPost', () => {
    it('should create new progress entry', async () => {
      const body = { start: '2024-01-01', title: '5.5' };
      
      const response = await handleProgressPost(mockRequest, mockDb, body);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe('Created successfully');
      expect(mockDB.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO progress'));
    });

    it('should return 400 if missing required fields', async () => {
      const response = await handleProgressPost(mockRequest, mockDb, {});
      expect(response.status).toBe(400);
    });

    it('should return 400 if invalid date format', async () => {
      (validators.isValidDateFormat as jest.Mock).mockReturnValue(false);
      const response = await handleProgressPost(mockRequest, mockDb, { start: 'bad-date', title: '5.5' });
      expect(response.status).toBe(400);
    });

    it('should return 400 if invalid distance', async () => {
      (validators.isValidDistance as jest.Mock).mockReturnValue(false);
      const response = await handleProgressPost(mockRequest, mockDb, { start: '2024-01-01', title: 'bad' });
      expect(response.status).toBe(400);
    });

    it('should return 409 if duplicate entry', async () => {
      const mockPrepare = mockDB.prepare;
      const mockBind = jest.fn();
      
      mockPrepare.mockReturnValue({ bind: mockBind });
      mockBind.mockReturnValue({ 
        run: jest.fn().mockRejectedValue(new Error('UNIQUE constraint failed')) 
      });

      const response = await handleProgressPost(mockRequest, mockDb, { start: '2024-01-01', title: '5.5' });
      expect(response.status).toBe(409);
    });
  });

  describe('handleProgressPut', () => {
    it('should update existing progress entry', async () => {
      const body = { start: '2024-01-01', title: '6.0' };
      
      const response = await handleProgressPut(mockRequest, mockDb, body);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Updated successfully');
      expect(mockDB.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE progress'));
    });

    it('should return 404 if entry not found', async () => {
      const mockPrepare = mockDB.prepare;
      const mockBind = jest.fn();
      const mockRun = jest.fn();
      const mockFirst = jest.fn().mockResolvedValue(null);

      mockPrepare.mockReturnValue({ bind: mockBind, run: mockRun });
      mockBind.mockReturnValue({ run: mockRun, first: mockFirst });
      mockRun.mockResolvedValueOnce({ meta: { changes: 0 } });

      const response = await handleProgressPut(mockRequest, mockDb, { start: '2024-01-01', title: '6.0' });
      expect(response.status).toBe(404);
    });
  });

  describe('handleProgressDelete', () => {
    it('should delete progress entry', async () => {
      const body = { start: '2024-01-01' };
      
      const response = await handleProgressDelete(mockRequest, mockDb, body);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Deleted successfully');
      expect(mockDB.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM progress'));
    });

    it('should return 404 if entry not found', async () => {
      const mockPrepare = mockDB.prepare;
      const mockBind = jest.fn();
      const mockRun = jest.fn();
      const mockFirst = jest.fn().mockResolvedValue(null);

      mockPrepare.mockReturnValue({ bind: mockBind, run: mockRun });
      mockBind.mockReturnValue({ run: mockRun, first: mockFirst });
      mockRun.mockResolvedValueOnce({ meta: { changes: 0 } });

      const response = await handleProgressDelete(mockRequest, mockDb, { start: '2024-01-01' });
      expect(response.status).toBe(404);
    });
  });

  describe('reengage_tier_sent reset on POST', () => {
    it('resets reengage_tier_sent to 0 on new walk POST', async () => {
      const body = { start: '2024-01-01', title: '5.5' };
      
      const response = await handleProgressPost(mockRequest, mockDb, body);
      
      expect(response.status).toBe(201);
      // The tier reset UPDATE should have been called
      expect(mockDB.prepare).toHaveBeenCalledWith(
        'UPDATE users SET reengage_tier_sent = 0 WHERE id = ? AND reengage_tier_sent > 0'
      );
    });

    it('does NOT reset reengage_tier_sent on PUT (edit)', async () => {
      const body = { start: '2024-01-01', title: '6.0' };
      
      const response = await handleProgressPut(mockRequest, mockDb, body);
      
      expect(response.status).toBe(200);
      // The tier reset UPDATE should NOT have been called
      const prepareCalls = mockDB.prepare.mock.calls.map((c: unknown[]) => c[0]);
      expect(prepareCalls).not.toContain(
        'UPDATE users SET reengage_tier_sent = 0 WHERE id = ? AND reengage_tier_sent > 0'
      );
    });

    it('does NOT reset reengage_tier_sent on DELETE', async () => {
      const body = { start: '2024-01-01' };
      
      const response = await handleProgressDelete(mockRequest, mockDb, body);
      
      expect(response.status).toBe(200);
      const prepareCalls = mockDB.prepare.mock.calls.map((c: unknown[]) => c[0]);
      expect(prepareCalls).not.toContain(
        'UPDATE users SET reengage_tier_sent = 0 WHERE id = ? AND reengage_tier_sent > 0'
      );
    });
  });
});
