import {
  handleJournalStateGet,
  handleJournalUpsert,
  handleJournalDelete,
} from '../../src/journal-handlers';
import { DbClient } from '../../src/db';

// Mock validateSession
jest.mock('../../src/auth-handlers', () => ({
  validateSession: jest.fn(),
}));

import { validateSession } from '../../src/auth-handlers';

// ── Helpers ────────────────────────────────────────────────────────────────

function mockDbClient(): { db: DbClient; mockDB: { prepare: jest.Mock } } {
  const mockDB = { prepare: jest.fn() };
  const db: DbClient = {
    read: mockDB as unknown as D1Database,
    write: mockDB as unknown as D1Database,
  };
  return { db, mockDB };
}

function mockFirst(mockDB: { prepare: jest.Mock }, value: unknown) {
  mockDB.prepare.mockReturnValueOnce({
    bind: jest.fn().mockReturnValue({
      first: jest.fn(() => Promise.resolve(value)),
    }),
  });
}

function mockAll(mockDB: { prepare: jest.Mock }, results: unknown[]) {
  mockDB.prepare.mockReturnValueOnce({
    bind: jest.fn().mockReturnValue({
      all: jest.fn(() => Promise.resolve({ results })),
    }),
  });
}

function mockRun(mockDB: { prepare: jest.Mock }, changes = 1, lastRowId?: number) {
  mockDB.prepare.mockReturnValueOnce({
    bind: jest.fn().mockReturnValue({
      run: jest.fn(() => Promise.resolve({
        meta: { changes, last_row_id: lastRowId ?? 0 },
      })),
    }),
  });
}

function createRequest(path: string, headers?: Record<string, string>): Request {
  return new Request(`https://example.com${path}`, {
    headers: { 'Authorization': 'Bearer mock-token', ...headers },
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Journal Handlers', () => {
  let db: DbClient;
  let mockDB: { prepare: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    const client = mockDbClient();
    db = client.db;
    mockDB = client.mockDB;
    (validateSession as jest.Mock).mockResolvedValue({ valid: true, userId: 1 });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // handleJournalStateGet
  // ═══════════════════════════════════════════════════════════════════════

  describe('handleJournalStateGet', () => {
    it('returns empty journal state when no entries exist', async () => {
      // Own entry lookup → null
      mockFirst(mockDB, null);
      // Resolve user storyline → mock storyline context
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      // Goal storyline distance
      mockFirst(mockDB, { distance: 100 });
      // Progress total
      mockAll(mockDB, [{ total: 80 }]);
      // No active party memberships (hasAnyFellowshipReachedGoal fallback)
      mockAll(mockDB, []);
      // Accepted friend IDs
      mockAll(mockDB, []);

      const req = createRequest('/api/goals/5/journals');
      const resp = await handleJournalStateGet(req, db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(200);
      expect(data.ownEntry).toBeNull();
      expect(data.friendEntries).toEqual([]);
      expect(data.permissions.canWrite).toBe(false);
      expect(data.permissions.canEditOwn).toBe(false);
      expect(data.permissions.canDeleteOwn).toBe(false);
      expect(data.permissions.canReadFriends).toBe(false);
    });

    it('returns own entry when one exists', async () => {
      const ownEntry = {
        id: 1, user_id: 1, goal_id: 5,
        body: 'What a beautiful milestone!',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      mockFirst(mockDB, ownEntry);
      // Storyline context
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      // Goal storyline distance
      mockFirst(mockDB, { distance: 100 });
      // Progress total
      mockAll(mockDB, [{ total: 150 }]);
      // No active party memberships (hasAnyFellowshipReachedGoal fallback)
      mockAll(mockDB, []);
      // Accepted friend IDs
      mockAll(mockDB, []);

      const req = createRequest('/api/goals/5/journals');
      const resp = await handleJournalStateGet(req, db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(200);
      expect(data.ownEntry).toBeTruthy();
      expect(data.ownEntry.body).toBe('What a beautiful milestone!');
      expect(data.permissions.canEditOwn).toBe(true);
      expect(data.permissions.canDeleteOwn).toBe(true);
    });

    it('grants write access when user has reached goal', async () => {
      // No own entry
      mockFirst(mockDB, null);
      // Storyline context
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      // Goal storyline distance
      mockFirst(mockDB, { distance: 100 });
      // Progress total >= goal distance
      mockAll(mockDB, [{ total: 150 }]);
      // No active party memberships (hasAnyFellowshipReachedGoal fallback)
      mockAll(mockDB, []);
      // Accepted friend IDs
      mockAll(mockDB, []);

      const req = createRequest('/api/goals/5/journals');
      const resp = await handleJournalStateGet(req, db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(200);
      expect(data.permissions.canWrite).toBe(true);
    });

    it('denies write access when user has not reached goal', async () => {
      mockFirst(mockDB, null);
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      mockFirst(mockDB, { distance: 100 });
      mockAll(mockDB, [{ total: 50 }]);
      // No active party memberships (hasAnyFellowshipReachedGoal fallback)
      mockAll(mockDB, []);
      mockAll(mockDB, []);

      const req = createRequest('/api/goals/5/journals');
      const resp = await handleJournalStateGet(req, db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(200);
      expect(data.permissions.canWrite).toBe(false);
    });

    it('returns visible friend entries when previews are enabled', async () => {
      // Own entry
      mockFirst(mockDB, null);
      // Storyline context
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      // Goal storyline distance
      mockFirst(mockDB, { distance: 100 });
      // Progress total
      mockAll(mockDB, [{ total: 80 }]);
      // No active party memberships (hasAnyFellowshipReachedGoal fallback)
      mockAll(mockDB, []);
      // Accepted friend IDs (single call, reused for permissions + visibility)
      mockAll(mockDB, [{ friend_id: 2 }]);
      // Milestone previews enabled
      mockFirst(mockDB, { show_future_goals_unlocked: 1 });
      // Friend journal entries
      mockAll(mockDB, [{
        body: 'Friend entry!',
        created_at: '2026-01-02T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        user_id: 2,
        username: 'friend1',
        avatar_id: null,
      }]);

      const req = createRequest('/api/goals/5/journals');
      const resp = await handleJournalStateGet(req, db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(200);
      expect(data.permissions.canReadFriends).toBe(true);
      expect(data.friendEntries).toHaveLength(1);
      expect(data.friendEntries[0].username).toBe('friend1');
    });

    it('hides friend entries when previews are locked and viewer has not reached goal', async () => {
      mockFirst(mockDB, null);
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      mockFirst(mockDB, { distance: 100 });
      mockAll(mockDB, [{ total: 50 }]);
      // No active party memberships (hasAnyFellowshipReachedGoal fallback)
      mockAll(mockDB, []);
      // Accepted friend IDs (single call, reused for permissions + visibility)
      mockAll(mockDB, [{ friend_id: 2 }]);
      // Milestone previews locked
      mockFirst(mockDB, { show_future_goals_unlocked: 0 });
      // getFriendJournalEntries called with empty array → returns [] without DB call

      const req = createRequest('/api/goals/5/journals');
      const resp = await handleJournalStateGet(req, db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(200);
      expect(data.canReadFriends !== undefined);
      expect(data.friendEntries).toEqual([]);
    });

    it('rejects unauthenticated requests', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      });

      const req = createRequest('/api/goals/5/journals');
      const resp = await handleJournalStateGet(req, db, 5);

      expect(resp.status).toBe(401);
    });

    it('validates partyId and rejects non-member', async () => {
      // isActivePartyMember check → null (not a member)
      mockFirst(mockDB, null);

      const req = createRequest('/api/goals/5/journals?partyId=99');
      const resp = await handleJournalStateGet(req, db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(403);
      expect(data.error).toContain('not an active member');
    });

    it('grants fellowship access via any active party when no partyId specified', async () => {
      // Own entry → null
      mockFirst(mockDB, null);
      // Personal reach check: storyline context
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      // Goal storyline distance
      mockFirst(mockDB, { distance: 100 });
      // Progress total < goal distance (personal reach fails)
      mockAll(mockDB, [{ total: 50 }]);
      // hasAnyFellowshipReachedGoal: active party memberships → found one
      mockAll(mockDB, [{ party_id: 42 }]);
      // hasFellowshipReachedGoal: resolvePartyStoryline
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      // Goal storyline distance (for party check)
      mockFirst(mockDB, { distance: 100 });
      // Party distance_mode
      mockFirst(mockDB, { distance_mode: 'incremental' });
      // computePartyTotalDistance: active members
      mockAll(mockDB, [{
        user_id: 10, display_name: 'Frodo', distance_at_join: 0,
        joined_at: '2025-01-01', avatar_id: null, total_distance: 200,
      }]);
      // computePartyTotalDistance: departed members
      mockAll(mockDB, []);
      // computePartyTotalDistance: resolvePartyStoryline again
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      // Accepted friend IDs
      mockAll(mockDB, []);

      const req = createRequest('/api/goals/5/journals');
      const resp = await handleJournalStateGet(req, db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(200);
      expect(data.permissions.canWrite).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // handleJournalUpsert
  // ═══════════════════════════════════════════════════════════════════════

  describe('handleJournalUpsert', () => {
    it('creates a new journal entry', async () => {
      // Personal reach: storyline context
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      // Goal storyline distance
      mockFirst(mockDB, { distance: 100 });
      // Progress total >= goal distance
      mockAll(mockDB, [{ total: 150 }]);
      // Check existing entry → null (not found)
      mockFirst(mockDB, null);
      // Insert new entry
      mockRun(mockDB, 1, 10);

      const req = createRequest('/api/goals/5/journal');
      const resp = await handleJournalUpsert(req, db, 5, {
        body: 'My first journal entry!',
      });
      const data = await resp.json();

      expect(resp.status).toBe(201);
      expect(data.message).toBe('Journal entry saved');
      expect(data.entry.body).toBe('My first journal entry!');
    });

    it('updates an existing journal entry', async () => {
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      mockFirst(mockDB, { distance: 100 });
      mockAll(mockDB, [{ total: 150 }]);
      // Existing entry found
      mockFirst(mockDB, { id: 10 });
      // Read created_at for preserving original timestamp
      mockFirst(mockDB, { created_at: '2026-01-15T00:00:00Z' });
      // Update
      mockRun(mockDB, 1);

      const req = createRequest('/api/goals/5/journal');
      const resp = await handleJournalUpsert(req, db, 5, {
        body: 'Updated entry text.',
      });
      const data = await resp.json();

      expect(resp.status).toBe(200);
      expect(data.message).toBe('Journal entry saved');
      expect(data.entry.body).toBe('Updated entry text.');
    });

    it('rejects empty body', async () => {
      const req = createRequest('/api/goals/5/journal');
      const resp = await handleJournalUpsert(req, db, 5, { body: '   ' });
      const data = await resp.json();

      expect(resp.status).toBe(400);
      expect(data.error).toContain('cannot be empty');
    });

    it('rejects body exceeding 2000 characters', async () => {
      const req = createRequest('/api/goals/5/journal');
      const resp = await handleJournalUpsert(req, db, 5, {
        body: 'x'.repeat(2001),
      });
      const data = await resp.json();

      expect(resp.status).toBe(400);
      expect(data.error).toContain('2000');
    });

    it('rejects missing body field', async () => {
      const req = createRequest('/api/goals/5/journal');
      const resp = await handleJournalUpsert(req, db, 5, {});
      const data = await resp.json();

      expect(resp.status).toBe(400);
      expect(data.error).toContain('Missing required field');
    });

    it('denies write when user has not reached goal', async () => {
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      mockFirst(mockDB, { distance: 100 });
      mockAll(mockDB, [{ total: 50 }]);
      // No active party memberships (hasAnyFellowshipReachedGoal fallback)
      mockAll(mockDB, []);

      const req = createRequest('/api/goals/5/journal');
      const resp = await handleJournalUpsert(req, db, 5, {
        body: 'Should not be saved',
      });
      const data = await resp.json();

      expect(resp.status).toBe(403);
      expect(data.error).toContain('must reach this goal');
    });

    it('allows write via fellowship context with partyId', async () => {
      // Personal reach check (fails): storyline context
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      // Goal storyline distance
      mockFirst(mockDB, { distance: 100 });
      // Progress total < goal distance (personal reach fails)
      mockAll(mockDB, [{ total: 50 }]);
      // isActivePartyMember → yes
      mockFirst(mockDB, { role: 'member' });
      // hasFellowshipReachedGoal: resolvePartyStoryline → full StorylineContextRow
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      // Goal storyline distance (for fellowship check)
      mockFirst(mockDB, { distance: 100 });
      // Party distance_mode lookup
      mockFirst(mockDB, { distance_mode: 'incremental' });
      // computePartyTotalDistance: active members query
      mockAll(mockDB, [{
        user_id: 10, display_name: 'Frodo', distance_at_join: 0,
        joined_at: '2025-01-01', avatar_id: null, total_distance: 150,
      }]);
      // computePartyTotalDistance: departed members query
      mockAll(mockDB, []);
      // computePartyTotalDistance: resolvePartyStoryline again
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      // Check existing entry → null
      mockFirst(mockDB, null);
      // Insert
      mockRun(mockDB, 1, 11);

      const req = createRequest('/api/goals/5/journal');
      const resp = await handleJournalUpsert(req, db, 5, {
        body: 'Written via fellowship!',
        partyId: 99,
      });
      const data = await resp.json();

      expect(resp.status).toBe(201);
      expect(data.message).toBe('Journal entry saved');
    });

    it('rejects fellowship write when not a member', async () => {
      // Personal reach check (fails): storyline context
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      // Goal storyline distance
      mockFirst(mockDB, { distance: 100 });
      // Progress total < goal distance (personal reach fails)
      mockAll(mockDB, [{ total: 50 }]);
      // isActivePartyMember → no
      mockFirst(mockDB, null);

      const req = createRequest('/api/goals/5/journal');
      const resp = await handleJournalUpsert(req, db, 5, {
        body: 'Should not work',
        partyId: 99,
      });
      const data = await resp.json();

      expect(resp.status).toBe(403);
      expect(data.error).toContain('not an active member');
    });

    it('allows write via any active party when no partyId provided', async () => {
      // Personal reach check (fails): storyline context
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      // Goal storyline distance
      mockFirst(mockDB, { distance: 100 });
      // Progress total < goal distance (personal reach fails)
      mockAll(mockDB, [{ total: 50 }]);
      // hasAnyFellowshipReachedGoal: active party memberships → found one
      mockAll(mockDB, [{ party_id: 42 }]);
      // hasFellowshipReachedGoal: resolvePartyStoryline
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      // Goal storyline distance (for party check)
      mockFirst(mockDB, { distance: 100 });
      // Party distance_mode
      mockFirst(mockDB, { distance_mode: 'incremental' });
      // computePartyTotalDistance: active members
      mockAll(mockDB, [{
        user_id: 10, display_name: 'Frodo', distance_at_join: 0,
        joined_at: '2025-01-01', avatar_id: null, total_distance: 200,
      }]);
      // computePartyTotalDistance: departed members
      mockAll(mockDB, []);
      // computePartyTotalDistance: resolvePartyStoryline again
      mockFirst(mockDB, {
        id: 1, slug: 'frodo-sam', title: 'Frodo & Sam', description: null,
        path_key: 'fellowship', sort_order: 0, is_active: 1, admin_only: 0,
        storyline_distance_offset: 0,
      });
      // Check existing entry → null
      mockFirst(mockDB, null);
      // Insert
      mockRun(mockDB, 1, 11);

      const req = createRequest('/api/goals/5/journal');
      const resp = await handleJournalUpsert(req, db, 5, {
        body: 'Written via any fellowship!',
      });
      const data = await resp.json();

      expect(resp.status).toBe(201);
      expect(data.message).toBe('Journal entry saved');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // handleJournalDelete
  // ═══════════════════════════════════════════════════════════════════════

  describe('handleJournalDelete', () => {
    it('deletes an existing journal entry', async () => {
      mockRun(mockDB, 1);

      const req = createRequest('/api/goals/5/journal');
      const resp = await handleJournalDelete(req, db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(200);
      expect(data.message).toBe('Journal entry deleted');
    });

    it('returns 404 when no entry exists', async () => {
      mockRun(mockDB, 0);

      const req = createRequest('/api/goals/5/journal');
      const resp = await handleJournalDelete(req, db, 5);
      const data = await resp.json();

      expect(resp.status).toBe(404);
      expect(data.error).toContain('No journal entry');
    });
  });
});
