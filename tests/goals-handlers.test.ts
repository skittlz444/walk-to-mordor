import { handleGoalsGet, calculateTotalDistance } from '../src/goals-handlers';

describe('Goals Handlers', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = {
      DB: {
        prepare: jest.fn()
      }
    };
  });

  describe('handleGoalsGet', () => {
    it('should return goals successfully', async () => {
      const mockRequest = new Request('https://example.com');
      const mockResults = [
        { distance: 100, title: 'Rivendell', special: true },
        { distance: 200, title: 'Lothlorien', special: false }
      ];

      mockEnv.DB.prepare.mockReturnValue({
        all: jest.fn(() => Promise.resolve({
          results: mockResults
        }))
      });

      const response = await handleGoalsGet(mockRequest, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResults);
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith("SELECT * FROM goals");
    });

    it('should handle database errors', async () => {
      const mockRequest = new Request('https://example.com');
      
      mockEnv.DB.prepare.mockReturnValue({
        all: jest.fn(() => Promise.reject(new Error('Database connection failed')))
      });

      const response = await handleGoalsGet(mockRequest, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error while retrieving goals');
    });
  });

  describe('calculateTotalDistance', () => {
    it('should calculate total distance correctly', async () => {
      const userId = 1;
      const mockResults = [
        { distance: 5.5 },
        { distance: 3.2 },
        { distance: 1.3 }
      ];

      mockEnv.DB.prepare.mockReturnValue({
        bind: jest.fn().mockReturnThis(),
        all: jest.fn(() => Promise.resolve({
          results: mockResults
        }))
      });

      const total = await calculateTotalDistance(mockEnv, userId);

      expect(total).toBe(10); // 5.5 + 3.2 + 1.3 = 10
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith("SELECT * FROM progress WHERE user_id = ?");
    });

    it('should return 0 for no progress entries', async () => {
      const userId = 1;

      mockEnv.DB.prepare.mockReturnValue({
        bind: jest.fn().mockReturnThis(),
        all: jest.fn(() => Promise.resolve({
          results: []
        }))
      });

      const total = await calculateTotalDistance(mockEnv, userId);

      expect(total).toBe(0);
    });

    it('should handle decimal precision correctly', async () => {
      const userId = 1;
      const mockResults = [
        { distance: 1.111 },
        { distance: 2.222 },
        { distance: 3.333 }
      ];

      mockEnv.DB.prepare.mockReturnValue({
        bind: jest.fn().mockReturnThis(),
        all: jest.fn(() => Promise.resolve({
          results: mockResults
        }))
      });

      const total = await calculateTotalDistance(mockEnv, userId);

      expect(total).toBe(6.67); // Should be rounded to 2 decimal places
    });
  });
});