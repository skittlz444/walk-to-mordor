import { handleCreateParty, generateInviteCode, handlePreviewParty, handleJoinParty, handleRegenerateInvite, handleGetUserParties } from '../../src/party-handlers';
import { validateSession } from '../../src/auth-handlers';
import { calculateTotalDistance } from '../../src/goals-handlers';

// Mock dependencies
jest.mock('../../src/auth-handlers');
jest.mock('../../src/goals-handlers');

describe('Party Handlers', () => {
  let mockEnv: any;
  let mockRequest: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    (validateSession as jest.Mock).mockResolvedValue({ valid: true, userId: 1 });
    (calculateTotalDistance as jest.Mock).mockResolvedValue(42.5);

    // Mock DB with chainable methods
    const mockFirst = jest.fn().mockResolvedValue(null);
    const mockRun = jest.fn().mockResolvedValue({ meta: { changes: 1 } });
    const mockAll = jest.fn().mockResolvedValue({ results: [] });
    const mockBind = jest.fn(() => ({
      run: mockRun,
      all: mockAll,
      first: mockFirst
    }));

    mockEnv = {
      DB: {
        prepare: jest.fn(() => ({
          bind: mockBind,
          run: mockRun,
          all: mockAll,
          first: mockFirst
        })),
        batch: jest.fn().mockResolvedValue([
          { meta: { last_row_id: 1, changes: 1 } },
          { meta: { changes: 1 } }
        ])
      }
    };

    mockRequest = {
      headers: {
        get: jest.fn()
      }
    };
  });

  describe('generateInviteCode', () => {
    it('should generate an 8-character alphanumeric code', () => {
      const code = generateInviteCode();
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[A-Za-z0-9]{8}$/);
    });

    it('should generate unique codes on subsequent calls', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateInviteCode());
      }
      // With 62^8 possibilities, 100 codes should all be unique
      expect(codes.size).toBe(100);
    });
  });

  describe('handleCreateParty', () => {
    it('should return 401 if session is invalid', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' }
        })
      });

      const response = await handleCreateParty(mockRequest, mockEnv, { name: 'Test Party' });
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 if name is missing', async () => {
      const response = await handleCreateParty(mockRequest, mockEnv, {});
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required field: name');
    });

    it('should return 400 if name is empty string', async () => {
      const response = await handleCreateParty(mockRequest, mockEnv, { name: '' });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required field: name');
    });

    it('should return 400 if name is only whitespace', async () => {
      const response = await handleCreateParty(mockRequest, mockEnv, { name: '   ' });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required field: name');
    });

    it('should return 400 if name is not a string', async () => {
      const response = await handleCreateParty(mockRequest, mockEnv, { name: 123 });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required field: name');
    });

    it('should return 400 if name exceeds 50 characters', async () => {
      const longName = 'A'.repeat(51);
      const response = await handleCreateParty(mockRequest, mockEnv, { name: longName });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Name must be 50 characters or less');
    });

    it('should accept name of exactly 50 characters', async () => {
      const exactName = 'A'.repeat(50);

      // Setup mock to return created party
      const mockParty = {
        id: 1,
        name: exactName,
        leader_id: 1,
        created_at: '2026-01-01T00:00:00Z',
        invite_code: 'AbCd1234',
        distance_mode: 'incremental',
        leave_distance_behavior: 'keep'
      };

      // Mock the first() call for invite code check (null = no collision)
      // and the final party fetch
      const mockBind = jest.fn();
      const mockFirst = jest.fn()
        .mockResolvedValueOnce(null) // invite code check
        .mockResolvedValueOnce(mockParty); // fetch created party
      mockBind.mockReturnValue({
        run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
        all: jest.fn().mockResolvedValue({ results: [] }),
        first: mockFirst
      });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleCreateParty(mockRequest, mockEnv, { name: exactName });
      expect(response.status).toBe(201);
    });

    it('should return 400 if distance_mode is invalid', async () => {
      const response = await handleCreateParty(mockRequest, mockEnv, {
        name: 'Test Party',
        distance_mode: 'invalid'
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid distance_mode');
    });

    it('should return 400 if leave_distance_behavior is invalid', async () => {
      const response = await handleCreateParty(mockRequest, mockEnv, {
        name: 'Test Party',
        leave_distance_behavior: 'invalid'
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid leave_distance_behavior');
    });

    it('should default distance_mode to incremental when not provided', async () => {
      const mockParty = {
        id: 1,
        name: 'Test Party',
        leader_id: 1,
        created_at: '2026-01-01T00:00:00Z',
        invite_code: 'AbCd1234',
        distance_mode: 'incremental',
        leave_distance_behavior: 'keep'
      };

      const mockFirst = jest.fn()
        .mockResolvedValueOnce(null) // invite code check
        .mockResolvedValueOnce(mockParty); // fetch created party
      const mockBind = jest.fn().mockReturnValue({
        run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
        all: jest.fn().mockResolvedValue({ results: [] }),
        first: mockFirst
      });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleCreateParty(mockRequest, mockEnv, { name: 'Test Party' });
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.distance_mode).toBe('incremental');
    });

    it('should default leave_distance_behavior to keep when not provided', async () => {
      const mockParty = {
        id: 1,
        name: 'Test Party',
        leader_id: 1,
        created_at: '2026-01-01T00:00:00Z',
        invite_code: 'AbCd1234',
        distance_mode: 'incremental',
        leave_distance_behavior: 'keep'
      };

      const mockFirst = jest.fn()
        .mockResolvedValueOnce(null) // invite code check
        .mockResolvedValueOnce(mockParty); // fetch created party
      const mockBind = jest.fn().mockReturnValue({
        run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
        all: jest.fn().mockResolvedValue({ results: [] }),
        first: mockFirst
      });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleCreateParty(mockRequest, mockEnv, { name: 'Test Party' });
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.leave_distance_behavior).toBe('keep');
    });

    it('should accept cumulative distance_mode', async () => {
      const mockParty = {
        id: 1,
        name: 'Test Party',
        leader_id: 1,
        created_at: '2026-01-01T00:00:00Z',
        invite_code: 'AbCd1234',
        distance_mode: 'cumulative',
        leave_distance_behavior: 'keep'
      };

      const mockFirst = jest.fn()
        .mockResolvedValueOnce(null) // invite code check
        .mockResolvedValueOnce(mockParty); // fetch created party
      const mockBind = jest.fn().mockReturnValue({
        run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
        all: jest.fn().mockResolvedValue({ results: [] }),
        first: mockFirst
      });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleCreateParty(mockRequest, mockEnv, {
        name: 'Test Party',
        distance_mode: 'cumulative'
      });
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.distance_mode).toBe('cumulative');
    });

    it('should accept remove leave_distance_behavior', async () => {
      const mockParty = {
        id: 1,
        name: 'Test Party',
        leader_id: 1,
        created_at: '2026-01-01T00:00:00Z',
        invite_code: 'AbCd1234',
        distance_mode: 'incremental',
        leave_distance_behavior: 'remove'
      };

      const mockFirst = jest.fn()
        .mockResolvedValueOnce(null) // invite code check
        .mockResolvedValueOnce(mockParty); // fetch created party
      const mockBind = jest.fn().mockReturnValue({
        run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
        all: jest.fn().mockResolvedValue({ results: [] }),
        first: mockFirst
      });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleCreateParty(mockRequest, mockEnv, {
        name: 'Test Party',
        leave_distance_behavior: 'remove'
      });
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.leave_distance_behavior).toBe('remove');
    });

    it('should create party successfully with all fields', async () => {
      const mockParty = {
        id: 1,
        name: 'The Fellowship',
        leader_id: 1,
        created_at: '2026-01-01T00:00:00Z',
        invite_code: 'XyZ12345',
        distance_mode: 'cumulative',
        leave_distance_behavior: 'remove'
      };

      const mockFirst = jest.fn()
        .mockResolvedValueOnce(null) // invite code uniqueness check
        .mockResolvedValueOnce(mockParty); // fetch created party
      const mockBind = jest.fn().mockReturnValue({
        run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
        all: jest.fn().mockResolvedValue({ results: [] }),
        first: mockFirst
      });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleCreateParty(mockRequest, mockEnv, {
        name: 'The Fellowship',
        distance_mode: 'cumulative',
        leave_distance_behavior: 'remove'
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBe(1);
      expect(data.name).toBe('The Fellowship');
      expect(data.leader_id).toBe(1);
      expect(data.invite_code).toBe('XyZ12345');
      expect(data.distance_mode).toBe('cumulative');
      expect(data.leave_distance_behavior).toBe('remove');
      expect(data.created_at).toBeDefined();
    });

    it('should call calculateTotalDistance for distance_at_join', async () => {
      const mockParty = {
        id: 1,
        name: 'Test Party',
        leader_id: 1,
        created_at: '2026-01-01T00:00:00Z',
        invite_code: 'AbCd1234',
        distance_mode: 'incremental',
        leave_distance_behavior: 'keep'
      };

      const mockFirst = jest.fn()
        .mockResolvedValueOnce(null) // invite code check
        .mockResolvedValueOnce(mockParty); // fetch created party
      const mockBind = jest.fn().mockReturnValue({
        run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
        all: jest.fn().mockResolvedValue({ results: [] }),
        first: mockFirst
      });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      await handleCreateParty(mockRequest, mockEnv, { name: 'Test Party' });

      expect(calculateTotalDistance).toHaveBeenCalledWith(mockEnv, 1);
    });

    it('should use D1 batch for atomic creation', async () => {
      const mockParty = {
        id: 1,
        name: 'Test Party',
        leader_id: 1,
        created_at: '2026-01-01T00:00:00Z',
        invite_code: 'AbCd1234',
        distance_mode: 'incremental',
        leave_distance_behavior: 'keep'
      };

      const mockFirst = jest.fn()
        .mockResolvedValueOnce(null) // invite code check
        .mockResolvedValueOnce(mockParty); // fetch created party
      const mockBind = jest.fn().mockReturnValue({
        run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
        all: jest.fn().mockResolvedValue({ results: [] }),
        first: mockFirst
      });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      await handleCreateParty(mockRequest, mockEnv, { name: 'Test Party' });

      // Verify batch was called with 2 statements (party insert + member insert)
      expect(mockEnv.DB.batch).toHaveBeenCalledTimes(1);
      const batchArgs = mockEnv.DB.batch.mock.calls[0][0];
      expect(batchArgs).toHaveLength(2);
    });

    it('should handle database errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      try {
        const mockFirst = jest.fn().mockResolvedValueOnce(null); // invite code check
        const mockBind = jest.fn().mockReturnValue({
          run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
          all: jest.fn().mockResolvedValue({ results: [] }),
          first: mockFirst
        });
        mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });
        mockEnv.DB.batch.mockRejectedValueOnce(new Error('DB error'));

        const response = await handleCreateParty(mockRequest, mockEnv, { name: 'Test Party' });
        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toBe('Internal server error while creating party');
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('should return 500 if party cannot be retrieved after creation', async () => {
      const mockFirst = jest.fn()
        .mockResolvedValueOnce(null) // invite code check
        .mockResolvedValueOnce(null); // party fetch returns null
      const mockBind = jest.fn().mockReturnValue({
        run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
        all: jest.fn().mockResolvedValue({ results: [] }),
        first: mockFirst
      });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleCreateParty(mockRequest, mockEnv, { name: 'Test Party' });
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to retrieve created party');
    });

    it('should handle null body gracefully', async () => {
      const response = await handleCreateParty(mockRequest, mockEnv, null as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required field: name');
    });

    it('should trim whitespace from name', async () => {
      const mockParty = {
        id: 1,
        name: 'Trimmed Name',
        leader_id: 1,
        created_at: '2026-01-01T00:00:00Z',
        invite_code: 'AbCd1234',
        distance_mode: 'incremental',
        leave_distance_behavior: 'keep'
      };

      const mockFirst = jest.fn()
        .mockResolvedValueOnce(null) // invite code check
        .mockResolvedValueOnce(mockParty); // fetch created party
      const mockBind = jest.fn().mockReturnValue({
        run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
        all: jest.fn().mockResolvedValue({ results: [] }),
        first: mockFirst
      });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleCreateParty(mockRequest, mockEnv, { name: '  Trimmed Name  ' });
      expect(response.status).toBe(201);
      // Verify the trimmed name was used in the SQL bind call
      expect(mockBind).toHaveBeenCalledWith(
        'Trimmed Name',
        expect.any(Number),
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should retry invite code generation on collision', async () => {
      const mockParty = {
        id: 1,
        name: 'Test Party',
        leader_id: 1,
        created_at: '2026-01-01T00:00:00Z',
        invite_code: 'NewCode1',
        distance_mode: 'incremental',
        leave_distance_behavior: 'keep'
      };

      // First invite code check returns existing (collision), second returns null (unique)
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 99 }) // first code collides
        .mockResolvedValueOnce(null)        // second code is unique
        .mockResolvedValueOnce(mockParty);  // fetch created party
      const mockBind = jest.fn().mockReturnValue({
        run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
        all: jest.fn().mockResolvedValue({ results: [] }),
        first: mockFirst
      });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleCreateParty(mockRequest, mockEnv, { name: 'Test Party' });
      expect(response.status).toBe(201);
    });

    it('should return 500 after exhausting invite code retries', async () => {
      // All invite code checks return existing (collision)
      const mockFirst = jest.fn().mockResolvedValue({ id: 99 });
      const mockBind = jest.fn().mockReturnValue({
        run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
        all: jest.fn().mockResolvedValue({ results: [] }),
        first: mockFirst
      });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleCreateParty(mockRequest, mockEnv, { name: 'Test Party' });
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Failed to generate unique invite code');
    });

    it('should retry on invite_code UNIQUE constraint violation during batch insert', async () => {
      const mockParty = {
        id: 1,
        name: 'Test Party',
        leader_id: 1,
        created_at: '2026-01-01T00:00:00Z',
        invite_code: 'NewCode1',
        distance_mode: 'incremental',
        leave_distance_behavior: 'keep'
      };

      // Both pre-checks pass (no collision), but first batch fails with UNIQUE violation
      const mockFirst = jest.fn()
        .mockResolvedValueOnce(null) // first invite code pre-check passes
        .mockResolvedValueOnce(null) // second invite code pre-check passes
        .mockResolvedValueOnce(mockParty); // fetch created party on second attempt
      const mockBind = jest.fn().mockReturnValue({
        run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
        all: jest.fn().mockResolvedValue({ results: [] }),
        first: mockFirst
      });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });
      mockEnv.DB.batch
        .mockRejectedValueOnce(new Error('UNIQUE constraint failed: parties.invite_code'))
        .mockResolvedValueOnce([
          { meta: { last_row_id: 1, changes: 1 } },
          { meta: { changes: 1 } }
        ]);

      const response = await handleCreateParty(mockRequest, mockEnv, { name: 'Test Party' });
      expect(response.status).toBe(201);
      expect(mockEnv.DB.batch).toHaveBeenCalledTimes(2);
    });

    it('should return 409 after exhausting UNIQUE constraint retries', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      try {
        // All pre-checks pass but all batch inserts fail with UNIQUE violation
        const mockFirst = jest.fn().mockResolvedValue(null);
        const mockBind = jest.fn().mockReturnValue({
          run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
          all: jest.fn().mockResolvedValue({ results: [] }),
          first: mockFirst
        });
        mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });
        mockEnv.DB.batch.mockRejectedValue(new Error('UNIQUE constraint failed: parties.invite_code'));

        const response = await handleCreateParty(mockRequest, mockEnv, { name: 'Test Party' });
        expect(response.status).toBe(409);
        const data = await response.json();
        expect(data.error).toContain('Could not generate a unique invite code');
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });

  describe('handlePreviewParty', () => {
    it('should return 404 for non-existent invite code', async () => {
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handlePreviewParty(mockRequest, mockEnv, 'BADCODE1');
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Invalid invite code');
    });

    it('should return 400 for dissolved party', async () => {
      const mockFirst = jest.fn().mockResolvedValue({
        id: 1, name: 'Old Party', distance_mode: 'incremental',
        leave_distance_behavior: 'keep', dissolved_at: '2026-01-01T00:00:00Z'
      });
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handlePreviewParty(mockRequest, mockEnv, 'AbCd1234');
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('This party has been dissolved');
    });

    it('should return party preview with member count', async () => {
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({
          id: 1, name: 'The Fellowship', distance_mode: 'incremental',
          leave_distance_behavior: 'keep', dissolved_at: null
        })
        .mockResolvedValueOnce({ count: 3 });
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handlePreviewParty(mockRequest, mockEnv, 'AbCd1234');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.name).toBe('The Fellowship');
      expect(data.member_count).toBe(3);
      expect(data.distance_mode).toBe('incremental');
      expect(data.leave_distance_behavior).toBe('keep');
    });

    it('should handle database errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const mockBind = jest.fn().mockReturnValue({
          first: jest.fn().mockRejectedValue(new Error('DB error'))
        });
        mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

        const response = await handlePreviewParty(mockRequest, mockEnv, 'AbCd1234');
        expect(response.status).toBe(500);
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });

  describe('handleJoinParty', () => {
    it('should return 401 if session is invalid', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { 'content-type': 'application/json' }
        })
      });

      const response = await handleJoinParty(mockRequest, mockEnv, 'AbCd1234');
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent invite code', async () => {
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleJoinParty(mockRequest, mockEnv, 'BADCODE1');
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Invalid invite code');
    });

    it('should return 400 for dissolved party', async () => {
      const mockFirst = jest.fn().mockResolvedValue({
        id: 1, name: 'Old Party', dissolved_at: '2026-01-01T00:00:00Z'
      });
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleJoinParty(mockRequest, mockEnv, 'AbCd1234');
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('This party has been dissolved');
    });

    it('should return 400 if already an active member', async () => {
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, name: 'Party', dissolved_at: null }) // party lookup
        .mockResolvedValueOnce({ id: 10, status: 'active' }); // existing member
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleJoinParty(mockRequest, mockEnv, 'AbCd1234');
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('You are already an active member of this party');
    });

    it('should re-join if previously left', async () => {
      const mockRun = jest.fn().mockResolvedValue({ meta: { changes: 1 } });
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, name: 'Party', dissolved_at: null }) // party lookup
        .mockResolvedValueOnce({ id: 10, status: 'left' }); // existing departed member
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst, run: mockRun });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleJoinParty(mockRequest, mockEnv, 'AbCd1234');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.party_id).toBe(1);
      expect(data.rejoined).toBe(true);
      expect(calculateTotalDistance).toHaveBeenCalled();
    });

    it('should re-join if previously kicked', async () => {
      const mockRun = jest.fn().mockResolvedValue({ meta: { changes: 1 } });
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, name: 'Party', dissolved_at: null }) // party lookup
        .mockResolvedValueOnce({ id: 10, status: 'kicked' }); // existing kicked member
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst, run: mockRun });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleJoinParty(mockRequest, mockEnv, 'AbCd1234');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.rejoined).toBe(true);
    });

    it('should join as new member if no existing membership', async () => {
      const mockRun = jest.fn().mockResolvedValue({ meta: { changes: 1 } });
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, name: 'Party', dissolved_at: null }) // party lookup
        .mockResolvedValueOnce(null); // no existing member
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst, run: mockRun });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleJoinParty(mockRequest, mockEnv, 'AbCd1234');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.party_id).toBe(1);
      expect(data.party_name).toBe('Party');
      expect(data.rejoined).toBe(false);
      expect(calculateTotalDistance).toHaveBeenCalledWith(mockEnv, 1);
    });

    it('should handle database errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const mockBind = jest.fn().mockReturnValue({
          first: jest.fn().mockRejectedValue(new Error('DB error'))
        });
        mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

        const response = await handleJoinParty(mockRequest, mockEnv, 'AbCd1234');
        expect(response.status).toBe(500);
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });

  describe('handleRegenerateInvite', () => {
    let mockRequestWithUrl: any;

    beforeEach(() => {
      mockRequestWithUrl = {
        ...mockRequest,
        url: 'https://example.com/api/party/1/invite'
      };
    });

    it('should return 401 if session is invalid', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { 'content-type': 'application/json' }
        })
      });

      const response = await handleRegenerateInvite(mockRequestWithUrl, mockEnv, 1);
      expect(response.status).toBe(401);
    });

    it('should return 404 if party not found', async () => {
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleRegenerateInvite(mockRequestWithUrl, mockEnv, 999);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Party not found');
    });

    it('should return 400 if party is dissolved', async () => {
      const mockFirst = jest.fn().mockResolvedValue({
        id: 1, leader_id: 1, dissolved_at: '2026-01-01T00:00:00Z'
      });
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleRegenerateInvite(mockRequestWithUrl, mockEnv, 1);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('This party has been dissolved');
    });

    it('should return 403 if user is not the leader', async () => {
      const mockFirst = jest.fn().mockResolvedValue({
        id: 1, leader_id: 999, dissolved_at: null
      });
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleRegenerateInvite(mockRequestWithUrl, mockEnv, 1);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Only the party leader');
    });

    it('should regenerate invite code and return code + URL', async () => {
      const mockRun = jest.fn().mockResolvedValue({ meta: { changes: 1 } });
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, leader_id: 1, dissolved_at: null }) // party lookup
        .mockResolvedValueOnce(null); // pre-check uniqueness
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst, run: mockRun });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleRegenerateInvite(mockRequestWithUrl, mockEnv, 1);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.inviteCode).toBeDefined();
      expect(data.inviteCode).toMatch(/^[A-Za-z0-9]{8}$/);
      expect(data.inviteUrl).toContain('https://example.com/party/join/');
      expect(data.inviteUrl).toContain(data.inviteCode);
    });

    it('should handle database errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const mockBind = jest.fn().mockReturnValue({
          first: jest.fn().mockRejectedValue(new Error('DB error'))
        });
        mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

        const response = await handleRegenerateInvite(mockRequestWithUrl, mockEnv, 1);
        expect(response.status).toBe(500);
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('should return 409 after exhausting uniqueness retries', async () => {
      // Party lookup succeeds, all pre-checks find existing codes
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, leader_id: 1, dissolved_at: null }) // party lookup
        .mockResolvedValue({ id: 99 }); // all pre-checks find collision
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleRegenerateInvite(mockRequestWithUrl, mockEnv, 1);
      expect(response.status).toBe(409);
    });
  });

  describe('handleGetUserParties', () => {
    it('should return 401 if session is invalid', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { 'content-type': 'application/json' }
        })
      });

      const requestWithUrl = { ...mockRequest, url: 'https://example.com/api/user/parties' };
      const response = await handleGetUserParties(requestWithUrl, mockEnv);
      expect(response.status).toBe(401);
    });

    it('should return active party memberships excluding dissolved', async () => {
      const mockParties = [
        { id: 1, name: 'Party A', role: 'leader', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 3 },
        { id: 2, name: 'Party B', role: 'member', distance_mode: 'cumulative', leave_distance_behavior: 'remove', dissolved_at: null, active_member_count: 5 }
      ];

      const mockAll = jest.fn().mockResolvedValue({ results: mockParties });
      const mockBind = jest.fn().mockReturnValue({ all: mockAll });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const requestWithUrl = { ...mockRequest, url: 'https://example.com/api/user/parties' };
      const response = await handleGetUserParties(requestWithUrl, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.parties).toHaveLength(2);
      expect(data.parties[0].name).toBe('Party A');
      expect(data.parties[1].name).toBe('Party B');
    });

    it('should include dissolved parties when include_dissolved=true', async () => {
      const mockParties = [
        { id: 1, name: 'Active Party', role: 'member', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 3 },
        { id: 2, name: 'Dissolved Party', role: 'member', distance_mode: 'cumulative', leave_distance_behavior: 'keep', dissolved_at: '2026-01-01T00:00:00Z', active_member_count: 0 }
      ];

      const mockAll = jest.fn().mockResolvedValue({ results: mockParties });
      const mockBind = jest.fn().mockReturnValue({ all: mockAll });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const requestWithUrl = { ...mockRequest, url: 'https://example.com/api/user/parties?include_dissolved=true' };
      const response = await handleGetUserParties(requestWithUrl, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.parties).toHaveLength(2);
    });

    it('should return empty array when user has no parties', async () => {
      const mockAll = jest.fn().mockResolvedValue({ results: [] });
      const mockBind = jest.fn().mockReturnValue({ all: mockAll });
      mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

      const requestWithUrl = { ...mockRequest, url: 'https://example.com/api/user/parties' };
      const response = await handleGetUserParties(requestWithUrl, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.parties).toHaveLength(0);
    });

    it('should handle database errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const mockBind = jest.fn().mockReturnValue({
          all: jest.fn().mockRejectedValue(new Error('DB error'))
        });
        mockEnv.DB.prepare.mockReturnValue({ bind: mockBind });

        const requestWithUrl = { ...mockRequest, url: 'https://example.com/api/user/parties' };
        const response = await handleGetUserParties(requestWithUrl, mockEnv);
        expect(response.status).toBe(500);
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });
});
