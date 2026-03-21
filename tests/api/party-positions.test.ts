import { handlePartyPositions } from '../../src/party-handlers';
import { validateSession } from '../../src/auth-handlers';
import { DbClient } from '../../src/db';

// Mock dependencies
jest.mock('../../src/auth-handlers');
jest.mock('../../src/goals-handlers');

describe('handlePartyPositions (GET /api/user/parties/positions)', () => {
  let mockDB: Record<string, jest.Mock>;
  let mockDb: DbClient;
  let mockRequest: { headers: { get: jest.Mock }; url: string };

  // Reusable chainable mock builder
  function createChainableMock(overrides?: {
    first?: jest.Mock;
    all?: jest.Mock;
    run?: jest.Mock;
  }) {
    const first = overrides?.first ?? jest.fn().mockResolvedValue(null);
    const all = overrides?.all ?? jest.fn().mockResolvedValue({ results: [] });
    const run = overrides?.run ?? jest.fn().mockResolvedValue({ meta: { changes: 1 } });
    const bind = jest.fn(() => ({ run, all, first }));
    return { bind, run, all, first };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (validateSession as jest.Mock).mockResolvedValue({ valid: true, userId: 1 });

    mockDB = {
      prepare: jest.fn(() => createChainableMock()),
      batch: jest.fn().mockResolvedValue([]),
    };
    mockDb = { read: mockDB as unknown as D1Database, write: mockDB as unknown as D1Database };

    mockRequest = {
      headers: { get: jest.fn() },
      url: 'https://example.com/api/user/parties/positions',
    };
  });

  it('should return 401 if session is invalid', async () => {
    (validateSession as jest.Mock).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    });

    const response = await handlePartyPositions(mockRequest as unknown as Request, mockDb);
    expect(response.status).toBe(401);
  });

  it('should return empty fellowships array when user has no parties', async () => {
    // parties query returns empty
    mockDB.prepare.mockReturnValueOnce(createChainableMock({
      all: jest.fn().mockResolvedValue({ results: [] }),
    }));

    const response = await handlePartyPositions(mockRequest as unknown as Request, mockDb);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.fellowships).toEqual([]);
  });

  it('should return fellowship positions with calculated total distance (incremental mode)', async () => {
    // First call: parties query
    mockDB.prepare.mockReturnValueOnce(createChainableMock({
      all: jest.fn().mockResolvedValue({
        results: [
          { party_id: 1, name: 'Fellowship A', distance_mode: 'incremental' },
        ],
      }),
    }));

    // Second call: members query for party 1
    mockDB.prepare.mockReturnValueOnce(createChainableMock({
      all: jest.fn().mockResolvedValue({
        results: [
          { user_id: 1, distance_at_join: 50, total_distance: 150, status: 'active', contribution_at_departure: null, distance_kept: null },
          { user_id: 2, distance_at_join: 30, total_distance: 100, status: 'active', contribution_at_departure: null, distance_kept: null },
        ],
      }),
    }));

    const response = await handlePartyPositions(mockRequest as unknown as Request, mockDb);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.fellowships).toHaveLength(1);
    expect(body.fellowships[0].party_id).toBe(1);
    expect(body.fellowships[0].name).toBe('Fellowship A');
    // Incremental: (150-50) + (100-30) = 100 + 70 = 170
    expect(body.fellowships[0].total_distance).toBe(170);
  });

  it('should return fellowship positions with calculated total distance (cumulative mode)', async () => {
    // First call: parties query
    mockDB.prepare.mockReturnValueOnce(createChainableMock({
      all: jest.fn().mockResolvedValue({
        results: [
          { party_id: 2, name: 'Fellowship B', distance_mode: 'cumulative' },
        ],
      }),
    }));

    // Second call: members query for party 2
    mockDB.prepare.mockReturnValueOnce(createChainableMock({
      all: jest.fn().mockResolvedValue({
        results: [
          { user_id: 1, distance_at_join: 50, total_distance: 150, status: 'active', contribution_at_departure: null, distance_kept: null },
          { user_id: 2, distance_at_join: 30, total_distance: 100, status: 'active', contribution_at_departure: null, distance_kept: null },
        ],
      }),
    }));

    const response = await handlePartyPositions(mockRequest as unknown as Request, mockDb);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.fellowships).toHaveLength(1);
    expect(body.fellowships[0].party_id).toBe(2);
    expect(body.fellowships[0].name).toBe('Fellowship B');
    // Cumulative: 150 + 100 = 250
    expect(body.fellowships[0].total_distance).toBe(250);
  });

  it('should include departed member contributions when distance_kept is true', async () => {
    // First call: parties query
    mockDB.prepare.mockReturnValueOnce(createChainableMock({
      all: jest.fn().mockResolvedValue({
        results: [
          { party_id: 3, name: 'Fellowship C', distance_mode: 'incremental' },
        ],
      }),
    }));

    // Second call: members query for party 3 (includes departed member)
    mockDB.prepare.mockReturnValueOnce(createChainableMock({
      all: jest.fn().mockResolvedValue({
        results: [
          { user_id: 1, distance_at_join: 10, total_distance: 60, status: 'active', contribution_at_departure: null, distance_kept: null },
          { user_id: 3, distance_at_join: 20, total_distance: 0, status: 'left', contribution_at_departure: 30, distance_kept: 1 },
        ],
      }),
    }));

    const response = await handlePartyPositions(mockRequest as unknown as Request, mockDb);
    expect(response.status).toBe(200);
    const body = await response.json();
    // Active: (60-10) = 50, Departed kept: 30, Total = 80
    expect(body.fellowships[0].total_distance).toBe(80);
  });

  it('should handle multiple parties correctly', async () => {
    // First call: parties query returns 2 parties
    mockDB.prepare.mockReturnValueOnce(createChainableMock({
      all: jest.fn().mockResolvedValue({
        results: [
          { party_id: 1, name: 'Party Alpha', distance_mode: 'incremental' },
          { party_id: 2, name: 'Party Beta', distance_mode: 'cumulative' },
        ],
      }),
    }));

    // Second call: members for party 1
    mockDB.prepare.mockReturnValueOnce(createChainableMock({
      all: jest.fn().mockResolvedValue({
        results: [
          { user_id: 1, distance_at_join: 0, total_distance: 100, status: 'active', contribution_at_departure: null, distance_kept: null },
        ],
      }),
    }));

    // Third call: members for party 2
    mockDB.prepare.mockReturnValueOnce(createChainableMock({
      all: jest.fn().mockResolvedValue({
        results: [
          { user_id: 1, distance_at_join: 0, total_distance: 200, status: 'active', contribution_at_departure: null, distance_kept: null },
        ],
      }),
    }));

    const response = await handlePartyPositions(mockRequest as unknown as Request, mockDb);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.fellowships).toHaveLength(2);
    // Incremental: 100 - 0 = 100
    expect(body.fellowships[0].total_distance).toBe(100);
    // Cumulative: 200
    expect(body.fellowships[1].total_distance).toBe(200);
  });

  it('should handle negative incremental contributions as zero', async () => {
    // First call: parties query
    mockDB.prepare.mockReturnValueOnce(createChainableMock({
      all: jest.fn().mockResolvedValue({
        results: [
          { party_id: 1, name: 'Fellowship', distance_mode: 'incremental' },
        ],
      }),
    }));

    // Second call: member with total_distance < distance_at_join (shouldn't happen but edge case)
    mockDB.prepare.mockReturnValueOnce(createChainableMock({
      all: jest.fn().mockResolvedValue({
        results: [
          { user_id: 1, distance_at_join: 100, total_distance: 50, status: 'active', contribution_at_departure: null, distance_kept: null },
        ],
      }),
    }));

    const response = await handlePartyPositions(mockRequest as unknown as Request, mockDb);
    expect(response.status).toBe(200);
    const body = await response.json();
    // Max(0, 50-100) = 0
    expect(body.fellowships[0].total_distance).toBe(0);
  });

  it('should return 500 on database error', async () => {
    // Simulate database error
    mockDB.prepare.mockReturnValueOnce({
      bind: jest.fn(() => ({
        all: jest.fn().mockRejectedValue(new Error('DB error')),
        first: jest.fn().mockRejectedValue(new Error('DB error')),
        run: jest.fn().mockRejectedValue(new Error('DB error')),
      })),
    });

    const response = await handlePartyPositions(mockRequest as unknown as Request, mockDb);
    expect(response.status).toBe(500);
  });
});
