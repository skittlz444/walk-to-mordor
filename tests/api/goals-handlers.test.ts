import { handleGoalsGet, calculateTotalDistance } from '../../src/goals-handlers';

describe('Goals Handlers', () => {
  let mockEnv: any;
  let mockRequest: Request;

  beforeEach(() => {
    mockEnv = {
      DB: {
        prepare: jest.fn()
      }
    };
    
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
      mockEnv.DB.prepare.mockReturnValueOnce({
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
      mockEnv.DB.prepare.mockReturnValueOnce({
        all: jest.fn(() => Promise.resolve({
          results: mockResults
        }))
      });

      const response = await handleGoalsGet(mockRequest, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResults);
    });

    it('should handle database errors', async () => {
      // Mock session validation
      mockEnv.DB.prepare.mockReturnValueOnce({
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
      mockEnv.DB.prepare.mockReturnValueOnce({
        all: jest.fn(() => Promise.reject(new Error('Database connection failed')))
      });

      const response = await handleGoalsGet(mockRequest, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error while retrieving goals');
    });

    it('should reject requests without authentication', async () => {
      const unauthRequest = new Request('https://example.com');
      const response = await handleGoalsGet(unauthRequest, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Missing or invalid authorization header');
    });
  });

  describe('calculateTotalDistance', () => {
    it('should calculate total distance correctly', async () => {
      const mockResults = [
        { distance: 5.5 },
        { distance: 3.2 },
        { distance: 1.3 }
      ];

      mockEnv.DB.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          all: jest.fn(() => Promise.resolve({
            results: mockResults
          }))
        })
      });

      const total = await calculateTotalDistance(mockEnv, 1);

      expect(total).toBe(10); // 5.5 + 3.2 + 1.3 = 10
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith("SELECT * FROM progress WHERE user_id = ?");
    });

    it('should return 0 for no progress entries', async () => {
      mockEnv.DB.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          all: jest.fn(() => Promise.resolve({
            results: []
          }))
        })
      });

      const total = await calculateTotalDistance(mockEnv, 1);

      expect(total).toBe(0);
    });

    it('should handle decimal precision correctly', async () => {
      const mockResults = [
        { distance: 1.111 },
        { distance: 2.222 },
        { distance: 3.333 }
      ];

      mockEnv.DB.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          all: jest.fn(() => Promise.resolve({
            results: mockResults
          }))
        })
      });

      const total = await calculateTotalDistance(mockEnv, 1);

      expect(total).toBe(6.67); // Should be rounded to 2 decimal places
    });
  });
});