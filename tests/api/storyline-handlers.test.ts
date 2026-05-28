import {
  handleStorylinesList,
  handleUpdateUserStoryline,
  handleUpdatePartyStoryline,
} from '../../src/storyline-handlers';
import { DbClient } from '../../src/db';

// Mock validateSession to avoid complex auth DB setup
jest.mock('../../src/auth-handlers', () => ({
  validateSession: jest.fn(),
}));

// Mock calculateTotalDistance from goals-handlers
jest.mock('../../src/goals-handlers', () => ({
  calculateTotalDistance: jest.fn(),
}));

import { validateSession } from '../../src/auth-handlers';
import { calculateTotalDistance } from '../../src/goals-handlers';

describe('Storyline Handlers', () => {
  let mockDB: { prepare: jest.Mock; batch: jest.Mock };
  let mockDb: DbClient;
  let mockRequest: Request;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();

    mockDB = { prepare: jest.fn(), batch: jest.fn() };
    mockDb = { read: mockDB as unknown as D1Database, write: mockDB as unknown as D1Database };
    mockRequest = new Request('https://example.com', {
      headers: { 'Authorization': 'Bearer mock-token' },
    });

    // Default: authenticated as userId 1
    (validateSession as jest.Mock).mockResolvedValue({ valid: true, userId: 1 });
  });

  const mockStorylineRow = {
    id: 1,
    slug: 'frodo-sam',
    title: 'Frodo & Sam',
    description: null,
    path_key: 'fellowship',
    sort_order: 0,
    is_active: 1,
    admin_only: 0,
    storyline_distance_offset: 0,
  };

  function mockAdminStatus(isAdmin = false) {
    mockDB.prepare.mockReturnValueOnce({
      bind: jest.fn().mockReturnValue({
        first: jest.fn(() => Promise.resolve({ is_admin: isAdmin ? 1 : 0 })),
      }),
    });
  }

  describe('handleStorylinesList', () => {
    it('returns a list of active storylines', async () => {
      mockAdminStatus(false);
      mockDB.prepare.mockReturnValueOnce({
        all: jest.fn(() => Promise.resolve({ results: [mockStorylineRow] })),
      });

      const response = await handleStorylinesList(mockRequest, mockDb);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.storylines).toHaveLength(1);
      expect(data.storylines[0].slug).toBe('frodo-sam');
      expect(data.storylines[0].pathKey).toBe('fellowship');
      expect(data.storylines[0].adminOnly).toBe(false);
    });

    it('includes admin-only storylines for admins', async () => {
      mockAdminStatus(true);
      mockDB.prepare.mockReturnValueOnce({
        all: jest.fn(() => Promise.resolve({ results: [mockStorylineRow, { ...mockStorylineRow, id: 2, slug: 'draft', admin_only: 1 }] })),
      });

      const response = await handleStorylinesList(mockRequest, mockDb);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.storylines).toHaveLength(2);
      expect(data.storylines[1].adminOnly).toBe(true);
    });

    it('returns 401 when session is invalid', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      });

      const response = await handleStorylinesList(mockRequest, mockDb);
      expect(response.status).toBe(401);
    });

    it('returns 500 on database error', async () => {
      mockAdminStatus(false);
      mockDB.prepare.mockReturnValueOnce({
        all: jest.fn(() => Promise.reject(new Error('DB error'))),
      });

      const response = await handleStorylinesList(mockRequest, mockDb);
      expect(response.status).toBe(500);
    });
  });

  describe('handleUpdateUserStoryline', () => {
    function setupUserStorylineSwitch() {
      // isUserAdmin
      mockAdminStatus(false);
      // requireActiveStoryline
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          first: jest.fn(() => Promise.resolve(mockStorylineRow)),
        }),
      });
      // calculateTotalDistance (mocked at module level)
      (calculateTotalDistance as jest.Mock).mockResolvedValue(100);
      // resolveUserStoryline
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          first: jest.fn(() => Promise.resolve({ ...mockStorylineRow, storyline_distance_offset: 0 })),
        }),
      });
      // UPDATE users
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ run: jest.fn(() => Promise.resolve({})) }),
      });
    }

    it('switches storyline with reset mode (offset = -rawDistance)', async () => {
      setupUserStorylineSwitch();

      const response = await handleUpdateUserStoryline(
        mockRequest, mockDb, { storylineId: 1, mode: 'reset' },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalDistance).toBe(0); // rawDistance 100 + offset -100 = 0
      expect(data.rawTotalDistance).toBe(100);
      expect(data.activeStoryline.slug).toBe('frodo-sam');
    });

    it('switches storyline with carry mode (displayed distance preserved)', async () => {
      // Set up offset of -10 meaning displayed = 90
      mockAdminStatus(false);
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          first: jest.fn(() => Promise.resolve(mockStorylineRow)),
        }),
      });
      (calculateTotalDistance as jest.Mock).mockResolvedValue(100);
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          first: jest.fn(() => Promise.resolve({ ...mockStorylineRow, storyline_distance_offset: -10 })),
        }),
      });
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ run: jest.fn(() => Promise.resolve({})) }),
      });

      const response = await handleUpdateUserStoryline(
        mockRequest, mockDb, { storylineId: 1, mode: 'carry' },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalDistance).toBe(90); // carry: displayed 90 stays 90
    });

    it('returns 400 for missing body fields', async () => {
      const response = await handleUpdateUserStoryline(mockRequest, mockDb, {});
      expect(response.status).toBe(400);
    });

    it('returns 404 when storyline not found', async () => {
      mockAdminStatus(false);
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ first: jest.fn(() => Promise.resolve(null)) }),
      });

      const response = await handleUpdateUserStoryline(
        mockRequest, mockDb, { storylineId: 99, mode: 'reset' },
      );
      expect(response.status).toBe(404);
    });

    it('lets admins switch to admin-only storylines', async () => {
      mockAdminStatus(true);
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          first: jest.fn(() => Promise.resolve({ ...mockStorylineRow, id: 2, slug: 'draft', admin_only: 1 })),
        }),
      });
      (calculateTotalDistance as jest.Mock).mockResolvedValue(100);
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          first: jest.fn(() => Promise.resolve({ ...mockStorylineRow, storyline_distance_offset: 0 })),
        }),
      });
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ run: jest.fn(() => Promise.resolve({})) }),
      });

      const response = await handleUpdateUserStoryline(
        mockRequest, mockDb, { storylineId: 2, mode: 'reset' },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.activeStoryline.adminOnly).toBe(true);
    });
  });

  describe('handleUpdatePartyStoryline', () => {
    function setupPartyStorylineSwitch() {
      // Party lookup
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          first: jest.fn(() => Promise.resolve({
            id: 5, leader_id: 1, distance_mode: 'cumulative', dissolved_at: null,
          })),
        }),
      });
      // isUserAdmin
      mockAdminStatus(false);
      // requireActiveStoryline
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          first: jest.fn(() => Promise.resolve(mockStorylineRow)),
        }),
      });
      // calculatePartyRawTotalDistance
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn(() => Promise.resolve({
            results: [
              { distance_at_join: 0, total_distance: 80, status: 'active', contribution_at_departure: null },
            ],
          })),
        }),
      });
      // resolvePartyStoryline
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          first: jest.fn(() => Promise.resolve({ ...mockStorylineRow, storyline_distance_offset: 0 })),
        }),
      });
      // batch update
      mockDB.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({ run: jest.fn(() => Promise.resolve({})) }),
      });
      mockDB.batch.mockResolvedValue([{}, {}]);
    }

    it('switches party storyline when user is leader', async () => {
      setupPartyStorylineSwitch();

      const response = await handleUpdatePartyStoryline(
        mockRequest, mockDb, 5, { storylineId: 1, mode: 'reset' },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.partyId).toBe(5);
      expect(data.rawTotalDistance).toBe(80);
    });

    it('returns 403 when user is not party leader', async () => {
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          first: jest.fn(() => Promise.resolve({
            id: 5, leader_id: 999, distance_mode: 'cumulative', dissolved_at: null,
          })),
        }),
      });

      const response = await handleUpdatePartyStoryline(
        mockRequest, mockDb, 5, { storylineId: 1, mode: 'reset' },
      );
      expect(response.status).toBe(403);
    });

    it('returns 404 when party not found', async () => {
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ first: jest.fn(() => Promise.resolve(null)) }),
      });

      const response = await handleUpdatePartyStoryline(
        mockRequest, mockDb, 99, { storylineId: 1, mode: 'reset' },
      );
      expect(response.status).toBe(404);
    });

    it('returns 400 when party is dissolved', async () => {
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          first: jest.fn(() => Promise.resolve({
            id: 5, leader_id: 1, distance_mode: 'cumulative', dissolved_at: '2026-05-20T00:00:00.000Z',
          })),
        }),
      });

      const response = await handleUpdatePartyStoryline(
        mockRequest, mockDb, 5, { storylineId: 1, mode: 'reset' },
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('This party has been dissolved');
    });

    it('returns 400 for invalid mode', async () => {
      const response = await handleUpdatePartyStoryline(
        mockRequest, mockDb, 5, { storylineId: 1, mode: 'invalid' },
      );
      expect(response.status).toBe(400);
    });
  });
});
