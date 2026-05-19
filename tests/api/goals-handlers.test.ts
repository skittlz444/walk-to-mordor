import { handleGoalsGet, calculateTotalDistance } from '../../src/goals-handlers';
import { DbClient } from '../../src/db';

describe('Goals Handlers', () => {
  let mockDB: any;
  let mockDb: DbClient;
  let mockRequest: Request;

  beforeEach(() => {
    mockDB = { prepare: jest.fn() };
    mockDb = { read: mockDB as unknown as D1Database, write: mockDB as unknown as D1Database };
    
    // Mock request with auth header
    mockRequest = new Request('https://example.com', {
      headers: {
        'Authorization': 'Bearer mock-session-token'
      }
    });
  });

  describe('handleGoalsGet', () => {
    it('should return goals successfully', async () => {
      const mockResults = [
        { distance: 100, title: 'Rivendell', special: true, image_id: '1' },
        { distance: 200, title: 'Lothlorien', special: false, image_id: '2' }
      ];

      // Mock session validation
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn(() => Promise.resolve({
            results: [{
              id: 'mock-session',
              expires_at: new Date(Date.now() + 86400000).toISOString(),
              user_id: 1,
              approved: 1
            }]
          }))
        })
      });

      // Mock goals query
      mockDB.prepare.mockReturnValueOnce({
        all: jest.fn(() => Promise.resolve({
          results: mockResults
        }))
      });

      const response = await handleGoalsGet(mockRequest, mockDb);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResults);
    });

    it('should handle database errors', async () => {
      // Mock session validation
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn(() => Promise.resolve({
            results: [{
              id: 'mock-session',
              expires_at: new Date(Date.now() + 86400000).toISOString(),
              user_id: 1,
              approved: 1
            }]
          }))
        })
      });
      
      // Mock goals query to fail
      mockDB.prepare.mockReturnValueOnce({
        all: jest.fn(() => Promise.reject(new Error('Database connection failed')))
      });

      const response = await handleGoalsGet(mockRequest, mockDb);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error while retrieving goals');
    });

    it('should reject requests without authentication', async () => {
      const unauthRequest = new Request('https://example.com');
      const response = await handleGoalsGet(unauthRequest, mockDb);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Missing or invalid authorization header');
    });
  });

  describe('calculateTotalDistance', () => {
    it('should read users.active_storyline_distance_km for the user', async () => {
      mockDB.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          first: jest.fn(() => Promise.resolve({ total: 10 }))
        })
      });

      const total = await calculateTotalDistance(mockDb, 1);

      expect(total).toBe(10);
      expect(mockDB.prepare).toHaveBeenCalledWith(
        'SELECT active_storyline_distance_km AS total FROM users WHERE id = ?'
      );
    });

    it('should return 0 when user row is missing or counter is null', async () => {
      mockDB.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          first: jest.fn(() => Promise.resolve(null))
        })
      });

      const total = await calculateTotalDistance(mockDb, 1);

      expect(total).toBe(0);
    });

    it('should round the stored distance to two decimal places', async () => {
      mockDB.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          first: jest.fn(() => Promise.resolve({ total: 6.666 }))
        })
      });

      const total = await calculateTotalDistance(mockDb, 1);

      expect(total).toBe(6.67); // Should be rounded to 2 decimal places
    });
  });
});