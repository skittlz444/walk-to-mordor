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
        { storyline_goal_id: 10, id: 1, distance: 100, title: 'Rivendell', description: null, special: true, image_id: '1', sort_order: 1 },
        { storyline_goal_id: 11, id: 2, distance: 200, title: 'Lothlorien', description: null, special: false, image_id: '2', sort_order: 2 }
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

      // Mock active user storyline resolution
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          first: jest.fn(() => Promise.resolve({
            id: 1,
            slug: 'frodo-sam',
            title: 'Frodo & Sam',
            description: null,
            path_key: 'fellowship',
            sort_order: 0,
            is_active: 1,
            storyline_distance_offset: 0,
          }))
        })
      });

      // Mock storyline goals query
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn(() => Promise.resolve({
            results: mockResults
          }))
        })
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
      
      // Mock active user storyline resolution
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          first: jest.fn(() => Promise.resolve({
            id: 1,
            slug: 'frodo-sam',
            title: 'Frodo & Sam',
            description: null,
            path_key: 'fellowship',
            sort_order: 0,
            is_active: 1,
            storyline_distance_offset: 0,
          }))
        })
      });

      // Mock storyline goals query to fail
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn(() => Promise.reject(new Error('Database connection failed')))
        })
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

    it('should use explicit storylineId when provided as query param', async () => {
      const mockResults = [
        { storyline_goal_id: 20, id: 3, distance: 300, title: 'Edoras', description: null, special: false, image_id: null, sort_order: 1 },
      ];

      // Mock session validation
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn(() => Promise.resolve({
            results: [{
              id: 'mock-session',
              expires_at: new Date(Date.now() + 86400000).toISOString(),
              user_id: 1,
              approved: 1,
            }],
          })),
        }),
      });

      // Mock requireActiveStoryline: returns storyline row
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          first: jest.fn(() => Promise.resolve({ is_admin: 0 })),
        }),
      });

      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          first: jest.fn(() => Promise.resolve({
            id: 2,
            slug: 'rohan',
            title: 'Rohan',
            description: null,
            path_key: 'rohan',
            sort_order: 1,
            is_active: 1,
            admin_only: 0,
          })),
        }),
      });

      // Mock storyline goals query
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn(() => Promise.resolve({ results: mockResults })),
        }),
      });

      const requestWithStorylineId = new Request('https://example.com?storylineId=2', {
        headers: { 'Authorization': 'Bearer mock-session-token' },
      });

      const response = await handleGoalsGet(requestWithStorylineId, mockDb);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResults);
    });

    it('should return 400 for invalid storylineId query param', async () => {
      // Mock session validation
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn(() => Promise.resolve({
            results: [{
              id: 'mock-session',
              expires_at: new Date(Date.now() + 86400000).toISOString(),
              user_id: 1,
              approved: 1,
            }],
          })),
        }),
      });

      const requestWithBadId = new Request('https://example.com?storylineId=abc', {
        headers: { 'Authorization': 'Bearer mock-session-token' },
      });

      const response = await handleGoalsGet(requestWithBadId, mockDb);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid storylineId');
    });
  });

  describe('calculateTotalDistance', () => {
    it('should calculate total distance correctly', async () => {
      const mockResults = [
        { distance: 5.5 },
        { distance: 3.2 },
        { distance: 1.3 }
      ];

      mockDB.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          all: jest.fn(() => Promise.resolve({
            results: mockResults
          }))
        })
      });

      const total = await calculateTotalDistance(mockDb, 1);

      expect(total).toBe(10); // 5.5 + 3.2 + 1.3 = 10
      expect(mockDB.prepare).toHaveBeenCalledWith("SELECT * FROM progress WHERE user_id = ?");
    });

    it('should return 0 for no progress entries', async () => {
      mockDB.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          all: jest.fn(() => Promise.resolve({
            results: []
          }))
        })
      });

      const total = await calculateTotalDistance(mockDb, 1);

      expect(total).toBe(0);
    });

    it('should handle decimal precision correctly', async () => {
      const mockResults = [
        { distance: 1.111 },
        { distance: 2.222 },
        { distance: 3.333 }
      ];

      mockDB.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          all: jest.fn(() => Promise.resolve({
            results: mockResults
          }))
        })
      });

      const total = await calculateTotalDistance(mockDb, 1);

      expect(total).toBe(6.67); // Should be rounded to 2 decimal places
    });
  });
});