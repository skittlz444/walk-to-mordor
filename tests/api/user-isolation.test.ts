/**
 * User Isolation Tests
 * 
 * These tests verify that:
 * 1. Users cannot view each other's progress entries
 * 2. Users cannot update/delete each other's entries
 * 3. Total distance is correctly calculated per user
 * 4. Two users can have different distances for the same date
 */

import { 
  handleProgressPost, 
  handleProgressPut, 
  handleProgressDelete, 
  handleProgressGet 
} from '../../src/progress-handlers';
import { calculateTotalDistance } from '../../src/goals-handlers';
import { validateSession } from '../../src/auth-handlers';
import { DbClient } from '../../src/db';

// Mock dependencies
jest.mock('../../src/auth-handlers');
jest.mock('../../src/validators', () => ({
  ...jest.requireActual('../../src/validators'),
  isValidDateFormat: jest.fn(),
  isValidDistance: jest.fn(),
}));

const validators = require('../../src/validators');

describe('User Isolation', () => {
  let mockDB: any;
  let mockDb: DbClient;
  let mockRequest1: any;
  let mockRequest2: any;
  let user1Id = 1;
  let user2Id = 2;
  let mockDataStore: Map<string, any>;

  // SQL query constants for more maintainable mocking
  const SQL_INSERT_PROGRESS = 'INSERT INTO progress (date, distance, user_id) VALUES (?, ?, ?)';
  const SQL_UPDATE_PROGRESS = 'UPDATE progress SET distance = ? WHERE date = ? AND user_id = ?';
  const SQL_DELETE_PROGRESS = 'DELETE FROM progress WHERE date = ? AND user_id = ?';
  const SQL_SELECT_PROGRESS = 'SELECT * FROM progress WHERE user_id = ?';
  const SQL_SELECT_PROGRESS_ROW = 'SELECT distance FROM progress WHERE date = ? AND user_id = ?';
  const SQL_UPDATE_USER_DISTANCE = 'UPDATE users SET active_storyline_distance_km = MAX(active_storyline_distance_km + ?, 0) WHERE id = ?';
  const SQL_SELECT_USER_DISTANCE = 'SELECT active_storyline_distance_km AS total FROM users WHERE id = ?';
  const SQL_SELECT_ACTIVE_MEMBERSHIPS = 'SELECT party_id FROM party_members WHERE user_id = ? AND status = ?';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup validators to always return true
    validators.isValidDateFormat.mockReturnValue(true);
    validators.isValidDistance.mockReturnValue(true);

    // Simple in-memory database mock using structured composite keys
    mockDataStore = new Map();
    // Per-user cumulative distance on their active storyline.
    // Mirrors users.active_storyline_distance_km from the multi-storyline schema.
    const userDistanceStore = new Map<number, number>();

    // Mock DB with in-memory storage
    mockDB = {
      prepare: jest.fn((sql: string) => {
          return {
            bind: jest.fn((...params: any[]) => {
              // Helper to create composite key from userId and date
              const createKey = (userId: number, date: string) => 
                JSON.stringify({ userId, date });
              
              // Helper to parse composite key
              const parseKey = (key: string) => JSON.parse(key);
              
              return {
                run: jest.fn(async () => {
                  // Simulate INSERT
                  if (sql === SQL_INSERT_PROGRESS) {
                    const [date, distance, userId] = params;
                    const key = createKey(userId, date);
                    if (mockDataStore.has(key)) {
                      throw new Error('UNIQUE constraint failed');
                    }
                    mockDataStore.set(key, { date, distance, user_id: userId, id: mockDataStore.size + 1 });
                    return { meta: { changes: 1, last_row_id: mockDataStore.size } };
                  }
                  
                  // Simulate UPDATE
                  if (sql === SQL_UPDATE_PROGRESS) {
                    const [distance, date, userId] = params;
                    const key = createKey(userId, date);
                    if (mockDataStore.has(key)) {
                      const entry = mockDataStore.get(key);
                      entry.distance = distance;
                      return { meta: { changes: 1 } };
                    }
                    return { meta: { changes: 0 } };
                  }
                  
                  // Simulate DELETE
                  if (sql === SQL_DELETE_PROGRESS) {
                    const [date, userId] = params;
                    const key = createKey(userId, date);
                    if (mockDataStore.has(key)) {
                      mockDataStore.delete(key);
                      return { meta: { changes: 1 } };
                    }
                    return { meta: { changes: 0 } };
                  }

                  // Simulate UPDATE users SET active_storyline_distance_km = ...
                  if (sql === SQL_UPDATE_USER_DISTANCE) {
                    const [delta, userId] = params;
                    const current = userDistanceStore.get(userId) ?? 0;
                    userDistanceStore.set(userId, Math.max(current + delta, 0));
                    return { meta: { changes: 1 } };
                  }

                  return { meta: { changes: 0 } };
                }),
                all: jest.fn(async () => {
                  // Simulate SELECT with user_id filter
                  if (sql === SQL_SELECT_PROGRESS) {
                    const [userId] = params;
                    const results: any[] = [];
                    mockDataStore.forEach((value, key) => {
                      const parsed = parseKey(key);
                      if (parsed.userId === userId) {
                        results.push(value);
                      }
                    });
                    return { results };
                  }
                  // Active party memberships — none in this isolation test.
                  if (sql === SQL_SELECT_ACTIVE_MEMBERSHIPS) {
                    return { results: [] };
                  }
                  return { results: [] };
                }),
                first: jest.fn(async () => {
                  // Pre-write read for delta computation in PUT/DELETE handlers.
                  if (sql === SQL_SELECT_PROGRESS_ROW) {
                    const [date, userId] = params;
                    const key = createKey(userId, date);
                    const entry = mockDataStore.get(key);
                    return entry ? { distance: entry.distance } : null;
                  }
                  // Read of users.active_storyline_distance_km (calculateTotalDistance).
                  if (sql === SQL_SELECT_USER_DISTANCE) {
                    const [userId] = params;
                    return { total: userDistanceStore.get(userId) ?? 0 };
                  }
                  return null;
                })
              };
            })
          };
        })
    };
    mockDb = { read: mockDB as unknown as D1Database, write: mockDB as unknown as D1Database };

    // Mock requests for two different users
    mockRequest1 = {
      headers: {
        get: jest.fn(() => 'Bearer token1')
      }
    };

    mockRequest2 = {
      headers: {
        get: jest.fn(() => 'Bearer token2')
      }
    };

    // Mock validateSession to return different users
    (validateSession as jest.Mock).mockImplementation(async (request: any) => {
      if (request === mockRequest1) {
        return { valid: true, userId: user1Id };
      } else if (request === mockRequest2) {
        return { valid: true, userId: user2Id };
      }
      return { valid: false, error: new Response('Unauthorized', { status: 401 }) };
    });
  });

  describe('Progress Entry Isolation', () => {
    it('should allow two users to have different distances for the same date', async () => {
      // User 1 adds 5.5 km on 2024-01-01
      const response1 = await handleProgressPost(mockRequest1, mockDb, {
        start: '2024-01-01',
        title: '5.5'
      });
      expect(response1.status).toBe(201);

      // User 2 adds 10.2 km on the same date
      const response2 = await handleProgressPost(mockRequest2, mockDb, {
        start: '2024-01-01',
        title: '10.2'
      });
      expect(response2.status).toBe(201);

      // Verify both entries exist with proper composite keys
      expect(mockDataStore.size).toBe(2);
      const key1 = JSON.stringify({ userId: 1, date: '2024-01-01' });
      const key2 = JSON.stringify({ userId: 2, date: '2024-01-01' });
      expect(mockDataStore.get(key1)).toEqual({
        date: '2024-01-01',
        distance: 5.5,
        user_id: 1,
        id: 1
      });
      expect(mockDataStore.get(key2)).toEqual({
        date: '2024-01-01',
        distance: 10.2,
        user_id: 2,
        id: 2
      });
    });

    it('should only return progress entries for the authenticated user', async () => {
      // Add entries for both users
      await handleProgressPost(mockRequest1, mockDb, {
        start: '2024-01-01',
        title: '5.5'
      });
      await handleProgressPost(mockRequest1, mockDb, {
        start: '2024-01-02',
        title: '3.2'
      });
      await handleProgressPost(mockRequest2, mockDb, {
        start: '2024-01-01',
        title: '10.2'
      });

      // User 1 should only see their own entries
      const response1 = await handleProgressGet(mockRequest1, mockDb);
      const data1 = await response1.json();
      expect(data1).toHaveLength(2);
      expect(data1).toEqual([
        { start: '2024-01-01', title: '5.5' },
        { start: '2024-01-02', title: '3.2' }
      ]);

      // User 2 should only see their own entry
      const response2 = await handleProgressGet(mockRequest2, mockDb);
      const data2 = await response2.json();
      expect(data2).toHaveLength(1);
      expect(data2).toEqual([
        { start: '2024-01-01', title: '10.2' }
      ]);
    });

    it('should not allow user to update another user\'s entry', async () => {
      // User 1 creates an entry
      await handleProgressPost(mockRequest1, mockDb, {
        start: '2024-01-01',
        title: '5.5'
      });

      // User 2 attempts to update User 1's entry (should fail because they don't have one)
      const response = await handleProgressPut(mockRequest2, mockDb, {
        start: '2024-01-01',
        title: '99.9'
      });
      
      expect(response.status).toBe(404);
      
      // Verify User 1's entry is unchanged using proper composite key
      const key1 = JSON.stringify({ userId: 1, date: '2024-01-01' });
      expect(mockDataStore.get(key1).distance).toBe(5.5);
    });

    it('should not allow user to delete another user\'s entry', async () => {
      // User 1 creates an entry
      await handleProgressPost(mockRequest1, mockDb, {
        start: '2024-01-01',
        title: '5.5'
      });

      // User 2 attempts to delete User 1's entry (should fail)
      const response = await handleProgressDelete(mockRequest2, mockDb, {
        start: '2024-01-01'
      });
      
      expect(response.status).toBe(404);
      
      // Verify User 1's entry still exists using proper composite key
      const key1 = JSON.stringify({ userId: 1, date: '2024-01-01' });
      expect(mockDataStore.has(key1)).toBe(true);
    });
  });

  describe('Total Distance Calculation Isolation', () => {
    it('should calculate total distance only for specific user', async () => {
      // User 1 adds multiple entries
      await handleProgressPost(mockRequest1, mockDb, {
        start: '2024-01-01',
        title: '5.5'
      });
      await handleProgressPost(mockRequest1, mockDb, {
        start: '2024-01-02',
        title: '3.2'
      });

      // User 2 adds entries
      await handleProgressPost(mockRequest2, mockDb, {
        start: '2024-01-01',
        title: '10.0'
      });
      await handleProgressPost(mockRequest2, mockDb, {
        start: '2024-01-03',
        title: '7.5'
      });

      // Calculate totals with floating-point comparison tolerance
      const total1 = await calculateTotalDistance(mockDb, user1Id);
      const total2 = await calculateTotalDistance(mockDb, user2Id);

      // Verify totals are correct and isolated (using toBeCloseTo for floating-point safety)
      expect(total1).toBeCloseTo(8.7, 2); // 5.5 + 3.2, tolerance of 2 decimal places
      expect(total2).toBeCloseTo(17.5, 2); // 10.0 + 7.5, tolerance of 2 decimal places
    });

    it('should return 0 for user with no entries', async () => {
      // User 1 adds entries
      await handleProgressPost(mockRequest1, mockDb, {
        start: '2024-01-01',
        title: '5.5'
      });

      // User 2 has no entries
      const total2 = await calculateTotalDistance(mockDb, user2Id);
      expect(total2).toBeCloseTo(0, 2);
    });
  });

  describe('User Can Update Their Own Entries', () => {
    it('should allow user to update their own entry', async () => {
      // User 1 creates an entry
      await handleProgressPost(mockRequest1, mockDb, {
        start: '2024-01-01',
        title: '5.5'
      });

      // User 1 updates their own entry
      const response = await handleProgressPut(mockRequest1, mockDb, {
        start: '2024-01-01',
        title: '7.5'
      });
      
      expect(response.status).toBe(200);
      const key1 = JSON.stringify({ userId: 1, date: '2024-01-01' });
      expect(mockDataStore.get(key1).distance).toBe(7.5);
    });

    it('should allow user to delete their own entry', async () => {
      // User 1 creates an entry
      await handleProgressPost(mockRequest1, mockDb, {
        start: '2024-01-01',
        title: '5.5'
      });

      // User 1 deletes their own entry
      const response = await handleProgressDelete(mockRequest1, mockDb, {
        start: '2024-01-01'
      });
      
      expect(response.status).toBe(200);
      const key1 = JSON.stringify({ userId: 1, date: '2024-01-01' });
      expect(mockDataStore.has(key1)).toBe(false);
    });
  });

  describe('Composite Unique Constraint', () => {
    it('should prevent user from creating duplicate entry for same date', async () => {
      // User 1 creates an entry
      await handleProgressPost(mockRequest1, mockDb, {
        start: '2024-01-01',
        title: '5.5'
      });

      // User 1 attempts to create another entry for same date
      const response = await handleProgressPost(mockRequest1, mockDb, {
        start: '2024-01-01',
        title: '7.5'
      });
      
      expect(response.status).toBe(409);
    });

    it('should allow different users to have entries for same date', async () => {
      // User 1 creates an entry
      const response1 = await handleProgressPost(mockRequest1, mockDb, {
        start: '2024-01-01',
        title: '5.5'
      });
      expect(response1.status).toBe(201);

      // User 2 creates an entry for same date (should succeed)
      const response2 = await handleProgressPost(mockRequest2, mockDb, {
        start: '2024-01-01',
        title: '10.0'
      });
      expect(response2.status).toBe(201);
      
      // Both entries should exist
      expect(mockDataStore.size).toBe(2);
    });
  });
});
